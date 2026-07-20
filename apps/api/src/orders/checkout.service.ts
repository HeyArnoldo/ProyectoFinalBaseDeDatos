import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { checkoutResponseSchema, type CheckoutRequest, type CheckoutResponse } from '@app/contracts';
import { createHash, randomUUID } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import { MONGO_CLIENT, MONGO_DATABASE } from '../database/mongo.provider';
import { DEFAULT_RESTAURANT_ID } from '../database/seed.service';
import type { OrderDocument, OrderItemSnapshot, OutboxDocument } from './order.types';

type CatalogPriceRecord = {
  _id: string;
  restaurantId: string;
  sku: string;
  name: string;
  priceCents: number;
};

function requestHash(request: CheckoutRequest, restaurantId: string): string {
  return createHash('sha256')
    .update(JSON.stringify({ restaurantId, guest: request.guest, items: request.items }))
    .digest('hex');
}

function responseFor(order: OrderDocument): CheckoutResponse {
  return checkoutResponseSchema.parse({
    orderId: order._id,
    totalCents: order.totalCents,
    status: 'PENDING',
    projectionStatus: 'PENDING',
  });
}

function buildSnapshots(requestItems: CheckoutRequest['items'], catalogItems: CatalogPriceRecord[]): OrderItemSnapshot[] {
  const catalogById = new Map(catalogItems.map((item) => [String(item._id), item]));
  if (catalogById.size !== requestItems.length) {
    throw new BadRequestException('One or more catalog items are unavailable');
  }

  return requestItems.map((item) => {
    const catalogItem = catalogById.get(item.catalogItemId);
    if (!catalogItem) throw new BadRequestException('One or more catalog items are unavailable');
    return {
      catalogItemId: item.catalogItemId,
      sku: catalogItem.sku,
      name: catalogItem.name,
      unitPriceCents: catalogItem.priceCents,
      quantity: item.quantity,
      lineTotalCents: catalogItem.priceCents * item.quantity,
    };
  });
}

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(MONGO_DATABASE) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
  ) {}

  async checkout(request: CheckoutRequest, restaurantId = DEFAULT_RESTAURANT_ID): Promise<CheckoutResponse> {
    const hash = requestHash(request, restaurantId);
    const orderId = randomUUID();
    const eventId = randomUUID();
    const historyId = randomUUID();
    const outboxId = randomUUID();
    const now = new Date();
    const session = this.client.startSession();
    let response: CheckoutResponse | undefined;

    try {
      await session.withTransaction(async () => {
        const orders = this.db.collection<OrderDocument>('orders');
        const existing = await orders.findOne({ idempotencyKey: request.idempotencyKey }, { session });
        if (existing) {
          if (existing.requestHash !== hash) {
            throw new ConflictException('Idempotency key was used with a different request');
          }
          response = responseFor(existing);
          return;
        }

        const catalogItems = await this.db
          .collection<CatalogPriceRecord>('catalog_items')
          .find(
            { _id: { $in: request.items.map((item) => item.catalogItemId) }, restaurantId, active: true },
            { session },
          )
          .toArray();
        const snapshots = buildSnapshots(request.items, catalogItems);
        const totalCents = snapshots.reduce((total, item) => total + item.lineTotalCents, 0);
        const order: OrderDocument = {
          _id: orderId,
          restaurantId,
          guest: request.guest,
          items: snapshots,
          totalCents,
          status: 'PENDING',
          history: [{ eventId: historyId, status: 'PENDING', at: now }],
          idempotencyKey: request.idempotencyKey,
          requestHash: hash,
          createdAt: now,
          updatedAt: now,
        };
        const outbox: OutboxDocument = {
          _id: outboxId,
          eventId,
          restaurantId,
          orderId,
          type: 'ORDER_CREATED',
          payload: { status: 'PENDING', totalCents },
          occurredAt: now,
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: null,
          leaseUntil: null,
          leaseId: null,
          processedAt: null,
          lastError: null,
          cleanupProtected: false,
          createdAt: now,
          updatedAt: now,
        };

        await orders.insertOne(order, { session });
        await this.db.collection<OutboxDocument>('outbox').insertOne(outbox, { session });
        response = responseFor(order);
      }, { writeConcern: { w: 'majority' } });
      return response as CheckoutResponse;
    } catch (error) {
      const duplicateKey = typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
      if (!duplicateKey) throw error;
      const existing = await this.db.collection<OrderDocument>('orders').findOne({ idempotencyKey: request.idempotencyKey });
      if (!existing) throw error;
      if (existing.requestHash !== hash) throw new ConflictException('Idempotency key was used with a different request');
      return responseFor(existing);
    } finally {
      await session.endSession();
    }
  }
}
