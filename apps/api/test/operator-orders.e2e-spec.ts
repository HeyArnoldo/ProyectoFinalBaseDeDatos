import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthService, OPERATOR_SESSION_COOKIE } from '../src/auth/auth.service';
import { OperatorGuard } from '../src/auth/operator.guard';
import { CheckoutService } from '../src/orders/checkout.service';
import { OperatorOrdersService } from '../src/orders/operator-orders.service';
import { OrdersController } from '../src/orders/orders.controller';
import { TransitionService } from '../src/orders/transition.service';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '55555555-5555-4555-8555-555555555555';

function order(overrides: Record<string, unknown> = {}) {
  return {
    _id: ORDER_ID,
    restaurantId: RESTAURANT_ID,
    guest: { name: 'Ana', phone: '999 555 444', address: 'Av. Lima 123' },
    items: [{ catalogItemId: '22222222-2222-4222-8222-222222222222', sku: 'POLLO-MEDIO', name: 'Medio pollo a la brasa', unitPriceCents: 1250, quantity: 2, lineTotalCents: 2500 }],
    totalCents: 2500,
    status: 'PENDING' as const,
    requestHash: 'private-hash',
    idempotencyKey: 'private-key',
    createdAt: new Date('2026-07-18T12:00:00.000Z'),
    updatedAt: new Date('2026-07-18T12:05:00.000Z'),
    ...overrides,
  };
}

describe('operator order listing', () => {
  it('filters, projects, sorts newest first, limits results, and never exposes private order fields', async () => {
    const toArray = jest.fn().mockResolvedValue([order()]);
    const limit = jest.fn().mockReturnValue({ toArray });
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const service = new OperatorOrdersService({ collection: jest.fn().mockReturnValue({ find }) } as never);

    const result = await service.list({ restaurantId: RESTAURANT_ID, status: 'PENDING', limit: 25 });

    expect(find).toHaveBeenCalledWith({ restaurantId: RESTAURANT_ID, status: 'PENDING' }, expect.objectContaining({ projection: expect.any(Object) }));
    expect(find.mock.calls[0]![1].projection).not.toHaveProperty('requestHash');
    expect(find.mock.calls[0]![1].projection).not.toHaveProperty('idempotencyKey');
    expect(sort).toHaveBeenCalledWith({ restaurantId: 1, createdAt: -1, _id: -1 });
    expect(limit).toHaveBeenCalledWith(26);
    expect(result).toEqual({ orders: [{ orderId: ORDER_ID, guest: { name: 'Ana', phone: '999 555 444', address: 'Av. Lima 123' }, items: [{ name: 'Medio pollo a la brasa', quantity: 2, lineTotalCents: 2500 }], totalCents: 2500, status: 'PENDING', createdAt: '2026-07-18T12:00:00.000Z', updatedAt: '2026-07-18T12:05:00.000Z' }], nextCursor: null });
    expect(JSON.stringify(result)).not.toContain('private-hash');
    expect(JSON.stringify(result)).not.toContain('private-key');
  });

  it('uses a stable createdAt and id cursor without exposing private fields', async () => {
    const first = order();
    const second = order({ _id: '66666666-6666-4666-8666-666666666666', createdAt: new Date('2026-07-18T11:00:00.000Z') });
    const toArray = jest.fn().mockResolvedValue([first, second]);
    const limit = jest.fn().mockReturnValue({ toArray });
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const service = new OperatorOrdersService({ collection: jest.fn().mockReturnValue({ find }) } as never);

    const firstPage = await service.list({ restaurantId: RESTAURANT_ID, limit: 1 });

    expect(firstPage.orders).toHaveLength(1);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(limit).toHaveBeenCalledWith(2);

    await service.list({ restaurantId: RESTAURANT_ID, limit: 1, cursor: firstPage.nextCursor! });
    expect(find.mock.calls[1]![0]).toEqual(expect.objectContaining({
      $or: [
        { createdAt: { $lt: new Date('2026-07-18T12:00:00.000Z') } },
        { createdAt: new Date('2026-07-18T12:00:00.000Z'), _id: { $lt: ORDER_ID } },
      ],
    }));
  });

  it('requires the operator guard before querying and validates canonical filters', async () => {
    const list = jest.fn().mockResolvedValue([]);
    @Module({ controllers: [OrdersController], providers: [OperatorGuard, { provide: AuthService, useValue: { verify: jest.fn(() => ({ sub: 'operator', role: 'operator' })) } }, { provide: CheckoutService, useValue: { checkout: jest.fn() } }, { provide: TransitionService, useValue: { transition: jest.fn() } }, { provide: OperatorOrdersService, useValue: { list } }] })
    class OperatorOrdersTestModule {}
    const module = await Test.createTestingModule({ imports: [OperatorOrdersTestModule] }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const server = request(app.getHttpServer());

    await server.get(`/api/orders?restaurantId=${RESTAURANT_ID}`).expect(401);
    expect(list).not.toHaveBeenCalled();
    await server.get('/api/orders?restaurantId=not-a-uuid').set('Cookie', `${OPERATOR_SESSION_COOKIE}=valid`).expect(400);
    await server.get(`/api/orders?restaurantId=${RESTAURANT_ID}&status=INVALID`).set('Cookie', `${OPERATOR_SESSION_COOKIE}=valid`).expect(400);
    await server.get(`/api/orders?restaurantId=${RESTAURANT_ID}&status=PENDING&limit=101`).set('Cookie', `${OPERATOR_SESSION_COOKIE}=valid`).expect(400);
    expect(list).not.toHaveBeenCalled();
    await server.get(`/api/orders?restaurantId=${RESTAURANT_ID}&status=PENDING&limit=10`).set('Cookie', `${OPERATOR_SESSION_COOKIE}=valid`).expect(200).expect([]);
    expect(list).toHaveBeenCalledWith({ restaurantId: RESTAURANT_ID, status: 'PENDING', limit: 10 });

    await app.close();
  });
});
