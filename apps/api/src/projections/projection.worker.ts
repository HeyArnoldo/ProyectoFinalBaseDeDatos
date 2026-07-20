import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import {
  projectionActivityRowsSchema,
  projectionReplayResponseSchema,
  projectionStatusSchema,
  projectionTimelineRowsSchema,
  type ProjectionActivityRows,
  type ProjectionReplayResponse,
  type ProjectionStatus,
  type ProjectionTimelineRows,
} from '@app/contracts';
import { randomUUID } from 'node:crypto';
import type { Client } from 'cassandra-driver';
import { types } from 'cassandra-driver';
import type { Db, Filter } from 'mongodb';
import { MONGO_DATABASE } from '../database/mongo.provider';
import type { OutboxDocument } from '../orders/order.types';
import { CASSANDRA_CLIENT, CASSANDRA_KEYSPACE } from './cassandra.provider';
import { CassandraBootstrapService } from './cql.bootstrap';

const POLL_INTERVAL_MS = 2_000;
const LEASE_MS = 30_000;
const BATCH_SIZE = 100;

const INSERT_ORDER_TIMELINE = `INSERT INTO ${CASSANDRA_KEYSPACE}.order_timeline_by_order (order_id, occurred_at, event_id, restaurant_id, event_type, status, total_cents) VALUES (?, ?, ?, ?, ?, ?, ?)`;
const INSERT_RESTAURANT_ACTIVITY = `INSERT INTO ${CASSANDRA_KEYSPACE}.restaurant_activity_by_day (restaurant_id, day, occurred_at, event_id, order_id, event_type, status, total_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
const SELECT_ORDER_TIMELINE = `SELECT order_id, occurred_at, event_id, restaurant_id, event_type, status, total_cents FROM ${CASSANDRA_KEYSPACE}.order_timeline_by_order WHERE order_id = ?`;
const SELECT_RESTAURANT_ACTIVITY = `SELECT restaurant_id, day, occurred_at, event_id, order_id, event_type, status, total_cents FROM ${CASSANDRA_KEYSPACE}.restaurant_activity_by_day WHERE restaurant_id = ? AND day = ?`;

type CassandraRow = Record<string, unknown>;

function retryDelay(attempts: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempts - 1), LEASE_MS);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asString(value: unknown): string {
  return String(value);
}

function asIsoDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(asString(value));
  return date.toISOString();
}

@Injectable()
export class ProjectionWorker implements OnModuleInit, OnApplicationShutdown {
  private interval?: NodeJS.Timeout;
  private activeTick?: Promise<void>;
  private stopped = false;
  private paused = false;

  constructor(
    @Inject(MONGO_DATABASE) private readonly db: Db,
    @Inject(CASSANDRA_CLIENT) private readonly cassandra: Client,
    private readonly bootstrap: CassandraBootstrapService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrap.ensureReady();
    if (this.stopped) return;
    this.interval = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    void this.tick();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.interval) clearInterval(this.interval);
    await this.activeTick;
  }

  async tick(): Promise<void> {
    if (this.stopped || this.paused) return;
    if (this.activeTick) return this.activeTick;

    const activeTick = this.processBatch();
    this.activeTick = activeTick;
    try {
      await activeTick;
    } catch {
      // The next poll retries Mongo outages; Cassandra failures are released for retry in the batch.
    } finally {
      if (this.activeTick === activeTick) this.activeTick = undefined;
    }
  }

  async getStatus(): Promise<ProjectionStatus> {
    const outbox = this.db.collection<OutboxDocument>('outbox');
    const unprocessed: Filter<OutboxDocument> = { status: { $in: ['PENDING', 'PROCESSING'] } };
    const [pending, processing, processed, oldest] = await Promise.all([
      outbox.countDocuments({ status: 'PENDING' }),
      outbox.countDocuments({ status: 'PROCESSING' }),
      outbox.countDocuments({ status: 'PROCESSED' }),
      outbox.findOne(unprocessed, { sort: { occurredAt: 1 } }),
    ]);
    const oldestOccurredAt = oldest?.occurredAt ?? null;
    const lagSeconds = oldestOccurredAt ? Math.max(0, Math.floor((Date.now() - oldestOccurredAt.getTime()) / 1_000)) : 0;

    return projectionStatusSchema.parse({
      state: pending + processing === 0 ? 'IDLE' : 'BACKLOG',
      pending,
      processing,
      processed,
      lagSeconds,
      oldestUnprocessedOccurredAt: oldestOccurredAt?.toISOString() ?? null,
    });
  }

  async replay(): Promise<ProjectionReplayResponse> {
    this.paused = true;
    try {
      await this.activeTick;
      const now = new Date();
      const result = await this.db.collection<OutboxDocument>('outbox').updateMany(
        {},
        {
          $set: {
            status: 'PENDING',
            attempts: 0,
            nextAttemptAt: null,
            leaseUntil: null,
            leaseId: null,
            processedAt: null,
            lastError: null,
            updatedAt: now,
          },
        },
      );
      return projectionReplayResponseSchema.parse({ reset: result.modifiedCount });
    } finally {
      this.paused = false;
      if (!this.stopped) void this.tick();
    }
  }

  async getOrderTimeline(orderId: string): Promise<ProjectionTimelineRows> {
    const result = await this.cassandra.execute(
      SELECT_ORDER_TIMELINE,
      [types.Uuid.fromString(orderId)],
      { prepare: true, isIdempotent: true },
    );
    return projectionTimelineRowsSchema.parse(result.rows.map((row) => this.timelineRow(row as CassandraRow)));
  }

  async getRestaurantActivity(restaurantId: string, day: string): Promise<ProjectionActivityRows> {
    const result = await this.cassandra.execute(
      SELECT_RESTAURANT_ACTIVITY,
      [types.Uuid.fromString(restaurantId), types.LocalDate.fromString(day)],
      { prepare: true, isIdempotent: true },
    );
    return projectionActivityRowsSchema.parse(result.rows.map((row) => this.activityRow(row as CassandraRow)));
  }

  private async processBatch(): Promise<void> {
    for (let count = 0; count < BATCH_SIZE && !this.stopped && !this.paused; count += 1) {
      const event = await this.claimNext();
      if (!event) return;
      try {
        await this.writeEvent(event);
        await this.markProcessed(event);
      } catch (error) {
        await this.releaseForRetry(event, error);
        return;
      }
    }
  }

  private async claimNext(): Promise<OutboxDocument | null> {
    const now = new Date();
    const leaseId = randomUUID();
    const outbox = this.db.collection<OutboxDocument>('outbox');
    const update = {
      $set: { status: 'PROCESSING' as const, leaseId, leaseUntil: new Date(now.getTime() + LEASE_MS), updatedAt: now },
      $inc: { attempts: 1 },
    };
    const options = { sort: { occurredAt: 1 as const, _id: 1 as const }, returnDocument: 'after' as const, includeResultMetadata: false as const };
    const pending = await outbox.findOneAndUpdate(
      {
        status: 'PENDING',
        cleanupProtected: { $ne: true },
        $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
      },
      update,
      options,
    );
    if (pending) return pending as OutboxDocument;

    const expiredProcessing = await outbox.findOneAndUpdate(
      { status: 'PROCESSING', cleanupProtected: { $ne: true }, leaseUntil: { $lte: now } },
      update,
      options,
    );
    return expiredProcessing as OutboxDocument | null;
  }

  private async writeEvent(event: OutboxDocument): Promise<void> {
    const eventId = types.Uuid.fromString(event.eventId);
    const orderId = types.Uuid.fromString(event.orderId);
    const restaurantId = types.Uuid.fromString(event.restaurantId);
    const day = types.LocalDate.fromString(event.occurredAt.toISOString().slice(0, 10));
    const options = { prepare: true, isIdempotent: true };

    await this.cassandra.execute(
      INSERT_ORDER_TIMELINE,
      [orderId, event.occurredAt, eventId, restaurantId, event.type, event.payload.status, event.payload.totalCents],
      options,
    );
    await this.cassandra.execute(
      INSERT_RESTAURANT_ACTIVITY,
      [restaurantId, day, event.occurredAt, eventId, orderId, event.type, event.payload.status, event.payload.totalCents],
      options,
    );
  }

  private async markProcessed(event: OutboxDocument): Promise<void> {
    await this.db.collection<OutboxDocument>('outbox').updateOne(
      { _id: event._id, status: 'PROCESSING', leaseId: event.leaseId },
      {
        $set: {
          status: 'PROCESSED',
          leaseId: null,
          leaseUntil: null,
          nextAttemptAt: null,
          processedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        },
      },
    );
  }

  private async releaseForRetry(event: OutboxDocument, error: unknown): Promise<void> {
    const now = new Date();
    await this.db.collection<OutboxDocument>('outbox').updateOne(
      { _id: event._id, status: 'PROCESSING', leaseId: event.leaseId },
      {
        $set: {
          status: 'PENDING',
          leaseId: null,
          leaseUntil: null,
          nextAttemptAt: new Date(now.getTime() + retryDelay(event.attempts)),
          lastError: errorMessage(error),
          updatedAt: now,
        },
      },
    );
  }

  private timelineRow(row: CassandraRow) {
    return {
      orderId: asString(row.order_id),
      restaurantId: asString(row.restaurant_id),
      eventId: asString(row.event_id),
      eventType: asString(row.event_type),
      status: asString(row.status),
      totalCents: Number(row.total_cents),
      occurredAt: asIsoDate(row.occurred_at),
    };
  }

  private activityRow(row: CassandraRow) {
    return {
      restaurantId: asString(row.restaurant_id),
      day: asString(row.day),
      orderId: asString(row.order_id),
      eventId: asString(row.event_id),
      eventType: asString(row.event_type),
      status: asString(row.status),
      totalCents: Number(row.total_cents),
      occurredAt: asIsoDate(row.occurred_at),
    };
  }
}

export const projectionCql = {
  insertOrderTimeline: INSERT_ORDER_TIMELINE,
  insertRestaurantActivity: INSERT_RESTAURANT_ACTIVITY,
  selectOrderTimeline: SELECT_ORDER_TIMELINE,
  selectRestaurantActivity: SELECT_RESTAURANT_ACTIVITY,
};
