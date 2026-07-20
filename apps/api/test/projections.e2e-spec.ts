import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { types } from 'cassandra-driver';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { OperatorGuard } from '../src/auth/operator.guard';
import { CassandraLifecycle, loadCassandraConfig } from '../src/projections/cassandra.provider';
import { CASSANDRA_BOOTSTRAP_STATEMENTS, bootstrapCassandra } from '../src/projections/cql.bootstrap';
import { ProjectionController } from '../src/projections/projection.controller';
import { projectionCql, ProjectionWorker } from '../src/projections/projection.worker';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '55555555-5555-4555-8555-555555555555';
const EVENT_ID = '99999999-9999-4999-8999-999999999999';

function event(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    eventId: EVENT_ID,
    restaurantId: RESTAURANT_ID,
    orderId: ORDER_ID,
    type: 'ORDER_CREATED' as const,
    payload: { status: 'PENDING' as const, totalCents: 1250 },
    occurredAt: new Date('2026-07-18T12:00:00.000Z'),
    status: 'PROCESSING' as const,
    attempts: 1,
    nextAttemptAt: null,
    leaseUntil: new Date('2026-07-18T12:00:30.000Z'),
    leaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    processedAt: null,
    lastError: null,
    createdAt: new Date('2026-07-18T12:00:00.000Z'),
    updatedAt: new Date('2026-07-18T12:00:00.000Z'),
    ...overrides,
  };
}

function workerSetup(claimed: ReturnType<typeof event> | null = event()) {
  const outbox = {
    findOneAndUpdate: jest.fn().mockResolvedValueOnce(claimed).mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0),
    findOne: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
  };
  const cassandra = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
  const bootstrap = { ensureReady: jest.fn().mockResolvedValue(undefined) };
  const db = { collection: jest.fn().mockReturnValue(outbox) };
  return { worker: new ProjectionWorker(db as never, cassandra as never, bootstrap as never), outbox, cassandra, bootstrap };
}

