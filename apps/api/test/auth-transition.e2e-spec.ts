import 'reflect-metadata';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ConflictException, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AuthController } from '../src/auth/auth.controller';
import { AuthModule } from '../src/auth/auth.module';
import { AUTH_CONFIG, AuthConfig, AuthService, loadAuthConfig, OPERATOR_SESSION_COOKIE } from '../src/auth/auth.service';
import { OperatorGuard } from '../src/auth/operator.guard';
import { CheckoutService } from '../src/orders/checkout.service';
import { OrdersController } from '../src/orders/orders.controller';
import { TransitionService, isAllowedOrderTransition } from '../src/orders/transition.service';
import type { OrderStatus } from '../src/orders/order.types';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '55555555-5555-4555-8555-555555555555';
const TEST_USERNAME = 'unit-test-operator';
const TEST_PASSWORD = 'unit-test-password';
const CONFIG: AuthConfig = {
  username: TEST_USERNAME,
  passwordHash: bcrypt.hashSync(TEST_PASSWORD, 4),
  jwtSecret: randomBytes(32).toString('hex'),
};
const transitionMock = { transition: jest.fn().mockResolvedValue({ orderId: ORDER_ID, status: 'CONFIRMED' }) };
const checkoutMock = { checkout: jest.fn() };
const REQUIRED_AUTH_ENV = ['OPERATOR_USERNAME', 'OPERATOR_PASSWORD_HASH_B64', 'JWT_SECRET'] as const;
const originalAuthEnv = new Map(REQUIRED_AUTH_ENV.map((name) => [name, process.env[name]]));

describe('auth configuration safety', () => {
  beforeEach(() => Object.assign(process.env, { OPERATOR_USERNAME: 'configured-operator', OPERATOR_PASSWORD_HASH_B64: Buffer.from(CONFIG.passwordHash).toString('base64'), JWT_SECRET: 'configured-jwt-secret' }));
  afterEach(() => REQUIRED_AUTH_ENV.forEach((name) => originalAuthEnv.get(name) === undefined ? delete process.env[name] : process.env[name] = originalAuthEnv.get(name)));

  it.each(REQUIRED_AUTH_ENV)('fails deterministically when %s is missing', (missing) => {
    delete process.env[missing];
    expect(() => loadAuthConfig()).toThrow(`${missing} is required`);
  });

  it.each(REQUIRED_AUTH_ENV)('rejects blank %s', (blank) => { process.env[blank] = ' '; expect(() => loadAuthConfig()).toThrow(`${blank} is required`); });
  it('decodes the configured bcrypt hash without defaults', () => expect(loadAuthConfig()).toEqual({ username: 'configured-operator', passwordHash: CONFIG.passwordHash, jwtSecret: 'configured-jwt-secret' }));
  it('rejects a base64 value that is not a bcrypt hash', () => {
    process.env.OPERATOR_PASSWORD_HASH_B64 = Buffer.from('not-a-bcrypt-hash').toString('base64');
    expect(() => loadAuthConfig()).toThrow('OPERATOR_PASSWORD_HASH_B64 must contain a base64-encoded bcrypt hash');
  });

  it('wires AuthConfig through a dedicated mandatory token instead of Object metadata', () => {
    const providers = Reflect.getMetadata('providers', AuthModule) as unknown[];
    expect(providers).toContainEqual({ provide: AUTH_CONFIG, useFactory: loadAuthConfig });
    expect(Reflect.getMetadata('self:paramtypes', AuthService)).toEqual([{ index: 0, param: AUTH_CONFIG }]);
  });

  it('fails real AuthModule initialization even when an Object provider is present', async () => {
    delete process.env.OPERATOR_USERNAME;
    await expect(Test.createTestingModule({ imports: [AuthModule], providers: [{ provide: Object, useValue: {} }] }).compile()).rejects.toThrow('OPERATOR_USERNAME is required');
  });

  it('requires all auth settings in the API Compose environment without repository secrets', () => {
    const compose = readFileSync(join(__dirname, '../../../infra/compose.yaml'), 'utf8');
    for (const line of ['OPERATOR_USERNAME: "${OPERATOR_USERNAME:?OPERATOR_USERNAME is required}"', 'OPERATOR_PASSWORD_HASH_B64: "${OPERATOR_PASSWORD_HASH_B64:?OPERATOR_PASSWORD_HASH_B64 is required}"', 'JWT_SECRET: "${JWT_SECRET:?JWT_SECRET is required}"']) expect(compose).toContain(line);
  });
});

