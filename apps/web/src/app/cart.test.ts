import { expect, it } from 'vitest';
import { cartReducer } from './cart';

it('adds, changes, removes, and reconciles persisted cart lines against active catalog IDs', () => {
  let state = cartReducer({ items: [] }, { type: 'add', itemId: 'item-a' });
  state = cartReducer(state, { type: 'increment', itemId: 'item-a' });
  state = cartReducer(state, { type: 'add', itemId: 'item-b' });
  expect(state.items).toEqual([{ itemId: 'item-a', quantity: 2 }, { itemId: 'item-b', quantity: 1 }]);

  state = cartReducer(state, { type: 'decrement', itemId: 'item-a' });
  state = cartReducer(state, { type: 'remove', itemId: 'item-b' });
  state = cartReducer(state, { type: 'reconcile', activeIds: new Set(['item-a']) });
  expect(state.items).toEqual([{ itemId: 'item-a', quantity: 1 }]);
});
