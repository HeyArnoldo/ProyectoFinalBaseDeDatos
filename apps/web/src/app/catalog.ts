import { useQuery } from '@tanstack/react-query';
import type { CatalogItem } from '@app/contracts';
import { api } from './api';
import type { CartLine } from './cart';

export function useCatalogQuery() {
  return useQuery({ queryKey: ['catalog'], queryFn: api.getCatalog });
}

export type CartEntry = { item: CatalogItem; quantity: number };

export function cartEntries(lines: CartLine[], catalog: CatalogItem[]): CartEntry[] {
  const byId = new Map(catalog.map((item) => [item._id, item]));
  return lines.flatMap((line) => {
    const item = byId.get(line.itemId);
    return item?.active ? [{ item, quantity: line.quantity }] : [];
  });
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(cents / 100);
}
