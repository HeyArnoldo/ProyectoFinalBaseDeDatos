import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { CatalogItem } from '@app/contracts';

const STORAGE_KEY = 'la-brasa-cart';

export type CartLine = { itemId: string; quantity: number };
export type CartState = { items: CartLine[] };
export type CartAction =
  | { type: 'add'; itemId: string }
  | { type: 'increment'; itemId: string }
  | { type: 'decrement'; itemId: string }
  | { type: 'remove'; itemId: string }
  | { type: 'clear' }
  | { type: 'reconcile'; activeIds: Set<string> };

export function cartReducer(state: CartState, action: CartAction): CartState {
  const existing = state.items.find((item) => item.itemId === ('itemId' in action ? action.itemId : ''));
  if (action.type === 'add' || action.type === 'increment') {
    return { items: existing ? state.items.map((item) => item.itemId === action.itemId ? { ...item, quantity: item.quantity + 1 } : item) : [...state.items, { itemId: action.itemId, quantity: 1 }] };
  }
  if (action.type === 'decrement') {
    return { items: state.items.flatMap((item) => item.itemId !== action.itemId ? [item] : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []) };
  }
  if (action.type === 'remove') return { items: state.items.filter((item) => item.itemId !== action.itemId) };
  if (action.type === 'clear') return { items: [] };
  const items = state.items.filter((item) => action.activeIds.has(item.itemId));
  return items.length === state.items.length ? state : { items };
}

function loadCart(): CartState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return { items: [] };
    return { items: value.filter((item): item is CartLine => typeof item === 'object' && item !== null && 'itemId' in item && 'quantity' in item && typeof item.itemId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0) };
  } catch {
    return { items: [] };
  }
}

type CartContextValue = CartState & {
  add(itemId: string): void;
  increment(itemId: string): void;
  decrement(itemId: string): void;
  remove(itemId: string): void;
  clear(): void;
  reconcile(catalog: CatalogItem[]): void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadCart);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)); }, [state.items]);
  const value: CartContextValue = {
    ...state,
    add: (itemId) => dispatch({ type: 'add', itemId }),
    increment: (itemId) => dispatch({ type: 'increment', itemId }),
    decrement: (itemId) => dispatch({ type: 'decrement', itemId }),
    remove: (itemId) => dispatch({ type: 'remove', itemId }),
    clear: () => dispatch({ type: 'clear' }),
    reconcile: (catalog) => dispatch({ type: 'reconcile', activeIds: new Set(catalog.filter((item) => item.active).map((item) => item._id)) }),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}

export const cartStorageKey = STORAGE_KEY;
