import { expect, mock, test } from 'claude-code/testing'
import type { HttpInit, On } from 'claude-code'

import type { BridgeTurn } from '../../types'

// `session.append` is not exercised here: on 2.1.287 the kit cannot stand in
// for the row store (a test hook that answers without `next` is skipped, and
// nothing lies beneath it). The append of a held send at the next tool call,
// and after an interrupt, is verified in a live session instead (COD-1821's
// PR records the run).

const SOCKET = '/tmp/codello-bridge-test/bridge.sock'
const TOKEN = 'test-token'
const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const SESSION_ID = 'c0de110a-0000-4000-8000-000000000001'

// A session Codello did not start: it has a home directory and none of the
// bridge variables, so it looks for a host at the discovery socket.
const HOME = '/home/e'
const HELLO = '/v1/hello'
const DISCOVERY_SOCKET = `${HOME}/.codetogo/bridge/ambient.sock`
// What a host hands such a session back: a socket of its own, and the token
// that socket accepts. A restarted host hands back a different one.
const OWN_SOCKET = '/tmp/codello-bridge-test/own.sock'
const OWN_TOKEN = 'own-token'
const NEXT_SOCKET = '/tmp/codello-bridge-test/next.sock'

const COMPLETE ={ answer: 'done', durationMs: 5, isAborted: false, turnId: 't1', reason: 'answer' } as const

interface Fetched {
  url: string
  init?: HttpInit
}

type Respond = (call: Fetched) => { status: number; text: string }

// Answers the engine's own work beneath the plugin, and the host's socket,
// which records each request and answers with `respond`.
// With `slowPoll`, that poll answers 30 ms late on `clock`.
function host(on: On, respond: Respond, slowPoll?: number, clock?: { sleep: (ms: number) => Promise<void> }): { calls: Fetched[]; unset: string[] } {
  const calls: Fetched[] = []
  const unset: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', ($, e) => {
    if (e.value === undefined) unset.push(e.name)
    return { value: undefined }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  // What the mod tells a host about a session the host did not start.
  on('session.id', () => ({ value: SESSION_ID }))
  on('session.cwd', () => ({ value: START.cwd }))
  let polls = 0
  on('http.fetch', async ($, e) => {
    calls.push({ url: e.url, init: e.init })
    if (e.url.includes('/v1/inbound')) polls += 1
    if (clock && polls === slowPoll && e.url.includes('/v1/inbound')) await clock.sleep(30)
    const { status, text } = respond({ url: e.url, init: e.init })
    return { value: { status, ok: status >= 200 && status < 300, headers: {}, text } }
  })
  return { calls, unset }
}

// The first poll answers with `sends`; the next is superseded, ending the loop.
function sendsOnce(sends: { id: string; text: string }[]): Respond {
  let polls = 0
  return call => {
    if (!call.url.includes('/v1/inbound')) return { status: 200, text: '{}' }
    polls += 1
    return polls === 1 ? { status: 200, text: JSON.stringify({ sends }) } : { status: 409, text: '' }
  }
}

const pollEnds: Respond = sendsOnce([])

function posted(calls: Fetched[]): string {
  return calls
    .filter(call => call.url.endsWith('/v1/events'))
    .map(call => String(call.init?.body))
    .join('\n')
}

test('with no host configured, events pass through and nothing is fetched', async ($, on) => {
  mock.env(on, {})
  const { calls } = host(on, pollEnds)
  await $.session.start(START)

  const started = await $.turn.start({ text: 'hi', turnId: 't1' })

  expect(started.turnId).toBe('t1')
  expect(calls.length).toBe(0)
})

test('turn start and end are posted to the host socket with the token, in order', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  const { calls } = host(on, pollEnds)
  await $.session.start(START)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(COMPLETE)
  await clock.advance(10)

  const posts = calls.filter(call => call.url.endsWith('/v1/events'))
  const body = posted(calls)
  expect(posts.length > 0).toBe(true)
  expect(posts.every(call => call.init?.socketPath === SOCKET)).toBe(true)
  expect(posts.every(call => call.init?.headers?.authorization === `Bearer ${TOKEN}`)).toBe(true)
  expect(body.indexOf('"kind":"session-start"') < body.indexOf('"kind":"turn-start"')).toBe(true)
  expect(body.indexOf('"kind":"turn-start"') < body.indexOf('"kind":"turn-complete"')).toBe(true)
})

test('the token and the socket path are unset so the agent’s children do not inherit them', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const { unset } = host(on, pollEnds)

  await $.session.start(START)

  expect(unset).toEqual(['CODELLO_BRIDGE_TOKEN', 'CODELLO_BRIDGE_SOCKET'])
})

