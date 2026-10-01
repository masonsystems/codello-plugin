import { expect, mock, test } from 'claude-code/testing'
import type { HttpInit, On } from 'claude-code'

// `session.append` is not exercised here: on 2.1.287 the kit cannot stand in
// for the row store (a test hook that answers without `next` is skipped, and
// nothing lies beneath it). The append of a held send at the next tool call,
// and after an interrupt, is verified in a live session instead (COD-1821's
// PR records the run).

const SOCKET = '/tmp/codello-bridge-test/bridge.sock'
const TOKEN = 'test-token'
const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const COMPLETE = { answer: 'done', durationMs: 5, isAborted: false, turnId: 't1', reason: 'answer' } as const

interface Fetched {
  url: string
  init?: HttpInit
}

type Respond = (call: Fetched) => { status: number; text: string }

// Answers the engine's own work beneath the plugin, and the host's socket,
// which records each request and answers with `respond`.
function host(on: On, respond: Respond): { calls: Fetched[]; unset: string[] } {
  const calls: Fetched[] = []
  const unset: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', ($, e) => {
    if (e.value === undefined) unset.push(e.name)
    return { value: undefined }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('http.fetch', ($, e) => {
    calls.push({ url: e.url, init: e.init })
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

test('the token is unset so the agent’s children do not inherit it', async ($, on) => {
  mock.env(on, { CODELLO_BRIDGE_SOCKET: SOCKET, CODELLO_BRIDGE_TOKEN: TOKEN })
  const { unset } = host(on, pollEnds)

  await $.session.start(START)

  expect(unset).toEqual(['CODELLO_BRIDGE_TOKEN'])
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
