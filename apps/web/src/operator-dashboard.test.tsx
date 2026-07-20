import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import './styles.css';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '55555555-5555-4555-8555-555555555555';

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, text: vi.fn().mockResolvedValue(JSON.stringify(body)) } as unknown as Response;
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  responses.forEach((value) => fetchMock.mockResolvedValueOnce(value));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function open(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

const order = [{ orderId: ORDER_ID, guest: { name: 'Ana', phone: '999 555 444', address: 'Av. Lima 123' }, items: [{ name: 'Medio pollo a la brasa', quantity: 2, lineTotalCents: 2500 }], totalCents: 2500, status: 'PENDING', createdAt: '2026-07-18T12:00:00.000Z', updatedAt: '2026-07-18T12:05:00.000Z' }];
const orderPage = { orders: order, nextCursor: null };

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('operator access and orders', () => {
  it('shows invalid login feedback and navigates after a cookie-backed successful login without storing a token', async () => {
    const user = userEvent.setup();
    mockFetch(response({ message: 'Invalid credentials' }, 401));
    const first = open('/operador/login');
    await screen.findByRole('heading', { name: 'El pase empieza acá.' });
    await user.type(screen.getByLabelText('Usuario'), 'operator');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Entrar a operaciones' }));
    expect(await screen.findByText('Usuario o contraseña inválidos.')).toBeInTheDocument();
    first.unmount();

    mockFetch(response({ authenticated: true, username: 'operator' }), response({ orders: [], nextCursor: null }));
    const second = open('/operador/login');
    await user.type(screen.getByLabelText('Usuario'), 'operator');
    await user.type(screen.getByLabelText('Contraseña'), 'correct');
    await user.click(screen.getByRole('button', { name: 'Entrar a operaciones' }));
    expect(await screen.findByRole('heading', { name: 'Cola de preparación' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    second.unmount();
  });

  it('hides protected orders on 401 and renders/filter/transitions only real server data', async () => {
    mockFetch(response({ message: 'Unauthorized' }, 401));
    const first = open('/operador/pedidos');
    expect(await screen.findByText(/Tu sesión de operaciones venció/)).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    first.unmount();

     const fetchMock = mockFetch(response(orderPage), response(orderPage), response({ orderId: ORDER_ID, status: 'CONFIRMED' }), response({ orders: [{ ...order[0], status: 'CONFIRMED' }], nextCursor: null }));
    const user = userEvent.setup();
    open('/operador/pedidos');
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pendiente' }));
    await user.click(within(screen.getByText('Ana').closest('article')!).getByRole('button', { name: 'Confirmado' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/orders/${ORDER_ID}/status`, expect.objectContaining({ method: 'PATCH', credentials: 'include' })));
    expect(JSON.parse(fetchMock.mock.calls[2]![1].body as string)).toEqual({ status: 'CONFIRMED' });
  });

  it('maps non-401 login responses to service-unavailable feedback', async () => {
    const user = userEvent.setup();
    mockFetch(response({ message: 'Database unavailable' }, 503));
    open('/operador/login');
    await user.type(screen.getByLabelText('Usuario'), 'operator');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Entrar a operaciones' }));
    expect(await screen.findByText('El servicio de operaciones no está disponible en este momento.')).toBeInTheDocument();
  });
});

describe('projection board', () => {
  it('shows status, replays with confirmation, and queries the allowed timeline and activity partitions', async () => {
    const fetchMock = mockFetch(
      response({ state: 'BACKLOG', pending: 2, processing: 1, processed: 8, lagSeconds: 12, oldestUnprocessedOccurredAt: '2026-07-18T12:00:00.000Z' }),
      response({ reset: 3 }),
      response({ state: 'IDLE', pending: 0, processing: 0, processed: 11, lagSeconds: 0, oldestUnprocessedOccurredAt: null }),
      response([{ orderId: ORDER_ID, restaurantId: RESTAURANT_ID, eventId: '99999999-9999-4999-8999-999999999999', eventType: 'ORDER_CREATED', status: 'PENDING', totalCents: 1250, occurredAt: '2026-07-18T12:00:00.000Z' }]),
      response([{ restaurantId: RESTAURANT_ID, day: '2026-07-18', orderId: ORDER_ID, eventId: '99999999-9999-4999-8999-999999999999', eventType: 'ORDER_CREATED', status: 'PENDING', totalCents: 1250, occurredAt: '2026-07-18T12:00:00.000Z' }]),
    );
    vi.stubGlobal('confirm', vi.fn(() => true));
    const user = userEvent.setup();
    open('/operador/proyeccion');
    expect(await screen.findByRole('heading', { name: 'Lecturas operativas' })).toBeInTheDocument();
    await screen.findByText('Demora estimada');
    expect(screen.getByText('12s')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reprocesar eventos' }));
    expect(await screen.findByText('Se restablecieron 3 eventos para reprocesar.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('ID de pedido'), ORDER_ID);
    await user.click(screen.getByRole('button', { name: 'Consultar timeline' }));
    await screen.findAllByText('PENDING');
    await user.clear(screen.getByLabelText('Día'));
    await user.type(screen.getByLabelText('Día'), '2026-07-18');
    await user.click(screen.getByRole('button', { name: 'Consultar actividad' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/projections/restaurants/${RESTAURANT_ID}/activity?day=2026-07-18`, expect.objectContaining({ credentials: 'include' })));
  });
});
