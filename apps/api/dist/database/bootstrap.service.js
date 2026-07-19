"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoBootstrapService = exports.INDEX_DEFINITIONS = exports.COLLECTION_DEFINITIONS = exports.UUID_V4_PATTERN = void 0;
exports.buildCollModCommand = buildCollModCommand;
exports.bootstrapMongo = bootstrapMongo;
const common_1 = require("@nestjs/common");
const mongodb_1 = require("mongodb");
const mongo_tokens_1 = require("./mongo.tokens");
const seed_service_1 = require("./seed.service");
exports.UUID_V4_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
exports.COLLECTION_DEFINITIONS = {
    catalog_items: {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['_id', 'restaurantId', 'sku', 'name', 'priceCents', 'active', 'createdAt', 'updatedAt'],
                additionalProperties: false,
                properties: {
                    _id: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN },
                    restaurantId: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN },
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
                    _id: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN },
                    restaurantId: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN },
                    guest: { bsonType: 'object', required: ['name', 'phone', 'address'], additionalProperties: false, properties: { name: { bsonType: 'string' }, phone: { bsonType: 'string' }, address: { bsonType: 'string' } } },
                    items: { bsonType: 'array', minItems: 1, items: { bsonType: 'object', required: ['catalogItemId', 'sku', 'name', 'unitPriceCents', 'quantity', 'lineTotalCents'], additionalProperties: false, properties: { catalogItemId: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN }, sku: { bsonType: 'string' }, name: { bsonType: 'string' }, unitPriceCents: { bsonType: 'int', minimum: 0 }, quantity: { bsonType: 'int', minimum: 1 }, lineTotalCents: { bsonType: 'int', minimum: 0 } } } },
                    totalCents: { bsonType: 'int', minimum: 0 }, status: { bsonType: 'string', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED'] },
                    history: { bsonType: 'array', items: { bsonType: 'object', required: ['eventId', 'status', 'at'], additionalProperties: false, properties: { eventId: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN }, status: { bsonType: 'string' }, at: { bsonType: 'date' } } } },
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
                    _id: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN }, eventId: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN }, restaurantId: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN }, orderId: { bsonType: 'string', pattern: exports.UUID_V4_PATTERN },
                    type: { bsonType: 'string', enum: ['ORDER_CREATED', 'ORDER_STATUS_CHANGED'] }, payload: { bsonType: 'object', required: ['status', 'totalCents'], additionalProperties: false, properties: { status: { bsonType: 'string' }, totalCents: { bsonType: 'int', minimum: 0 } } },
                    occurredAt: { bsonType: 'date' }, status: { bsonType: 'string', enum: ['PENDING', 'PROCESSING', 'PROCESSED'] }, attempts: { bsonType: 'int', minimum: 0 },
                    nextAttemptAt: { bsonType: ['date', 'null'] }, leaseUntil: { bsonType: ['date', 'null'] }, processedAt: { bsonType: ['date', 'null'] }, lastError: { bsonType: ['string', 'null'] }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
                },
            },
        },
    },
};
exports.INDEX_DEFINITIONS = {
    catalog_items: [{ key: { restaurantId: 1, sku: 1 }, name: 'uq_catalog_restaurant_sku', unique: true }],
    orders: [{ key: { idempotencyKey: 1 }, name: 'uq_orders_idempotency', unique: true }, { key: { restaurantId: 1, createdAt: -1 }, name: 'ix_orders_restaurant_createdAt' }],
    outbox: [{ key: { eventId: 1 }, name: 'uq_outbox_eventId', unique: true }, { key: { processedAt: 1, nextAttemptAt: 1, leaseUntil: 1, createdAt: 1 }, name: 'ix_outbox_claim' }],
};
function buildCollModCommand(name, definition) {
    return {
        collMod: name,
        validator: definition.validator,
        validationLevel: 'strict',
        validationAction: 'error',
    };
}
async function bootstrapMongo(db) {
    for (const [name, definition] of Object.entries(exports.COLLECTION_DEFINITIONS)) {
        const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
        if (exists) {
            await db.command(buildCollModCommand(name, definition));
        }
        else {
            await db.createCollection(name, { ...definition, validationLevel: 'strict', validationAction: 'error' });
        }
        for (const index of exports.INDEX_DEFINITIONS[name]) {
            await db.collection(name).createIndex(index.key, {
                name: index.name,
                unique: 'unique' in index ? index.unique : false,
            });
        }
    }
    await (0, seed_service_1.seedCatalog)(db);
}
let MongoBootstrapService = class MongoBootstrapService {
    db;
    constructor(db) {
        this.db = db;
    }
    async onModuleInit() {
        await bootstrapMongo(this.db);
    }
};
exports.MongoBootstrapService = MongoBootstrapService;
exports.MongoBootstrapService = MongoBootstrapService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mongo_tokens_1.MONGO_DATABASE)),
    __metadata("design:paramtypes", [mongodb_1.Db])
], MongoBootstrapService);
//# sourceMappingURL=bootstrap.service.js.map