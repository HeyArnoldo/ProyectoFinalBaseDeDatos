import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { checkoutResponseSchema, guestSchema, type CheckoutResponse, type Guest } from '@app/contracts';
import { api, ApiError, type CheckoutPayload } from '../app/api';
import { cartEntries, formatPrice, useCatalogQuery } from '../app/catalog';
import { useCart } from '../app/cart';
import { Button, Field, Notice, StatusBadge } from '../components/primitives';

const CONFIRMATION_KEY = 'la-brasa:last-confirmation';
const ACTIVE_ATTEMPT_KEY = 'la-brasa:active-checkout-attempt';
type Attempt = CheckoutPayload;
type StoredAttempt = { fingerprint: string; idempotencyKey: string };

function normalizeGuest(guest: Guest): Guest {
  return {
    name: guest.name.trim().replace(/\s+/g, ' '),
    phone: guest.phone.trim().replace(/\s+/g, ' '),
    address: guest.address.trim().replace(/\s+/g, ' '),
  };
}

function normalizeItems(items: Attempt['items']): Attempt['items'] {
  return [...items].sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));
}

function payloadFingerprint(guest: Guest, items: Attempt['items']): string {
  const normalized = JSON.stringify({ guest: normalizeGuest(guest), items: normalizeItems(items) });
  let hash = 14695981039346656037n;
  for (const character of normalized) {
    hash ^= BigInt(character.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, '0');
}

function readStoredAttempt(): StoredAttempt | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(ACTIVE_ATTEMPT_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null || typeof (value as StoredAttempt).fingerprint !== 'string' || typeof (value as StoredAttempt).idempotencyKey !== 'string') return null;
    return value as StoredAttempt;
  } catch {
    return null;
  }
}

function saveStoredAttempt(attempt: StoredAttempt): void {
  sessionStorage.setItem(ACTIVE_ATTEMPT_KEY, JSON.stringify(attempt));
}

function clearStoredAttempt(): void {
  sessionStorage.removeItem(ACTIVE_ATTEMPT_KEY);
}

function saveConfirmation(response: CheckoutResponse): void {
  sessionStorage.setItem(CONFIRMATION_KEY, JSON.stringify(response));
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const cart = useCart();
  const { data: catalog, isPending, isError, error, refetch } = useCatalogQuery();
  const attempt = useRef<Attempt | null>(null);
  const storedAttempt = useRef<StoredAttempt | null>(readStoredAttempt());
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, setFocus, formState: { errors } } = useForm<Guest>({ resolver: zodResolver(guestSchema), shouldFocusError: true });
  useEffect(() => { if (catalog) cart.reconcile(catalog); }, [catalog]);

  if (isPending) return <section className="checkout-empty" aria-live="polite"><p className="eyebrow">Preparando tu pedido</p><h1>Estamos revisando la carta.</h1></section>;
  if (isError) {
    const message = error instanceof ApiError && error.network ? 'No hay conexión con la cocina.' : 'No pudimos cargar la carta en este momento.';
    return <section className="checkout-empty"><p className="eyebrow">Carta no disponible</p><h1>{message}</h1><p>Tu pedido guardado sigue intacto. Podés reintentar cuando la conexión vuelva a estar lista.</p><Button onClick={() => void refetch()}>Reintentar</Button></section>;
  }

  const activeCatalog = catalog!;
  const entries = cartEntries(cart.items, activeCatalog);
  const subtotal = entries.reduce((total, entry) => total + entry.item.priceCents * entry.quantity, 0);

  const send = async (payload: Attempt) => {
    setSubmitting(true); setRequestError(null);
    try {
      const response = await api.checkout(payload);
      const parsed = checkoutResponseSchema.parse(response);
      saveConfirmation(parsed);
      cart.clear();
      attempt.current = null;
      storedAttempt.current = null;
      clearStoredAttempt();
      navigate(`/confirmacion/${parsed.orderId}`, { replace: true, state: parsed });
     } catch (error) {
       if (error instanceof ApiError && !error.network && error.status !== undefined && error.status >= 400 && error.status < 500) {
         attempt.current = null;
         storedAttempt.current = null;
         clearStoredAttempt();
       }
       setRequestError(error instanceof ApiError ? error.message : 'No pudimos enviar tu pedido.');
     } finally { setSubmitting(false); }
   };
  const onSubmit = (guest: Guest) => {
    const normalizedGuest = normalizeGuest(guest);
    const items = normalizeItems(entries.map(({ item, quantity }) => ({ catalogItemId: item._id, quantity })));
    const fingerprint = payloadFingerprint(normalizedGuest, items);
    const previous = storedAttempt.current;
    const idempotencyKey = previous?.fingerprint === fingerprint ? previous.idempotencyKey : crypto.randomUUID();
    const payload: Attempt = { guest: normalizedGuest, items, idempotencyKey };
    const nextStoredAttempt = { fingerprint, idempotencyKey };
    saveStoredAttempt(nextStoredAttempt);
    storedAttempt.current = nextStoredAttempt;
    attempt.current = payload;
    void send(payload);
  };
  const onInvalid = (invalid: FieldErrors<Guest>) => {
    const first = Object.keys(invalid)[0] as keyof Guest | undefined;
    if (first) setFocus(first);
  };
  if (entries.length === 0) return <section className="checkout-empty"><p className="eyebrow">Tu pedido está vacío</p><h1>Elegí algo de la carta antes de continuar.</h1><Link className="button button--ember" to="/">Volver a la carta</Link></section>;

  return <section className="checkout-layout"><div className="checkout-form"><p className="eyebrow">Último paso</p><h1>¿A dónde llevamos la brasa?</h1><p>Pedimos solo lo necesario para preparar tu entrega.</p><form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate><Field label="Nombre" autoComplete="name" error={errors.name?.message} {...register('name')} /><Field label="Teléfono" autoComplete="tel" inputMode="tel" error={errors.phone?.message} {...register('phone')} /><Field label="Dirección de entrega" autoComplete="street-address" error={errors.address?.message} {...register('address')} />{requestError && <Notice tone="warm">{requestError}<button className="inline-action" type="button" disabled={submitting || !attempt.current} onClick={() => attempt.current && void send(attempt.current)}>Reintentar el envío</button></Notice>}<Button type="submit" disabled={submitting}>{submitting ? 'Enviando a cocina…' : 'Confirmar pedido'}</Button></form></div><aside className="checkout-summary" aria-label="Resumen del pedido"><StatusBadge tone="herb">Pedido estimado</StatusBadge><h2>Tu selección</h2><ul>{entries.map(({ item, quantity }) => <li key={item._id}><span>{quantity} × {item.name}</span><strong>{formatPrice(item.priceCents * quantity)}</strong></li>)}</ul><div><span>Subtotal estimado</span><strong>{formatPrice(subtotal)}</strong></div><small>El total enviado por la cocina puede variar solo si la carta cambia antes de confirmar.</small></aside></section>;
}

export { ACTIVE_ATTEMPT_KEY, CONFIRMATION_KEY };
