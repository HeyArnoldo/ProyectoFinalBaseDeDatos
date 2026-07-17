import {
  buildCollModCommand,
  COLLECTION_DEFINITIONS,
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

const { buildFixtureFilter } = require('./mongo-catalog.fixture.cjs');

const UUID_V4_PATTERN =
  '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

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
      expect.arrayContaining(['restaurantId', 'sku', 'priceCents', 'active']),
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
        { key: { restaurantId: 1, createdAt: -1 }, name: 'ix_orders_restaurant_createdAt' },
      ],
      outbox: [
        { key: { eventId: 1 }, name: 'uq_outbox_eventId', unique: true },
        {
          key: { processedAt: 1, nextAttemptAt: 1, leaseUntil: 1, createdAt: 1 },
          name: 'ix_outbox_claim',
        },
      ],
    });
  });

  it('queries only active catalog items for a restaurant', async () => {
    const find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            _id: '22222222-2222-4222-8222-222222222222',
            restaurantId: '11111111-1111-4111-8111-111111111111',
            sku: 'ACTIVE',
            name: 'Active item',
            priceCents: 1250,
            active: true,
          },
          {
            _id: '33333333-3333-4333-8333-333333333333',
            restaurantId: '11111111-1111-4111-8111-111111111111',
            sku: 'INACTIVE',
            name: 'Inactive item',
            priceCents: 1450,
            active: false,
          },
        ]),
      }),
    });
    const db = { collection: jest.fn().mockReturnValue({ find }) };
    const service = new CatalogService(db as never);

    await service.findActive('11111111-1111-4111-8111-111111111111');

    expect(find).toHaveBeenCalledWith({
      restaurantId: '11111111-1111-4111-8111-111111111111',
      active: true,
    });
  });

  it('returns catalog items parsed by the shared public contract', async () => {
    const toArray = jest.fn().mockResolvedValue([
      {
        _id: '22222222-2222-4222-8222-222222222222',
        restaurantId: '11111111-1111-4111-8111-111111111111',
        sku: 'ACTIVE',
        name: 'Active item',
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

    expect(SEED_CATALOG).toHaveLength(3);
    expect(bulkWrite).toHaveBeenCalledTimes(2);
    expect(bulkWrite.mock.calls[0][0]).toEqual(bulkWrite.mock.calls[1][0]);
    expect(bulkWrite.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ _id: expect.any(String) }),
            update: { $setOnInsert: expect.any(Object) },
            upsert: true,
          }),
        }),
      ]),
    );
    expect(bulkWrite.mock.calls[0][0]).toEqual(
      SEED_CATALOG.map((item) => ({
        updateOne: { filter: { _id: item._id }, update: { $setOnInsert: item }, upsert: true },
      })),
    );
    expect(bulkWrite.mock.calls[0][1]).toEqual({ ordered: true });
  });

  it('fails AppModule startup when Mongo configuration is missing', async () => {
    const originalUri = process.env.MONGODB_URI;
    const originalDatabase = process.env.MONGODB_DATABASE;
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DATABASE;

    try {
      await expect(Test.createTestingModule({ imports: [AppModule] }).compile()).rejects.toThrow(
        'MONGODB_URI is required',
      );
    } finally {
      if (originalUri === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = originalUri;
      if (originalDatabase === undefined) delete process.env.MONGODB_DATABASE;
      else process.env.MONGODB_DATABASE = originalDatabase;
    }
  });

  it('fails before connecting when the Mongo database name is missing', async () => {
    const originalUri = process.env.MONGODB_URI;
    const originalDatabase = process.env.MONGODB_DATABASE;
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:1';
    delete process.env.MONGODB_DATABASE;

    try {
      await expect(Test.createTestingModule({ imports: [AppModule] }).compile()).rejects.toThrow(
        'MONGODB_DATABASE is required',
      );
    } finally {
      if (originalUri === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = originalUri;
      if (originalDatabase === undefined) delete process.env.MONGODB_DATABASE;
      else process.env.MONGODB_DATABASE = originalDatabase;
    }
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
    expect(catalogIndex).toEqual(
      expect.objectContaining({
        key: { restaurantId: 1, sku: 1 },
        unique: true,
      }),
    );
  });
});
