import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Lancamento } from '@/types'

// CONSTANTE: ID do Caixa Casa
const CAIXA_ID_CASA = '69bebc06-f495-4fed-b0b1-beafb50c017b'

// Fetch function
const getLancamentosCasa = async (): Promise<Lancamento[]> => {
  const { data, error } = await supabase
    .from('lancamentos_financeiros')
    .select('*, centros_de_custo(nome)')
    .eq('caixa_id', CAIXA_ID_CASA)
    .order('data_prevista', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

// Hook to fetch data
export const useLancamentosCasa = () => {
  return useQuery({
    queryKey: ['lancamentosCasa'],
    queryFn: getLancamentosCasa,
  })
}

// Hook to add data
export const useAddLancamentoCasa = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (newLancamento: Omit<Lancamento, 'id'>) => {
      const { data, error } = await supabase
        .from('lancamentos_financeiros')
        .insert([newLancamento])
        .select()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentosCasa'] })
    },
  })
}

// Hook to update data
export const useUpdateLancamentoCasa = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updatedLancamento: Lancamento) => {
      const { data, error } = await supabase
        .from('lancamentos_financeiros')
        .update(updatedLancamento)
        .eq('id', updatedLancamento.id)
        .select()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentosCasa'] })
    },
  })
}

// Hook to delete data
export const useDeleteLancamentoCasa = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('lancamentos_financeiros')
        .delete()
        .eq('id', id)

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentosCasa'] })
    },
  })
}
