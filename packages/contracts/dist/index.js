"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderTransitionResponseSchema = exports.orderTransitionRequestSchema = exports.operatorLoginRequestSchema = exports.orderStatusSchema = exports.checkoutResponseSchema = exports.checkoutRequestSchema = exports.catalogItemSchema = exports.healthResponseSchema = void 0;
const zod_1 = require("zod");
exports.healthResponseSchema = zod_1.z.object({
    status: zod_1.z.literal('ok'),
});
exports.catalogItemSchema = zod_1.z.object({
    _id: zod_1.z.string().uuid(),
    restaurantId: zod_1.z.string().uuid(),
    sku: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    priceCents: zod_1.z.number().int().nonnegative(),
    active: zod_1.z.boolean(),
});
exports.checkoutRequestSchema = zod_1.z.object({
    guest: zod_1.z.object({
        name: zod_1.z.string().min(1),
        phone: zod_1.z.string().min(1),
        address: zod_1.z.string().min(1),
    }),
    items: zod_1.z.array(zod_1.z.object({ catalogItemId: zod_1.z.string().uuid(), quantity: zod_1.z.number().int().min(1) })).min(1),
    idempotencyKey: zod_1.z.string().min(1),
    totalCents: zod_1.z.number().int().nonnegative().optional(),
});
exports.checkoutResponseSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    totalCents: zod_1.z.number().int().nonnegative(),
    status: zod_1.z.literal('PENDING'),
});
exports.orderStatusSchema = zod_1.z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED']);
exports.operatorLoginRequestSchema = zod_1.z.object({ username: zod_1.z.string().min(1), password: zod_1.z.string().min(1) });
exports.orderTransitionRequestSchema = zod_1.z.object({ status: exports.orderStatusSchema });
exports.orderTransitionResponseSchema = zod_1.z.object({ orderId: zod_1.z.string().uuid(), status: exports.orderStatusSchema });
