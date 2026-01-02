
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
  // Handles 'YYYY-MM-DDTHH:mm:ss.sssZ' format
  if (d.includes('T')) return d.split('T')[0];
  // Basic handling for 'YYYY-MM-DD'
  return new Date(d).toISOString().slice(0, 10);
};

const gerarIntervaloDatas = (inicio: string, fim: string) => {
  const lista: string[] = [];
  // Use UTC to avoid timezone shifts
  let atual = new Date(inicio + 'T00:00:00Z');
  const fimDate = new Date(fim + 'T00:00:00Z');
  while (atual <= fimDate) {
    lista.push(atual.toISOString().slice(0, 10));
    atual.setDate(atual.getDate() + 1);
  }
  return lista;
};

const fetchCaixaPrevisto = async ({ contexto, dataInicio, dataFim }: CaixaPrevistoFiltros): Promise<DiaCaixa[]> => {
  let allEntries: Array<{ id: string; data: string; tipo: 'entrada' | 'saida'; valor: number }> = [];

  if (contexto === 'casa') {
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select('id, valor, tipo, data_lancamento, data_prevista')
      .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
      .order('data_lancamento', { ascending: true }); // Order by a single column for consistency
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

  const datas = allEntries.map(e => e.data).filter(Boolean);
  if (datas.length === 0) return [];

  const minDate = datas.reduce((a, b) => (a < b ? a : b));

  // O período de cálculo deve ir do início absoluto até o fim do período solicitado
  const periodoCalculoFim = dataFim;

  const agrup: Record<string, { receitas: number; despesas: number }> = {};
  allEntries.forEach(r => {
    if (!agrup[r.data]) agrup[r.data] = { receitas: 0, despesas: 0 };
    if (r.tipo === 'entrada') agrup[r.data].receitas += r.valor;
    else agrup[r.data].despesas += r.valor;
  });

  const listaDatasCompleta = gerarIntervaloDatas(minDate, periodoCalculoFim);
  const seriesCompletas: DiaCaixa[] = [];
  let saldoAcumulado = 0;

  listaDatasCompleta.forEach(data => {
    const valores = agrup[data] || { receitas: 0, despesas: 0 };
    saldoAcumulado += (valores.receitas - valores.despesas);
    seriesCompletas.push({
      data,
      data_formatada: formatarDataParaExibicao(data),
      receitas: valores.receitas,
      despesas: valores.despesas,
      saldo_acumulado: saldoAcumulado,
    });
  });

  // Finalmente, filtre a série completa para retornar apenas o período desejado
  return seriesCompletas.filter(s => s.data >= dataInicio && s.data <= dataFim);
};


export const useCaixaPrevisto = (filtros: CaixaPrevistoFiltros) => {
  return useQuery({
    queryKey: ['caixaPrevisto', filtros.contexto, filtros.dataInicio, filtros.dataFim],
    queryFn: () => fetchCaixaPrevisto(filtros),
    enabled: !!filtros.contexto && !!filtros.dataInicio && !!filtros.dataFim,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
  });
};
