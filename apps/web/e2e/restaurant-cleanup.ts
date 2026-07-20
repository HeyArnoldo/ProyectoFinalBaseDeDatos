import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const composeFile = resolve(projectRoot, 'infra/compose.yaml');
const composeArgs = ['compose', '-p', 'infra', '-f', composeFile];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ProjectionEventFixture = {
  outboxId: string;
  eventId: string;
  restaurantId: string;
  orderId: string;
  occurredAt: string;
};

export type FixtureCleanupReport = {
  orderIds: string[];
  outboxIds: string[];
  eventIds: string[];
  cassandraRowsTargeted: number;
  deletedOutbox: number;
  deletedOrders: number;
  remainingMongoOrders: number;
  remainingMongoOutbox: number;
  remainingCassandraRows: number;
};

const PROCESSING_QUIESCE_TIMEOUT_MS = 15_000;
const CASSANDRA_GRACE_PERIOD_MS = 1_000;

function validateUuid(value: string): string {
  if (!uuidPattern.test(value)) throw new Error('E2E cleanup received an invalid fixture identifier');
  return value;
}

function cqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function cqlUuid(value: string): string {
  return validateUuid(value);
}

function runDocker(...args: string[]): string {
  try {
    return execFileSync('docker', [...composeArgs, ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: {
        ...process.env,
        OPERATOR_USERNAME: process.env.OPERATOR_USERNAME || 'e2e-fixture-cleanup',
        OPERATOR_PASSWORD_HASH: process.env.OPERATOR_PASSWORD_HASH || 'e2e-fixture-cleanup',
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-fixture-cleanup',
      },
    });
  } catch {
    throw new Error('E2E fixture cleanup command failed');
  }
}

function parseJsonArray(output: string): ProjectionEventFixture[] {
  const line = output.split(/\r?\n/).reverse().find((candidate) => candidate.trim().startsWith('['));
  if (!line) throw new Error('E2E cleanup did not return fixture metadata');
  try {
    const value: unknown = JSON.parse(line);
    if (!Array.isArray(value)) throw new Error('invalid fixture metadata');
    return value as ProjectionEventFixture[];
  } catch {
    throw new Error('E2E cleanup returned invalid fixture metadata');
  }
}

export function buildMongoEventLookupScript(orderIds: string[]): string {
  const safeOrderIds = orderIds.map(validateUuid);
  return `const orderIds = ${JSON.stringify(safeOrderIds)}; const docs = db.getSiblingDB('restaurant').getCollection('outbox').find({ orderId: { $in: orderIds } }, { _id: 1, eventId: 1, restaurantId: 1, orderId: 1, occurredAt: 1 }).toArray(); print(JSON.stringify(docs.map((doc) => ({ outboxId: String(doc._id), eventId: String(doc.eventId), restaurantId: String(doc.restaurantId), orderId: String(doc.orderId), occurredAt: doc.occurredAt.toISOString() }))));`;
}

export function buildMongoProtectionScript(orderIds: string[], outboxIds: string[]): string {
  const safeOrderIds = orderIds.map(validateUuid);
  const safeOutboxIds = outboxIds.map(validateUuid);
  return `const orderIds = ${JSON.stringify(safeOrderIds)}; const outboxIds = ${JSON.stringify(safeOutboxIds)}; const outbox = db.getSiblingDB('restaurant').getCollection('outbox'); outbox.updateMany({ _id: { $in: outboxIds }, orderId: { $in: orderIds } }, { $set: { cleanupProtected: true, updatedAt: new Date() } }); const deadline = Date.now() + ${PROCESSING_QUIESCE_TIMEOUT_MS}; let processing = outbox.countDocuments({ _id: { $in: outboxIds }, orderId: { $in: orderIds }, status: 'PROCESSING' }); while (processing > 0 && Date.now() < deadline) { sleep(100); processing = outbox.countDocuments({ _id: { $in: outboxIds }, orderId: { $in: orderIds }, status: 'PROCESSING' }); } if (processing > 0) throw new Error('E2E cleanup timed out waiting for fixture projection events'); print(JSON.stringify({ processing }));`;
}

export function buildMongoDeleteScript(orderIds: string[], outboxIds: string[]): string {
  const safeOrderIds = orderIds.map(validateUuid);
  const safeOutboxIds = outboxIds.map(validateUuid);
  return `const orderIds = ${JSON.stringify(safeOrderIds)}; const outboxIds = ${JSON.stringify(safeOutboxIds)}; const database = db.getSiblingDB('restaurant'); const outbox = database.getCollection('outbox'); const orders = database.getCollection('orders'); const deletedOutbox = outbox.deleteMany({ _id: { $in: outboxIds }, orderId: { $in: orderIds } }); const deletedOrders = orders.deleteMany({ _id: { $in: orderIds } }); print(JSON.stringify({ deletedOutbox: deletedOutbox.deletedCount, deletedOrders: deletedOrders.deletedCount, remainingMongoOrders: orders.countDocuments({ _id: { $in: orderIds } }), remainingMongoOutbox: outbox.countDocuments({ _id: { $in: outboxIds }, orderId: { $in: orderIds } }) }));`;
}

