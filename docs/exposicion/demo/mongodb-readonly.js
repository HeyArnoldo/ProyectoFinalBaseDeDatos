// Read-only inspection for one canonical UUID v4 order. Run with mongosh.
// Provide ORDER_ID in the environment, or replace the empty placeholder below.

const ORDER_ID_PLACEHOLDER = '';
const orderId = (process.env.ORDER_ID || ORDER_ID_PLACEHOLDER).trim().toLowerCase();
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

if (!UUID_V4.test(orderId)) {
  throw new Error('ORDER_ID must be a canonical lowercase UUID v4. Set ORDER_ID or replace ORDER_ID_PLACEHOLDER.');
}

const orderProjection = {
  _id: 1,
  restaurantId: 1,
  items: 1,
  totalCents: 1,
  status: 1,
  history: 1,
  createdAt: 1,
  updatedAt: 1,
};

const outboxProjection = {
  _id: 1,
  eventId: 1,
  restaurantId: 1,
  orderId: 1,
  type: 1,
  payload: 1,
  occurredAt: 1,
  status: 1,
  attempts: 1,
  nextAttemptAt: 1,
  leaseUntil: 1,
  processedAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

print(`Read-only inspection for order ${orderId}`);
print('Collections:');
printjson(db.getCollectionNames());

for (const collectionName of ['orders', 'outbox']) {
  print(`Indexes for ${collectionName}:`);
  printjson(db.getCollection(collectionName).getIndexes());
}

print('Order (sensitive fields excluded):');
printjson(db.orders.findOne({ _id: orderId }, orderProjection));

print('Outbox events for this order:');
printjson(
  db.outbox
    .find({ orderId }, outboxProjection)
    .sort({ occurredAt: 1, _id: 1 })
    .toArray(),
);

print('Safe query plan for the primary-key order lookup:');
printjson(db.orders.find({ _id: orderId }, orderProjection).explain('queryPlanner'));

print('Safe query plan for the recent-orders index:');
printjson(
  db.orders
    .find({ restaurantId: RESTAURANT_ID }, { _id: 1, restaurantId: 1, status: 1, createdAt: 1 })
    .sort({ createdAt: -1, _id: -1 })
    .limit(10)
    .explain('executionStats'),
);
