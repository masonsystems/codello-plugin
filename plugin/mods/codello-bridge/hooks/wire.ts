// The bridge's wire format between this mod and the Codello host server. The
// mod's module environment cannot import from the Codello repo, so the host
// keeps its own copy in src/server/mod-bridge-wire.ts, and a test there holds
// the paths and the poll wait below to the same values.

export const EVENTS_PATH = '/v1/events'
export const INBOUND_PATH = '/v1/inbound'

// The URL host is ignored on a Unix socket; it only fills the Host header.
export const BRIDGE_ORIGIN = 'http://codello-bridge'

// How long the host may hold an inbound poll open before answering empty.
export const POLL_WAIT_MS = 20_000

export interface OutboundEvent {
  // Ordinal within one module load; `loadId` changes on every hot reload, and
  // the host drops an event whose (loadId, seq) it has already taken, so a
  // retried batch is not counted twice.
  seq: number
  loadId: string
  at: number
  kind: string
  [field: string]: unknown
}

// How a send reached the model: `submit` started a turn of its own,
// `append` added a user row to the running turn, `command` ran it as a slash
// command, and `hold` kept it for the turn's next tool call or its end.
export type DeliveryRoute = 'submit' | 'append' | 'command' | 'hold'

export interface InboundSend {
  id: string
  text: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInboundSend(value: unknown): value is InboundSend {
  return isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string'
}

/** Reads the host's poll answer, `{ sends: [{ id, text }] }`; anything else is no sends. */
export function parseInbound(body: string): InboundSend[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return []
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.sends)) return []
  return parsed.sends.filter(isInboundSend)
}
