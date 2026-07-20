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
  category: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().min(1).nullable(),
  priceCents: z.number().int().nonnegative(),
  active: z.boolean(),
});

export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const guestSchema = z.object({
  name: z.string().min(1, 'Ingresá tu nombre'),
  phone: z.string().min(1, 'Ingresá un teléfono de contacto'),
  address: z.string().min(1, 'Ingresá la dirección de entrega'),
});
export type Guest = z.infer<typeof guestSchema>;

export const checkoutRequestSchema = z.object({
  guest: guestSchema,
  items: z.array(z.object({ catalogItemId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
  idempotencyKey: z.string().min(1),
  totalCents: z.number().int().nonnegative().optional(),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  totalCents: z.number().int().nonnegative(),
  status: z.literal('PENDING'),
  projectionStatus: z.literal('PENDING'),
});

export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const orderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export const operatorLoginRequestSchema = z.object({ username: z.string().min(1, 'Ingresá el usuario'), password: z.string().min(1, 'Ingresá la contraseña') });
export type OperatorLoginRequest = z.infer<typeof operatorLoginRequestSchema>;
export const operatorLoginResponseSchema = z.object({ authenticated: z.literal(true), username: z.string().min(1) });
export type OperatorLoginResponse = z.infer<typeof operatorLoginResponseSchema>;
export const orderTransitionRequestSchema = z.object({ status: orderStatusSchema });
export type OrderTransitionRequest = z.infer<typeof orderTransitionRequestSchema>;
export const orderTransitionResponseSchema = z.object({ orderId: z.string().uuid(), status: orderStatusSchema });
export type OrderTransitionResponse = z.infer<typeof orderTransitionResponseSchema>;

export const canonicalUuidV4Schema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a real ISO calendar day');

export const projectionStatusSchema = z.object({
  state: z.enum(['IDLE', 'BACKLOG']),
  pending: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  lagSeconds: z.number().int().nonnegative(),
  oldestUnprocessedOccurredAt: z.string().datetime().nullable(),
});
export type ProjectionStatus = z.infer<typeof projectionStatusSchema>;

export const projectionReplayResponseSchema = z.object({ reset: z.number().int().nonnegative() });
export type ProjectionReplayResponse = z.infer<typeof projectionReplayResponseSchema>;

export const projectionOrderTimelineRequestSchema = z.object({ orderId: canonicalUuidV4Schema });
export const projectionActivityRequestSchema = z.object({ restaurantId: canonicalUuidV4Schema, day: isoDaySchema });

const projectionEventSchema = z.object({
  eventId: canonicalUuidV4Schema,
  eventType: z.enum(['ORDER_CREATED', 'ORDER_STATUS_CHANGED']),
  status: orderStatusSchema,
  totalCents: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
});

export const projectionTimelineRowSchema = projectionEventSchema.extend({
  orderId: canonicalUuidV4Schema,
  restaurantId: canonicalUuidV4Schema,
});
export const projectionTimelineRowsSchema = z.array(projectionTimelineRowSchema);
export type ProjectionTimelineRows = z.infer<typeof projectionTimelineRowsSchema>;

export const projectionActivityRowSchema = projectionEventSchema.extend({
  restaurantId: canonicalUuidV4Schema,
  day: isoDaySchema,
  orderId: canonicalUuidV4Schema,
});
export const projectionActivityRowsSchema = z.array(projectionActivityRowSchema);
export type ProjectionActivityRows = z.infer<typeof projectionActivityRowsSchema>;

export const operatorOrdersQuerySchema = z.object({
  restaurantId: canonicalUuidV4Schema,
  status: orderStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(512).optional(),
});
export type OperatorOrdersQuery = z.infer<typeof operatorOrdersQuerySchema>;

export const operatorOrderItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  lineTotalCents: z.number().int().nonnegative(),
});
export const operatorOrderSummarySchema = z.object({
  orderId: canonicalUuidV4Schema,
  guest: guestSchema,
  items: z.array(operatorOrderItemSchema).min(1),
  totalCents: z.number().int().nonnegative(),
  status: orderStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const operatorOrderSummariesSchema = z.array(operatorOrderSummarySchema);
export type OperatorOrderSummary = z.infer<typeof operatorOrderSummarySchema>;
export const operatorOrdersResponseSchema = z.object({
  orders: operatorOrderSummariesSchema,
  nextCursor: z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(512).nullable(),
});
export type OperatorOrdersResponse = z.infer<typeof operatorOrdersResponseSchema>;
