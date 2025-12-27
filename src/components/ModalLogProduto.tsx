'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'

interface Produto {
  id: string
  codigo: string
  descricao: string
}

interface LogMovimentacao {
  id: string
  data: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  preco: number
  observacao: string
  transacao_numero?: number
}

interface ModalLogProdutoProps {
  produto: Produto
  onClose: () => void
}

export default function ModalLogProduto({ produto, onClose }: ModalLogProdutoProps) {
  const [logs, setLogs] = useState<LogMovimentacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarLogs()
  }, [produto.id])

  const carregarLogs = async () => {
    try {
      setLoading(true)
      
      console.log(`📊 Carregando histórico para: ${produto.descricao}`)
      
      const logsCombinados: LogMovimentacao[] = []
      
      // 1. Buscar COMPRAS deste produto
      const { data: compras, error: erroCompras } = await supabase
        .from('itens_compra')
        .select(`
          descricao, 
          quantidade, 
          preco_custo,
          compras (
            data_compra, 
            fornecedor, 
            numero_transacao
          )
        `)
        .eq('produto_id', produto.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (erroCompras) {
        console.error('Erro ao buscar compras:', erroCompras)
      } else if (compras && compras.length > 0) {
        console.log(`📦 ${compras.length} compras encontradas`)
        
        compras.forEach((compra: any, index: number) => {
          const compraData = compra.compras
          logsCombinados.push({
            id: `compra-${produto.id}-${compraData?.numero_transacao || 'N'}-${index}`,
            data: compraData?.data_compra || new Date().toISOString(),
            tipo: 'entrada',
            quantidade: compra.quantidade || 0,
            preco: compra.preco_custo || 0,
            observacao: `COMPRA #${compraData?.numero_transacao || 'N/A'}: ${compra.descricao}`,
            transacao_numero: compraData?.numero_transacao
          })
        })
      }
      
      // 2. Buscar VENDAS deste produto
      const { data: vendas, error: erroVendas } = await supabase
        .from('itens_venda')
        .select(`
          descricao, 
          quantidade, 
          preco_venda,
          vendas (
            data_venda, 
            cliente, 
            numero_transacao
          )
        `)
        .eq('produto_id', produto.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (erroVendas) {
        console.error('Erro ao buscar vendas:', erroVendas)
      } else if (vendas && vendas.length > 0) {
        console.log(`💰 ${vendas.length} vendas encontradas`)
        
        vendas.forEach((venda: any, index: number) => {
          const vendaData = venda.vendas
          logsCombinados.push({
            id: `venda-${produto.id}-${vendaData?.numero_transacao || 'N'}-${index}`,
            data: vendaData?.data_venda || new Date().toISOString(),
            tipo: 'saida',
            quantidade: venda.quantidade || 0,
            preco: venda.preco_venda || 0,
            observacao: `VENDA #${vendaData?.numero_transacao || 'N/A'}: ${venda.descricao}`,
            transacao_numero: vendaData?.numero_transacao
          })
        })
      }
      
      // 3. Ordenar por data (mais recente primeiro)
      logsCombinados.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      
      console.log(`✅ Total de movimentações: ${logsCombinados.length}`)
      setLogs(logsCombinados)
      
    } catch (error) {
      console.error('❌ Erro completo ao carregar logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTipoBadge = (tipo: string) => {
    const tipos: { [key: string]: { bg: string; text: string; label: string; emoji: string } } = {
      entrada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Compra', emoji: '📦' },
      saida: { bg: 'bg-red-100', text: 'text-red-800', label: 'Venda', emoji: '💰' },
    }
    const config = tipos[tipo] || { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Outro', emoji: '⚙️' }
    return config
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Histórico do Produto</h2>
            <p className="text-gray-200 text-sm mt-1">
              {produto.codigo} - {produto.descricao}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-gray-600 p-2 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-gray-600">Carregando histórico...</p>
              <p className="text-gray-400 text-xs mt-1">Buscando compras e vendas do produto</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-500">Nenhuma movimentação registrada</p>
              <p className="text-gray-400 text-sm mt-2">
                Este produto não teve compras ou vendas registradas no sistema
              </p>
              <button
                onClick={carregarLogs}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                🔄 Tentar novamente
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <span className="font-semibold">{logs.length}</span> movimentações encontradas
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    📦 {logs.filter(l => l.tipo === 'entrada').length} compras
                  </span>
                  <span className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    💰 {logs.filter(l => l.tipo === 'saida').length} vendas
                  </span>
                  <button
                    onClick={carregarLogs}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                  >
                    Atualizar
                  </button>
                </div>
              </div>
              
              {logs.map((log) => {
                const tipoBadge = getTipoBadge(log.tipo)
                const valorTotal = log.quantidade * log.preco
                const dataFormatada = formatarDataParaExibicao(log.data)
                
                return (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${tipoBadge.bg} ${tipoBadge.text}`}
                        >
                          {tipoBadge.emoji} <span className="hidden sm:inline">{tipoBadge.label}</span>
                        </span>
                        <div>
                          <div className="text-sm text-gray-600">{dataFormatada}</div>
                          {log.transacao_numero && (
                            <div className="text-xs text-gray-500">Transação #{log.transacao_numero}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-lg font-bold ${log.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {log.tipo === 'entrada' ? '+' : '-'}{log.quantidade} unidades
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <div>Preço: R$ {log.preco.toFixed(2)}</div>
                          <div className="font-semibold">Total: R$ {valorTotal.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-700 bg-gray-100 p-3 rounded">
                      <div className="font-semibold mb-1">{log.observacao}</div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">
                          {log.tipo === 'entrada' ? 'Adicionado ao estoque' : 'Retirado do estoque'}
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${log.tipo === 'entrada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {log.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-between items-center">
          <div className="text-xs text-gray-600">
            Histórico gerado a partir das compras e vendas registradas
          </div>
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}