test('a host that refuses the connection never fails the event', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', () => ({ value: undefined }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('http.fetch', () => {
    throw new Error('connect ENOENT')
  })
  await $.session.start(START)

  const started = await $.turn.start({ text: 'hi', turnId: 't1' })

  expect(started.turnId).toBe('t1')
})

test('a send polled while idle is submitted as the person’s own words', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  const { calls } = host(on, sendsOnce([{ id: 's1', text: 'line one\nline two' }]))
  on('command.list', () => ({ value: [] }))
  const submitted: { text: string; asUser?: true }[] = []
  on('prompt.submit', ($, e) => {
    submitted.push({ text: e.text, asUser: e.origin.kind === 'plugin' ? e.origin.asUser : undefined })
    return { text: e.text }
  })
  await $.session.start(START)
  await clock.advance(10)

  expect(submitted).toEqual([{ text: 'line one\nline two', asUser: true }])
  expect(posted(calls)).toContain('"id":"s1","via":"submit","ok":true')
})

test('a polled send naming a command the session has runs as that command', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  host(on, sendsOnce([{ id: 's1', text: '/compact keep the plan' }]))
  on('command.list', () => ({
    value: [{ name: 'compact', description: 'Compact the conversation', source: 'builtin' }],
  }))
  const ran: { command: string; args: string }[] = []
  on('command.run', ($, e) => {
    ran.push({ command: e.command, args: e.args })
    return {}
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start(START)
  await clock.advance(10)

  expect(ran).toEqual([{ command: 'compact', args: 'keep the plan' }])
})

test('a polled send that starts with a path, not a command, is not run as one', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  const { calls } = host(on, sendsOnce([{ id: 's1', text: '/tmp/x fails' }]))
  on('command.list', () => ({
    value: [{ name: 'compact', description: 'Compact the conversation', source: 'builtin' }],
  }))
  const ran: string[] = []
  on('command.run', ($, e) => {
    ran.push(e.command)
    return {}
  })
  await $.session.start(START)
  await clock.advance(10)

  // Not run as a command. `$.prompt.submit` refuses a leading slash too, so
  // the delivery reports a failure and the host falls back to typing it.
  expect(ran).toEqual([])
  expect(posted(calls)).toContain('"id":"s1","via":"submit","ok":false')
})

test('a send that arrives mid-turn with no tool call after it is held, then submitted once when the turn ends', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  const { calls } = host(on, sendsOnce([{ id: 's1', text: 'and the other thing' }]))
  on('command.list', () => ({ value: [] }))
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.session.start(START)
  await $.turn.start({ text: 'first', turnId: 't1' })
  await clock.advance(10)
  expect(submitted).toEqual([])
  expect(posted(calls)).toContain('"id":"s1","via":"hold","ok":true')

  await $.turn.complete(COMPLETE)
  await clock.advance(10)
  await $.turn.complete({ ...COMPLETE, turnId: 't2' })
  await clock.advance(10)

  expect(submitted).toEqual(['and the other thing'])
})

test('a command that arrives mid-turn runs once, when the turn ends', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  host(on, sendsOnce([{ id: 's1', text: '/compact' }]))
  on('command.list', () => ({
    value: [{ name: 'compact', description: 'Compact the conversation', source: 'builtin' }],
  }))
  const ran: string[] = []
  on('command.run', ($, e) => {
    ran.push(e.command)
    return {}
  })
  await $.session.start(START)
  await $.turn.start({ text: 'first', turnId: 't1' })
  await clock.advance(10)
  expect(ran).toEqual([])

  await $.turn.complete(COMPLETE)
  await clock.advance(10)

  expect(ran).toEqual(['compact'])
})

test('a usage window that moves is posted to the host', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  const { calls } = host(on, pollEnds)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.start(START)
  await $.session.measure({
    context: { window: 200_000 },
    changed: ['rateLimits'],
    rateLimits: [{ kind: 'five_hour', percentUsed: 100, resetsAt: '2030-01-01T00:00:00Z' }],
  })
  await clock.advance(10)

  expect(posted(calls)).toContain('"kind":"measure"')
  expect(posted(calls)).toContain('"percentUsed":100')
})

// Every write of the mod's turn, in order, answered as the engine would.
// With `slowDue`, a write that marks a send due takes that long to land.
function turnWrites(on: On, slowDue?: (ms: number) => Promise<void>): unknown[] {
  const writes: unknown[] = []
  let version = 0
  on('state.set', async ($, e) => {
    if (slowDue && e.key === 'turn' && e.value.held.some(send => send.stage === 'due')) await slowDue(5)
    if (e.key === 'turn') writes.push(e.value)
    version += 1
    return { value: { isSet: true as const, version } }
  })
  return writes
}

