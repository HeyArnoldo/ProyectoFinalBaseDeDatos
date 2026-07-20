import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { canonicalUuidV4Schema, projectionActivityRequestSchema } from '@app/contracts';
import { api, ApiError } from '../app/api';
import { OPERATOR_RESTAURANT_ID } from '../app/operator-config';
import { Button, Field, Notice, StatusBadge } from '../components/primitives';
import { OperatorErrorState, UnauthorizedState } from './operator-common';

function dayToday() { return new Date().toISOString().slice(0, 10); }

export function ProjectionBoardPage() {
  const queryClient = useQueryClient();
  const [timelineId, setTimelineId] = useState('');
  const [timelineInput, setTimelineInput] = useState('');
  const [activityDay, setActivityDay] = useState(dayToday());
  const [activityQuery, setActivityQuery] = useState('');
  const status = useQuery({ queryKey: ['operator', 'projection-status'], queryFn: api.getProjectionStatus, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' });
  const replay = useMutation({ mutationFn: api.replayProjections, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['operator', 'projection-status'] }); } });
  const timeline = useQuery({ queryKey: ['operator', 'timeline', timelineId], queryFn: () => api.getOrderTimeline(timelineId), enabled: Boolean(timelineId), retry: false });
  const activity = useQuery({ queryKey: ['operator', 'activity', activityQuery], queryFn: () => api.getRestaurantActivity(OPERATOR_RESTAURANT_ID, activityQuery), enabled: Boolean(activityQuery), retry: false });
  const unauthorized = [status.error, replay.error, timeline.error, activity.error].some((error) => error instanceof ApiError && error.status === 401);
  if (unauthorized) return <UnauthorizedState />;
  if (status.isError) return <OperatorErrorState message="No pudimos consultar el estado de la proyección." retry={() => void status.refetch()} />;
  if (status.isFetching) return <p className="operator-loading" aria-live="polite">Verificando la sesión de operaciones…</p>;
  const summary = status.data;

  return <section className="projection-board"><header className="operator-page-header"><div><p className="eyebrow">Cassandra + outbox</p><h1>Lecturas operativas</h1><p>Seguimiento eventual de la cola y de las particiones permitidas.</p></div></header>{summary && <div className="projection-summary"><article><StatusBadge tone={summary.state === 'IDLE' ? 'herb' : 'ember'}>{summary.state === 'IDLE' ? 'Al día' : 'Con cola'}</StatusBadge><strong>{summary.pending}</strong><span>Pendientes</span></article><article><strong>{summary.processing}</strong><span>En proceso</span></article><article><strong>{summary.processed}</strong><span>Procesados</span></article><article><strong>{summary.lagSeconds}s</strong><span>Demora estimada</span></article></div>}<section className="projection-replay"><div><h2>Reconstruir proyección</h2><p>Vuelve todos los eventos del outbox a pendientes. Cassandra recibe upserts idempotentes.</p></div><Button disabled={replay.isPending} onClick={() => { if (window.confirm('¿Reprocesar todos los eventos del outbox?')) replay.mutate(); }}>{replay.isPending ? 'Reprocesando…' : 'Reprocesar eventos'}</Button>{replay.isSuccess && <Notice tone="success">Se restablecieron {replay.data.reset} eventos para reprocesar.</Notice>}{replay.isError && <Notice tone="warm">No se pudo iniciar el reproceso.</Notice>}</section><div className="projection-queries"><section><h2>Timeline por pedido</h2><form onSubmit={(event) => { event.preventDefault(); if (canonicalUuidV4Schema.safeParse(timelineInput).success) setTimelineId(timelineInput); }}><Field label="ID de pedido" value={timelineInput} onChange={(event) => setTimelineInput(event.target.value)} hint="UUID v4 canónico" /><Button type="submit">Consultar timeline</Button></form>{timeline.isError && <Notice tone="warm">No pudimos leer el timeline solicitado.</Notice>}{timeline.data && <ul className="projection-list">{timeline.data.map((row) => <li key={row.eventId}><strong>{row.status}</strong><span>{new Date(row.occurredAt).toLocaleString('es-PE')}</span><small>{row.eventType} · {row.totalCents}</small></li>)}</ul>}</section><section><h2>Actividad por día</h2><form onSubmit={(event) => { event.preventDefault(); if (projectionActivityRequestSchema.safeParse({ restaurantId: OPERATOR_RESTAURANT_ID, day: activityDay }).success) setActivityQuery(activityDay); }}><Field label="Día" type="date" value={activityDay} onChange={(event) => setActivityDay(event.target.value)} /><Button type="submit">Consultar actividad</Button></form>{activity.isError && <Notice tone="warm">No pudimos leer la actividad solicitada.</Notice>}{activity.data && <ul className="projection-list">{activity.data.map((row) => <li key={row.eventId}><strong>{row.status}</strong><span>{row.orderId}</span><small>{new Date(row.occurredAt).toLocaleTimeString('es-PE')}</small></li>)}</ul>}</section></div></section>;
}
