
// src/components/CaixaUnificado.tsx
'use client';

import { useState } from 'react';
import { useCaixaUnificado, SaldoDiario } from '@/hooks/useCaixaUnificado';

// Função para formatar a data como DD/MM/AAAA
const formatarData = (data: string) => {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
};

// Função para formatar valores monetários
const formatarValor = (valor: number) => {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function CaixaUnificado() {
  const { data: saldos, isLoading, isError, error } = useCaixaUnificado();
  const [mostrarTodos, setMostrarTodos] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-lg text-gray-600 animate-pulse">Calculando caixa unificado...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-red-500">
        <h3 className="text-lg font-bold mb-2">Erro ao Carregar Dados</h3>
        <p className="text-sm">{error?.message}</p>
      </div>
    );
  }

  // Filtrar os dados para os últimos 30 dias se `mostrarTodos` for falso
  const dadosExibidos = mostrarTodos
    ? saldos
    : saldos?.slice(0, 30);

  return (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto p-6 border border-gray-100">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h2 className="text-2xl font-bold text-gray-800">Resumo Unificado (Casa + Loja)</h2>
        <button
          onClick={() => setMostrarTodos(!mostrarTodos)}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          {mostrarTodos ? 'Ver Últimos 30 Dias' : 'Ver Tudo'}
        </button>
      </div>

      {/* Tabela de Saldos Diários */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600 uppercase">
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold text-right">Receitas</th>
              <th className="px-4 py-3 font-semibold text-right">Despesas</th>
              <th className="px-4 py-3 font-semibold text-right">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {dadosExibidos && dadosExibidos.length > 0 ? (
              dadosExibidos.map((saldo) => (
                <tr key={saldo.data} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{formatarData(saldo.data)}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">{formatarValor(saldo.entradas)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-semibold">{formatarValor(saldo.saidas)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatarValor(saldo.saldoAcumulado)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  Nenhuma transação encontrada para exibir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
