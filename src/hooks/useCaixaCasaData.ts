import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeDate, gerarIntervaloDatas, buildCumulativeSeries } from '@/lib/dateUtils'; // Assuming these are moved to dateUtils
import { Lancamento } from '@/types';

const CAIXA_ID_CASA = '69bebc06-f495-4fed-b0b1-beafb50c017b';

const getCaixaCasaData = async () => {
  const { data: realizadosRaw, error: errRealizados } = await supabase
    .from('lancamentos_financeiros')
    .select('id, valor, tipo, data_lancamento')
    .eq('caixa_id', CAIXA_ID_CASA)
    .eq('status', 'realizado')
    .order('data_lancamento', { ascending: true });

  if (errRealizados) throw new Error(errRealizados.message);

  const { data: previstosRaw, error: errPrevistos } = await supabase
    .from('lancamentos_financeiros')
    .select('id, valor, tipo, data_prevista')
    .eq('caixa_id', CAIXA_ID_CASA)
    .eq('status', 'previsto')
    .order('data_prevista', { ascending: true });

  if (errPrevistos) throw new Error(errPrevistos.message);

  const allEntries = [
    ...(realizadosRaw || []).map((r: any) => ({ id: r.id, data: normalizeDate(r.data_lancamento), tipo: r.tipo, valor: r.valor })),
    ...(previstosRaw || []).map((p: any) => ({ id: p.id, data: normalizeDate(p.data_prevista), tipo: p.tipo, valor: p.valor })),
  ].filter(e => e.data);

  return allEntries;
};

export const useCaixaCasaData = () => {
  return useQuery({
    queryKey: ['caixaCasaData'],
    queryFn: getCaixaCasaData,
  });
};
