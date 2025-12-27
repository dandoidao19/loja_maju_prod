'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface BotaoExcluirCompraProps {
  compraId: string
  numeroTransacao: number
  fornecedor: string
  onExcluido: () => void
}

export default function BotaoExcluirCompra({ 
  compraId, 
  numeroTransacao, 
  fornecedor, 
  onExcluido 
}: BotaoExcluirCompraProps) {
  const [excluindo, setExcluindo] = useState(false)

  const excluirCompra = async () => {
    if (!confirm(`Tem certeza que deseja excluir a compra #${numeroTransacao} do fornecedor ${fornecedor}? Esta ação excluirá TODOS os itens e parcelas financeiras relacionadas.`)) {
      return
    }

    setExcluindo(true)
    
    try {
      console.log(`🗑️ Iniciando exclusão da compra #${numeroTransacao} (${fornecedor})...`)
      
      // 1. PRIMEIRO excluir todas as transações financeiras relacionadas
      console.log(`🔍 Buscando transações da compra #${numeroTransacao} ${fornecedor}...`)
      
      const { data: transacoes } = await supabase
        .from('transacoes_loja')
        .select('id')
        .ilike('descricao', `%Compra #${numeroTransacao} ${fornecedor}%`)
        .eq('tipo', 'saida')
      
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

      // 2. Buscar todos os itens da compra para registrar movimentações de estoque
      console.log(`🔍 Buscando itens da compra ${compraId}...`)
      const { data: itensCompra } = await supabase
        .from('itens_compra')
        .select('produto_id, quantidade')
        .eq('compra_id', compraId)
      
      // 3. Reverter estoque para cada item
      if (itensCompra && itensCompra.length > 0) {
        console.log(`🔄 Revertendo estoque de ${itensCompra.length} itens...`)
        
        for (const item of itensCompra) {
          if (item.produto_id) {
            // Buscar quantidade atual do produto
            const { data: produto } = await supabase
              .from('produtos')
              .select('quantidade')
              .eq('id', item.produto_id)
              .single()
            
            if (produto) {
              // Atualizar estoque (subtrair a quantidade que foi adicionada na compra)
              const novaQuantidade = produto.quantidade - item.quantidade
              
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
        .ilike('observacao', `%Compra de%${fornecedor}%`)
      
      if (errorMovimentacoes) {
        console.error('❌ Erro ao excluir movimentações de estoque:', errorMovimentacoes)
      } else {
        console.log('✅ Movimentações de estoque excluídas')
      }

      // 5. Excluir itens da compra
      console.log(`🗑️ Excluindo itens da compra...`)
      const { error: errorItens } = await supabase
        .from('itens_compra')
        .delete()
        .eq('compra_id', compraId)
      
      if (errorItens) {
        console.error('❌ Erro ao excluir itens da compra:', errorItens)
        throw new Error(`Erro ao excluir itens: ${errorItens.message}`)
      }
      console.log('✅ Itens da compra excluídos')

      // 6. FINALMENTE excluir a compra
      console.log(`🗑️ Excluindo compra principal...`)
      const { error: errorCompra } = await supabase
        .from('compras')
        .delete()
        .eq('id', compraId)
      
      if (errorCompra) {
        console.error('❌ Erro ao excluir compra:', errorCompra)
        throw new Error(`Erro ao excluir compra: ${errorCompra.message}`)
      }
      console.log('✅ Compra principal excluída')

      alert(`✅ Compra #${numeroTransacao} excluída com sucesso! Todas as transações financeiras relacionadas foram removidas.`)
      onExcluido()
      
    } catch (error) {
      console.error('❌ Erro completo ao excluir compra:', error)
      alert(`❌ Erro ao excluir compra: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <button
      onClick={excluirCompra}
      disabled={excluindo}
      className="text-red-500 hover:text-red-700 font-medium text-xs px-1 py-0.5 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
      title="Excluir Compra"
    >
      {excluindo ? '🗑️ Excluindo...' : '🗑️ Excluir'}
    </button>
  )
}