// Stands in for what an earlier load of the mod left in session state: the
// link it read from the environment, and its turn.
function earlierLoad(on: On, turn: BridgeTurn): void {
  on('state.get', ($, e) =>
    e.key === 'link'
      ? { value: { value: { socketPath: SOCKET, token: TOKEN }, version: 1 } }
      : { value: { value: turn, version: 1 } },
  )
}

test('when a turn ends, its held sends are written as due before the hook returns', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  host(on, sendsOnce([{ id: 's1', text: 'and the other thing' }]))
  on('command.list', () => ({ value: [] }))
  const writes = turnWrites(on, ms => clock.sleep(ms))
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.session.start(START)
  await $.turn.start({ text: 'first', turnId: 't1' })
  await clock.advance(10)

  // What a reload as the hook returns would read: the last write landed then.
  let atReturn: unknown
  const completed = $.turn.complete(COMPLETE).then(() => {
    atReturn = writes[writes.length - 1]
  })
  await clock.advance(5)
  await completed

  expect(atReturn).toEqual({
    isRunning: false,
    held: [{ id: 's1', text: 'and the other thing', isCommand: false, stage: 'due', isAfterAbort: false }],
  })

  await clock.advance(10)

  expect(submitted).toEqual(['and the other thing'])
  expect(writes[writes.length - 1]).toEqual({ isRunning: false, held: [] })
})

test('a load after a reload at turn end delivers the due sends once, and reports a send it may have delivered', async ($, on) => {
  // The first load unset the variables; this load finds them gone.
  mock.env(on, {})
  const clock = mock.clock(on)
  const { calls } = host(on, pollEnds)
  on('command.list', () => ({ value: [] }))
  earlierLoad(on, {
    isRunning: false,
    held: [
      { id: 's1', text: 'already going', isCommand: false, stage: 'sending' },
      { id: 's2', text: 'next one', isCommand: false, stage: 'due', isAfterAbort: false },
    ],
  })
  const writes = turnWrites(on)
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })

  await $.session.start(START)
  await clock.advance(10)
  await clock.advance(10)

  expect(submitted).toEqual(['next one'])
  expect(posted(calls)).toContain('"id":"s1","via":"submit","ok":false,"cause":"reloaded"')
  expect(posted(calls)).toContain('"id":"s2","via":"submit","ok":true,"cause":"held"')
  expect(writes[writes.length - 1]).toEqual({ isRunning: false, held: [] })
})

test('a load after a reload mid-turn keeps the held sends for the turn’s end', async ($, on) => {
  mock.env(on, {})
  const clock = mock.clock(on)
  host(on, pollEnds)
  on('command.list', () => ({ value: [] }))
  earlierLoad(on, { isRunning: true, held: [{ id: 's1', text: 'later', isCommand: false, stage: 'held' }] })
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.session.start(START)
  await clock.advance(10)
  expect(submitted).toEqual([])

  await $.turn.complete(COMPLETE)
  await clock.advance(10)

  expect(submitted).toEqual(['later'])
})

test('a command held through an interrupted turn is not run, and is reported undelivered', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  const { calls } = host(on, sendsOnce([{ id: 's1', text: '/compact' }]))
  on('command.list', () => ({
    value: [{ name: 'compact', description: 'Compact the conversation', source: 'builtin' }],
  }))
  const ran: string[] = []
  on('command.run', ($, e) => {
    ran.push(e.command)
    return {}
  })
  await $.session.start(START)
  await $.turn.start({ text: 'first', turnId: 't1' })
  await clock.advance(10)

  await $.turn.complete({ ...COMPLETE, isAborted: true, reason: 'aborted' })
  await clock.advance(10)

  expect(ran).toEqual([])
  expect(posted(calls)).toContain('"id":"s1","via":"command","ok":false,"cause":"aborted"')
})

