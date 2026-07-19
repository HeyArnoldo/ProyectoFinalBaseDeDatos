import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const catalogItemSchema = z.object({
  _id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  active: z.boolean(),
});

export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const checkoutRequestSchema = z.object({
  guest: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    address: z.string().min(1),
  }),
  items: z.array(z.object({ catalogItemId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
  idempotencyKey: z.string().min(1),
  totalCents: z.number().int().nonnegative().optional(),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  totalCents: z.number().int().nonnegative(),
  status: z.literal('PENDING'),
});

export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const orderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export const operatorLoginRequestSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
export type OperatorLoginRequest = z.infer<typeof operatorLoginRequestSchema>;
export const orderTransitionRequestSchema = z.object({ status: orderStatusSchema });
export type OrderTransitionRequest = z.infer<typeof orderTransitionRequestSchema>;
export const orderTransitionResponseSchema = z.object({ orderId: z.string().uuid(), status: orderStatusSchema });
export type OrderTransitionResponse = z.infer<typeof orderTransitionResponseSchema>;
