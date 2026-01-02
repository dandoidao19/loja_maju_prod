
// src/hooks/useCaixaPrevisto.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatarDataParaExibicao, getDataAtualBrasil } from '@/lib/dateUtils';

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

// Funções auxiliares movidas para cá
const normalizeDate = (d?: string) => {
  if (!d) return '';
  if (d.includes('T')) return d.split('T')[0];
  return new Date(d).toISOString().slice(0, 10);
};

const gerarIntervaloDatas = (inicio: string, fim: string) => {
  const lista: string[] = [];
  let atual = new Date(inicio + 'T12:00:00Z');
  const fimDate = new Date(fim + 'T12:00:00Z');
  while (atual <= fimDate) {
    lista.push(atual.toISOString().slice(0, 10));
    atual.setDate(atual.getDate() + 1);
  }
  return lista;
};

const fetchCaixaPrevisto = async ({ contexto, dataInicio, dataFim }: CaixaPrevistoFiltros): Promise<DiaCaixa[]> => {
  let allEntries: Array<any> = [];

  if (contexto === 'casa') {
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select('id, valor, tipo, data_lancamento, data_prevista')
      .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
      .order('data_lancamento', { ascending: true });
    if (error) throw error;

    data?.forEach((r: any) => {
        const d = normalizeDate(r.data_prevista || r.data_lancamento);
        if (d) allEntries.push({ id: r.id, data: d, tipo: r.tipo, valor: Number(r.valor) || 0 });
    });

  } else { // loja
    const { data, error } = await supabase
      .from('transacoes_loja')
      .select('id, tipo, total, valor_pago, data')
      .order('data', { ascending: true });
    if (error) throw error;

    data?.forEach((t: any) => {
      const d = normalizeDate(t.data);
      if (d) allEntries.push({ id: t.id, data: d, tipo: t.tipo, valor: Number(t.valor_pago ?? t.total) || 0 });
    });
  }

  if (allEntries.length === 0) return [];

  const datas = allEntries.map(e => e.data);
  const minDate = datas.reduce((a, b) => (a < b ? a : b));
  const maxDate = datas.reduce((a, b) => (a > b ? a : b));
  const finalMaxDate = dataFim > maxDate ? dataFim : maxDate;

  const agrup: Record<string, { receitas: number; despesas: number }> = {};
  allEntries.forEach(r => {
    if (!agrup[r.data]) agrup[r.data] = { receitas: 0, despesas: 0 };
    if (r.tipo === 'entrada') agrup[r.data].receitas += r.valor;
    else agrup[r.data].despesas += r.valor;
  });

  const listaDatas = gerarIntervaloDatas(minDate, finalMaxDate);
  const series: DiaCaixa[] = [];
  let saldoAtual = 0;

  listaDatas.forEach(data => {
    const valores = agrup[data] || { receitas: 0, despesas: 0 };
    saldoAtual += (valores.receitas - valores.despesas);
    series.push({
      data,
      data_formatada: formatarDataParaExibicao(data),
      receitas: valores.receitas,
      despesas: valores.despesas,
      saldo_acumulado: saldoAtual,
    });
  });

  return series.filter(s => s.data >= dataInicio && s.data <= dataFim);
};


export const useCaixaPrevisto = (filtros: CaixaPrevistoFiltros) => {
  return useQuery({
    queryKey: ['caixaPrevisto', filtros.contexto, filtros.dataInicio, filtros.dataFim],
    queryFn: () => fetchCaixaPrevisto(filtros),
    enabled: !!filtros.contexto && !!filtros.dataInicio && !!filtros.dataFim,
  });
};