test('a send that arrives while an ended turn’s sends are still going out waits behind them', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const clock = mock.clock(on)
  let polls = 0
  host(on, call => {
    if (!call.url.includes('/v1/inbound')) return { status: 200, text: '{}' }
    polls += 1
    if (polls === 1) return { status: 200, text: JSON.stringify({ sends: [{ id: 's1', text: 'one' }] }) }
    if (polls === 2) return { status: 200, text: JSON.stringify({ sends: [{ id: 's2', text: 'two' }] }) }
    return { status: 409, text: '' }
  }, 2, clock)
  on('command.list', () => ({ value: [] }))
  const submitted: string[] = []
  on('prompt.submit', async ($, e) => {
    // The first submit is slow, so the second send arrives while it is going out.
    if (e.text === 'one') await clock.sleep(50)
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.session.start(START)
  await $.turn.start({ text: 'first', turnId: 't1' })
  // s1 is held mid-turn; the poll that brings s2 answers 30 ms later.
  await clock.advance(10)
  await $.turn.complete(COMPLETE)
  await clock.advance(10)
  await clock.advance(100)

  expect(submitted).toEqual(['one', 'two'])
})

// Answers a hello with a link of this session's own, and answers the polls on
// that link the way `pollEnds` does, so the loop ends after one round.
function discovers(socketPath = OWN_SOCKET, token = OWN_TOKEN): Respond {
  const ends = sendsOnce([])
  return call => (call.url.endsWith(HELLO) ? { status: 200, text: JSON.stringify({ socketPath, token }) } : ends(call))
}

function hellos(calls: Fetched[]): Fetched[] {
  return calls.filter(call => call.url.endsWith(HELLO))
}

function events(calls: Fetched[]): Fetched[] {
  return calls.filter(call => call.url.endsWith('/v1/events'))
}

test('a session Codello did not start finds the host at its discovery socket, then uses the link it is given', async ($, on) => {
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  const { calls } = host(on, discovers())

  await $.session.start(START)
  await clock.advance(10)

  const asked = hellos(calls)
  expect(asked.length).toBe(1)
  expect(asked[0].init?.socketPath).toBe(DISCOVERY_SOCKET)
  expect(asked[0].init?.method).toBe('POST')
  // The discovery socket takes no token; the one it answers with does.
  expect(asked[0].init?.headers?.authorization).toBe(undefined)
  expect(asked[0].init?.headers?.['content-type']).toBe('application/json')
  const body = JSON.parse(String(asked[0].init?.body))
  expect(body.sessionId).toBe(SESSION_ID)
  expect(body.cwd).toBe('/w')
  expect(body.isInteractive).toBe(true)
  expect(typeof body.loadId).toBe('string')

  const posts = events(calls)
  expect(posts.length > 0).toBe(true)
  expect(posts.every(call => call.init?.socketPath === OWN_SOCKET)).toBe(true)
  expect(posts.every(call => call.init?.headers?.authorization === `Bearer ${OWN_TOKEN}`)).toBe(true)
  expect(posted(calls)).toContain('"kind":"session-start"')
  expect(calls.some(call => call.url.includes('/v1/inbound') && call.init?.socketPath === OWN_SOCKET)).toBe(true)
})

test('the configured config directory decides where the discovery socket is, not the home directory', async ($, on) => {
  mock.env(on, { HOME, CODELLO_CONFIG_DIR: '/var/codello' })
  const clock = mock.clock(on)
  const { calls } = host(on, discovers())

  await $.session.start(START)
  await clock.advance(10)

  expect(hellos(calls).map(call => call.init?.socketPath)).toEqual(['/var/codello/bridge/ambient.sock'])
})

test('a session Codello started never looks for a host: its link comes from the environment or not at all', async ($, on) => {
  mock.env(on, { HOME, CODELLO_SESSION: 'sess-1' })
  const clock = mock.clock(on)
  const { calls } = host(on, discovers())

  await $.session.start(START)
  await clock.advance(10)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await clock.advance(10)

  expect(calls.length).toBe(0)
})

test('with no host running, the hello is tried again at the next turn start, and that turn start reaches the host', async ($, on) => {
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  let asked = 0
  const ends = sendsOnce([])
  const { calls } = host(on, call => {
    if (!call.url.endsWith(HELLO)) return ends(call)
    asked += 1
    // No host at session.start: the socket file does not exist.
    if (asked === 1) throw new Error('connect ENOENT')
    return { status: 200, text: JSON.stringify({ socketPath: OWN_SOCKET, token: OWN_TOKEN }) }
  })

  await $.session.start(START)
  await clock.advance(10)
  expect(asked).toBe(1)
  expect(events(calls).length).toBe(0)

  const started = await $.turn.start({ text: 'hi', turnId: 't1' })
  await clock.advance(10)

  expect(started.turnId).toBe('t1')
  expect(asked).toBe(2)
  const body = posted(calls)
  expect(body.indexOf('"kind":"session-start"') < body.indexOf('"kind":"turn-start"')).toBe(true)
  expect(body).toContain('"kind":"turn-start"')
})

test('a host that refuses the session is never asked again', async ($, on) => {
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  let asked = 0
  const ends = sendsOnce([])
  const { calls } = host(on, call => {
    if (!call.url.endsWith(HELLO)) return ends(call)
    asked += 1
    return { status: 403, text: 'this session is already mine' }
  })

  await $.session.start(START)
  await clock.advance(10)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(COMPLETE)
  await clock.advance(10)
  await $.turn.start({ text: 'again', turnId: 't2' })
  await clock.advance(10)

  expect(asked).toBe(1)
  expect(events(calls).length).toBe(0)
})

test('a discovered link that goes dead is discovered again once the backoff tops out', async ($, on) => {
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  let asked = 0
  const { calls } = host(on, call => {
    if (call.url.endsWith(HELLO)) {
      asked += 1
      return { status: 200, text: JSON.stringify({ socketPath: asked === 1 ? OWN_SOCKET : NEXT_SOCKET, token: OWN_TOKEN }) }
    }
    if (!call.url.includes('/v1/inbound')) return { status: 200, text: '{}' }
    // The first host stops answering; the one found after it supersedes the poll.
    return call.init?.socketPath === OWN_SOCKET ? { status: 500, text: '' } : { status: 409, text: '' }
  })

  await $.session.start(START)
  // Past the whole backoff ladder, 250 ms doubling to 5 s, and one more wait.
  await clock.advance(30_000)

  expect(asked).toBe(2)
  expect(calls.some(call => call.url.includes('/v1/inbound') && call.init?.socketPath === NEXT_SOCKET)).toBe(true)
})

test('a hello the host never answers gives up after its timeout, so session start is not held', async ($, on) => {
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  let asked = 0
  const calls: Fetched[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', () => ({ value: undefined }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.id', () => ({ value: SESSION_ID }))
  on('session.cwd', () => ({ value: START.cwd }))
  // The listening socket accepts, and a wedged host never answers.
  on('http.fetch', async ($, e) => {
    calls.push({ url: e.url, init: e.init })
    asked += 1
    await clock.sleep(60_000)
    return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
  })

  let isStarted = false
  const started = $.session.start(START).then(() => {
    isStarted = true
  })
  await clock.advance(1_400)
  expect(isStarted).toBe(false)
  await clock.advance(200)
  await started
  expect(isStarted).toBe(true)
  expect(asked).toBe(1)
  expect(events(calls).length).toBe(0)
})

test('/clear lets a discovered link go, and the next turn start says hello for the new conversation', async ($, on) => {
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  let asked = 0
  const { calls } = host(on, call => {
    if (call.url.endsWith(HELLO)) {
      asked += 1
      return { status: 200, text: JSON.stringify({ socketPath: asked === 1 ? OWN_SOCKET : NEXT_SOCKET, token: OWN_TOKEN }) }
    }
    if (!call.url.includes('/v1/inbound')) return { status: 200, text: '{}' }
    return { status: 409, text: '' }
  })

  on('session.end', () => ({ sessionId: SESSION_ID }))

  await $.session.start(START)
  await clock.advance(10)
  expect(asked).toBe(1)
  await $.session.end({ reason: 'clear' })
  await $.turn.start({ text: 'fresh', turnId: 't1' })
  await clock.advance(10)

  expect(asked).toBe(2)
  const onNext = events(calls).filter(call => call.init?.socketPath === NEXT_SOCKET)
  expect(onNext.length > 0).toBe(true)
  expect(posted(onNext)).toContain('"kind":"session-start"')
  expect(posted(onNext)).toContain('"kind":"turn-start"')
})

test('a reload that takes up a discovered link can still ask again when that link dies', async ($, on) => {
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  on('state.get', ($, e) =>
    e.key === 'link'
      ? { value: { value: { socketPath: OWN_SOCKET, token: OWN_TOKEN, isAmbient: true }, version: 1 } }
      : { value: { value: { isRunning: false, held: [] }, version: 1 } },
  )
  let asked = 0
  const { calls } = host(on, call => {
    if (call.url.endsWith(HELLO)) {
      asked += 1
      return { status: 200, text: JSON.stringify({ socketPath: NEXT_SOCKET, token: OWN_TOKEN }) }
    }
    if (!call.url.includes('/v1/inbound')) return { status: 200, text: '{}' }
    return call.init?.socketPath === OWN_SOCKET ? { status: 500, text: '' } : { status: 409, text: '' }
  })

  await $.session.start(START)
  await clock.advance(30_000)

  expect(hellos(calls).map(call => call.init?.socketPath)).toEqual([DISCOVERY_SOCKET])
  expect(asked).toBe(1)
  expect(calls.some(call => call.url.includes('/v1/inbound') && call.init?.socketPath === NEXT_SOCKET)).toBe(true)
})
