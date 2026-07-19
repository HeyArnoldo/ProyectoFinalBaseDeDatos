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
exports.TransitionService = void 0;
exports.isAllowedOrderTransition = isAllowedOrderTransition;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@app/contracts");
const node_crypto_1 = require("node:crypto");
const mongo_provider_1 = require("../database/mongo.provider");
const NEXT_STATES = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['DISPATCHED'],
    DISPATCHED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
};
function isAllowedOrderTransition(from, to) {
    return NEXT_STATES[from].includes(to);
}
let TransitionService = class TransitionService {
    db;
    client;
    constructor(db, client) {
        this.db = db;
        this.client = client;
    }
    async transition(orderId, nextStatus) {
        const session = this.client.startSession();
        try {
            const response = await session.withTransaction(async () => {
                const orders = this.db.collection('orders');
                const current = await orders.findOne({ _id: orderId }, { session });
                if (!current)
                    throw new common_1.NotFoundException('Order not found');
                if (!isAllowedOrderTransition(current.status, nextStatus)) {
                    throw new common_1.BadRequestException('Invalid order transition');
                }
                const at = new Date();
                const history = { eventId: (0, node_crypto_1.randomUUID)(), status: nextStatus, at };
                const result = await orders.updateOne({ _id: orderId, status: current.status }, { $set: { status: nextStatus, updatedAt: at }, $push: { history } }, { session });
                if (result.matchedCount !== 1)
                    throw new common_1.ConflictException('Order state changed before transition');
                const eventId = (0, node_crypto_1.randomUUID)();
                const outbox = {
                    _id: (0, node_crypto_1.randomUUID)(),
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
                await this.db.collection('outbox').insertOne(outbox, { session });
                return contracts_1.orderTransitionResponseSchema.parse({ orderId, status: nextStatus });
            }, { writeConcern: { w: 'majority' } });
            return response;
        }
        finally {
            await session.endSession();
        }
    }
};
exports.TransitionService = TransitionService;
exports.TransitionService = TransitionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mongo_provider_1.MONGO_DATABASE)),
    __param(1, (0, common_1.Inject)(mongo_provider_1.MONGO_CLIENT)),
    __metadata("design:paramtypes", [Function, Function])
], TransitionService);
//# sourceMappingURL=transition.service.js.map