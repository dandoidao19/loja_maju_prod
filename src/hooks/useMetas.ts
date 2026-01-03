
// src/hooks/useMetas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const fetchMetas = async (contexto: 'casa' | 'loja') => {
  const tableName = `metas_${contexto}`;
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

const updateMetas = async ({ contexto, updates }: UpdatePayload) => {
  const tableName = `metas_${contexto}`;
  const { data, error } = await supabase.from(tableName).upsert(updates).select();
  if (error) throw new Error(error.message);
  return data;
};

export const useMetas = (contexto: 'casa' | 'loja') => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['metas', contexto],
    queryFn: () => fetchMetas(contexto),
  });

  const mutation = useMutation<any, Error, UpdatePayload>({
    mutationFn: updateMetas,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['metas', variables.contexto] });
    },
  });

  const updateWithContext = (updates: any[]) => {
    mutation.mutate({ contexto, updates });
  };

  return { ...query, update: updateWithContext, isUpdating: mutation.isPending };
};
