import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { CartProvider } from './cart';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } }));
  return <QueryClientProvider client={queryClient}><CartProvider>{children}</CartProvider></QueryClientProvider>;
}
