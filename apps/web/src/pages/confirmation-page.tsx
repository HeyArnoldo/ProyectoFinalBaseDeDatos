import { Link, useLocation, useParams } from 'react-router-dom';
import { checkoutResponseSchema, type CheckoutResponse } from '@app/contracts';
import { formatPrice } from '../app/catalog';
import { StatusBadge } from '../components/primitives';
import { CONFIRMATION_KEY } from './checkout-page';

function readConfirmation(): CheckoutResponse | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(CONFIRMATION_KEY) ?? 'null');
    const parsed = checkoutResponseSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function ConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const fromNavigation = checkoutResponseSchema.safeParse(location.state);
  const confirmation = fromNavigation.success ? fromNavigation.data : readConfirmation();
  if (!confirmation || confirmation.orderId !== orderId) return <section className="confirmation confirmation--missing"><p className="eyebrow">Pedido no disponible</p><h1>No encontramos esa confirmación en este dispositivo.</h1><Link className="button button--ember" to="/">Volver a la carta</Link></section>;
  return <section className="confirmation"><StatusBadge tone="herb">Pedido recibido</StatusBadge><p className="eyebrow">Gracias por elegir La Brasa</p><h1>Tu fuego ya está en marcha.</h1><p>Recibimos el pedido <strong>{confirmation.orderId}</strong>.</p><dl><div><dt>Estado del pedido</dt><dd>{confirmation.status}</dd></div><div><dt>Proyección inicial</dt><dd><StatusBadge tone="ember">{confirmation.projectionStatus}</StatusBadge></dd></div><div><dt>Total confirmado</dt><dd>{formatPrice(confirmation.totalCents)}</dd></div></dl><p className="confirmation__note">La proyección inicial queda pendiente mientras la cocina procesa el evento. Este comprobante no consulta Cassandra ni representa una lectura en tiempo real.</p><Link className="text-link" to="/">Volver a la carta</Link></section>;
}
