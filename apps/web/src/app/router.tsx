import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router-dom';
import { cartEntries, useCatalogQuery } from './catalog';
import { useCart } from './cart';
import { CartSheet } from '../components/cart-sheet';
import { CatalogPage } from '../pages/catalog-page';
import { CheckoutPage } from '../pages/checkout-page';
import { ConfirmationPage } from '../pages/confirmation-page';

const OperatorRoutes = lazy(() => import('../operator/operator-routes').then((module) => ({ default: module.OperatorRoutes })));

function PublicShell() {
  const [cartOpen, setCartOpen] = useState(false);
  const { data: catalog, isPending: catalogPending, isError: catalogIsError, error: catalogError, refetch: retryCatalog } = useCatalogQuery();
  const cart = useCart();
  useEffect(() => { if (catalog) cart.reconcile(catalog); }, [catalog]);
  const count = catalog ? cartEntries(cart.items, catalog).reduce((total, entry) => total + entry.quantity, 0) : cart.items.reduce((total, entry) => total + entry.quantity, 0);
  const closeCart = useCallback(() => setCartOpen(false), []);

  return <div className="site-shell"><a className="skip-link" href="#contenido">Saltar al contenido</a><header className="site-header"><Link className="brand" to="/" aria-label="La Brasa, inicio"><span className="brand__mark" aria-hidden="true">LB</span><span><strong>La Brasa</strong><small>Cocina al carbón</small></span></Link><nav aria-label="Navegación principal"><Link to="/">Carta</Link><button className="cart-trigger" type="button" onClick={() => setCartOpen(true)} aria-haspopup="dialog" aria-label={`Abrir pedido, ${count} productos`}><span>Pedido</span><b aria-live="polite">{count}</b></button></nav></header><main id="contenido"><Outlet /></main><footer className="site-footer"><span>La Brasa</span><span>Hecho para compartir.</span></footer><CartSheet open={cartOpen} onClose={closeCart} catalog={catalog} catalogPending={catalogPending} catalogError={catalogIsError ? catalogError : null} retryCatalog={() => void retryCatalog()} /></div>;
}

export function AppRouter() {
  return <BrowserRouter><Routes><Route element={<PublicShell />}><Route index element={<CatalogPage />} /><Route path="checkout" element={<CheckoutPage />} /><Route path="confirmacion/:orderId" element={<ConfirmationPage />} /></Route><Route path="operador/*" element={<Suspense fallback={<main className="operator-loading" aria-live="polite">Abriendo operaciones…</main>}><OperatorRoutes /></Suspense>} /></Routes></BrowserRouter>;
}
