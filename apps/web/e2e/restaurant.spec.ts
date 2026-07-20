import { expect, test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanupCreatedOrders } from './restaurant-cleanup';

const test = base.extend<{ createdOrderIds: Set<string> }>({
  createdOrderIds: async ({}, use, testInfo) => {
    const orderIds = new Set<string>();
    try {
      await use(orderIds);
    } finally {
      try {
        const report = cleanupCreatedOrders(orderIds);
        console.log(`E2E fixture cleanup ${JSON.stringify(report)}`);
        await testInfo.attach('e2e-fixture-cleanup.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
      } catch {
        await testInfo.attach('e2e-fixture-cleanup.json', { body: JSON.stringify({ orderIds: [...orderIds], cleanupFailed: true }, null, 2), contentType: 'application/json' });
        throw new Error('E2E fixture cleanup failed');
      }
    }
  },
});

const restaurantId = process.env.E2E_RESTAURANT_ID ?? '11111111-1111-4111-8111-111111111111';
const username = process.env.E2E_OPERATOR_USERNAME;
const password = process.env.E2E_OPERATOR_PASSWORD;

function uniqueKey(label: string) { return `e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function sanitizedAxeResult(result: Awaited<ReturnType<AxeBuilder['analyze']>>) {
  return {
    violations: result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      nodes: violation.nodes.map((node) => ({ impact: node.impact, target: node.target, failureSummary: node.failureSummary })),
    })),
    passes: result.passes.map((pass) => ({ id: pass.id, impact: pass.impact, help: pass.help, helpUrl: pass.helpUrl, tags: pass.tags })),
    incomplete: result.incomplete.map((item) => ({ id: item.id, impact: item.impact, help: item.help, helpUrl: item.helpUrl, tags: item.tags })),
  };
}

async function saveEvidence(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, name: string): Promise<void> {
  if (!process.env.EVIDENCE_DIR) return;
  const uiDirectory = resolve(process.env.EVIDENCE_DIR, 'ui');
  mkdirSync(uiDirectory, { recursive: true });
  const suffix = testInfo.project.name.replace(/[^a-zA-Z0-9_-]/g, '-');
  await page.screenshot({ path: resolve(uiDirectory, `${name}-${suffix}.png`), fullPage: true });
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  writeFileSync(resolve(uiDirectory, `${name}-${suffix}.axe.json`), `${JSON.stringify(sanitizedAxeResult(axe), null, 2)}\n`);
}

async function login(page: import('@playwright/test').Page) {
  test.skip(!username || !password, 'E2E operator credentials are required');
  await page.goto('/operador/login');
  await page.getByLabel('Usuario').fill(username!);
  await page.getByLabel('Contraseña').fill(password!);
  await page.getByRole('button', { name: 'Entrar a operaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Cola de preparación' })).toBeVisible();
}

test('public catalog, cart, checkout, idempotency, keyboard, and accessibility smoke', async ({ page, request, createdOrderIds }) => {
  test.skip(process.env.E2E_ALLOW_MUTATION !== '1', 'Mutation E2E requires E2E_ALLOW_MUTATION=1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pedí lo que el fuego hace mejor.' })).toBeVisible();
  await page.getByRole('button', { name: /Agregar .* al pedido/ }).first().click();
  await page.getByRole('button', { name: /Abrir pedido/ }).click();
  await expect(page.getByRole('dialog', { name: 'La mesa está servida' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar al pedido' }).click();
  await page.getByLabel('Nombre').fill('E2E Cliente');
  await page.getByLabel('Teléfono').fill('999 555 444');
  await page.getByLabel('Dirección de entrega').fill('Av. E2E 123');
  const browserCheckout = page.waitForResponse((response) => response.url().includes('/api/orders/checkout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  const browserCheckoutResponse = await browserCheckout;
  expect(browserCheckoutResponse.status()).toBe(201);
  createdOrderIds.add((await browserCheckoutResponse.json() as { orderId: string }).orderId);
  await expect(page.getByRole('heading', { name: 'Tu fuego ya está en marcha.' })).toBeVisible();
  await saveEvidence(page, test.info(), 'public-confirmation');

  const key = uniqueKey('idempotency');
  const payload = { guest: { name: 'E2E Retry', phone: '999 555 445', address: 'Av. E2E 124' }, items: [{ catalogItemId: '22222222-2222-4222-8222-222222222222', quantity: 1 }], idempotencyKey: key };
  const first = await request.post('/api/orders/checkout', { data: payload });
  const second = await request.post('/api/orders/checkout', { data: payload });
  expect(first.status()).toBe(201);
  expect(second.status()).toBe(201);
  const firstBody = await first.json() as { orderId: string };
  const secondBody = await second.json() as { orderId: string };
  createdOrderIds.add(firstBody.orderId);
  expect(firstBody.orderId).toBe(secondBody.orderId);
  const conflict = await request.post('/api/orders/checkout', { data: { ...payload, items: [{ catalogItemId: payload.items[0].catalogItemId, quantity: 2 }] } });
  expect(conflict.status()).toBe(409);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
});

test('operator authorization, valid transition, and partition projection reads', async ({ page, request, createdOrderIds }) => {
  test.skip(process.env.E2E_ALLOW_MUTATION !== '1', 'Mutation E2E requires E2E_ALLOW_MUTATION=1');
  test.skip(!username || !password, 'E2E operator credentials are required');
  await page.goto('/operador/pedidos');
  await expect(page.getByText(/Tu sesión de operaciones venció/)).toBeVisible();

  const create = await request.post('/api/orders/checkout', { data: { guest: { name: `E2E Operación ${Date.now()}`, phone: '999 555 446', address: 'Av. Operaciones 125' }, items: [{ catalogItemId: '22222222-2222-4222-8222-222222222222', quantity: 1 }], idempotencyKey: uniqueKey('operator') } });
  expect(create.status()).toBe(201);
  const created = await create.json() as { orderId: string };
  createdOrderIds.add(created.orderId);

  await login(page);
  await page.getByRole('button', { name: 'Pendiente' }).click();
  const ticket = page.getByText(/E2E Operación/).last().locator('xpath=ancestor::article');
  await expect(ticket).toBeVisible();
  await ticket.getByRole('button', { name: 'Confirmado' }).click();
  await expect(ticket.getByText('Confirmado')).toBeVisible({ timeout: 20_000 });
  await saveEvidence(page, test.info(), 'operator-orders');

  await expect.poll(async () => {
    return page.evaluate(async (orderId) => {
      const response = await fetch(`/api/projections/orders/${orderId}/timeline`);
      if (!response.ok) return `status:${response.status}`;
      const rows: unknown = await response.json();
      return Array.isArray(rows) && rows.some((row) => typeof row === 'object' && row !== null && 'eventType' in row && row.eventType === 'ORDER_CREATED') ? 'ready' : 'pending';
    }, created.orderId);
  }, { timeout: 45_000 }).toBe('ready');

  await page.goto('/operador/proyeccion');
  await expect(page.getByRole('heading', { name: 'Lecturas operativas' })).toBeVisible();
  await page.getByLabel('ID de pedido').fill(created.orderId);
  await page.getByRole('button', { name: 'Consultar timeline' }).click();
  await expect(page.getByText('ORDER_CREATED')).toBeVisible({ timeout: 30_000 });
  const day = new Date().toISOString().slice(0, 10);
  await page.getByLabel('Día').fill(day);
  await page.getByRole('button', { name: 'Consultar actividad' }).click();
  await expect(page.getByText(created.orderId).first()).toBeVisible({ timeout: 30_000 });
  await saveEvidence(page, test.info(), 'operator-projection');
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
});
