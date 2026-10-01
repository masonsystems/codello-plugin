import type { EngineInterface, Register } from 'claude-code'

import type { BridgeLink, BridgeSend, BridgeTurn } from '../types'
import {
  BRIDGE_ORIGIN,
  EVENTS_PATH,
  INBOUND_PATH,
  POLL_WAIT_MS,
  parseInbound,
  type DeliveryRoute,
  type InboundSend,
  type OutboundEvent,
} from './wire'

// The codello-bridge mod (COD-1821). It carries Codello chat sends into the
// session without typing into the PTY, and tells the host when a turn starts
// and ends, when the conversation compacts, and when a usage window moves.
// The transcript stays chat's source of truth; this mod forwards no rows.
//
// It must never block or fail a turn: every hook calls `next(e)`, and every
// transport error is swallowed. Outside a Codello session the host's
// variables are absent, `link` is null, and the mod makes no calls at all.

const LINK = { plugin: 'codello-bridge', key: 'link' } as const
const TURN = { plugin: 'codello-bridge', key: 'turn' } as const
const IDLE: BridgeTurn = { isRunning: false, held: [] }

// Bounds what a host that is down can cost: older events fall off the front.
const MAX_QUEUE = 2_000
const MAX_BATCH = 200
const MAX_BACKOFF_MS = 5_000

// `undefined` until this load's session.start has looked; `null` when no host
// was configured, which turns every emit into nothing.
let link: BridgeLink | null | undefined
const queue: OutboundEvent[] = []
let isDraining = false
let seq = 0
// A fresh id per module load, so the host can see a hot reload in the stream.
const loadId = crypto.randomUUID()
// The main loop's turn, mirrored into session state on every change so a hot
// reload takes it up. Routing reads this copy synchronously: an await between
// reading the turn and acting on it would let the turn end in between.
let turn: BridgeTurn = IDLE

function emit($: EngineInterface, kind: string, fields: Record<string, unknown>): void {
  if (link === null) return
  seq += 1
  queue.push({ ...fields, seq, loadId, at: Date.now(), kind })
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
  void drain($)
}

function headers(target: BridgeLink): Record<string, string> {
  return { authorization: `Bearer ${target.token}`, 'content-type': 'application/json' }
}

// One POST in flight at a time, so the host receives events in emit order.
// A failed POST keeps the queue; the next emit or poll retries it.
async function drain($: EngineInterface): Promise<void> {
  if (isDraining || !link) return
  isDraining = true
  try {
    while (queue.length > 0 && link) {
      const batch = queue.slice(0, MAX_BATCH)
      const sent = await $.http
        .fetch(BRIDGE_ORIGIN + EVENTS_PATH, {
          method: 'POST',
          socketPath: link.socketPath,
          headers: headers(link),
          body: JSON.stringify({ events: batch }),
        })
        .then(
          res => res.ok,
          () => false,
        )
      if (!sent) return
      queue.splice(0, batch.length)
    }
  } finally {
    isDraining = false
  }
}

function wait($: EngineInterface, ms: number): Promise<void> {
  return new Promise(resolve => {
    $.clock.after(ms, resolve)
  })
}

function setTurn($: EngineInterface, next: BridgeTurn): void {
  turn = next
  void $.state.set(TURN, next).catch(() => undefined)
}

function report($: EngineInterface, id: string, via: DeliveryRoute, fields: Record<string, unknown>): void {
  emit($, 'delivery', { id, via, ...fields })
}

// A slash command only when the name is one the session has: `/tmp/x fails`
// is text. `$.prompt.submit` refuses any text that starts with `/`, so such
// text fails its delivery and the host types it into the PTY instead.
async function commandOf($: EngineInterface, text: string): Promise<{ name: string; args: string } | undefined> {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text)
  const name = match?.[1]
  if (name === undefined) return undefined
  const known = await $.command.list()
  return known.some(command => command.name === name) ? { name, args: match?.[2] ?? '' } : undefined
}

async function runCommand($: EngineInterface, send: BridgeSend, cause?: 'held'): Promise<void> {
  try {
    const command = await commandOf($, send.text)
    if (!command) throw new Error('not a command this session has')
    await $.command.run({ command: command.name, args: command.args })
    report($, send.id, 'command', { ok: true, cause })
  } catch (err) {
    report($, send.id, 'command', { ok: false, cause, error: String(err) })
  }
}

async function submitSend($: EngineInterface, send: BridgeSend, cause?: 'held'): Promise<void> {
  try {
    const entered = await $.prompt.submit({ text: send.text, asUser: true })
    report($, send.id, 'submit', { ok: entered.drop === undefined, cause, drop: entered.drop })
  } catch (err) {
    report($, send.id, 'submit', { ok: false, cause, error: String(err) })
  }
}

async function appendSend($: EngineInterface, send: BridgeSend, cause: 'tool-call' | 'aborted'): Promise<void> {
  try {
    const stored = await $.session.append({
      message: { type: 'user', content: [{ type: 'text', text: send.text }] },
    })
    report($, send.id, 'append', { ok: stored.deny === undefined, cause, deny: stored.deny })
  } catch (err) {
    report($, send.id, 'append', { ok: false, cause, error: String(err) })
  }
}

