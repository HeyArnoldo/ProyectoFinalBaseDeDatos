import type { CheckoutRequest, OrderStatus as ContractOrderStatus } from '@app/contracts';

export type OrderStatus = ContractOrderStatus;

export type OrderItemSnapshot = {
  catalogItemId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type OrderDocument = {
  _id: string;
  restaurantId: string;
  guest: CheckoutRequest['guest'];
  items: OrderItemSnapshot[];
  totalCents: number;
  status: OrderStatus;
  history: { eventId: string; status: OrderStatus; at: Date }[];
  idempotencyKey: string;
  requestHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OutboxDocument = {
  _id: string;
  eventId: string;
  restaurantId: string;
  orderId: string;
  type: 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED';
  payload: { status: OrderStatus; totalCents: number };
  occurredAt: Date;
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED';
  attempts: number;
  nextAttemptAt: Date | null;
  leaseUntil: Date | null;
  leaseId: string | null;
  processedAt: Date | null;
  lastError: string | null;
  cleanupProtected?: boolean;
  createdAt: Date;
  updatedAt: Date;
};
