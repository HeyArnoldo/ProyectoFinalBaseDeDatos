import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { cartStorageKey } from './app/cart';
import { ACTIVE_ATTEMPT_KEY } from './pages/checkout-page';
import './styles.css';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_ID = '33333333-3333-4333-8333-333333333333';
const catalog = [
  { _id: FIRST_ID, restaurantId: RESTAURANT_ID, sku: 'POLLO-MEDIO', name: 'Medio pollo a la brasa', category: 'Brasa', description: 'Pollo al carbón con papas doradas.', imageUrl: null, priceCents: 1250, active: true },
  { _id: SECOND_ID, restaurantId: RESTAURANT_ID, sku: 'CHICHA-MORADA', name: 'Chicha morada', category: 'Bebidas', description: 'Refresco peruano de maíz morado.', imageUrl: 'https://images.invalid/chicha.jpg', priceCents: 550, active: true },
];

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, text: vi.fn().mockResolvedValue(JSON.stringify(body)) } as unknown as Response;
}

function mockFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn();
  for (const value of responses) value instanceof Error ? fetchMock.mockRejectedValueOnce(value) : fetchMock.mockResolvedValueOnce(value);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function open(path = '/') {
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => '99999999-9999-4999-8999-999999999999') });
});
afterEach(() => vi.unstubAllGlobals());

