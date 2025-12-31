
// src/components/TabelaLancamentosCasa.tsx
'use client';

import { useLancamentosCasa, Lancamento } from '@/hooks/useLancamentos';

interface TabelaLancamentosCasaProps {
  filtros: any;
}

export default function TabelaLancamentosCasa({ filtros }: TabelaLancamentosCasaProps) {
  const { data: lancamentos, isLoading, isError, error } = useLancamentosCasa(filtros);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <p>Carregando lançamentos...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 text-red-500">
        <p>Erro ao carregar os lançamentos.</p>
        <p className="text-xs">{error?.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <table className="min-w-full table-auto">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Data</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descrição</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CDC</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {lancamentos?.map((lancamento: Lancamento) => (
            <tr key={lancamento.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{new Date(lancamento.data).toLocaleDateString()}</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{lancamento.descricao}</td>
              <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${lancamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                {lancamento.tipo === 'entrada' ? '+' : '-'} R$ {lancamento.valor.toFixed(2)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  lancamento.status === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {lancamento.status}
                </span>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{lancamento.cdc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
