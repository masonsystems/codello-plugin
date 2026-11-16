import { expect, test } from 'claude-code/testing'

import { EventQueue } from './event-queue'
import type { OutboundEvent } from './wire'

function event(seq: number): OutboundEvent {
  return { seq, loadId: 'l1', at: 0, kind: 'k' }
}

function seqs(events: readonly OutboundEvent[]): number[] {
  return events.map(e => e.seq)
}

test('a batch acknowledged after an overflow trimmed the front drops only what was sent', async () => {
  const queue = new EventQueue(4, 2)
  for (const seq of [1, 2, 3, 4]) queue.push(event(seq))
  const batch = queue.batch()
  expect(seqs(batch)).toEqual([1, 2])

  // While the batch is in flight, two more events push 1 and 2 off the front.
  queue.push(event(5))
  queue.push(event(6))
  queue.acknowledge(batch)

  expect(queue.size).toBe(4)
  expect(seqs(queue.batch())).toEqual([3, 4])
})

test('a batch acknowledged with nothing trimmed drops exactly the batch', async () => {
  const queue = new EventQueue(10, 2)
  for (const seq of [1, 2, 3]) queue.push(event(seq))
  queue.acknowledge(queue.batch())

  expect(seqs(queue.batch())).toEqual([3])
})

test('past the bound, the oldest events fall off', async () => {
  const queue = new EventQueue(2, 5)
  for (const seq of [1, 2, 3]) queue.push(event(seq))

  expect(seqs(queue.batch())).toEqual([2, 3])
})