describe('Cassandra projection foundation', () => {
  const names = ['CASSANDRA_CONTACT_POINTS', 'CASSANDRA_LOCAL_DATACENTER', 'CASSANDRA_PORT'] as const;
  const original = new Map(names.map((name) => [name, process.env[name]]));

  beforeEach(() => Object.assign(process.env, {
    CASSANDRA_CONTACT_POINTS: 'cassandra, cassandra-2',
    CASSANDRA_LOCAL_DATACENTER: 'datacenter1',
    CASSANDRA_PORT: '9042',
  }));
  afterEach(() => names.forEach((name) => original.get(name) === undefined ? delete process.env[name] : process.env[name] = original.get(name)));

  it.each(names)('rejects a blank %s', (name) => {
    process.env[name] = ' ';
    expect(() => loadCassandraConfig()).toThrow(`${name} is required`);
  });

  it('loads explicit contact points, local data center, and port', () => {
    expect(loadCassandraConfig()).toEqual({ contactPoints: ['cassandra', 'cassandra-2'], localDataCenter: 'datacenter1', port: 9042 });
    process.env.CASSANDRA_PORT = '0';
    expect(() => loadCassandraConfig()).toThrow('CASSANDRA_PORT must be a valid TCP port');
  });

  it('passes all required Cassandra connection settings to the Compose API service', () => {
    const compose = readFileSync(join(__dirname, '../../../infra/compose.yaml'), 'utf8');
    for (const line of ['CASSANDRA_CONTACT_POINTS: cassandra', 'CASSANDRA_LOCAL_DATACENTER: datacenter1', 'CASSANDRA_PORT: "9042"']) {
      expect(compose).toContain(line);
    }
  });

  it('shuts down the connected Cassandra client during application shutdown', async () => {
    const shutdown = jest.fn().mockResolvedValue(undefined);
    await new CassandraLifecycle({ shutdown } as never).onApplicationShutdown();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('bootstraps only the fixed keyspace and its two projection tables', async () => {
    const execute = jest.fn().mockResolvedValue({});
    await bootstrapCassandra({ execute } as never);

    expect(CASSANDRA_BOOTSTRAP_STATEMENTS).toHaveLength(4);
    expect(CASSANDRA_BOOTSTRAP_STATEMENTS.join('\n')).toContain('restaurant_projection');
    expect(CASSANDRA_BOOTSTRAP_STATEMENTS.join('\n')).toContain("'class': 'NetworkTopologyStrategy'");
    expect(CASSANDRA_BOOTSTRAP_STATEMENTS.join('\n')).toContain('ALTER KEYSPACE restaurant_projection');
    expect(CASSANDRA_BOOTSTRAP_STATEMENTS.join('\n')).toContain('order_timeline_by_order');
    expect(CASSANDRA_BOOTSTRAP_STATEMENTS.join('\n')).toContain('restaurant_activity_by_day');
    expect(CASSANDRA_BOOTSTRAP_STATEMENTS.join('\n')).not.toMatch(/INDEX|MATERIALIZED VIEW|ALLOW FILTERING/i);
    expect(execute).toHaveBeenCalledTimes(4);
  });
});

describe('projection worker', () => {
  it('stops polling and waits for an active tick during shutdown', async () => {
    const { worker } = workerSetup(null);
    let finishTick: (() => void) | undefined;
    (worker as any).activeTick = new Promise<void>((resolve) => { finishTick = resolve; });

    const shutdown = worker.onApplicationShutdown();
    let complete = false;
    void shutdown.then(() => { complete = true; });
    await Promise.resolve();
    expect(complete).toBe(false);

    finishTick!();
    await expect(shutdown).resolves.toBeUndefined();
  });

  it('claims pending work with a 30-second lease and reclaims expired processing work', async () => {
    const { worker, outbox } = workerSetup(null);
    await worker.tick();

    const filter = outbox.findOneAndUpdate.mock.calls[0][0];
    const update = outbox.findOneAndUpdate.mock.calls[0][1];
    expect(filter).toEqual(expect.objectContaining({ status: 'PENDING', cleanupProtected: { $ne: true } }));
    expect(filter.$or).toEqual(expect.arrayContaining([{ nextAttemptAt: null }, { nextAttemptAt: expect.objectContaining({ $lte: expect.any(Date) }) }]));
    expect(update).toEqual(expect.objectContaining({
      $set: expect.objectContaining({ status: 'PROCESSING', leaseId: expect.any(String), leaseUntil: expect.any(Date) }),
      $inc: { attempts: 1 },
    }));
  });

  it('falls back to a separate expired-processing claim branch only after ready pending work is absent', async () => {
    const { worker, outbox } = workerSetup(null);
    await worker.tick();

    expect(outbox.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(outbox.findOneAndUpdate.mock.calls[0]![0]).toEqual(expect.objectContaining({ status: 'PENDING', cleanupProtected: { $ne: true } }));
    expect(outbox.findOneAndUpdate.mock.calls[1]![0]).toEqual(expect.objectContaining({ status: 'PROCESSING', cleanupProtected: { $ne: true }, leaseUntil: expect.objectContaining({ $lte: expect.any(Date) }) }));
    expect(outbox.findOneAndUpdate.mock.calls[0]![2]).toEqual(expect.objectContaining({ sort: { occurredAt: 1, _id: 1 } }));
  });

  it('writes duplicate events as two prepared idempotent upserts and marks only its lease processed', async () => {
    const { worker, cassandra, outbox } = workerSetup();
    await (worker as any).writeEvent(event());
    await (worker as any).writeEvent(event());
    await (worker as any).markProcessed(event());

    expect(cassandra.execute).toHaveBeenCalledTimes(4);
    expect(cassandra.execute.mock.calls.map(([query]: [string]) => query)).toEqual([
      projectionCql.insertOrderTimeline,
      projectionCql.insertRestaurantActivity,
      projectionCql.insertOrderTimeline,
      projectionCql.insertRestaurantActivity,
    ]);
    for (const [, params, options] of cassandra.execute.mock.calls) {
      expect(options).toEqual({ prepare: true, isIdempotent: true });
      expect(params.some((value: unknown) => value instanceof types.Uuid)).toBe(true);
    }
    expect(outbox.updateOne).toHaveBeenCalledWith(
      { _id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'PROCESSING', leaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'PROCESSED', leaseId: null }) }),
    );
  });

  it('returns an outage to pending with capped exponential retry and stops the current batch', async () => {
    const { worker, cassandra, outbox } = workerSetup(event({ attempts: 10 }));
    cassandra.execute.mockRejectedValueOnce(new Error('Cassandra unavailable'));
    await worker.tick();

    expect(cassandra.execute).toHaveBeenCalledTimes(1);
    expect(outbox.updateOne).toHaveBeenCalledWith(
      { _id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'PROCESSING', leaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'PENDING', leaseId: null, leaseUntil: null, lastError: 'Cassandra unavailable' }),
      }),
    );
    const retryAt = outbox.updateOne.mock.calls[0][1].$set.nextAttemptAt as Date;
    expect(retryAt.getTime() - Date.now()).toBeLessThanOrEqual(30_100);
  });

  it('uses partition-key reads without ALLOW FILTERING and maps native Cassandra types', async () => {
    const { worker, cassandra } = workerSetup(null);
    cassandra.execute
      .mockResolvedValueOnce({ rows: [{ order_id: ORDER_ID, restaurant_id: RESTAURANT_ID, event_id: EVENT_ID, event_type: 'ORDER_CREATED', status: 'PENDING', total_cents: 1250, occurred_at: new Date('2026-07-18T12:00:00.000Z') }] })
      .mockResolvedValueOnce({ rows: [{ restaurant_id: RESTAURANT_ID, day: types.LocalDate.fromString('2026-07-18'), order_id: ORDER_ID, event_id: EVENT_ID, event_type: 'ORDER_CREATED', status: 'PENDING', total_cents: 1250, occurred_at: new Date('2026-07-18T12:00:00.000Z') }] });

    await expect(worker.getOrderTimeline(ORDER_ID)).resolves.toHaveLength(1);
    await expect(worker.getRestaurantActivity(RESTAURANT_ID, '2026-07-18')).resolves.toHaveLength(1);
    for (const [query, params, options] of cassandra.execute.mock.calls) {
      expect(query).not.toMatch(/ALLOW FILTERING/i);
      expect(options).toEqual({ prepare: true, isIdempotent: true });
      expect(params[0]).toBeInstanceOf(types.Uuid);
    }
    expect(cassandra.execute.mock.calls[1][1][1]).toBeInstanceOf(types.LocalDate);
  });

  it('reports Mongo outbox status and safely resets every event for replay', async () => {
    const { worker, outbox } = workerSetup(null);
    outbox.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(7);
    outbox.findOne.mockResolvedValueOnce(event({ occurredAt: new Date(Date.now() - 5_500) }));

    await expect(worker.getStatus()).resolves.toEqual(expect.objectContaining({ state: 'BACKLOG', pending: 2, processing: 1, processed: 7, lagSeconds: expect.any(Number) }));
    await expect(worker.replay()).resolves.toEqual({ reset: 3 });
    expect(outbox.updateMany).toHaveBeenCalledWith({}, expect.objectContaining({ $set: expect.objectContaining({ status: 'PENDING', attempts: 0, leaseId: null, processedAt: null }) }));
  });
});

