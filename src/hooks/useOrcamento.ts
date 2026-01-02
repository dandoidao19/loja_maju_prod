
// src/hooks/useOrcamento.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const fetchOrcamento = async (contexto: 'casa' | 'loja') => {
  const { data, error } = await supabase
    .from('orcamentos')
    .select('*')
    .eq('contexto', contexto);
  if (error) throw new Error(error.message);
  return data;
};

const updateOrcamento = async (updates: any[]) => {
  const { data, error } = await supabase.from('orcamentos').upsert(updates).select();
  if (error) throw new Error(error.message);
  return data;
};

export const useOrcamento = (contexto: 'casa' | 'loja') => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orcamento', contexto],
    queryFn: () => fetchOrcamento(contexto),
  });

  const mutation = useMutation({
    mutationFn: updateOrcamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamento', contexto] });
    },
  });

  return { ...query, update: mutation.mutate, isUpdating: mutation.isPending };
};
