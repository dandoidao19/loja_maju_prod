
'use client'

import { useState, useMemo } from 'react';
import { useCaixaUniversal } from '@/hooks/useCaixaUniversal';
import { getDataAtualBrasil } from '@/lib/dateUtils';

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
        const dataInicio = hoje;
        const dataFim = calcularDataNDias(hoje, 365); // Próximo ano
        return { dataInicio, dataFim };
    }
    // modo '30dias' ou padrão
    const dataInicio = hoje;
    const dataFim = calcularDataNDias(hoje, 30);
    return { dataInicio, dataFim };
  }, [modo, mesFiltro]);

  const { caixaRealUniversal, entradasHojeUniversal, saidasHojeUniversal, caixaPrevisto, isLoading } = useCaixaUniversal(filtros);

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  const formatarMoedaCompacta = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor);

  const handleToggleTudo = () => {
    setModo(current => (current === 'tudo' ? '30dias' : 'tudo'));
    setMesFiltro(''); // Limpa o filtro de mês
  };

  const handleMesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setMesFiltro(e.target.value);
      setModo('mes');
  }

  const getTituloPrevisao = () => {
      if (modo === 'mes') return `Mês: ${mesFiltro.split('-')[1]}/${mesFiltro.split('-')[0]}`;
      if (modo === 'tudo') return 'Visão Geral';
      return 'Próximos 30 Dias';
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1">
      <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>Caixa Universal</h2>

      <div className="rounded p-1.5 bg-blue-50 border border-blue-200">
        <div>
          <p className="mb-0.5 text-gray-600" style={{ fontSize: '12px' }}>Caixa Real:</p>
          <p className="text-2xl font-bold text-blue-600">{formatarMoeda(caixaRealUniversal || 0)}</p>
          <div className="mt-0.5 flex justify-between text-[11px] font-medium">
            <span className="text-green-600">↑ {formatarMoedaCompacta(entradasHojeUniversal || 0)}</span>
            <span className="text-red-600">↓ {formatarMoedaCompacta(saidasHojeUniversal || 0)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-gray-700" style={{ fontSize: '12px' }}>{getTituloPrevisao()}</span>
            <div className="flex gap-0.5">
                <input type="month" value={mesFiltro} onChange={handleMesChange} className="px-1.5 py-0.5 text-xs border border-gray-300 rounded"/>
                <button onClick={() => setModo('mes')} className="px-1.5 py-0.5 bg-blue-500 text-white hover:bg-blue-600 rounded text-xs font-medium">Ver Mês</button>
                <button onClick={handleToggleTudo} className="px-1.5 py-0.5 bg-green-500 text-white hover:bg-green-600 rounded text-xs font-medium">
                    {modo === 'tudo' ? '30 Dias' : 'Ver Tudo'}
                </button>
            </div>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-2" style={{ fontSize: '12px' }}>Carregando...</p>
        ) : caixaPrevisto && caixaPrevisto.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Data</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Receitas</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Despesas</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {caixaPrevisto.map((dia) => (
                  <tr key={dia.data} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-1 py-0.5 text-gray-700 whitespace-nowrap">{dia.data_formatada}</td>
                    <td className="px-1 py-0.5 text-right text-green-600 font-medium">{formatarMoedaCompacta(dia.receitas)}</td>
                    <td className="px-1 py-0.5 text-right text-red-600 font-medium">{formatarMoedaCompacta(dia.despesas)}</td>
                    <td className={`px-1 py-0.5 text-right font-bold ${dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatarMoedaCompacta(dia.saldo_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-3"><p className="text-gray-500 text-xs">Nenhuma transação no período.</p></div>
        )}
      </div>
    </div>
  );
}