// Mid-turn sends are held, never appended on arrival: a row appended while
// the turn's last request is in flight is read by no request of that turn
// (measured in COD-1818), and it stays in the conversation, so submitting it
// again would put the words in front of the model twice. A held text send is
// appended from inside the next main tool call's hook, which the loop waits
// on before it stores the tool's result and builds the next request, so that
// request carries it. A turn that ends with sends still held submits each as
// a turn of its own; nothing was appended, so the model reads each send once.
// A command is never appended; a held one runs when the turn ends.
async function deliver($: EngineInterface, inbound: InboundSend): Promise<void> {
  let isCommand: boolean
  try {
    isCommand = (await commandOf($, inbound.text)) !== undefined
  } catch (err) {
    report($, inbound.id, 'submit', { ok: false, error: String(err) })
    return
  }
  const send: BridgeSend = { id: inbound.id, text: inbound.text, isCommand }
  if (turn.isRunning) {
    setTurn($, { ...turn, held: [...turn.held, send] })
    report($, send.id, 'hold', { ok: true })
    return
  }
  await (isCommand ? runCommand($, send) : submitSend($, send))
}

// The inbound half: one long poll at a time. The host answers as soon as a
// send is waiting, or empty after POLL_WAIT_MS. A hot reload drops this
// environment, and with it the loop; the new load's session.start starts
// another, and the host answers the superseded poll with 409.
async function pollLoop($: EngineInterface, target: BridgeLink): Promise<void> {
  let backoffMs = 250
  for (;;) {
    try {
      const res = await $.http.fetch(`${BRIDGE_ORIGIN}${INBOUND_PATH}?loadId=${loadId}&waitMs=${POLL_WAIT_MS}`, {
        socketPath: target.socketPath,
        headers: headers(target),
      })
      if (res.status === 409) return
      if (!res.ok) throw new Error(`poll ${res.status}`)
      backoffMs = 250
      for (const send of parseInbound(res.text)) await deliver($, send)
      void drain($)
    } catch {
      await wait($, backoffMs)
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
    }
  }
}

// Reads the host's address from the environment on a cold start, then unsets
// the token so no Bash child inherits it. A hot reload finds the token gone
// and takes the link the first load kept in session state.
async function resolveLink($: EngineInterface): Promise<BridgeLink | null> {
  const socketPath = await $.env.get('CODELLO_BRIDGE_SOCKET')
  const token = await $.env.get('CODELLO_BRIDGE_TOKEN')
  if (socketPath && token) {
    const found: BridgeLink = { socketPath, token }
    await $.state.set(LINK, found)
    // Best effort: a refused unset leaves the token inherited, not the link down.
    await $.env.set('CODELLO_BRIDGE_TOKEN', undefined).catch(() => undefined)
    return found
  }
  const kept = await $.state.get(LINK)
  return kept.value ?? null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      link = await resolveLink($)
      // A hot reload takes up the turn the last load left, held sends included.
      turn = (await $.state.get(TURN)).value ?? IDLE
    } catch {
      link = null
    }
    const started = await next(e)
    if (link) {
      const target = link
      emit($, 'session-start', { isInteractive: e.isInteractive })
      // Started from a timer so session.start, which the first prompt waits
      // on, returns at once.
      $.clock.after(0, () => void pollLoop($, target))
    }
    return started
  })

  on('session.end', async ($, e, next) => {
    emit($, 'session-end', { reason: e.reason })
    return next(e)
  })

  // Main loop only: a subagent's run raises no turn.start.
  on('turn.start', async ($, e, next) => {
    setTurn($, { ...turn, isRunning: true })
    emit($, 'turn-start', { turnId: e.turnId })
    return next(e)
  })

  // The one place a held text send is appended: the loop waits on this hook
  // before it stores the tool's result and builds the next request.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && turn.held.some(send => !send.isCommand)) {
      const texts = turn.held.filter(send => !send.isCommand)
      setTurn($, { ...turn, held: turn.held.filter(send => send.isCommand) })
      for (const send of texts) await appendSend($, send, 'tool-call')
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      // Read and cleared with no await between, so a send routed after this
      // sees an idle session and is submitted, not held.
      const sends = turn.held
      setTurn($, IDLE)
      for (const send of sends) {
        $.clock.after(0, () => {
          // Interrupted: the person is back at the prompt, so no text send
          // starts a turn. It goes in as a row the next turn reads.
          if (send.isCommand) void runCommand($, send, 'held')
          else if (e.isAborted) void appendSend($, send, 'aborted')
          else void submitSend($, send, 'held')
        })
      }
      emit($, 'turn-complete', { turnId: e.turnId, reason: e.reason, isAborted: e.isAborted })
    }
    return done
  })

  // Compaction rewrites the conversation without appending its rows
  // (measured in COD-1818), so the host learns of it here and rereads the
  // transcript.
  on('session.compact', async ($, e, next) => {
    const compacted = await next(e)
    if (e.agentId === undefined && compacted.skip === undefined) {
      emit($, 'compacted', { trigger: e.trigger })
    }
    return compacted
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      emit($, 'measure', {
        rateLimits: e.rateLimits.map(window => ({
          kind: window.kind,
          percentUsed: window.percentUsed,
          resetsAt: window.resetsAt,
        })),
      })
    }
    return next(e)
  })
}
