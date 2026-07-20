import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OperatorOrderSummary, OrderStatus } from '@app/contracts';
import { api, ApiError } from '../app/api';
import { formatPrice } from '../app/catalog';
import { OPERATOR_RESTAURANT_ID } from '../app/operator-config';
import { Button, Notice, StatusBadge } from '../components/primitives';
import { OperatorErrorState, UnauthorizedState } from './operator-common';

const BOARD_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
const NEXT_STATES: Record<OrderStatus, readonly OrderStatus[]> = { PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY'], READY: ['DISPATCHED'], DISPATCHED: ['DELIVERED'], DELIVERED: [], CANCELLED: [] };
const statusLabel: Record<OrderStatus, string> = { PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PREPARING: 'En preparación', READY: 'Listo', DISPATCHED: 'En camino', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };

function Ticket({ order, onTransition, pending }: { order: OperatorOrderSummary; onTransition(status: OrderStatus): void; pending: boolean }) {
  return <article className="order-ticket"><header><StatusBadge tone={order.status === 'CANCELLED' ? 'charcoal' : order.status === 'READY' ? 'herb' : 'ember'}>{statusLabel[order.status]}</StatusBadge><time dateTime={order.createdAt}>{new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(new Date(order.createdAt))}</time></header><h3>{order.guest.name}</h3><p className="order-ticket__contact">{order.guest.phone}<br />{order.guest.address}</p><ul>{order.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span><strong>{formatPrice(item.lineTotalCents)}</strong></li>)}</ul><footer><strong>{formatPrice(order.totalCents)}</strong><div>{NEXT_STATES[order.status].map((status) => <Button key={status} tone={status === 'CANCELLED' ? 'quiet' : 'ember'} disabled={pending} onClick={() => onTransition(status)}>{statusLabel[status]}</Button>)}</div></footer></article>;
}

export function OrdersBoardPage() {
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const queryClient = useQueryClient();
  const orders = useInfiniteQuery({
    queryKey: ['operator', 'orders', filter],
    queryFn: ({ pageParam }) => api.getOperatorOrders({ restaurantId: OPERATOR_RESTAURANT_ID, status: filter === 'ALL' ? undefined : filter, limit: 100, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
  const transition = useMutation({ mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) => api.transitionOrder(orderId, status), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['operator', 'orders'] }), queryClient.invalidateQueries({ queryKey: ['operator', 'projection-status'] })]); } });
  if ((orders.error instanceof ApiError && orders.error.status === 401) || (transition.error instanceof ApiError && transition.error.status === 401)) return <UnauthorizedState />;
  if (orders.isError && !orders.data) return <OperatorErrorState message="No pudimos cargar la cola de pedidos." retry={() => void orders.refetch()} />;
  if (orders.isFetching && !orders.data) return <p className="operator-loading" aria-live="polite">Verificando la sesión de operaciones…</p>;
  const visible = orders.data?.pages.flatMap((page) => page.orders) ?? [];

  return <section className="orders-board"><header className="operator-page-header"><div><p className="eyebrow">Pase de cocina</p><h1>Cola de preparación</h1><p>Acciones reales sobre pedidos confirmados por el servidor.</p></div><span aria-live="polite">{visible.length} pedidos cargados</span></header><div className="operator-filters" aria-label="Filtrar pedidos"><button type="button" aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>Todos</button>{BOARD_STATUSES.map((status) => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>{statusLabel[status]}</button>)}</div>{transition.isError && <Notice tone="warm">No pudimos actualizar el pedido. La cola se mantiene sin cambios hasta confirmar la operación.</Notice>}{orders.isPending ? <p className="operator-loading" aria-live="polite">Consultando la cola de cocina…</p> : <><div className="order-board-grid">{(filter === 'ALL' ? BOARD_STATUSES : [filter]).map((status) => <section className="order-column" key={status} aria-labelledby={`column-${status}`}><h2 id={`column-${status}`}>{statusLabel[status]} <span>{visible.filter((order) => order.status === status).length}</span></h2><div>{visible.filter((order) => order.status === status).map((order) => <Ticket key={order.orderId} order={order} pending={transition.isPending} onTransition={(next) => transition.mutate({ orderId: order.orderId, status: next })} />)}</div></section>)}</div>{orders.hasNextPage && <div className="operator-load-more"><Button tone="quiet" disabled={orders.isFetchingNextPage} onClick={() => void orders.fetchNextPage()}>{orders.isFetchingNextPage ? 'Cargando más pedidos…' : 'Cargar más pedidos'}</Button></div>}{orders.isFetchNextPageError && <Notice tone="warm">No pudimos cargar el resto de la cola. Reintentá para continuar.</Notice>}</>}</section>;
}
