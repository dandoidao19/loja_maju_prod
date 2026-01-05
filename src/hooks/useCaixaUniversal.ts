import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO } from 'date-fns'

interface Lancamento {
  id: string;
  data_lancamento: string;
  valor: number;
  tipo: 'entrada' | 'saida';
}

interface Serie {
  name: string;
  data: number[];
}

interface CaixaData {
  series: Serie[];
  categories: string[];
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  loading: boolean;
}

const buildCumulativeSeries = (lancamentos: Lancamento[], startDate: Date, endDate: Date, saldoInicial: number) => {
  const categories = eachDayOfInterval({ start: startDate, end: endDate }).map(date => format(date, 'dd/MM'));
  const dailyTotals = new Map<string, number>();

  lancamentos.forEach(lanc => {
    const date = format(parseISO(lanc.data_lancamento), 'dd/MM');
    const value = lanc.tipo === 'entrada' ? lanc.valor : -lanc.valor;
    dailyTotals.set(date, (dailyTotals.get(date) || 0) + value);
  });

  let cumulativeTotal = saldoInicial;
  const cumulativeData = categories.map(date => {
    cumulativeTotal += dailyTotals.get(date) || 0;
    return cumulativeTotal;
  });

  return {
    series: [{ name: 'Saldo Previsto', data: cumulativeData }],
    categories,
  };
};

export const useCaixaUniversal = (month: string): CaixaData => {
  const [data, setData] = useState<CaixaData>({
    series: [],
    categories: [],
    saldoInicial: 0,
    entradas: 0,
    saidas: 0,
    saldoFinal: 0,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true }));

    try {
      const [year, monthIndex] = month.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, monthIndex - 1));
      const endDate = endOfMonth(startDate);

      const { data: saldoData, error: saldoError } = await supabase
        .from('caixas')
        .select('valor') // CORREÇÃO: Usando a coluna 'valor'
        .lte('data', format(startDate, 'yyyy-MM-dd'))
        .order('data', { ascending: false })
        .limit(1);

      if (saldoError) throw saldoError;
      const saldoInicial = saldoData?.[0]?.valor || 0;

      const { data: lancamentos, error: lancamentosError } = await supabase
        .from('lancamentos_financeiros')
        .select('id, data_lancamento, valor, tipo')
        .gte('data_lancamento', format(startDate, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(endDate, 'yyyy-MM-dd'));

      if (lancamentosError) throw lancamentosError;

      const { series, categories } = buildCumulativeSeries(lancamentos || [], startDate, endDate, saldoInicial);
      const entradas = lancamentos?.filter(l => l.tipo === 'entrada').reduce((acc, l) => acc + l.valor, 0) || 0;
      const saidas = lancamentos?.filter(l => l.tipo === 'saida').reduce((acc, l) => acc + l.valor, 0) || 0;
      const saldoFinal = saldoInicial + entradas - saidas;

      setData({
        series,
        categories,
        saldoInicial,
        entradas,
        saidas,
        saldoFinal,
        loading: false,
      });
    } catch (error) {
      console.error('Erro ao buscar dados do caixa (detalhado):', JSON.stringify(error, null, 2));
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return data;
};
