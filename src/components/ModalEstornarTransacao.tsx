'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface ModalEstornarTransacaoProps {
  aberto: boolean
  transacao: {
    id: string
    tipo: 'entrada' | 'saida'
    descricao: string
    valor: number
    numero_transacao: number
    status_pagamento: string
    cliente_fornecedor?: string
    origem_id?: string
    valor_pago?: number
    juros_descontos?: number
    data_pagamento?: string
  } | null
  onClose: () => void
  onEstornoRealizado: () => void
}

export default function ModalEstornarTransacao({ 
  aberto, 
  transacao, 
  onClose, 
  onEstornoRealizado 
}: ModalEstornarTransacaoProps) {
  const [erro, setErro] = useState('')
  const { atualizarCaixaReal } = useDadosFinanceiros()
  const queryClient = useQueryClient()

  const estornarTransacaoMutation = useMutation({
    mutationFn: async () => {
      if (!transacao) throw new Error("Transação não encontrada");

      const tabela = transacao.tipo === 'entrada' ? 'vendas' : 'compras';
      
      const { error: errorTransacao } = await supabase.from(tabela).update({ status_pagamento: 'pendente' }).eq('id', transacao.id);
      if (errorTransacao) throw new Error(`Erro ao estornar ${tabela}: ${errorTransacao.message}`);

      const { data: transacoesLoja, error: erroBusca } = await supabase
        .from('transacoes_loja')
        .select('id')
        .ilike('descricao', `%${transacao.cliente_fornecedor || transacao.descricao}%`)
        .eq('tipo', transacao.tipo)
        .eq('status_pagamento', 'pago');
      
      if (erroBusca) console.error('❌ Erro ao buscar transações da loja:', erroBusca);
      else if (transacoesLoja && transacoesLoja.length > 0) {
        const transacoesIds = transacoesLoja.map(t => t.id);
        const { error: errorTransacoesLoja } = await supabase
          .from('transacoes_loja')
          .update({ 
            status_pagamento: 'pendente',
            data_pagamento: null,
            valor_pago: null,
            juros_descontos: null
          })
          .in('id', transacoesIds);
        if (errorTransacoesLoja) throw new Error(`Erro ao limpar dados de pagamento: ${errorTransacoesLoja.message}`);
      }
      await atualizarCaixaReal('loja');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes_loja'] });
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      alert(`✅ Estorno da ${transacao?.tipo === 'entrada' ? 'venda' : 'compra'} #${transacao?.numero_transacao} realizado com sucesso!`);
      onEstornoRealizado();
      onClose();
    },
    onError: (error) => {
      setErro(error.message);
    }
  });

  const { isPending: loading } = estornarTransacaoMutation;

  const handleEstornar = () => {
    setErro('');
    estornarTransacaoMutation.mutate();
  };

  if (!aberto || !transacao) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Estorno</h3>
            <div className="h-1 w-12 bg-yellow-500 rounded"></div>
          </div>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Transação:</span> #{transacao.numero_transacao}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Cliente/Fornecedor:</span> {transacao.descricao}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Tipo:</span> {transacao.tipo === 'entrada' ? 'Venda' : 'Compra'}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Valor Original:</span> 
              <span className={`text-lg font-bold ml-2 ${transacao.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                {transacao.tipo === 'entrada' ? '+' : '-'} R$ {transacao.valor.toFixed(2)}
              </span>
            </p>
            {transacao.valor_pago && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Valor Pago:</span> 
                <span className="text-blue-600 font-bold ml-2">
                  R$ {transacao.valor_pago.toFixed(2)}
                </span>
              </p>
            )}
          </div>

          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
              {erro}
            </div>
          )}

          <p className="text-sm text-gray-600 mb-6">
            <span className="font-bold text-yellow-600">⚠️ ATENÇÃO:</span> Confirmar estorno total desta transação? 
            Esta ação reverterá o status para "Pendente", limpará a data de pagamento, valor pago e juros/descontos.
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleEstornar}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Confirmar Estorno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}