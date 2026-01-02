
'use client'

import { DadosFinanceirosProvider } from '@/context/DadosFinanceirosContext';
import ReactQueryProvider from './providers/ReactQueryProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <DadosFinanceirosProvider>
        {children}
      </DadosFinanceirosProvider>
    </ReactQueryProvider>
  );
}