function transitionSetup(current: OrderStatus = 'PENDING') {
  const session = {
    withTransaction: jest.fn(async (work: () => Promise<unknown>) => work()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  const orders = {
    findOne: jest.fn().mockResolvedValue({ _id: ORDER_ID, restaurantId: RESTAURANT_ID, status: current, totalCents: 1250 }),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
  };
  const outbox = { insertOne: jest.fn().mockResolvedValue({}) };
  const db = { collection: jest.fn((name: string) => ({ orders, outbox })[name]) };
  const client = { startSession: jest.fn().mockReturnValue(session) };
  return { service: new TransitionService(db as never, client as never), session, orders, outbox };
}

describe('operator authentication', () => {
  @Module({ controllers: [AuthController, OrdersController], providers: [AuthService, OperatorGuard, { provide: CheckoutService, useValue: checkoutMock }, { provide: TransitionService, useValue: transitionMock }] })
  class AuthTestModule {}

  let app: TestingModule;
  let server: ReturnType<typeof request>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthTestModule],
    })
      .overrideProvider(AuthService)
      .useValue(new AuthService(CONFIG))
      .compile();
    const nestApp = module.createNestApplication();
    await nestApp.init();
    app = module;
    server = request(nestApp.getHttpServer());
  });

  beforeEach(() => {
    transitionMock.transition.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues a 15-minute HS256 secure operator cookie for a bcrypt password', async () => {
    const response = await server.post('/auth/login').send({ username: CONFIG.username, password: TEST_PASSWORD }).expect(201);
    const cookie = response.headers['set-cookie']?.[0] ?? '';

    for (const attribute of [`${OPERATOR_SESSION_COOKIE}=`, 'Max-Age=900', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict']) expect(cookie).toContain(attribute);

    const token = cookie.split(';', 1)[0]?.split('=', 2)[1];
    const claims = jwt.verify(token!, CONFIG.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    expect(claims).toEqual(expect.objectContaining({ sub: CONFIG.username, role: 'operator' }));
    expect(claims.exp! - claims.iat!).toBe(900);
  });

  it('rejects invalid credentials and does not issue a session', async () => {
    const response = await server.post('/auth/login').send({ username: CONFIG.username, password: 'wrong-unit-test-password' }).expect(401);

    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('protects the real order transition endpoint and never calls it for absent or expired sessions', async () => {
    await server.patch(`/orders/${ORDER_ID}/status`).send({ status: 'CONFIRMED' }).expect(401);
    expect(transitionMock.transition).not.toHaveBeenCalled();

    await server.patch(`/orders/${ORDER_ID}/status`).set('Cookie', `${OPERATOR_SESSION_COOKIE}=not-a-jwt`).send({ status: 'CONFIRMED' }).expect(401);

    const expired = jwt.sign({ sub: CONFIG.username, role: 'operator' }, CONFIG.jwtSecret, { algorithm: 'HS256', expiresIn: -1 });
    await server
      .patch(`/orders/${ORDER_ID}/status`)
      .set('Cookie', `${OPERATOR_SESSION_COOKIE}=${expired}`)
      .send({ status: 'CONFIRMED' })
      .expect(401);
    expect(transitionMock.transition).not.toHaveBeenCalled();

    const login = await server.post('/auth/login').send({ username: CONFIG.username, password: TEST_PASSWORD }).expect(201);
    await server
      .patch(`/orders/${ORDER_ID}/status`)
      .set('Cookie', login.headers['set-cookie']?.[0] ?? '')
      .send({ status: 'CONFIRMED' })
      .expect(200)
      .expect({ orderId: ORDER_ID, status: 'CONFIRMED' });
    expect(transitionMock.transition).toHaveBeenCalledWith(ORDER_ID, 'CONFIRMED');
  });
});

describe('order transitions', () => {
  afterEach(() => jest.restoreAllMocks());

  it('accepts only the forward chain and cancellation from pending or confirmed', () => expect([
    isAllowedOrderTransition('PENDING', 'CONFIRMED'), isAllowedOrderTransition('CONFIRMED', 'PREPARING'), isAllowedOrderTransition('PREPARING', 'READY'), isAllowedOrderTransition('READY', 'DISPATCHED'),
    isAllowedOrderTransition('DISPATCHED', 'DELIVERED'), isAllowedOrderTransition('PENDING', 'CANCELLED'), isAllowedOrderTransition('CONFIRMED', 'CANCELLED'), isAllowedOrderTransition('PENDING', 'READY'), isAllowedOrderTransition('DELIVERED', 'CANCELLED'),
  ]).toEqual([true, true, true, true, true, true, true, false, false]));

  it('atomically updates the expected state, appends history, and emits one status outbox event', async () => {
    const ids = [
      '99999999-9999-4999-8999-999999999999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ];
    jest.spyOn(require('node:crypto'), 'randomUUID').mockImplementation(() => ids.shift()!);
    const { service, session, orders, outbox } = transitionSetup();

    await expect(service.transition(ORDER_ID, 'CONFIRMED')).resolves.toEqual({ orderId: ORDER_ID, status: 'CONFIRMED' });
    expect(orders.updateOne).toHaveBeenCalledWith({ _id: ORDER_ID, status: 'PENDING' }, expect.objectContaining({ $set: expect.objectContaining({ status: 'CONFIRMED' }), $push: { history: expect.objectContaining({ status: 'CONFIRMED' }) } }), { session });
    expect(outbox.insertOne).toHaveBeenCalledWith(expect.objectContaining({ _id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'ORDER_STATUS_CHANGED', payload: { status: 'CONFIRMED', totalCents: 1250 } }), { session });
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('triangulates cancellation from confirmed with the same transaction shape', async () => {
    const { service, orders, outbox } = transitionSetup('CONFIRMED');

    await expect(service.transition(ORDER_ID, 'CANCELLED')).resolves.toEqual({ orderId: ORDER_ID, status: 'CANCELLED' });
    expect(outbox.insertOne).toHaveBeenCalledWith(expect.objectContaining({ type: 'ORDER_STATUS_CHANGED', payload: expect.objectContaining({ status: 'CANCELLED' }) }), expect.objectContaining({ session: expect.any(Object) }));
  });

  it('rejects an invalid transition without updating history or outbox', async () => {
    const { service, orders, outbox } = transitionSetup();

    await expect(service.transition(ORDER_ID, 'READY')).rejects.toThrow(BadRequestException);
    expect(orders.updateOne).not.toHaveBeenCalled(); expect(outbox.insertOne).not.toHaveBeenCalled();
  });

  it('aborts a stale expected-state update without emitting an outbox event', async () => {
    const { service, orders, outbox } = transitionSetup();
    orders.updateOne.mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });

    await expect(service.transition(ORDER_ID, 'CONFIRMED')).rejects.toThrow(ConflictException);
    expect(outbox.insertOne).not.toHaveBeenCalled();
  });
});