export function buildCassandraDeleteStatements(events: ProjectionEventFixture[]): string[] {
  return events.flatMap((event) => {
    const eventId = validateUuid(event.eventId);
    const restaurantId = validateUuid(event.restaurantId);
    const orderId = validateUuid(event.orderId);
    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('E2E cleanup received an invalid event timestamp');
    const timestamp = cqlString(occurredAt.toISOString());
    const day = cqlString(occurredAt.toISOString().slice(0, 10));
    return [
      `DELETE FROM restaurant_projection.order_timeline_by_order WHERE order_id = ${cqlUuid(orderId)} AND occurred_at = ${timestamp} AND event_id = ${cqlUuid(eventId)};`,
      `DELETE FROM restaurant_projection.restaurant_activity_by_day WHERE restaurant_id = ${cqlUuid(restaurantId)} AND day = ${day} AND occurred_at = ${timestamp} AND event_id = ${cqlUuid(eventId)};`,
    ];
  });
}

export function buildCassandraVerifyStatements(events: ProjectionEventFixture[]): string[] {
  return events.flatMap((event) => {
    const eventId = validateUuid(event.eventId);
    const restaurantId = validateUuid(event.restaurantId);
    const orderId = validateUuid(event.orderId);
    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('E2E cleanup received an invalid event timestamp');
    const timestamp = cqlString(occurredAt.toISOString());
    const day = cqlString(occurredAt.toISOString().slice(0, 10));
    return [
      `SELECT event_id FROM restaurant_projection.order_timeline_by_order WHERE order_id = ${cqlUuid(orderId)} AND occurred_at = ${timestamp} AND event_id = ${cqlUuid(eventId)};`,
      `SELECT event_id FROM restaurant_projection.restaurant_activity_by_day WHERE restaurant_id = ${cqlUuid(restaurantId)} AND day = ${day} AND occurred_at = ${timestamp} AND event_id = ${cqlUuid(eventId)};`,
    ];
  });
}

function deleteProjectionRows(events: ProjectionEventFixture[]): void {
  const statements = buildCassandraDeleteStatements(events);
  if (statements.length === 0) return;
  runDocker('exec', '-T', 'cassandra', 'cqlsh', '--request-timeout', '15', '127.0.0.1', '9042', '-e', statements.join('\n'));
}

function verifyProjectionRows(events: ProjectionEventFixture[]): number {
  const statements = buildCassandraVerifyStatements(events);
  if (statements.length === 0) return 0;
  const output = runDocker('exec', '-T', 'cassandra', 'cqlsh', '--request-timeout', '15', '127.0.0.1', '9042', '-e', statements.join('\n'));
  return events.reduce((count, event) => count + (output.split(event.eventId).length - 1), 0);
}

function waitForCassandraGracePeriod(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, CASSANDRA_GRACE_PERIOD_MS);
}

export function cleanupCreatedOrders(orderIds: Iterable<string>): FixtureCleanupReport {
  const safeOrderIds = [...new Set([...orderIds].map(validateUuid))];
  if (safeOrderIds.length === 0) {
    return { orderIds: [], outboxIds: [], eventIds: [], cassandraRowsTargeted: 0, deletedOutbox: 0, deletedOrders: 0, remainingMongoOrders: 0, remainingMongoOutbox: 0, remainingCassandraRows: 0 };
  }

  const events = parseJsonArray(runDocker('exec', '-T', 'mongodb', 'mongosh', '--quiet', 'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0', '--eval', buildMongoEventLookupScript(safeOrderIds)));
  const safeOutboxIds = events.map((event) => validateUuid(event.outboxId));
  runDocker('exec', '-T', 'mongodb', 'mongosh', '--quiet', 'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0', '--eval', buildMongoProtectionScript(safeOrderIds, safeOutboxIds));
  const line = runDocker('exec', '-T', 'mongodb', 'mongosh', '--quiet', 'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0', '--eval', buildMongoDeleteScript(safeOrderIds, safeOutboxIds))
    .split(/\r?\n/)
    .reverse()
    .find((candidate) => candidate.trim().startsWith('{'));
  if (!line) throw new Error('E2E cleanup did not return deletion metadata');
  let deletion: Omit<FixtureCleanupReport, 'orderIds' | 'outboxIds' | 'eventIds' | 'cassandraRowsTargeted'>;
  try {
    deletion = JSON.parse(line) as typeof deletion;
  } catch {
    throw new Error('E2E cleanup returned invalid deletion metadata');
  }

  waitForCassandraGracePeriod();
  deleteProjectionRows(events);
  const remainingCassandraRows = verifyProjectionRows(events);
  if (remainingCassandraRows !== 0) throw new Error('E2E cleanup left projection rows behind');
  return { orderIds: safeOrderIds, outboxIds: safeOutboxIds, eventIds: events.map((event) => validateUuid(event.eventId)), cassandraRowsTargeted: events.length * 2, remainingCassandraRows, ...deletion };
}
