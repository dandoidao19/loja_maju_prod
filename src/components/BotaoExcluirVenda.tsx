'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface BotaoExcluirVendaProps {
  vendaId: string
  numeroTransacao: number
  cliente: string
  onExcluido: () => void
}

export default function BotaoExcluirVenda({ 
  vendaId, 
  numeroTransacao, 
  cliente, 
  onExcluido 
}: BotaoExcluirVendaProps) {
  const [excluindo, setExcluindo] = useState(false)

  const excluirVenda = async () => {
    if (!confirm(`Tem certeza que deseja excluir a venda #${numeroTransacao} do cliente ${cliente}? Esta ação excluirá TODOS os itens e parcelas financeiras relacionadas.`)) {
      return
    }

    setExcluindo(true)
    
    try {
      console.log(`🗑️ Iniciando exclusão da venda #${numeroTransacao} (${cliente})...`)
      
      // 1. PRIMEIRO excluir todas as transações financeiras relacionadas
      console.log(`🔍 Buscando transações da venda ${cliente}...`)
      
      const { data: transacoes } = await supabase
        .from('transacoes_loja')
        .select('id')
        .ilike('descricao', `%Venda ${cliente}%`)
        .eq('tipo', 'entrada')
      
      if (transacoes && transacoes.length > 0) {
        console.log(`🗑️ Excluindo ${transacoes.length} transações financeiras...`)
        const { error: errorTransacoes } = await supabase
          .from('transacoes_loja')
          .delete()
          .in('id', transacoes.map(t => t.id))
        
        if (errorTransacoes) {
          console.error('❌ Erro ao excluir transações:', errorTransacoes)
          throw new Error(`Erro ao excluir transações: ${errorTransacoes.message}`)
        }
        console.log(`✅ ${transacoes.length} transações financeiras excluídas`)
      } else {
        console.log('ℹ️ Nenhuma transação financeira encontrada para excluir')
      }

      // 2. Buscar todos os itens da venda para registrar movimentações de estoque
      console.log(`🔍 Buscando itens da venda ${vendaId}...`)
      const { data: itensVenda } = await supabase
        .from('itens_venda')
        .select('produto_id, quantidade')
        .eq('venda_id', vendaId)
      
      // 3. Reverter estoque para cada item (adicionar de volta ao estoque)
      if (itensVenda && itensVenda.length > 0) {
        console.log(`🔄 Revertendo estoque de ${itensVenda.length} itens...`)
        
        for (const item of itensVenda) {
          if (item.produto_id) {
            // Buscar quantidade atual do produto
            const { data: produto } = await supabase
              .from('produtos')
              .select('quantidade')
              .eq('id', item.produto_id)
              .single()
            
            if (produto) {
              // Atualizar estoque (adicionar a quantidade que foi vendida)
              const novaQuantidade = produto.quantidade + item.quantidade
              
              const { error: errorEstoque } = await supabase
                .from('produtos')
                .update({ quantidade: novaQuantidade })
                .eq('id', item.produto_id)
              
              if (errorEstoque) {
                console.error(`❌ Erro ao reverter estoque do produto ${item.produto_id}:`, errorEstoque)
              } else {
                console.log(`✅ Estoque do produto ${item.produto_id} revertido: ${produto.quantidade} -> ${novaQuantidade}`)
              }
            }
          }
        }
      }

      // 4. Excluir movimentações de estoque relacionadas
      console.log(`🗑️ Excluindo movimentações de estoque...`)
      const { error: errorMovimentacoes } = await supabase
        .from('movimentacoes_estoque')
        .delete()
        .ilike('observacao', `%Venda para ${cliente}%`)
      
      if (errorMovimentacoes) {
        console.error('❌ Erro ao excluir movimentações de estoque:', errorMovimentacoes)
      } else {
        console.log('✅ Movimentações de estoque excluídas')
      }

      // 5. Excluir itens da venda
      console.log(`🗑️ Excluindo itens da venda...`)
      const { error: errorItens } = await supabase
        .from('itens_venda')
        .delete()
        .eq('venda_id', vendaId)
      
      if (errorItens) {
        console.error('❌ Erro ao excluir itens da venda:', errorItens)
        throw new Error(`Erro ao excluir itens: ${errorItens.message}`)
      }
      console.log('✅ Itens da venda excluídos')

      // 6. FINALMENTE excluir a venda
      console.log(`🗑️ Excluindo venda principal...`)
      const { error: errorVenda } = await supabase
        .from('vendas')
        .delete()
        .eq('id', vendaId)
      
      if (errorVenda) {
        console.error('❌ Erro ao excluir venda:', errorVenda)
        throw new Error(`Erro ao excluir venda: ${errorVenda.message}`)
      }
      console.log('✅ Venda principal excluída')

      alert(`✅ Venda #${numeroTransacao} excluída com sucesso! Todas as transações financeiras relacionadas foram removidas.`)
      onExcluido()
      
    } catch (error) {
      console.error('❌ Erro completo ao excluir venda:', error)
      alert(`❌ Erro ao excluir venda: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <button
      onClick={excluirVenda}
      disabled={excluindo}
      className="text-red-500 hover:text-red-700 font-medium text-xs px-1 py-0.5 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
      title="Excluir Venda"
    >
      {excluindo ? '🗑️ Excluindo...' : '🗑️ Excluir'}
    </button>
  )
}