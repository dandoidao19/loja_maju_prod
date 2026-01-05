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

      // --- CÁLCULO CORRETO DO SALDO INICIAL ---
      const dataLimite = format(startDate, 'yyyy-MM-dd');

      // 1. Saldo inicial da CASA (lancamentos_financeiros)
      const { data: lancamentosCasa, error: casaError } = await supabase
        .from('lancamentos_financeiros')
        .select('valor, tipo')
        .lt('data_lancamento', dataLimite);

      if (casaError) throw casaError;

      const saldoCasa = lancamentosCasa.reduce((acc, l) => {
        return acc + (l.tipo === 'entrada' ? l.valor : -l.valor);
      }, 0);

      // 2. Saldo inicial da LOJA (transacoes_loja)
      const { data: transacoesLoja, error: lojaError } = await supabase
        .from('transacoes_loja')
        .select('valor_parcela')
        .eq('status_pagamento', 'pago')
        .lt('data_pagamento', dataLimite);

      if (lojaError) throw lojaError;

      const saldoLoja = transacoesLoja.reduce((acc, t) => acc + t.valor_parcela, 0);

      // 3. Saldo inicial total
      const saldoInicial = saldoCasa + saldoLoja;
      // --- FIM DO CÁLCULO ---

      // --- BUSCA DAS MOVIMENTAÇÕES DO MÊS ---
      const dataInicioMes = format(startDate, 'yyyy-MM-dd');
      const dataFimMes = format(endDate, 'yyyy-MM-dd');

      // 1. Lançamentos da CASA
      const { data: lancamentosCasaMes, error: lancamentosError } = await supabase
        .from('lancamentos_financeiros')
        .select('id, data_lancamento, valor, tipo')
        .gte('data_lancamento', dataInicioMes)
        .lte('data_lancamento', dataFimMes);

      if (lancamentosError) throw lancamentosError;

      // 2. Transações da LOJA (apenas entradas pagas)
      const { data: transacoesLojaMes, error: transacoesError } = await supabase
        .from('transacoes_loja')
        .select('id, data_pagamento, valor_parcela')
        .eq('status_pagamento', 'pago')
        .gte('data_pagamento', dataInicioMes)
        .lte('data_pagamento', dataFimMes);

      if (transacoesError) throw transacoesError;

      // 3. Unificar e formatar dados para o gráfico
      const lancamentosLojaFormatados: Lancamento[] = (transacoesLojaMes || []).map(t => ({
        id: t.id,
        data_lancamento: t.data_pagamento,
        valor: t.valor_parcela,
        tipo: 'entrada' as 'entrada',
      }));

      const todosLancamentos = [...(lancamentosCasaMes || []), ...lancamentosLojaFormatados]
        .sort((a, b) => parseISO(a.data_lancamento).getTime() - parseISO(b.data_lancamento).getTime());
      // --- FIM DA BUSCA ---

      const { series, categories } = buildCumulativeSeries(todosLancamentos, startDate, endDate, saldoInicial);
      const entradas = todosLancamentos.filter(l => l.tipo === 'entrada').reduce((acc, l) => acc + l.valor, 0) || 0;
      const saidas = todosLancamentos.filter(l => l.tipo === 'saida').reduce((acc, l) => acc + l.valor, 0) || 0;
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
