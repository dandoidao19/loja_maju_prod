
// src/hooks/useLancamentos.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Define the type for a financial entry.
export interface Lancamento {
  id: number;
  data: string;
  descricao: string;
  valor: number;
  status: 'Pago' | 'Previsto';
  cdc: string;
  mes_fechado: boolean;
  tipo: 'entrada' | 'saida';
}

// Define the type for filters.
interface Filtros {
  dataInicio?: string;
  dataFim?: string;
  mesFechado?: boolean | null;
  descricao?: string;
  cdc?: string;
  status?: string;
}

// Hook to fetch financial entries for the "Casa" module
export const useLancamentosCasa = (filtros: Filtros) => {
  return useQuery({
    queryKey: ['lancamentosCasa', filtros],
    queryFn: async () => {
      let query = supabase.from('lancamentos_casa').select('*');

      if (filtros.dataInicio) {
        query = query.gte('data', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('data', filtros.dataFim);
      }
      if (filtros.mesFechado !== undefined && filtros.mesFechado !== null) {
        query = query.eq('mes_fechado', filtros.mesFechado);
      }
      if (filtros.descricao) {
        query = query.ilike('descricao', `%${filtros.descricao}%`);
      }
      if (filtros.cdc && filtros.cdc !== 'Todos') {
        query = query.eq('cdc', filtros.cdc);
      }
      if (filtros.status && filtros.status !== 'Todos') {
        query = query.eq('status', filtros.status);
      }

      const { data, error } = await query.order('data', { ascending: false });

      if (error) {
        console.error('Erro ao buscar lançamentos da casa:', error);
        throw new Error('Erro ao buscar lançamentos da casa: ' + error.message);
      }
      return data as Lancamento[];
    },
  });
};

// Hook to fetch the summary data for the "Casa" cash box
export const useCaixaCasa = () => {
  return useQuery({
    queryKey: ['caixaCasa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caixa_casa')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        console.error('Erro ao buscar o caixa da casa:', error);
        throw new Error('Erro ao buscar o caixa da casa: ' + error.message);
      }
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