describe('projection HTTP boundary', () => {
  const projectionMock = {
    getStatus: jest.fn().mockResolvedValue({ state: 'IDLE', pending: 0, processing: 0, processed: 0, lagSeconds: 0, oldestUnprocessedOccurredAt: null }),
    replay: jest.fn().mockResolvedValue({ reset: 0 }),
    getOrderTimeline: jest.fn().mockResolvedValue([]),
    getRestaurantActivity: jest.fn().mockResolvedValue([]),
  };

  @Module({ controllers: [ProjectionController], providers: [OperatorGuard, { provide: AuthService, useValue: { verify: jest.fn(() => ({ username: 'operator', role: 'operator' })) } }, { provide: ProjectionWorker, useValue: projectionMock }] })
  class ProjectionHttpTestModule {}

  it('protects all routes and rejects noncanonical IDs or impossible calendar days before Cassandra', async () => {
    const module = await Test.createTestingModule({ imports: [ProjectionHttpTestModule] }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const server = request(app.getHttpServer());

    await server.get('/api/projections/status').expect(401);
    await server.get('/api/projections/orders/550E8400-e29b-41d4-a716-446655440000/timeline').set('Cookie', 'operator_session=test').expect(400);
    await server.get(`/api/projections/restaurants/${RESTAURANT_ID}/activity?day=2026-02-30`).set('Cookie', 'operator_session=test').expect(400);
    await server.get(`/api/projections/orders/${ORDER_ID}/timeline`).set('Cookie', 'operator_session=test').expect(200);
    await server.get(`/api/projections/restaurants/${RESTAURANT_ID}/activity?day=2026-07-18`).set('Cookie', 'operator_session=test').expect(200);
    expect(projectionMock.getOrderTimeline).toHaveBeenCalledWith(ORDER_ID);
    expect(projectionMock.getRestaurantActivity).toHaveBeenCalledWith(RESTAURANT_ID, '2026-07-18');

    await app.close();
  });
});
