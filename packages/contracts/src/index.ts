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
