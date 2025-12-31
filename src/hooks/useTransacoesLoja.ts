import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Transacao } from '@/types' // Assuming Transacao type is in @/types

// Fetch function
const getTransacoesLoja = async (): Promise<Transacao[]> => {
  const { data, error } = await supabase
    .from('transacoes_loja')
    .select('*')
    .order('data', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

// Hook to fetch data
export const useTransacoesLoja = () => {
  return useQuery({
    queryKey: ['transacoesLoja'],
    queryFn: getTransacoesLoja,
  })
}

// Hook to process payment
export const usePagarTransacaoLoja = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (transacao: Transacao) => {
      // Your logic to process payment goes here
      // This is just a placeholder
      const { data, error } = await supabase
        .from('transacoes_loja')
        .update({ status_pagamento: 'pago', data_pagamento: new Date().toISOString() })
        .eq('id', transacao.id)
        .select()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoesLoja'] })
      queryClient.invalidateQueries({ queryKey: ['caixaRealLoja'] }) // Also invalidate caixa
    },
  })
}

// Hook to process reversal/chargeback
export const useEstornarTransacaoLoja = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (transacao: Transacao) => {
      // Your logic to process reversal goes here
      // This is just a placeholder
      const { data, error } = await supabase
        .from('transacoes_loja')
        .update({ status_pagamento: 'pendente', data_pagamento: null })
        .eq('id', transacao.id)
        .select()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoesLoja'] })
      queryClient.invalidateQueries({ queryKey: ['caixaRealLoja'] }) // Also invalidate caixa
    },
  })
}
