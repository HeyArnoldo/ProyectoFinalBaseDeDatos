import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { orderTransitionResponseSchema, type OrderStatus, type OrderTransitionResponse } from '@app/contracts';
import { randomUUID } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import { MONGO_CLIENT, MONGO_DATABASE } from '../database/mongo.provider';
import type { OrderDocument, OutboxDocument } from './order.types';

const NEXT_STATES: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['DISPATCHED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function isAllowedOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATES[from].includes(to);
}

@Injectable()
export class TransitionService {
  constructor(
    @Inject(MONGO_DATABASE) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
  ) {}

  async transition(orderId: string, nextStatus: OrderStatus): Promise<OrderTransitionResponse> {
    const session = this.client.startSession();
    try {
      const response = await session.withTransaction(async () => {
        const orders = this.db.collection<OrderDocument>('orders');
        const current = await orders.findOne({ _id: orderId }, { session });
        if (!current) throw new NotFoundException('Order not found');
        if (!isAllowedOrderTransition(current.status, nextStatus)) {
          throw new BadRequestException('Invalid order transition');
        }

        const at = new Date();
        const history = { eventId: randomUUID(), status: nextStatus, at };
        const result = await orders.updateOne(
          { _id: orderId, status: current.status },
          { $set: { status: nextStatus, updatedAt: at }, $push: { history } } as never,
          { session },
        );
        if (result.matchedCount !== 1) throw new ConflictException('Order state changed before transition');

        const eventId = randomUUID();
        const outbox: OutboxDocument = {
          _id: randomUUID(),
          eventId,
          restaurantId: current.restaurantId,
          orderId,
          type: 'ORDER_STATUS_CHANGED',
          payload: { status: nextStatus, totalCents: current.totalCents },
          occurredAt: at,
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: null,
          leaseUntil: null,
          processedAt: null,
          lastError: null,
          createdAt: at,
          updatedAt: at,
        };
        await this.db.collection<OutboxDocument>('outbox').insertOne(outbox, { session });
        return orderTransitionResponseSchema.parse({ orderId, status: nextStatus });
      }, { writeConcern: { w: 'majority' } });
      return response;
    } finally {
      await session.endSession();
    }
  }
}
