import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Db } from 'mongodb';
import { MONGO_DATABASE } from './mongo.tokens';
import { seedCatalog } from './seed.service';

export const UUID_V4_PATTERN =
  '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

export const COLLECTION_DEFINITIONS = {
  catalog_items: {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'restaurantId', 'sku', 'name', 'priceCents', 'active', 'createdAt', 'updatedAt'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'string', pattern: UUID_V4_PATTERN },
          restaurantId: { bsonType: 'string', pattern: UUID_V4_PATTERN },
          sku: { bsonType: 'string', minLength: 1, maxLength: 64 },
          name: { bsonType: 'string', minLength: 1, maxLength: 200 },
          priceCents: { bsonType: 'int', minimum: 0 },
          active: { bsonType: 'bool' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
  },
  orders: {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'restaurantId', 'guest', 'items', 'totalCents', 'status', 'history', 'idempotencyKey', 'requestHash', 'createdAt', 'updatedAt'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'string', pattern: UUID_V4_PATTERN },
          restaurantId: { bsonType: 'string', pattern: UUID_V4_PATTERN },
          guest: { bsonType: 'object', required: ['name', 'phone', 'address'], additionalProperties: false, properties: { name: { bsonType: 'string' }, phone: { bsonType: 'string' }, address: { bsonType: 'string' } } },
          items: { bsonType: 'array', minItems: 1, items: { bsonType: 'object', required: ['catalogItemId', 'sku', 'name', 'unitPriceCents', 'quantity', 'lineTotalCents'], additionalProperties: false, properties: { catalogItemId: { bsonType: 'string', pattern: UUID_V4_PATTERN }, sku: { bsonType: 'string' }, name: { bsonType: 'string' }, unitPriceCents: { bsonType: 'int', minimum: 0 }, quantity: { bsonType: 'int', minimum: 1 }, lineTotalCents: { bsonType: 'int', minimum: 0 } } } },
          totalCents: { bsonType: 'int', minimum: 0 }, status: { bsonType: 'string', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED'] },
          history: { bsonType: 'array', items: { bsonType: 'object', required: ['eventId', 'status', 'at'], additionalProperties: false, properties: { eventId: { bsonType: 'string', pattern: UUID_V4_PATTERN }, status: { bsonType: 'string' }, at: { bsonType: 'date' } } } },
          idempotencyKey: { bsonType: 'string' }, requestHash: { bsonType: 'string' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
        },
      },
    },
  },
  outbox: {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'eventId', 'restaurantId', 'orderId', 'type', 'payload', 'occurredAt', 'status', 'attempts', 'createdAt', 'updatedAt'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'string', pattern: UUID_V4_PATTERN }, eventId: { bsonType: 'string', pattern: UUID_V4_PATTERN }, restaurantId: { bsonType: 'string', pattern: UUID_V4_PATTERN }, orderId: { bsonType: 'string', pattern: UUID_V4_PATTERN },
          type: { bsonType: 'string', enum: ['ORDER_CREATED', 'ORDER_STATUS_CHANGED'] }, payload: { bsonType: 'object', required: ['status', 'totalCents'], additionalProperties: false, properties: { status: { bsonType: 'string' }, totalCents: { bsonType: 'int', minimum: 0 } } },
          occurredAt: { bsonType: 'date' }, status: { bsonType: 'string', enum: ['PENDING', 'PROCESSING', 'PROCESSED'] }, attempts: { bsonType: 'int', minimum: 0 },
          nextAttemptAt: { bsonType: ['date', 'null'] }, leaseUntil: { bsonType: ['date', 'null'] }, processedAt: { bsonType: ['date', 'null'] }, lastError: { bsonType: ['string', 'null'] }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
        },
      },
    },
  },
} as const;

export const INDEX_DEFINITIONS = {
  catalog_items: [{ key: { restaurantId: 1, sku: 1 }, name: 'uq_catalog_restaurant_sku', unique: true }],
  orders: [{ key: { idempotencyKey: 1 }, name: 'uq_orders_idempotency', unique: true }, { key: { restaurantId: 1, createdAt: -1 }, name: 'ix_orders_restaurant_createdAt' }],
  outbox: [{ key: { eventId: 1 }, name: 'uq_outbox_eventId', unique: true }, { key: { processedAt: 1, nextAttemptAt: 1, leaseUntil: 1, createdAt: 1 }, name: 'ix_outbox_claim' }],
} as const;

export function buildCollModCommand(
  name: string,
  definition: { validator: object },
) {
  return {
    collMod: name,
    validator: definition.validator,
    validationLevel: 'strict',
    validationAction: 'error',
  };
}

export async function bootstrapMongo(db: Db): Promise<void> {
  for (const [name, definition] of Object.entries(COLLECTION_DEFINITIONS)) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (exists) {
      await db.command(buildCollModCommand(name, definition));
    } else {
      await db.createCollection(name, { ...definition, validationLevel: 'strict', validationAction: 'error' });
    }
    for (const index of INDEX_DEFINITIONS[name as keyof typeof INDEX_DEFINITIONS]) {
      await db.collection(name).createIndex(index.key, {
        name: index.name,
        unique: 'unique' in index ? index.unique : false,
      });
    }
  }
  await seedCatalog(db);
}

@Injectable()
export class MongoBootstrapService implements OnModuleInit {
  constructor(@Inject(MONGO_DATABASE) private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    await bootstrapMongo(this.db);
  }
}
