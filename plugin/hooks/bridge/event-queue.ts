import type { OutboundEvent } from './wire'

// The events waiting to reach the host, oldest first. A batch is taken from
// the front and acknowledged by the last sequence number it carried, never by
// its length: while it is in flight, an overflow can trim the front, and
// counting off the batch's length after that would drop events never sent.
export class EventQueue {
  private readonly events: OutboundEvent[] = []

  constructor(
    private readonly maxEvents: number,
    private readonly maxBatch: number,
  ) {}

  get size(): number {
    return this.events.length
  }

  // Adds an event; past the bound, the oldest fall off the front, so a host
  // that is down costs a bounded amount of memory.
  push(event: OutboundEvent): void {
    this.events.push(event)
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents)
  }

  // The next batch to send, oldest first; a copy, so a push or trim during the
  // send leaves it as it was.
  batch(): OutboundEvent[] {
    return this.events.slice(0, this.maxBatch)
  }

  // The host took `sent`: drop it, and only it, from the front.
  acknowledge(sent: readonly OutboundEvent[]): void {
    const last = sent[sent.length - 1]
    if (last === undefined) return
    let taken = 0
    while (taken < this.events.length && (this.events[taken]?.seq ?? Infinity) <= last.seq) taken += 1
    this.events.splice(0, taken)
  }
}
