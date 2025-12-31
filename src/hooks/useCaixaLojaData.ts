import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeDate } from '@/lib/dateUtils';
import { Transacao } from '@/types';

const getCaixaLojaData = async () => {
  const { data: transacoesRaw, error } = await supabase
    .from('transacoes_loja')
    .select('id, tipo, total, valor_pago, data')
    .order('data', { ascending: true });

  if (error) throw new Error(error.message);

  const allEntries = (transacoesRaw || []).map((t: any) => ({
    id: t.id,
    data: normalizeDate(t.data),
    tipo: t.tipo,
    valor: t.valor_pago ?? t.total,
  })).filter(e => e.data);

  return allEntries;
};

export const useCaixaLojaData = () => {
  return useQuery({
    queryKey: ['caixaLojaData'],
    queryFn: getCaixaLojaData,
  });
};
