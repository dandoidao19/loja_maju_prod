
'use client'

import { useState, useMemo } from 'react';
import { useCaixaUniversal } from '@/hooks/useCaixaUniversal';
import { getDataAtualBrasil } from '@/lib/dateUtils';

// Função auxiliar para calcular datas
const calcularDataNDias = (dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00Z`);
    data.setDate(data.getDate() + dias);
    return data.toISOString().split('T')[0];
};

export default function CaixaUnificado() {
  const [modo, setModo] = useState<'30dias' | 'mes' | 'tudo'>('30dias');
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });

  // Define os filtros de data com base no modo selecionado
  const filtros = useMemo(() => {
    const hoje = getDataAtualBrasil();
    if (modo === 'mes') {
      const [ano, mes] = mesFiltro.split('-');
      const dataInicio = `${ano}-${mes}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`;
      return { dataInicio, dataFim };
    }
    if (modo === 'tudo') {
        // Para "Ver Tudo", definimos um período longo, ex: 1 ano para frente
        const dataInicio = hoje;
        const dataFim = calcularDataNDias(hoje, 365);
        return { dataInicio, dataFim };
    }
    // Padrão: próximos 30 dias
    const dataInicio = hoje;
    const dataFim = calcularDataNDias(hoje, 30);
    return { dataInicio, dataFim };
  }, [modo, mesFiltro]);

  const { caixaRealUniversal, entradasHojeUniversal, saidasHojeUniversal, caixaPrevisto, isLoading } = useCaixaUniversal(filtros);

  // Funções de formatação
  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  const formatarMoedaCompacta = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor);

  const handleToggleTudo = () => {
    setModo(current => (current === 'tudo' ? '30dias' : 'tudo'));
  };

  const handleMesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setMesFiltro(e.target.value);
      setModo('mes');
  }

  const getTituloPrevisao = () => {
      if (modo === 'mes') return `Mês: ${mesFiltro.split('-')[1]}/${mesFiltro.split('-')[0]}`;
      if (modo === 'tudo') return 'Visão Geral (Próximo Ano)';
      return 'Próximos 30 Dias';
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-2 space-y-2">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">Caixa Universal</h2>

      {/* Seção do Caixa Real */}
      <div className="rounded p-3 bg-blue-50 border border-blue-200">
        <div>
          <p className="text-sm text-gray-600">Caixa Real (Casa + Loja):</p>
          <p className="text-3xl font-bold text-blue-600">{formatarMoeda(caixaRealUniversal || 0)}</p>
          <div className="mt-1 flex justify-between text-sm font-medium">
            <span className="text-green-600">↑ Entradas Hoje: {formatarMoedaCompacta(entradasHojeUniversal || 0)}</span>
            <span className="text-red-600">↓ Saídas Hoje: {formatarMoedaCompacta(saidasHojeUniversal || 0)}</span>
          </div>
        </div>
      </div>

      {/* Seção da Previsão */}
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-2">
            <span className="text-md font-semibold text-gray-700">{getTituloPrevisao()}</span>
            <div className="flex items-center gap-2">
                <input type="month" value={mesFiltro} onChange={handleMesChange} className="px-2 py-1 text-sm border border-gray-300 rounded-md"/>
                <button onClick={handleToggleTudo} className="px-3 py-1 bg-green-500 text-white hover:bg-green-600 rounded-md text-sm font-medium">
                    {modo === 'tudo' ? 'Ver 30 Dias' : 'Ver Tudo'}
                </button>
            </div>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-4">Carregando previsão...</p>
        ) : caixaPrevisto && caixaPrevisto.length > 0 ? (
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr className="border-b border-gray-300">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Data</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Receitas</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Despesas</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {caixaPrevisto.map((dia) => (
                  <tr key={dia.data} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-1 text-gray-700 whitespace-nowrap">{dia.data_formatada}</td>
                    <td className="px-3 py-1 text-right text-green-600 font-medium">{formatarMoedaCompacta(dia.receitas)}</td>
                    <td className="px-3 py-1 text-right text-red-600 font-medium">{formatarMoedaCompacta(dia.despesas)}</td>
                    <td className={`px-3 py-1 text-right font-bold ${dia.saldo_acumulado >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatarMoedaCompacta(dia.saldo_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4"><p className="text-gray-500">Nenhuma transação prevista para o período.</p></div>
        )}
      </div>
    </div>
  );
}
