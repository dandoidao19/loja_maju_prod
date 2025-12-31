
// src/components/CaixaCasa.tsx
'use client';

import { useCaixaCasa } from '@/hooks/useLancamentos';

export default function CaixaCasa() {
  const { data: caixa, isLoading, isError, error } = useCaixaCasa();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-gray-300 rounded w-1/2"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 text-red-500">
        <p>Erro ao carregar o caixa da casa.</p>
        <p className="text-xs">{error?.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Caixa Casa</h2>
      <p className="text-3xl font-bold text-blue-600">
        R$ {caixa?.saldo_atual.toFixed(2)}
      </p>
    </div>
  );
}
