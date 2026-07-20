import {
  buildCollModCommand,
  COLLECTION_DEFINITIONS,
  ensureNamedIndexes,
  INDEX_DEFINITIONS,
} from '../src/database/bootstrap.service';
import { Test } from '@nestjs/testing';
import {
  MONGO_CLIENT,
  MONGO_DATABASE,
  MongoLifecycle,
  MongoModule,
} from '../src/database/mongo.provider';
import { seedCatalog, SEED_CATALOG } from '../src/database/seed.service';
import { CatalogService } from '../src/catalog/catalog.service';
import { AppModule } from '../src/app.module';
import { CASSANDRA_CLIENT, CASSANDRA_CONFIG } from '../src/projections/cassandra.provider';

const { buildFixtureFilter } = require('./mongo-catalog.fixture.cjs');

const UUID_V4_PATTERN =
  '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

async function expectAppModuleError(message: string, configureMongo: () => void): Promise<void> {
  const names = ['MONGODB_URI', 'MONGODB_DATABASE', 'OPERATOR_USERNAME', 'OPERATOR_PASSWORD_HASH', 'JWT_SECRET'] as const;
  const original = new Map(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, { OPERATOR_USERNAME: 'test-operator', OPERATOR_PASSWORD_HASH: 'test-bcrypt-hash', JWT_SECRET: 'test-jwt-secret' });
  configureMongo();
  try {
    await expect(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(CASSANDRA_CONFIG)
        .useValue({ contactPoints: ['cassandra'], localDataCenter: 'datacenter1', port: 9042 })
        .overrideProvider(CASSANDRA_CLIENT)
        .useValue({ shutdown: jest.fn() })
        .compile(),
    ).rejects.toThrow(message);
  } finally {
    for (const name of names) {
      const value = original.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

describe('MongoDB catalog foundation', () => {
  it('generates cleanup filters scoped to the fixture identity and restaurant', () => {
    const fixture = {
      _id: '55555555-5555-4555-8555-555555555555',
      restaurantId: '11111111-1111-4111-8111-111111111111',
      sku: 'BLACK-BOX-DUP',
    };

    expect(buildFixtureFilter(fixture)).toEqual({
      _id: fixture._id,
      restaurantId: fixture.restaurantId,
    });
  });

  it('keeps cleanup filters distinct for fixtures sharing a SKU', () => {
    const firstFixture = {
      _id: '55555555-5555-4555-8555-555555555555',
      restaurantId: '11111111-1111-4111-8111-111111111111',
      sku: 'BLACK-BOX-DUP',
    };
    const secondFixture = {
      _id: '66666666-6666-4666-8666-666666666666',
      restaurantId: '77777777-7777-4777-8777-777777777777',
      sku: firstFixture.sku,
    };

    expect(buildFixtureFilter(secondFixture)).toEqual({
      _id: secondFixture._id,
      restaurantId: secondFixture.restaurantId,
    });
    expect(buildFixtureFilter(firstFixture)).not.toEqual(buildFixtureFilter(secondFixture));
  });

  it('nests the validator correctly in an idempotent collMod command', () => {
    const command = buildCollModCommand('catalog_items', COLLECTION_DEFINITIONS.catalog_items);

    expect(command).toEqual(
      expect.objectContaining({
        collMod: 'catalog_items',
        validator: COLLECTION_DEFINITIONS.catalog_items.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      }),
    );
    expect(command).not.toHaveProperty('$jsonSchema');
  });

  it('resolves the native Mongo provider graph without a circular token import', async () => {
    const database = {};
    const close = jest.fn().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({ imports: [MongoModule] })
      .overrideProvider(MONGO_CLIENT)
      .useValue({ close })
      .overrideProvider(MONGO_DATABASE)
      .useValue(database)
      .compile();

    expect(module.get(MONGO_DATABASE)).toBe(database);
    await module.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the Mongo client during application shutdown', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const lifecycle = new MongoLifecycle({ close } as never);

    await lifecycle.onApplicationShutdown();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('defines strict validators and the required named indexes', () => {
    const catalogSchema = COLLECTION_DEFINITIONS.catalog_items.validator.$jsonSchema;
    const ordersSchema = COLLECTION_DEFINITIONS.orders.validator.$jsonSchema;
    const outboxSchema = COLLECTION_DEFINITIONS.outbox.validator.$jsonSchema;

    expect(catalogSchema.additionalProperties).toBe(false);
    expect(catalogSchema.required).toEqual(
      expect.arrayContaining(['restaurantId', 'sku', 'category', 'description', 'imageUrl', 'priceCents', 'active']),
    );
    expect(ordersSchema.additionalProperties).toBe(false);
    expect(outboxSchema.additionalProperties).toBe(false);

    expect(INDEX_DEFINITIONS.catalog_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'uq_catalog_restaurant_sku',
          unique: true,
        }),
      ]),
    );
    expect(INDEX_DEFINITIONS.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'uq_orders_idempotency', unique: true }),
        expect.objectContaining({ name: 'ix_orders_restaurant_createdAt' }),
      ]),
    );
    expect(INDEX_DEFINITIONS.outbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'uq_outbox_eventId', unique: true }),
        expect.objectContaining({ name: 'ix_outbox_claim' }),
      ]),
    );
  });

  it('requires canonical lowercase UUIDv4 strings for every UUID field', () => {
    const catalogSchema = COLLECTION_DEFINITIONS.catalog_items.validator.$jsonSchema as any;
    const ordersSchema = COLLECTION_DEFINITIONS.orders.validator.$jsonSchema as any;
    const outboxSchema = COLLECTION_DEFINITIONS.outbox.validator.$jsonSchema as any;

    expect(catalogSchema.properties._id.pattern).toBe(UUID_V4_PATTERN);
    expect(catalogSchema.properties.restaurantId.pattern).toBe(UUID_V4_PATTERN);
    expect(ordersSchema.properties._id.pattern).toBe(UUID_V4_PATTERN);
    expect(ordersSchema.properties.restaurantId.pattern).toBe(UUID_V4_PATTERN);
    expect(ordersSchema.properties.items.items.properties.catalogItemId.pattern).toBe(UUID_V4_PATTERN);
    expect(ordersSchema.properties.history.items.properties.eventId.pattern).toBe(UUID_V4_PATTERN);
    expect(outboxSchema.properties._id.pattern).toBe(UUID_V4_PATTERN);
    expect(outboxSchema.properties.eventId.pattern).toBe(UUID_V4_PATTERN);
    expect(outboxSchema.properties.restaurantId.pattern).toBe(UUID_V4_PATTERN);
    expect(outboxSchema.properties.orderId.pattern).toBe(UUID_V4_PATTERN);
  });

  it('preserves the exact index keys and directions required by the design', () => {
    expect(INDEX_DEFINITIONS).toEqual({
      catalog_items: [
        { key: { restaurantId: 1, sku: 1 }, name: 'uq_catalog_restaurant_sku', unique: true },
      ],
      orders: [
        { key: { idempotencyKey: 1 }, name: 'uq_orders_idempotency', unique: true },
        { key: { restaurantId: 1, createdAt: -1, _id: -1 }, name: 'ix_orders_restaurant_createdAt' },
      ],
      outbox: [
        { key: { eventId: 1 }, name: 'uq_outbox_eventId', unique: true },
        {
          key: { status: 1, cleanupProtected: 1, nextAttemptAt: 1, occurredAt: 1, _id: 1 },
          name: 'ix_outbox_claim',
        },
        {
          key: { status: 1, cleanupProtected: 1, leaseUntil: 1, occurredAt: 1, _id: 1 },
          name: 'ix_outbox_claim_expired_processing',
        },
      ],
    });
  });

  it('replaces a named index only when its key changes and leaves the migrated index alone thereafter', async () => {
    const dropIndex = jest.fn().mockResolvedValue(undefined);
    const createIndex = jest.fn().mockResolvedValue('ix_outbox_claim');
    const listIndexes = jest.fn()
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([{ name: 'ix_outbox_claim', key: { processedAt: 1, nextAttemptAt: 1, leaseUntil: 1, createdAt: 1 } }]) })
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([{ name: 'ix_outbox_claim', key: { status: 1, cleanupProtected: 1, nextAttemptAt: 1, occurredAt: 1, _id: 1 } }]) });
    const collection = { listIndexes, dropIndex, createIndex };
    const pending = INDEX_DEFINITIONS.outbox.find((index) => index.name === 'ix_outbox_claim')!;

    await ensureNamedIndexes(collection as never, [pending]);
    await ensureNamedIndexes(collection as never, [pending]);

    expect(dropIndex).toHaveBeenCalledTimes(1);
    expect(createIndex).toHaveBeenCalledTimes(1);
  });

  it('queries only active catalog items for a restaurant', async () => {
    const sort = jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        {
          _id: '22222222-2222-4222-8222-222222222222',
          restaurantId: '11111111-1111-4111-8111-111111111111',
          sku: 'ACTIVE',
          name: 'Active item',
          category: 'Brasa',
          description: 'A charcoal-grilled active item.',
          imageUrl: null,
          priceCents: 1250,
          active: true,
        },
        {
          _id: '33333333-3333-4333-8333-333333333333',
          restaurantId: '11111111-1111-4111-8111-111111111111',
          sku: 'INACTIVE',
          name: 'Inactive item',
          category: 'Brasa',
          description: 'An inactive charcoal-grilled item.',
          imageUrl: null,
          priceCents: 1450,
          active: false,
        },
      ]),
    });
    const find = jest.fn().mockReturnValue({ sort });
    const db = { collection: jest.fn().mockReturnValue({ find }) };
    const service = new CatalogService(db as never);

    await service.findActive('11111111-1111-4111-8111-111111111111');

    expect(find).toHaveBeenCalledWith({
      restaurantId: '11111111-1111-4111-8111-111111111111',
      active: true,
    });
    expect(sort).toHaveBeenCalledWith({ category: 1, name: 1, sku: 1 });
  });

  it('returns catalog items parsed by the shared public contract', async () => {
    const toArray = jest.fn().mockResolvedValue([
      {
        _id: '22222222-2222-4222-8222-222222222222',
        restaurantId: '11111111-1111-4111-8111-111111111111',
        sku: 'ACTIVE',
        name: 'Active item',
        category: 'Brasa',
        description: 'A charcoal-grilled active item.',
        imageUrl: null,
        priceCents: 1250,
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ toArray }),
    });
    const service = new CatalogService({ collection: jest.fn().mockReturnValue({ find }) } as never);

    await expect(service.findActive('11111111-1111-4111-8111-111111111111')).resolves.toEqual([
      {
        _id: '22222222-2222-4222-8222-222222222222',
        restaurantId: '11111111-1111-4111-8111-111111111111',
        sku: 'ACTIVE',
        name: 'Active item',
        category: 'Brasa',
        description: 'A charcoal-grilled active item.',
        imageUrl: null,
        priceCents: 1250,
        active: true,
      },
    ]);
  });

  it('rejects malformed catalog documents before returning them publicly', async () => {
    const toArray = jest.fn().mockResolvedValue([
      {
        _id: 'not-a-uuid',
        restaurantId: '11111111-1111-4111-8111-111111111111',
        sku: 'ACTIVE',
        name: 'Active item',
        category: 'Brasa',
        description: 'A charcoal-grilled active item.',
        imageUrl: null,
        priceCents: 1250,
        active: true,
      },
    ]);
    const find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ toArray }),
    });
    const service = new CatalogService({ collection: jest.fn().mockReturnValue({ find }) } as never);

    await expect(service.findActive('11111111-1111-4111-8111-111111111111')).rejects.toThrow();
  });

  it('seeds the same fixed catalog through idempotent upserts', async () => {
    const bulkWrite = jest.fn().mockResolvedValue({});
    const db = { collection: jest.fn().mockReturnValue({ bulkWrite }) };

    await seedCatalog(db as never);
    await seedCatalog(db as never);

    expect(SEED_CATALOG).toHaveLength(12);
    expect(SEED_CATALOG.filter((item) => item.active)).toHaveLength(10);
    expect(SEED_CATALOG.filter((item) => !item.active)).toHaveLength(2);
    expect(bulkWrite).toHaveBeenCalledTimes(2);
    expect(bulkWrite.mock.calls[0][0]).toEqual(bulkWrite.mock.calls[1][0]);
    expect(bulkWrite.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          replaceOne: expect.objectContaining({
            filter: expect.objectContaining({ _id: expect.any(String) }),
            replacement: expect.objectContaining({ category: expect.any(String), description: expect.any(String), imageUrl: null }),
            upsert: true,
          }),
        }),
      ]),
    );
    expect(bulkWrite.mock.calls[0][0]).toEqual(
      SEED_CATALOG.map((item) => ({
        replaceOne: { filter: { _id: item._id }, replacement: item, upsert: true },
      })),
    );
    expect(bulkWrite.mock.calls[0][1]).toEqual({ ordered: true });
  });

  it('fails AppModule startup when Mongo configuration is missing', async () => {
    await expectAppModuleError('MONGODB_URI is required', () => {
      delete process.env.MONGODB_URI;
      delete process.env.MONGODB_DATABASE;
    });
  });

  it('fails before connecting when the Mongo database name is missing', async () => {
    await expectAppModuleError('MONGODB_DATABASE is required', () => {
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:1';
      delete process.env.MONGODB_DATABASE;
    });
  });

  it('models invalid and duplicate writes as Mongo enforcement concerns', () => {
    const catalogSchema = COLLECTION_DEFINITIONS.catalog_items.validator.$jsonSchema;
    const catalogIndex = INDEX_DEFINITIONS.catalog_items.find(
      (index) => index.name === 'uq_catalog_restaurant_sku',
    );

    expect(catalogSchema.properties.priceCents).toEqual(
      expect.objectContaining({ bsonType: 'int', minimum: 0 }),
    );
    expect(catalogSchema.properties.active).toEqual({ bsonType: 'bool' });
    expect(catalogSchema.properties.category).toEqual(expect.objectContaining({ bsonType: 'string', minLength: 1 }));
    expect(catalogSchema.properties.description).toEqual(expect.objectContaining({ bsonType: 'string', minLength: 1 }));
    expect(catalogSchema.properties.imageUrl).toEqual({ bsonType: ['string', 'null'], minLength: 1 });
    expect(catalogIndex).toEqual(
      expect.objectContaining({
        key: { restaurantId: 1, sku: 1 },
        unique: true,
      }),
    );
  });
});
