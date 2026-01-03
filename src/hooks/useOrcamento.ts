
// src/hooks/useOrcamento.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const fetchOrcamento = async (contexto: 'casa' | 'loja') => {
  const tableName = `orcamentos_${contexto}`;
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  if (error) throw new Error(error.message);
  return data;
};

interface UpdatePayload {
  contexto: 'casa' | 'loja';
  updates: any[];
}

const updateOrcamento = async ({ contexto, updates }: UpdatePayload) => {
  const tableName = `orcamentos_${contexto}`;
  const { data, error } = await supabase.from(tableName).upsert(updates).select();
  if (error) throw new Error(error.message);
  return data;
};

export const useOrcamento = (contexto: 'casa' | 'loja') => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orcamento', contexto],
    queryFn: () => fetchOrcamento(contexto),
  });

  const mutation = useMutation<any, Error, UpdatePayload>({
    mutationFn: updateOrcamento,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orcamento', variables.contexto] });
    },
  });

  const updateWithContext = (updates: any[]) => {
    mutation.mutate({ contexto, updates });
  };

  return { ...query, update: updateWithContext, isUpdating: mutation.isPending };
};
