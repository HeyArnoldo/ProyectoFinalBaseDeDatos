import 'reflect-metadata';

import { BadRequestException, ConflictException } from '@nestjs/common';
import { CheckoutRequest, checkoutRequestSchema } from '@app/contracts';
import { CheckoutService } from '../src/orders/checkout.service';
import { OrdersController } from '../src/orders/orders.controller';
import type { OrderDocument } from '../src/orders/order.types';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '55555555-5555-4555-8555-555555555555';
const EVENT_ID = '66666666-6666-4666-8666-666666666666';
const HISTORY_ID = '77777777-7777-4777-8777-777777777777';
const OUTBOX_ID = '88888888-8888-4888-8888-888888888888';

function request(overrides: Partial<CheckoutRequest> = {}): CheckoutRequest {
  return checkoutRequestSchema.parse({
    guest: { name: 'Ana', phone: '555-0100', address: 'Main Street 1' },
    items: [{ catalogItemId: ITEM_ID, quantity: 2 }],
    idempotencyKey: 'checkout-1',
    totalCents: 1,
    ...overrides,
  });
}

function setup() {
  const session = {
    withTransaction: jest.fn(async (work: () => Promise<unknown>) => work()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  const orders = {
    findOne: jest.fn().mockResolvedValue(null),
    insertOne: jest.fn().mockResolvedValue({}),
  };
  const outbox = { insertOne: jest.fn().mockResolvedValue({}) };
  const catalog = {
    find: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        {
          _id: ITEM_ID,
          restaurantId: RESTAURANT_ID,
          sku: 'BURGER-CLASSIC',
          name: 'Classic Burger',
          priceCents: 1250,
          active: true,
        },
      ]),
    }),
  };
  const db = {
    collection: jest.fn((name: string) => ({ catalog_items: catalog, orders, outbox })[name]),
  };
  const client = { startSession: jest.fn().mockReturnValue(session) };
  return { service: new CheckoutService(db as never, client as never), session, orders, outbox, catalog };
}

describe('guest checkout', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('prices active catalog items and stores immutable snapshots plus one outbox event', async () => {
    const ids = [ORDER_ID, EVENT_ID, HISTORY_ID, OUTBOX_ID];
    const uuid = jest.spyOn(require('node:crypto'), 'randomUUID').mockImplementation(() => ids.shift()!);
    const { service, orders, outbox, session, catalog } = setup();

    const result = await service.checkout(request(), RESTAURANT_ID);

    expect(result).toEqual({ orderId: ORDER_ID, totalCents: 2500, status: 'PENDING', projectionStatus: 'PENDING' });
    expect(catalog.find).toHaveBeenCalledWith(
      { _id: { $in: [ITEM_ID] }, restaurantId: RESTAURANT_ID, active: true },
      { session },
    );
    expect(orders.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: ORDER_ID,
        items: [
          expect.objectContaining({
            catalogItemId: ITEM_ID,
            sku: 'BURGER-CLASSIC',
            name: 'Classic Burger',
            unitPriceCents: 1250,
            quantity: 2,
            lineTotalCents: 2500,
          }),
        ],
        totalCents: 2500,
      }),
      { session },
    );
    expect(outbox.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: OUTBOX_ID, eventId: EVENT_ID, orderId: ORDER_ID, status: 'PENDING' }),
      { session },
    );
    expect((orders.insertOne.mock.calls[0][0] as OrderDocument).history[0]!.eventId).toBe(HISTORY_ID);
    expect(uuid).toHaveBeenCalledTimes(4);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('rejects missing or inactive items without inserts', async () => {
    const { service, orders, outbox, catalog } = setup();
    catalog.find().toArray.mockResolvedValue([]);

    await expect(service.checkout(request())).rejects.toThrow(BadRequestException);

    expect(orders.insertOne).not.toHaveBeenCalled();
    expect(outbox.insertOne).not.toHaveBeenCalled();
  });

  it('returns the original order for a matching idempotency retry and rejects a hash mismatch', async () => {
    const { service, orders, outbox } = setup();
    await service.checkout(request());
    const original = orders.insertOne.mock.calls[0][0] as OrderDocument;
    orders.findOne.mockResolvedValueOnce({ ...original, status: 'CONFIRMED' });
    await expect(service.checkout(request({ totalCents: 99999 }))).resolves.toEqual({ orderId: original._id, totalCents: 2500, status: 'PENDING', projectionStatus: 'PENDING' });
    expect(orders.insertOne).toHaveBeenCalledTimes(1);
    expect(outbox.insertOne).toHaveBeenCalledTimes(1);

    orders.findOne.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ ...original, requestHash: 'different' }); orders.insertOne.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: 11000 }));
    await expect(service.checkout(request())).rejects.toThrow(ConflictException);

    orders.findOne.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce(original);
    orders.insertOne.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: 11000 }));
    await expect(service.checkout(request())).resolves.toEqual({
      orderId: original._id, totalCents: original.totalCents, status: 'PENDING', projectionStatus: 'PENDING',
    });
  });

  it('aborts the transaction when the outbox insert fails', async () => {
    const { service, orders, outbox, session } = setup();
    const abort = jest.fn().mockResolvedValue(undefined);
    session.withTransaction.mockImplementationOnce(async (work) => {
      try {
        return await work();
      } catch (error) {
        await abort();
        throw error;
      }
    });
    outbox.insertOne.mockRejectedValueOnce(new Error('outbox unavailable'));

    await expect(service.checkout(request())).rejects.toThrow('outbox unavailable');

    expect(orders.insertOne).toHaveBeenCalledTimes(1);
    expect(outbox.insertOne).toHaveBeenCalledTimes(1);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('validates checkout input and exposes the public controller endpoint contract', async () => {
    expect(checkoutRequestSchema.safeParse({ items: [], idempotencyKey: '' }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...request(), items: [{ catalogItemId: ITEM_ID, quantity: 0 }] }).success).toBe(false);

    const checkout = jest.fn().mockResolvedValue({ orderId: ORDER_ID, totalCents: 2500, status: 'PENDING', projectionStatus: 'PENDING' });
    const controller = new OrdersController({ checkout } as never);
    await expect(controller.checkout(request())).resolves.toEqual({
      orderId: ORDER_ID,
      totalCents: 2500,
      status: 'PENDING',
      projectionStatus: 'PENDING',
    });
    expect(checkout).toHaveBeenCalledWith(request(), RESTAURANT_ID);

    await expect(controller.checkout({ items: [] })).rejects.toThrow(BadRequestException);
  });
});
