
// src/components/CaixaUnificado.tsx
'use client';

import { useState, useMemo } from 'react';
import { useCaixaUnificado } from '@/hooks/useCaixaUnificado';
import { getDataAtualBrasil } from '@/lib/dateUtils';

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
    // Gera 12 meses passados
    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const valor = `${ano}-${mes}`;
      const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      meses.push({ valor, nome: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) });
    }
    // Gera 12 meses futuros
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
  const [verTodas, setVerTodas] = useState(false);
  const [filtroMes, setFiltroMes] = useState('');

  // Memoizar a geração da lista de meses para performance
  const meses = useMemo(() => gerarMeses(), []);

  // Lógica de filtragem corrigida e centralizada
  const dadosExibidos = useMemo(() => {
    if (isLoading || isError || !saldos) return [];

    const hojeStr = getDataAtualBrasil();

    // 1. Filtro por Mês (tem prioridade)
    if (filtroMes) {
      return saldos.filter(saldo => saldo.data.startsWith(filtroMes));
    }

    // 2. Filtro "Ver Todas" (mostra tudo a partir de hoje)
    if (verTodas) {
      return saldos.filter(saldo => saldo.data >= hojeStr);
    }

    // 3. Filtro Padrão: "Próximos 30 dias"
    const dataBase = new Date(`${hojeStr}T12:00:00`);
    dataBase.setDate(dataBase.getDate() + 30);
    const dataFimStr = dataBase.toISOString().split('T')[0];

    return saldos.filter(saldo => saldo.data >= hojeStr && saldo.data <= dataFimStr);
  }, [saldos, verTodas, filtroMes, isLoading, isError]);

  const handleMesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mes = e.target.value;
    setFiltroMes(mes);
    if (mes) {
      setVerTodas(false); // Desativa "Ver Todas" se um mês for selecionado
    }
  };

  const handleVerTodasClick = () => {
    setVerTodas(prev => !prev);
    setFiltroMes(''); // Limpa o filtro de mês ao alternar
  };

  const getTitulo = () => {
    if (filtroMes) {
      const mesSelecionado = meses.find(m => m.valor === filtroMes);
      return `Resumo do Mês: ${mesSelecionado?.nome || filtroMes}`;
    }
    if (verTodas) {
      return 'Resumo de Todas as Transações Futuras';
    }
    return 'Resumo dos Próximos 30 Dias';
  }

  return (
    <div className="bg-white rounded-lg shadow-xl w-full p-4 border border-gray-100">
      <div className="flex flex-wrap justify-between items-center mb-4 pb-2 border-b">
        <h2 className="text-lg font-bold text-gray-800 mb-2 sm:mb-0">{getTitulo()}</h2>
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
            onClick={handleVerTodasClick}
            className={`px-3 py-1 text-xs font-semibold text-white rounded-md transition-colors ${
              verTodas ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600'
            }`}
          >
            {verTodas ? 'Ver Próximos 30 Dias' : 'Ver Tudo'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-gray-500">Carregando dados...</div>
      )}

      {isError && (
        <div className="text-center py-8 text-red-500">
          Ocorreu um erro ao carregar os dados. Detalhes: {error?.message}
        </div>
      )}

      {!isLoading && !isError && (
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
              {dadosExibidos.length > 0 ? (
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
                    Nenhuma transação encontrada para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
