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
exports.CheckoutService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@app/contracts");
const node_crypto_1 = require("node:crypto");
const mongo_provider_1 = require("../database/mongo.provider");
const seed_service_1 = require("../database/seed.service");
function requestHash(request, restaurantId) {
    return (0, node_crypto_1.createHash)('sha256')
        .update(JSON.stringify({ restaurantId, guest: request.guest, items: request.items }))
        .digest('hex');
}
function responseFor(order) {
    return contracts_1.checkoutResponseSchema.parse({ orderId: order._id, totalCents: order.totalCents, status: order.status });
}
function buildSnapshots(requestItems, catalogItems) {
    const catalogById = new Map(catalogItems.map((item) => [String(item._id), item]));
    if (catalogById.size !== requestItems.length) {
        throw new common_1.BadRequestException('One or more catalog items are unavailable');
    }
    return requestItems.map((item) => {
        const catalogItem = catalogById.get(item.catalogItemId);
        if (!catalogItem)
            throw new common_1.BadRequestException('One or more catalog items are unavailable');
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
let CheckoutService = class CheckoutService {
    db;
    client;
    constructor(db, client) {
        this.db = db;
        this.client = client;
    }
    async checkout(request, restaurantId = seed_service_1.DEFAULT_RESTAURANT_ID) {
        const hash = requestHash(request, restaurantId);
        const orderId = (0, node_crypto_1.randomUUID)();
        const eventId = (0, node_crypto_1.randomUUID)();
        const historyId = (0, node_crypto_1.randomUUID)();
        const outboxId = (0, node_crypto_1.randomUUID)();
        const now = new Date();
        const session = this.client.startSession();
        let response;
        try {
            await session.withTransaction(async () => {
                const orders = this.db.collection('orders');
                const existing = await orders.findOne({ idempotencyKey: request.idempotencyKey }, { session });
                if (existing) {
                    if (existing.requestHash !== hash) {
                        throw new common_1.ConflictException('Idempotency key was used with a different request');
                    }
                    response = responseFor(existing);
                    return;
                }
                const catalogItems = await this.db
                    .collection('catalog_items')
                    .find({ _id: { $in: request.items.map((item) => item.catalogItemId) }, restaurantId, active: true }, { session })
                    .toArray();
                const snapshots = buildSnapshots(request.items, catalogItems);
                const totalCents = snapshots.reduce((total, item) => total + item.lineTotalCents, 0);
                const order = {
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
                const outbox = {
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
                    processedAt: null,
                    lastError: null,
                    createdAt: now,
                    updatedAt: now,
                };
                await orders.insertOne(order, { session });
                await this.db.collection('outbox').insertOne(outbox, { session });
                response = responseFor(order);
            }, { writeConcern: { w: 'majority' } });
            return response;
        }
        catch (error) {
            const duplicateKey = typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
            if (!duplicateKey)
                throw error;
            const existing = await this.db.collection('orders').findOne({ idempotencyKey: request.idempotencyKey });
            if (!existing)
                throw error;
            if (existing.requestHash !== hash)
                throw new common_1.ConflictException('Idempotency key was used with a different request');
            return responseFor(existing);
        }
        finally {
            await session.endSession();
        }
    }
};
exports.CheckoutService = CheckoutService;
exports.CheckoutService = CheckoutService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mongo_provider_1.MONGO_DATABASE)),
    __param(1, (0, common_1.Inject)(mongo_provider_1.MONGO_CLIENT)),
    __metadata("design:paramtypes", [Function, Function])
], CheckoutService);
//# sourceMappingURL=checkout.service.js.map