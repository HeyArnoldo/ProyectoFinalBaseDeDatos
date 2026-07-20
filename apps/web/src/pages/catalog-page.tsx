import { startTransition, useEffect, useState } from 'react';
import { ApiError } from '../app/api';
import { formatPrice, useCatalogQuery } from '../app/catalog';
import { useCart } from '../app/cart';
import { ProductArtwork } from '../components/product-artwork';
import { Button, Notice, StatusBadge } from '../components/primitives';
import type { CatalogItem } from '@app/contracts';

function ProductImage({ item }: { item: CatalogItem }) {
  const [failed, setFailed] = useState(false);
  if (!item.imageUrl || failed) return <ProductArtwork compact label={`Ilustración de ${item.name}`} />;
  return <img className="product-card__image" src={item.imageUrl} alt={item.name} onError={() => setFailed(true)} />;
}

export function CatalogPage() {
  const { data, isPending, isError, error, refetch } = useCatalogQuery();
  const cart = useCart();
  const [category, setCategory] = useState('Todos');
  useEffect(() => { if (data) cart.reconcile(data); }, [data]);

  if (isPending) return <section className="catalog-state" aria-live="polite"><p className="eyebrow">Preparando la parrilla</p><h1>Estamos encendiendo el menú.</h1><div className="loading-embers" aria-hidden="true"><i /><i /><i /></div></section>;
  if (isError) {
    const message = error instanceof ApiError && error.network ? 'No hay conexión con la cocina.' : 'No pudimos cargar la carta en este momento.';
    return <section className="catalog-state"><p className="eyebrow">Carta no disponible</p><h1>{message}</h1><p>Podés reintentar cuando la conexión vuelva a estar lista.</p><Button onClick={() => void refetch()}>Reintentar</Button></section>;
  }
  const categories = ['Todos', ...new Set(data.map((item) => item.category))];
  const items = category === 'Todos' ? data : data.filter((item) => item.category === category);
  if (data.length === 0) return <section className="catalog-state"><p className="eyebrow">Carta en pausa</p><h1>La carta vuelve en breve.</h1><p>Estamos afinando los últimos detalles de la cocina.</p><Button onClick={() => void refetch()}>Actualizar carta</Button></section>;

  return (
    <>
      <section className="catalog-hero" aria-labelledby="catalog-title"><div><StatusBadge tone="ember">Carta de hoy</StatusBadge><p className="eyebrow">La Brasa</p><h1 id="catalog-title">Pedí lo que el fuego hace mejor.</h1><p>Elegí tus favoritos. El precio final siempre lo confirma nuestra cocina antes de preparar tu pedido.</p></div><div className="catalog-hero__stamp" aria-label="Cocina peruana al carbón"><span>Desde</span><strong>1998</strong><span>al carbón</span></div></section>
      <section className="catalog" aria-label="Carta de La Brasa"><div className="category-filters" aria-label="Filtrar por categoría">{categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => startTransition(() => setCategory(item))}>{item}</button>)}</div><p className="catalog__count" aria-live="polite">{items.length} {items.length === 1 ? 'opción' : 'opciones'} para compartir</p><div className="product-grid">{items.map((item) => <article className="product-card" key={item._id}><ProductImage item={item} /><div className="product-card__body"><span>{item.category}</span><h2>{item.name}</h2><p>{item.description}</p><div className="product-card__footer"><strong>{formatPrice(item.priceCents)}</strong><Button aria-label={`Agregar ${item.name} al pedido`} onClick={() => cart.add(item._id)}>Agregar</Button></div></div></article>)}</div></section>
      <section className="catalog-note"><Notice tone="success">Las fotos de la carta se incorporarán pronto. Por ahora, cada ilustración representa una preparación disponible.</Notice></section>
    </>
  );
}
