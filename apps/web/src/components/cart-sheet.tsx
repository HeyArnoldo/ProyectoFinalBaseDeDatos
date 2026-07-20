import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CatalogItem } from '@app/contracts';
import { cartEntries, formatPrice } from '../app/catalog';
import { useCart } from '../app/cart';
import { ApiError } from '../app/api';
import { Button, Notice } from './primitives';

export function CartSheet({ open, onClose, catalog, catalogPending, catalogError, retryCatalog }: { open: boolean; onClose(): void; catalog?: CatalogItem[]; catalogPending: boolean; catalogError: unknown; retryCatalog(): void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const cart = useCart();
  const navigate = useNavigate();
  const entries = catalog ? cartEntries(cart.items, catalog) : [];
  const subtotal = entries.reduce((total, entry) => total + entry.item.priceCents * entry.quantity, 0);
  const savedCount = cart.items.reduce((total, item) => total + item.quantity, 0);
  const catalogUnavailable = catalogPending || catalogError !== null;
  const unavailableMessage = catalogError instanceof ApiError && catalogError.network ? 'No hay conexión con la cocina.' : 'La carta no está disponible para reconciliar tu pedido.';

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, a, input, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus.current?.focus(); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="cart-overlay" onMouseDown={onClose}>
      <aside ref={dialog} className="cart-sheet" role="dialog" aria-modal="true" aria-labelledby="cart-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="cart-sheet__header"><div><p className="eyebrow">Tu pedido</p><h2 id="cart-title">La mesa está servida</h2></div><Button tone="quiet" aria-label="Cerrar carrito" onClick={onClose}>Cerrar</Button></header>
        <p className="cart-sheet__live" aria-live="polite">{catalogUnavailable ? `${savedCount} ${savedCount === 1 ? 'producto guardado' : 'productos guardados'}. Esperando la carta para reconciliar tu pedido.` : `${entries.reduce((total, entry) => total + entry.quantity, 0)} ${entries.reduce((total, entry) => total + entry.quantity, 0) === 1 ? 'producto' : 'productos'} en tu pedido`}</p>
        {catalogUnavailable ? <Notice tone="warm">{unavailableMessage} <Button tone="quiet" onClick={retryCatalog}>Reintentar</Button></Notice> : entries.length === 0 ? <p className="cart-sheet__empty">Todavía no elegiste nada. La brasa te espera.</p> : <ul className="cart-lines">{entries.map(({ item, quantity }) => <li key={item._id}><div><strong>{item.name}</strong><span>{formatPrice(item.priceCents)} c/u</span></div><div className="quantity-control"><Button tone="quiet" aria-label={`Quitar una unidad de ${item.name}`} onClick={() => cart.decrement(item._id)}>−</Button><span aria-label={`${quantity} unidades de ${item.name}`}>{quantity}</span><Button tone="quiet" aria-label={`Agregar una unidad de ${item.name}`} onClick={() => cart.increment(item._id)}>+</Button><button className="remove-line" type="button" onClick={() => cart.remove(item._id)}>Quitar</button></div></li>)}</ul>}
        <footer className="cart-sheet__footer"><div><span>Subtotal estimado</span><strong>{formatPrice(subtotal)}</strong><small>El total final lo confirma la cocina.</small></div><Button disabled={entries.length === 0} onClick={() => { onClose(); navigate('/checkout'); }}>Continuar al pedido</Button></footer>
      </aside>
    </div>
  );
}