describe('public catalog', () => {
  it('shows loading, filters active categories, and uses the local fallback when imagery is absent or broken', async () => {
    const fetchMock = mockFetch(response(catalog));
    const user = userEvent.setup();
    open();
    expect(screen.getByText('Estamos encendiendo el menú.')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Medio pollo a la brasa' });
    expect(screen.getByRole('img', { name: 'Ilustración de Medio pollo a la brasa' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bebidas' }));
    expect(screen.getByRole('heading', { name: 'Chicha morada' })).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img', { name: 'Chicha morada' }));
    expect(screen.getByRole('img', { name: 'Ilustración de Chicha morada' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/catalog', expect.objectContaining({ credentials: 'include' }));
  });

  it('renders explicit empty and error states with retry', async () => {
    mockFetch(response([]));
    const first = open();
    await screen.findByText('La carta vuelve en breve.');
    first.unmount();

    mockFetch(response({ message: 'Servicio no disponible' }, 503), response(catalog));
    open();
    await screen.findByText('No pudimos cargar la carta en este momento.');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { name: 'Medio pollo a la brasa' });
  });
});

describe('cart and checkout', () => {
  it('reconciles persisted lines, lets guests change/remove items, and persists only IDs and quantities', async () => {
    localStorage.setItem(cartStorageKey, JSON.stringify([{ itemId: FIRST_ID, quantity: 1 }, { itemId: 'missing', quantity: 2 }]));
    mockFetch(response(catalog));
    const user = userEvent.setup();
    open();
    await screen.findByRole('heading', { name: 'Medio pollo a la brasa' });
    await user.click(screen.getByRole('button', { name: /Abrir pedido, 1 productos/ }));
    expect(screen.getByRole('dialog', { name: 'La mesa está servida' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar una unidad de Medio pollo a la brasa' }));
    await user.click(screen.getByRole('button', { name: 'Quitar una unidad de Medio pollo a la brasa' }));
    await user.click(screen.getByRole('button', { name: 'Agregar Medio pollo a la brasa al pedido' }));
    await user.click(screen.getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(cartStorageKey) ?? '[]')).toEqual([]));
  });

  it('validates guest fields, sends no local total, retries with the same key, and displays the authoritative confirmation', async () => {
    localStorage.setItem(cartStorageKey, JSON.stringify([{ itemId: FIRST_ID, quantity: 2 }]));
    const fetchMock = mockFetch(response(catalog), new Error('offline'), response({ orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', totalCents: 2750, status: 'PENDING', projectionStatus: 'PENDING' }));
    const user = userEvent.setup();
    open('/checkout');
    await screen.findByRole('heading', { name: '¿A dónde llevamos la brasa?' });
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText('Ingresá tu nombre')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '999 555 444');
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Av. Lima 123');
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText(/No pudimos conectarnos/)).toBeInTheDocument();
    const firstPayload = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(firstPayload).toEqual({ guest: { name: 'Ana', phone: '999 555 444', address: 'Av. Lima 123' }, items: [{ catalogItemId: FIRST_ID, quantity: 2 }], idempotencyKey: '99999999-9999-4999-8999-999999999999' });
    expect(firstPayload).not.toHaveProperty('totalCents');
    await user.click(screen.getByRole('button', { name: 'Reintentar el envío' }));
    await screen.findByRole('heading', { name: 'Tu fuego ya está en marcha.' });
    const retryPayload = JSON.parse(fetchMock.mock.calls[2]![1].body as string);
    expect(retryPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);
    expect(sessionStorage.getItem(ACTIVE_ATTEMPT_KEY)).toBeNull();
    expect(screen.getByText(/27\.50/)).toBeInTheDocument();
    expect(screen.getAllByText('PENDING')).toHaveLength(2);
    expect(screen.getByText('Proyección inicial')).toBeInTheDocument();
  });

  it('reuses the active key on a primary resubmit and replaces it when the payload changes', async () => {
    localStorage.setItem(cartStorageKey, JSON.stringify([{ itemId: FIRST_ID, quantity: 1 }]));
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('99999999-9999-4999-8999-999999999999').mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') });
    const fetchMock = mockFetch(response(catalog), new Error('offline'), new Error('offline'), new Error('offline'));
    const user = userEvent.setup();
    open('/checkout');
    await screen.findByRole('heading', { name: '¿A dónde llevamos la brasa?' });
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '999 555 444');
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Av. Lima 123');
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText(/No pudimos conectarnos/)).toBeInTheDocument();
    const firstPayload = JSON.parse(fetchMock.mock.calls[1]![1].body as string);

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    const secondPayload = JSON.parse(fetchMock.mock.calls[2]![1].body as string);
    expect(secondPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);

    await user.clear(screen.getByLabelText('Dirección de entrega'));
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Av. Lima 456');
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    const changedPayload = JSON.parse(fetchMock.mock.calls[3]![1].body as string);
    expect(changedPayload.idempotencyKey).not.toBe(firstPayload.idempotencyKey);
  });

  it('restores the active key after remounting with the same payload', async () => {
    localStorage.setItem(cartStorageKey, JSON.stringify([{ itemId: FIRST_ID, quantity: 1 }]));
    const fetchMock = mockFetch(response(catalog), new Error('offline'), response(catalog), response({ orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', totalCents: 1250, status: 'PENDING', projectionStatus: 'PENDING' }));
    const user = userEvent.setup();
    const first = open('/checkout');
    await screen.findByRole('heading', { name: '¿A dónde llevamos la brasa?' });
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '999 555 444');
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Av. Lima 123');
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText(/No pudimos conectarnos/)).toBeInTheDocument();
    const firstPayload = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    first.unmount();

    open('/checkout');
    await screen.findByRole('heading', { name: '¿A dónde llevamos la brasa?' });
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Teléfono'), '999 555 444');
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Av. Lima 123');
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    const restoredPayload = JSON.parse(fetchMock.mock.calls[3]![1].body as string);
    expect(restoredPayload.idempotencyKey).toBe(firstPayload.idempotencyKey);
    expect(await screen.findByRole('heading', { name: 'Tu fuego ya está en marcha.' })).toBeInTheDocument();
  });

  it('keeps a persisted cart when catalog reconciliation is unavailable', async () => {
    localStorage.setItem(cartStorageKey, JSON.stringify([{ itemId: FIRST_ID, quantity: 1 }]));
    mockFetch(new Error('offline'), response(catalog));
    const user = userEvent.setup();
    open('/checkout');
    expect(await screen.findByText('No hay conexión con la cocina.')).toBeInTheDocument();
    expect(screen.queryByText('Tu pedido está vacío')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(cartStorageKey) ?? '[]')).toEqual([{ itemId: FIRST_ID, quantity: 1 }]);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { name: '¿A dónde llevamos la brasa?' });
  });

  it('keeps saved cart count and unavailable language while the catalog is unavailable', async () => {
    localStorage.setItem(cartStorageKey, JSON.stringify([{ itemId: FIRST_ID, quantity: 2 }]));
    mockFetch(new Error('offline'));
    const user = userEvent.setup();
    open('/');
    await user.click(screen.getByRole('button', { name: 'Abrir pedido, 2 productos' }));
    expect(screen.getByText(/2 productos guardados/)).toBeInTheDocument();
    expect(screen.queryByText(/0 productos/)).not.toBeInTheDocument();
    expect(screen.queryByText('Todavía no elegiste nada.')).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('does not reset the drawer focus when a cart mutation rerenders it', async () => {
    localStorage.setItem(cartStorageKey, JSON.stringify([{ itemId: FIRST_ID, quantity: 1 }]));
    mockFetch(response(catalog));
    const user = userEvent.setup();
    open('/');
    await screen.findByRole('heading', { name: 'Medio pollo a la brasa' });
    await user.click(screen.getByRole('button', { name: /Abrir pedido, 1 productos/ }));
    const increment = screen.getByRole('button', { name: 'Agregar una unidad de Medio pollo a la brasa' });
    await user.click(increment);
    expect(increment).toHaveFocus();
  });
});
