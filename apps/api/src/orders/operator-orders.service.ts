import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { operatorOrdersResponseSchema, type OperatorOrdersQuery } from '@app/contracts';
import type { Db, Filter } from 'mongodb';
import { MONGO_DATABASE } from '../database/mongo.provider';
import type { OrderDocument } from './order.types';

type OrderCursor = { createdAt: string; orderId: string };

function encodeCursor(order: Pick<OrderDocument, '_id' | 'createdAt'>): string {
  const value: OrderCursor = { createdAt: order.createdAt.toISOString(), orderId: order._id };
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(value: string): { createdAt: Date; orderId: string } {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<OrderCursor>;
    if (typeof decoded.createdAt !== 'string' || typeof decoded.orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(decoded.orderId)) throw new Error('invalid cursor');
    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== decoded.createdAt) throw new Error('invalid cursor');
    return { createdAt, orderId: decoded.orderId };
  } catch {
    throw new BadRequestException('Invalid operator orders cursor');
  }
}

@Injectable()
export class OperatorOrdersService {
  constructor(@Inject(MONGO_DATABASE) private readonly db: Db) {}

  async list(query: OperatorOrdersQuery) {
    const filter: Filter<OrderDocument> = {
      restaurantId: query.restaurantId,
      ...(query.status ? { status: query.status } : {}),
    };
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.orderId } },
      ];
    }
    const orders = await this.db.collection<OrderDocument>('orders')
      .find(filter, {
        projection: {
          _id: 1,
          guest: 1,
          items: 1,
          totalCents: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ restaurantId: 1, createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .toArray();

    const page = orders.slice(0, query.limit);
    const nextCursor = orders.length > query.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null;
    return operatorOrdersResponseSchema.parse({
      orders: page.map((order) => ({
      orderId: order._id,
      guest: order.guest,
      items: order.items.map((item) => ({ name: item.name, quantity: item.quantity, lineTotalCents: item.lineTotalCents })),
      totalCents: order.totalCents,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      })),
      nextCursor,
    });
  }
}
