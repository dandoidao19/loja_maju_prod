
// src/components/CaixaUnificado.tsx
'use client';

import { useState, useMemo } from 'react';
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

const gerarMeses = () => {
    const meses = [];
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const valor = `${ano}-${mes}`;
      const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      meses.push({ valor, nome: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) });
    }
    for (let i = 1; i <= 12; i++) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const valor = `${ano}-${mes}`;
        const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        meses.push({ valor, nome: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) });
      }
    return meses;
};

export default function CaixaUnificado() {
  const { data: saldos, isLoading, isError, error } = useCaixaUnificado();
  const [modoExibicao, setModoExibicao] = useState<'proximos30' | 'tudo' | 'mes'>('proximos30');
  const [filtroMes, setFiltroMes] = useState('');
  const meses = useMemo(() => gerarMeses(), []);

  const dadosExibidos = useMemo(() => {
    if (isLoading || isError || !saldos) return [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    switch (modoExibicao) {
      case 'proximos30':
        const dataFim = new Date();
        dataFim.setDate(hoje.getDate() + 30);
        return saldos.filter(saldo => {
          const dataSaldo = new Date(saldo.data + 'T12:00:00');
          return dataSaldo >= hoje && dataSaldo <= dataFim;
        });

      case 'tudo':
        return saldos.filter(saldo => {
            const dataSaldo = new Date(saldo.data + 'T12:00:00');
            return dataSaldo >= hoje;
        });

      case 'mes':
        if (!filtroMes) return [];
        return saldos.filter(saldo => saldo.data.startsWith(filtroMes));

      default:
        return [];
    }
  }, [saldos, modoExibicao, filtroMes]);

  const handleMesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mes = e.target.value;
    setFiltroMes(mes);
    setModoExibicao(mes ? 'mes' : 'proximos30');
  };

  return (
    <div className="bg-white rounded-lg shadow-xl w-full p-4 border border-gray-100">
      <div className="flex flex-wrap justify-between items-center mb-4 pb-2 border-b">
        <h2 className="text-lg font-bold text-gray-800 mb-2 sm:mb-0">Resumo Unificado (Casa + Loja)</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={filtroMes}
            onChange={handleMesChange}
            className="px-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Filtrar por mês...</option>
            {meses.map(m => (
              <option key={m.valor} value={m.valor}>{m.nome}</option>
            ))}
          </select>
          <button
            onClick={() => setModoExibicao(modoExibicao === 'tudo' ? 'proximos30' : 'tudo')}
            className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            {modoExibicao === 'tudo' ? 'Ver Próximos 30 Dias' : 'Ver Tudo'}
          </button>
        </div>
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
