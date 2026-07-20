import {
  catalogItemSchema,
  checkoutResponseSchema,
  operatorLoginResponseSchema,
  operatorOrdersResponseSchema,
  orderTransitionResponseSchema,
  projectionActivityRowsSchema,
  projectionReplayResponseSchema,
  projectionStatusSchema,
  projectionTimelineRowsSchema,
  type CatalogItem,
  type CheckoutResponse,
  type Guest,
  type OperatorLoginRequest,
  type OperatorLoginResponse,
  type OperatorOrdersQuery,
  type OrderStatus,
  type ProjectionActivityRows,
  type ProjectionReplayResponse,
  type ProjectionStatus,
  type ProjectionTimelineRows,
} from '@app/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly network = false) {
    super(message);
  }
}

async function request<T>(path: string, schema: { safeParse(value: unknown): { success: boolean; data?: T } }, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', ...init });
  } catch {
    throw new ApiError('No pudimos conectarnos con La Brasa. Revisá tu conexión e intentá nuevamente.', undefined, true);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError('La respuesta del servicio no tiene un formato válido.', response.status);
    }
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
      ? body.message
      : 'No pudimos completar la solicitud. Intentá nuevamente.';
    throw new ApiError(message, response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data === undefined) throw new ApiError('La respuesta del servicio no tiene los datos esperados.', response.status);
  return parsed.data;
}

export type CheckoutPayload = {
  guest: Guest;
  items: { catalogItemId: string; quantity: number }[];
  idempotencyKey: string;
};

export const api = {
  getCatalog: () => request('/catalog', catalogItemSchema.array()),
  checkout: (payload: CheckoutPayload): Promise<CheckoutResponse> => request('/orders/checkout', checkoutResponseSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  login: (payload: OperatorLoginRequest): Promise<OperatorLoginResponse> => request('/auth/login', operatorLoginResponseSchema, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }),
  getOperatorOrders: (query: OperatorOrdersQuery) => {
    const params = new URLSearchParams({ restaurantId: query.restaurantId, limit: String(query.limit) });
    if (query.status) params.set('status', query.status);
    if (query.cursor) params.set('cursor', query.cursor);
    return request(`/orders?${params.toString()}`, operatorOrdersResponseSchema);
  },
  transitionOrder: (orderId: string, status: OrderStatus) => request(`/orders/${orderId}/status`, orderTransitionResponseSchema, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
  }),
  getProjectionStatus: (): Promise<ProjectionStatus> => request('/projections/status', projectionStatusSchema),
  replayProjections: (): Promise<ProjectionReplayResponse> => request('/projections/replay', projectionReplayResponseSchema, { method: 'POST' }),
  getOrderTimeline: (orderId: string): Promise<ProjectionTimelineRows> => request(`/projections/orders/${encodeURIComponent(orderId)}/timeline`, projectionTimelineRowsSchema),
  getRestaurantActivity: (restaurantId: string, day: string): Promise<ProjectionActivityRows> => request(`/projections/restaurants/${encodeURIComponent(restaurantId)}/activity?day=${encodeURIComponent(day)}`, projectionActivityRowsSchema),
};
