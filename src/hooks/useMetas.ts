
// src/hooks/useMetas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const fetchMetas = async (contexto: 'casa' | 'loja') => {
  const { data, error } = await supabase
    .from('metas')
    .select('*')
    .eq('contexto', contexto);
  if (error) throw new Error(error.message);
  return data;
};

const updateMetas = async (updates: any[]) => {
  const { data, error } = await supabase.from('metas').upsert(updates).select();
  if (error) throw new Error(error.message);
  return data;
};

export const useMetas = (contexto: 'casa' | 'loja') => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['metas', contexto],
    queryFn: () => fetchMetas(contexto),
  });

  const mutation = useMutation({
    mutationFn: updateMetas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas', contexto] });
    },
  });

  return { ...query, update: mutation.mutate, isUpdating: mutation.isPending };
};
