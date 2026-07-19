import { z } from 'zod';
export declare const healthResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<"ok">;
}, z.core.$strip>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export declare const catalogItemSchema: z.ZodObject<{
    _id: z.ZodString;
    restaurantId: z.ZodString;
    sku: z.ZodString;
    name: z.ZodString;
    priceCents: z.ZodNumber;
    active: z.ZodBoolean;
}, z.core.$strip>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export declare const checkoutRequestSchema: z.ZodObject<{
    guest: z.ZodObject<{
        name: z.ZodString;
        phone: z.ZodString;
        address: z.ZodString;
    }, z.core.$strip>;
    items: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        quantity: z.ZodNumber;
    }, z.core.$strip>>;
    idempotencyKey: z.ZodString;
    totalCents: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export declare const checkoutResponseSchema: z.ZodObject<{
    orderId: z.ZodString;
    totalCents: z.ZodNumber;
    status: z.ZodLiteral<"PENDING">;
}, z.core.$strip>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export declare const orderStatusSchema: z.ZodEnum<{
    PENDING: "PENDING";
    CONFIRMED: "CONFIRMED";
    PREPARING: "PREPARING";
    READY: "READY";
    DISPATCHED: "DISPATCHED";
    DELIVERED: "DELIVERED";
    CANCELLED: "CANCELLED";
}>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export declare const operatorLoginRequestSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type OperatorLoginRequest = z.infer<typeof operatorLoginRequestSchema>;
export declare const orderTransitionRequestSchema: z.ZodObject<{
    status: z.ZodEnum<{
        PENDING: "PENDING";
        CONFIRMED: "CONFIRMED";
        PREPARING: "PREPARING";
        READY: "READY";
        DISPATCHED: "DISPATCHED";
        DELIVERED: "DELIVERED";
        CANCELLED: "CANCELLED";
    }>;
}, z.core.$strip>;
export type OrderTransitionRequest = z.infer<typeof orderTransitionRequestSchema>;
export declare const orderTransitionResponseSchema: z.ZodObject<{
    orderId: z.ZodString;
    status: z.ZodEnum<{
        PENDING: "PENDING";
        CONFIRMED: "CONFIRMED";
        PREPARING: "PREPARING";
        READY: "READY";
        DISPATCHED: "DISPATCHED";
        DELIVERED: "DELIVERED";
        CANCELLED: "CANCELLED";
    }>;
}, z.core.$strip>;
export type OrderTransitionResponse = z.infer<typeof orderTransitionResponseSchema>;
