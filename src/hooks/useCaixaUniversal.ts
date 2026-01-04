'use client'

import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import {
  getDataAtualBrasil,
  formatarDataParaExibicao,
  normalizeDate,
  gerarIntervaloDatas,
  calcularDataNDias
} from '@/lib/dateUtils'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

interface TransacaoUnificada {
  id: string | null
  data: string
  tipo: 'entrada' | 'saida'
  valor: number
  contexto: 'casa' | 'loja'
}

const fetchCaixaUniversal = async ({ queryKey }: any) => {
  const [_key, filtro, mesFiltro] = queryKey;

  const fetchAll = async (fromTable: string, selectFields = '*', orderColumn = 'id', filters?: Record<string, any>) => {
    const pageSize = 1000;
    let all: any[] = [];
    let offset = 0;
    while (true) {
      let query = supabase.from(fromTable).select(selectFields).order(orderColumn, { ascending: true }).range(offset, offset + pageSize - 1);
      if (filters) {
        Object.keys(filters).forEach(key => {
          query = query.eq(key, filters[key]);
        });
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  };

  const transacoesLoja = await fetchAll('transacoes_loja', 'id, tipo, total, valor_pago, data', 'data');
  const lancamentosLoja: TransacaoUnificada[] = (transacoesLoja || []).map((t: any) => ({
    id: t.id ?? null,
    data: normalizeDate(t.data),
    tipo: t.tipo as 'entrada' | 'saida',
    valor: Number(t.valor_pago ?? t.total) || 0,
    contexto: 'loja' as const
  })).filter(t => t.data && (t.tipo === 'entrada' || t.tipo === 'saida'));

  const lancamentosCasa = await fetchAll('lancamentos_financeiros', 'id, valor, tipo, data_lancamento, data_prevista', 'id', { caixa_id: '69bebc06-f495-4fed-b0b1-beafb50c017b' });
  const lancamentosCasaUnificados: TransacaoUnificada[] = (lancamentosCasa || []).map((l: any) => ({
      id: l.id ?? null,
      data: normalizeDate(l.data_lancamento ?? l.data_prevista),
      tipo: l.tipo as 'entrada' | 'saida',
      valor: Number(l.valor) || 0,
      contexto: 'casa' as const
  })).filter(l => l.data && (l.tipo === 'entrada' || l.tipo === 'saida'));

  const todasTransacoes = [...lancamentosLoja, ...lancamentosCasaUnificados];
  const hoje = getDataAtualBrasil();

  const transacoesHoje = todasTransacoes.filter(t => t.data === hoje);
  const entradasHoje = transacoesHoje.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
  const saidasHoje = transacoesHoje.filter(t => t.tipo !== 'entrada').reduce((acc, t) => acc + t.valor, 0);

  const caixaRealGeral = todasTransacoes
    .filter(t => t.data <= hoje)
    .reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);

  // buildCumulativeSeries logic is not defined here, assuming it's available or will be moved.
  const buildCumulativeSeries = (entriesRaw: Array<TransacaoUnificada>, desiredEnd?: string): { series: DiaCaixa[], minDate: string, maxDate: string } => {
    if (!entriesRaw || entriesRaw.length === 0) return { series: [], minDate: '', maxDate: '' };
    const uniqueEntries = Array.from(
      entriesRaw.reduce((acc, r) => {
        const data = normalizeDate(r.data);
        if (!data) return acc;
        const key = r.id ? String(r.id) : `${data}|${r.tipo}|${r.valor}`;
        if (!acc.has(key)) acc.set(key, { ...r, data });
        return acc;
      }, new Map<string, TransacaoUnificada>()).values()
    );

    if (uniqueEntries.length === 0) return { series: [], minDate: '', maxDate: '' };
    const datas = uniqueEntries.map((e: TransacaoUnificada) => e.data).filter(Boolean);
    if(datas.length === 0) return { series: [], minDate: '', maxDate: '' };

    const minDate = datas.reduce((a, b) => (a < b ? a : b));
    const maxDateEntries = datas.reduce((a, b) => (a > b ? a : b));
    const maxDate = desiredEnd && desiredEnd > maxDateEntries ? desiredEnd : maxDateEntries;

    const agrup: Record<string, { receitas: number; despesas: number }> = {};
    uniqueEntries.forEach((r: TransacaoUnificada) => {
      const d = r.data;
      if (!agrup[d]) agrup[d] = { receitas: 0, despesas: 0 };
      if (r.tipo === 'entrada') agrup[d].receitas += Number(r.valor) || 0;
      else agrup[d].despesas += Number(r.valor) || 0;
    });

    const saldoInicial = uniqueEntries
      .filter(e => e.data < minDate)
      .reduce((acc, e) => acc + (e.tipo === 'entrada' ? e.valor : -e.valor), 0);

    const listaDatas = gerarIntervaloDatas(minDate, maxDate);
    const series: DiaCaixa[] = [];
    let saldoAtual = saldoInicial;

    listaDatas.forEach(data => {
      const valores = agrup[data] || { receitas: 0, despesas: 0 };
      saldoAtual += valores.receitas - valores.despesas;
      series.push({
        data,
        data_formatada: formatarDataParaExibicao(data),
        receitas: valores.receitas,
        despesas: valores.despesas,
        saldo_acumulado: saldoAtual
      });
    });
    return { series, minDate, maxDate };
  };

  let resultadoPrevisto: DiaCaixa[] = [];
  if (filtro === 'tudo') {
    const { series } = buildCumulativeSeries(todasTransacoes);
    resultadoPrevisto = series.filter(s => s.data >= hoje);
  } else {
    let displayStart = '';
    let displayEnd = '';
    if (filtro === '30dias') {
      const ontem = calcularDataNDias(hoje, -1);
      displayStart = ontem;
      displayEnd = calcularDataNDias(ontem, 29);
    } else if (filtro === 'mes' && mesFiltro) {
      const [ano, mes] = mesFiltro.split('-');
      displayStart = `${ano}-${mes}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      displayEnd = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`;
    }
    const { series } = buildCumulativeSeries(todasTransacoes, displayEnd);
    resultadoPrevisto = series.filter(s => s.data >= displayStart && s.data <= displayEnd);
  }

  return { caixaRealGeral, caixaPrevistoGeral: resultadoPrevisto, entradasHoje, saidasHoje };
};

export const useCaixaUniversal = (filtro: string, mesFiltro: string) => {
  return useQuery({
    queryKey: ['caixaUniversal', filtro, mesFiltro],
    queryFn: fetchCaixaUniversal,
  });
};
