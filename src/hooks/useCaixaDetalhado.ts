
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  normalizeDate,
  buildCumulativeSeries,
  getDataAtualBrasil,
  calcularDataNDias
} from '@/lib/dateUtils';

const fetchAll = async (fromTable: string, selectFields = '*', orderColumn = 'id') => {
  const pageSize = 1000;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const from = offset;
    const to = offset + pageSize - 1;
    const { data, error } = await supabase.from(fromTable).select(selectFields).order(orderColumn, { ascending: true }).range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
};

const fetchCaixaDetalhado = async (contexto: 'casa' | 'loja', options: any) => {
  const { mostrandoHistorico, mostrando30Dias, mostrandoMes, mesFiltro } = options;
  const fromTable = `transacoes_${contexto}`;
  const selectFields = 'id, tipo, total, valor_pago, status_pagamento, data, pagamento';
  const orderColumn = contexto === 'loja' ? 'pagamento' : 'data';

  const hoje = getDataAtualBrasil();
  let displayStart = '';
  let displayEnd = '';

  if (mostrandoHistorico) {
    // No specific date range, but we'll filter client-side later
  } else if (mostrando30Dias) {
    const ontem = calcularDataNDias(hoje, -1);
    displayStart = ontem;
    displayEnd = calcularDataNDias(ontem, 29);
  } else if (mostrandoMes && mesFiltro) {
    const [ano, mes] = mesFiltro.split('-');
    displayStart = `${ano}-${mes}-01`;
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    displayEnd = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`;
  } else { // Default to 30 days
    const ontem = calcularDataNDias(hoje, -1);
    displayStart = ontem;
    displayEnd = calcularDataNDias(ontem, 29);
  }

  const transacoes = await fetchAll(fromTable, selectFields, orderColumn);

  const allEntries = (transacoes || [])
    .filter((t: any) => {
      if (contexto === 'loja') return t.status_pagamento === 'pago' && t.pagamento;
      return t.data;
    })
    .map((t: any) => ({
      id: t.id ?? null,
      data: normalizeDate(contexto === 'loja' ? t.pagamento : t.data),
      tipo: t.tipo,
      valor: Number(t.valor_pago ?? t.total) || 0,
    }))
    .filter((t: any) => t.data);

  const { series } = buildCumulativeSeries(allEntries, displayEnd);

  let novoResultado = series;
  if (!mostrandoHistorico) {
    novoResultado = series.filter((s: any) => s.data >= displayStart && s.data <= displayEnd);
  } else {
    novoResultado = series.filter((s: any) => s.data >= hoje);
  }

  return novoResultado;
};

export const useCaixaDetalhado = (contexto: 'casa' | 'loja', options: any) => {
  return useQuery({
    queryKey: ['caixaDetalhado', contexto, options],
    queryFn: () => fetchCaixaDetalhado(contexto, options),
  });
};
