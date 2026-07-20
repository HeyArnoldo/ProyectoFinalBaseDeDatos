import { ProjectionWorker } from '../src/projections/projection.worker';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function event(index: number) {
  const suffix = index.toString(16).padStart(12, '0');
  return {
    _id: `00000000-0000-4000-8000-${suffix}`,
    eventId: `10000000-0000-4000-8000-${suffix}`,
    restaurantId: RESTAURANT_ID,
    orderId: `20000000-0000-4000-8000-${suffix}`,
    type: 'ORDER_CREATED' as const,
    payload: { status: 'PENDING' as const, totalCents: 1250 },
    occurredAt: new Date('2026-07-19T00:00:00.000Z'),
    status: 'PROCESSING' as const,
    attempts: 1,
    nextAttemptAt: null,
    leaseUntil: new Date('2026-07-19T00:00:30.000Z'),
    leaseId: `30000000-0000-4000-8000-${suffix}`,
    processedAt: null,
    lastError: null,
    createdAt: new Date('2026-07-19T00:00:00.000Z'),
    updatedAt: new Date('2026-07-19T00:00:00.000Z'),
  };
}

async function processMockedBatch(total: number) {
  const queue = Array.from({ length: total }, (_, index) => event(index + 1));
  let activeWrites = 0;
  let maxActiveWrites = 0;
  const outbox = { findOneAndUpdate: jest.fn(async () => queue.shift() ?? null), updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }) };
  const cassandra = { execute: jest.fn(async () => { activeWrites += 1; maxActiveWrites = Math.max(maxActiveWrites, activeWrites); await Promise.resolve(); activeWrites -= 1; return { rows: [] }; }) };
  const worker = new ProjectionWorker({ collection: jest.fn().mockReturnValue(outbox) } as never, cassandra as never, { ensureReady: jest.fn().mockResolvedValue(undefined) } as never);
  while (queue.length > 0) await worker.tick();
  return { outbox, cassandra, maxActiveWrites };
}

describe('projection worker mocked orchestration load evidence (non-runtime)', () => {
  it.each([50, 250, 1000])('processes %i claimed events without logical loss or duplicate marking', async (total) => {
    const result = await processMockedBatch(total);
    expect(result.cassandra.execute).toHaveBeenCalledTimes(total * 2);
    expect(result.outbox.updateOne).toHaveBeenCalledTimes(total);
    expect(result.maxActiveWrites).toBe(1);
    const marked = result.outbox.updateOne.mock.calls.map(([filter]) => filter._id);
    expect(new Set(marked).size).toBe(total);
  });
});
