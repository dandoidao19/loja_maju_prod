
// src/hooks/useCaixaPrevisto.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatarDataParaExibicao } from '@/lib/dateUtils';

interface DiaCaixa {
  data: string;
  data_formatada: string;
  receitas: number;
  despesas: number;
  saldo_acumulado: number;
}

interface CaixaPrevistoFiltros {
  contexto: 'casa' | 'loja';
  dataInicio: string;
  dataFim: string;
}

const normalizeDate = (d?: string) => {
  if (!d) return '';
  if (d.includes('T')) return d.split('T')[0];
  const date = new Date(d);
  date.setUTCHours(12); // Evita problemas de fuso
  return date.toISOString().slice(0, 10);
};

const fetchCaixaPrevisto = async ({ contexto, dataInicio, dataFim }: CaixaPrevistoFiltros): Promise<DiaCaixa[]> => {
  let allEntries: Array<{ data: string; tipo: 'entrada' | 'saida'; valor: number }> = [];

  // 1. Buscar TODAS as transações para calcular o saldo inicial
  if (contexto === 'casa') {
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select('valor, tipo, data_lancamento, data_prevista')
      .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b');
    if (error) throw error;
    data?.forEach(r => {
      const d = normalizeDate(r.data_prevista || r.data_lancamento);
      if (d) allEntries.push({ data: d, tipo: r.tipo, valor: Number(r.valor) || 0 });
    });
  } else { // loja
    const { data, error } = await supabase.from('transacoes_loja').select('tipo, total, valor_pago, data');
    if (error) throw error;
    data?.forEach(t => {
      const d = normalizeDate(t.data);
      if (d) allEntries.push({ data: d, tipo: t.tipo, valor: Number(t.valor_pago ?? t.total) || 0 });
    });
  }

  if (allEntries.length === 0) return [];

  // 2. Calcular o saldo acumulado até o DIA ANTERIOR ao início do período
  const diaAnterior = new Date(`${dataInicio}T12:00:00Z`);
  diaAnterior.setDate(diaAnterior.getDate() - 1);
  const diaAnteriorStr = diaAnterior.toISOString().split('T')[0];

  let saldoInicial = 0;
  allEntries.forEach(entry => {
    if (entry.data <= diaAnteriorStr) {
      saldoInicial += entry.tipo === 'entrada' ? entry.valor : -entry.valor;
    }
  });

  // 3. Agrupar as transações DENTRO do período solicitado
  const transacoesNoPeriodo = allEntries.filter(e => e.data >= dataInicio && e.data <= dataFim);
  const agrup: Record<string, { receitas: number; despesas: number }> = {};
  transacoesNoPeriodo.forEach(r => {
    if (!agrup[r.data]) agrup[r.data] = { receitas: 0, despesas: 0 };
    if (r.tipo === 'entrada') agrup[r.data].receitas += r.valor;
    else agrup[r.data].despesas += r.valor;
  });

  // 4. Gerar a série de dias para o período, começando com o saldo inicial
  const series: DiaCaixa[] = [];
  let saldoAcumulado = saldoInicial;

  const diasPeriodo = [];
  let diaCorrente = new Date(`${dataInicio}T12:00:00Z`);
  const dataFimDate = new Date(`${dataFim}T12:00:00Z`);
  while(diaCorrente <= dataFimDate) {
      diasPeriodo.push(diaCorrente.toISOString().split('T')[0]);
      diaCorrente.setDate(diaCorrente.getDate() + 1);
  }

  diasPeriodo.forEach(data => {
    const valores = agrup[data] || { receitas: 0, despesas: 0 };
    saldoAcumulado += valores.receitas - valores.despesas;
    series.push({
      data,
      data_formatada: formatarDataParaExibicao(data),
      receitas: valores.receitas,
      despesas: valores.despesas,
      saldo_acumulado: saldoAcumulado,
    });
  });

  return series;
};

export const useCaixaPrevisto = (filtros: CaixaPrevistoFiltros) => {
  return useQuery({
    queryKey: ['caixaPrevisto', filtros.contexto, filtros.dataInicio, filtros.dataFim],
    queryFn: () => fetchCaixaPrevisto(filtros),
    enabled: !!filtros.contexto && !!filtros.dataInicio && !!filtros.dataFim,
    staleTime: 1000 * 60 * 5,
    initialData: [], // Garante que 'data' seja sempre um array
  });
};
