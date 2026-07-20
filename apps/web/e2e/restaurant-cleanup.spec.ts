import { expect, test } from '@playwright/test';
import { buildCassandraDeleteStatements, buildCassandraVerifyStatements, buildMongoDeleteScript, buildMongoEventLookupScript, buildMongoProtectionScript } from './restaurant-cleanup';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const OUTBOX_ID = '33333333-3333-4333-8333-333333333333';
const EVENT = { outboxId: OUTBOX_ID, eventId: EVENT_ID, restaurantId: ORDER_ID, orderId: ORDER_ID, occurredAt: '2026-07-19T12:00:00.000Z' };

test('E2E cleanup remains scoped to exact fixture identifiers and projection partitions', () => {
  const lookup = buildMongoEventLookupScript([ORDER_ID]);
  const protection = buildMongoProtectionScript([ORDER_ID], [OUTBOX_ID]);
  const deletion = buildMongoDeleteScript([ORDER_ID], [OUTBOX_ID]);
  const projectionDeletes = buildCassandraDeleteStatements([EVENT]);
  const projectionVerify = buildCassandraVerifyStatements([EVENT]);

  expect(lookup).toContain(`const orderIds = ["${ORDER_ID}"]`);
  expect(lookup).toContain('orderId: { $in: orderIds }');
  expect(protection).toContain('_id: { $in: outboxIds }');
  expect(protection).toContain('cleanupProtected: true');
  expect(protection).toContain("status: 'PROCESSING'");
  expect(protection).toContain('Date.now() + 15000');
  expect(deletion).toContain(`const orderIds = ["${ORDER_ID}"]`);
  expect(deletion).toContain(`const outboxIds = ["${OUTBOX_ID}"]`);
  expect(deletion).toContain('_id: { $in: outboxIds }');
  expect(deletion).toContain('_id: { $in: orderIds }');
  expect(deletion).not.toContain('deleteMany({})');
  expect(projectionDeletes).toHaveLength(2);
  expect(projectionDeletes[0]).toContain(`order_id = ${ORDER_ID}`);
  expect(projectionDeletes[0]).toContain(`event_id = ${EVENT_ID}`);
  expect(projectionDeletes[1]).toContain(`restaurant_id = ${ORDER_ID}`);
  expect(projectionDeletes[1]).toContain(`event_id = ${EVENT_ID}`);
  expect(projectionDeletes[1]).not.toContain('ALLOW FILTERING');
  expect(projectionVerify).toHaveLength(2);
  expect(projectionVerify[0]).toContain(`event_id = ${EVENT_ID}`);
});
