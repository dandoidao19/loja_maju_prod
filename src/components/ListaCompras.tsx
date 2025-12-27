'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'
import ModalEditarProduto from './ModalEditarProduto'
import BotaoExcluirCompra from './BotaoExcluirCompra'
import { GeradorPDF, obterConfigLogos } from '@/lib/gerador-pdf-utils'

interface ItemCompra {
  id: string
  compra_id: string
  produto_id: string | null
  codigo?: string
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
}

interface ParcelaCompra {
  id: string
  numero: number
  data: string
  valor: number
  status: string
}

interface CompraDetalhada {
  id: string
  numero_transacao: number
  data_compra: string
  data_vencimento?: string
  fornecedor: string
  total: number
  quantidade_itens: number
  status_pagamento: string
  quantidade_parcelas: number
  prazoparcelas: string
  itens: ItemCompra[]
  parcelas: ParcelaCompra[]
  totalParcelas: number
}

interface ListaComprasProps {
  compras: any[]
  onAtualizar: () => void
}

const calcularDataParcela = (
  dataBase: string, 
  numeroParcela: number, 
  prazo: string,
  isPrimeiraParcela?: boolean
): string => {
  const data = new Date(dataBase + 'T12:00:00')
  
  const offset = (isPrimeiraParcela || numeroParcela === 1) ? 0 : (numeroParcela - 1)
  
  if (offset > 0) {
    switch (prazo) {
      case 'diaria':
        data.setDate(data.getDate() + offset)
        break
      case 'semanal':
        data.setDate(data.getDate() + (offset * 7))
        break
      case 'mensal':
        data.setMonth(data.getMonth() + offset)
        if (data.getDate() !== new Date(dataBase + 'T12:00:00').getDate()) {
          data.setDate(0)
        }
        break
      default:
        data.setMonth(data.getMonth() + offset)
        if (data.getDate() !== new Date(dataBase + 'T12:00:00').getDate()) {
          data.setDate(0)
        }
    }
  }
  
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// ✅ NOVA FUNÇÃO: Calcular status da compra baseado nas parcelas
const calcularStatusCompra = (parcelas: ParcelaCompra[]): string => {
  if (!parcelas || parcelas.length === 0) return 'pendente'
  
  const totalParcelas = parcelas.length
  const parcelasPagas = parcelas.filter(p => p.status === 'pago').length
  const parcelasPendentes = parcelas.filter(p => p.status === 'pendente').length
  
  if (parcelasPagas === 0 && parcelasPendentes === totalParcelas) {
    return 'pendente'
  } else if (parcelasPagas === totalParcelas && parcelasPendentes === 0) {
    return 'pago'
  } else if (parcelasPagas > 0 && parcelasPendentes > 0) {
    return 'parcial' // ✅ Status parcial quando houver parcelas pagas e pendentes
  }
  
  return 'pendente'
}

const extrairNumeroParcela = (descricao: string): number => {
  const match = descricao.match(/\((\d+)\/(\d+)\)/)
  return match ? parseInt(match[1]) : 1
}

export default function ListaCompras({ compras, onAtualizar }: ListaComprasProps) {
  const [comprasComDetalhes, setComprasComDetalhes] = useState<CompraDetalhada[]>([])
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; produto: any | null }>({ 
    aberto: false, 
    produto: null 
  })

  // ✅ LISTENER PARA ATUALIZAÇÕES EM TEMPO REAL
  useEffect(() => {
    if (compras.length === 0) return

    const channel = supabase
      .channel('transacoes-loja-compras-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacoes_loja',
          filter: 'tipo=eq.saida'
        },
        async (payload) => {
          console.log('🔄 Atualização detectada nas transações de compra:', payload)
          
          // Atualizar status das compras afetadas
          const novasComprasComDetalhes = await Promise.all(
            comprasComDetalhes.map(async (compra) => {
              try {
                const descricaoBusca = `Compra #${compra.numero_transacao} ${compra.fornecedor}%`
                
                const { data: transacoes } = await supabase
                  .from('transacoes_loja')
                  .select('id, data, total, status_pagamento, descricao')
                  .ilike('descricao', descricaoBusca)
                  .eq('tipo', 'saida')
                  .order('data', { ascending: true })

                const parcelas: ParcelaCompra[] = []
                
                if (transacoes && transacoes.length > 0) {
                  transacoes.sort((a: any, b: any) => {
                    const numA = extrairNumeroParcela(a.descricao)
                    const numB = extrairNumeroParcela(b.descricao)
                    return numA - numB
                  })
                  
                  transacoes.forEach((trans: any, index: number) => {
                    const numeroParcela = extrairNumeroParcela(trans.descricao) || (index + 1)
                    parcelas.push({
                      id: trans.id,
                      numero: numeroParcela,
                      data: trans.data,
                      valor: trans.total,
                      status: trans.status_pagamento
                    })
                  })
                }
                
                // ✅ Calcular novo status baseado nas parcelas
                const novoStatus = calcularStatusCompra(parcelas)
                
                // ✅ Atualizar status na tabela compras se mudou
                if (novoStatus !== compra.status_pagamento) {
                  await supabase
                    .from('compras')
                    .update({ status_pagamento: novoStatus })
                    .eq('id', compra.id)
                  
                  console.log(`🔄 Status da compra #${compra.numero_transacao} atualizado: ${compra.status_pagamento} → ${novoStatus}`)
                }
                
                return {
                  ...compra,
                  parcelas,
                  status_pagamento: novoStatus // ✅ Atualizar status local
                }
              } catch (error) {
                console.error('Erro ao atualizar status da compra:', error)
                return compra
              }
            })
          )
          
          setComprasComDetalhes(novasComprasComDetalhes)
          
          // ✅ Forçar atualização da lista se necessário
          if (comprasComDetalhes.some((c, i) => c.status_pagamento !== novasComprasComDetalhes[i].status_pagamento)) {
            onAtualizar()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [comprasComDetalhes, onAtualizar, compras.length])

  useEffect(() => {
    const carregarDetalhes = async () => {
      const comprasDetalhadas = await Promise.all(
        compras.map(async (compra): Promise<CompraDetalhada> => {
          try {
            const { data: itens } = await supabase
              .from('itens_compra')
              .select('*')
              .eq('compra_id', compra.id)

            const itensComCodigos = await Promise.all(
              (itens || []).map(async (item) => {
                let codigo = 'COMPRA-' + compra.numero_transacao
                
                if (item.produto_id) {
                  const { data: produto } = await supabase
                    .from('produtos')
                    .select('codigo')
                    .eq('id', item.produto_id)
                    .single()
                  
                  if (produto?.codigo) {
                    codigo = produto.codigo
                  }
                }
                
                return {
                  ...item,
                  codigo
                }
              })
            )

            const descricaoBusca = `Compra #${compra.numero_transacao} ${compra.fornecedor}%`
            
            const { data: transacoes } = await supabase
              .from('transacoes_loja')
              .select('id, data, total, status_pagamento, descricao')
              .ilike('descricao', descricaoBusca)
              .eq('tipo', 'saida')
              .order('data', { ascending: true })

            const parcelas: ParcelaCompra[] = []
            
            if (transacoes && transacoes.length > 0) {
              transacoes.sort((a: any, b: any) => {
                const numA = extrairNumeroParcela(a.descricao)
                const numB = extrairNumeroParcela(b.descricao)
                return numA - numB
              })
              
              transacoes.forEach((trans: any, index: number) => {
                const numeroParcela = extrairNumeroParcela(trans.descricao) || (index + 1)
                parcelas.push({
                  id: trans.id,
                  numero: numeroParcela,
                  data: trans.data,
                  valor: trans.total,
                  status: trans.status_pagamento
                })
              })
            } else {
              const valorParcela = compra.total / compra.quantidade_parcelas
              const prazo = compra.prazoparcelas || 'mensal'
              
              let dataPrimeiraParcela = compra.data_compra
              
              if (compra.fornecedor) {
                const descricaoBusca = `Compra #${compra.numero_transacao} ${compra.fornecedor}%`
                
                const { data: transacoesReais } = await supabase
                  .from('transacoes_loja')
                  .select('data')
                  .ilike('descricao', descricaoBusca)
                  .eq('tipo', 'saida')
                  .order('data', { ascending: true })
                  .limit(1)
                
                if (transacoesReais && transacoesReais.length > 0) {
                  dataPrimeiraParcela = transacoesReais[0].data.split('T')[0]
                }
              }
              
              for (let i = 1; i <= compra.quantidade_parcelas; i++) {
                const dataParcela = calcularDataParcela(dataPrimeiraParcela, i, prazo, i === 1)
                parcelas.push({
                  id: `simulada-${compra.id}-${i}`,
                  numero: i,
                  data: dataParcela,
                  valor: valorParcela,
                  status: compra.status_pagamento || 'pendente'
                })
              }
            }

            // ✅ Calcular status baseado nas parcelas
            const statusCalculado = calcularStatusCompra(parcelas)
            
            // ✅ Atualizar na tabela compras se for diferente
            if (statusCalculado !== compra.status_pagamento) {
              try {
                await supabase
                  .from('compras')
                  .update({ status_pagamento: statusCalculado })
                  .eq('id', compra.id)
              } catch (error) {
                console.error('Erro ao atualizar status da compra:', error)
              }
            }

            return {
              ...compra,
              itens: itensComCodigos,
              parcelas,
              totalParcelas: parcelas.length || compra.quantidade_parcelas,
              status_pagamento: statusCalculado // ✅ Usar status calculado
            } as CompraDetalhada
          } catch (error) {
            console.error(`Erro ao carregar detalhes da compra ${compra.id}:`, error)
            return {
              ...compra,
              itens: [],
              parcelas: [],
              totalParcelas: 0,
            } as CompraDetalhada
          }
        })
      )
      
      setComprasComDetalhes(comprasDetalhadas)
    }

    if (compras.length > 0) {
      carregarDetalhes()
    } else {
      setComprasComDetalhes([])
    }
  }, [compras])

  const toggleExpandir = (compraId: string) => {
    const novoExpandidos = new Set(expandidos)
    if (novoExpandidos.has(compraId)) {
      novoExpandidos.delete(compraId)
    } else {
      novoExpandidos.add(compraId)
    }
    setExpandidos(novoExpandidos)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-800'
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800'
      case 'parcial':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleExcluir = async (compraId: string) => {
    if (confirm('Tem certeza que deseja excluir esta compra?')) {
      try {
        const { error } = await supabase.from('compras').delete().eq('id', compraId)
        if (error) throw error
        onAtualizar()
      } catch (error) {
        console.error('Erro ao excluir compra:', error)
        alert('Erro ao excluir compra')
      }
    }
  }

  const gerarPDFCompra = async (compra: CompraDetalhada) => {
    try {
      const logoConfig = obterConfigLogos()
      
      const itensComCodigos = compra.itens.map(item => ({
        codigo: item.codigo || `COMPRA-${compra.numero_transacao}`,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.preco_custo,
        valorTotal: item.quantidade * item.preco_custo,
      }))
      
      const parcelasPDF = compra.parcelas.map(parcela => ({
        numero: parcela.numero,
        data: parcela.data,
        valor: parcela.valor,
        status: parcela.status
      }))
      
      const dadosPDF = {
        tipo: 'compra_detalhada' as const,
        numero: compra.numero_transacao,
        data: compra.data_compra,
        clienteFornecedor: compra.fornecedor,
        itens: itensComCodigos,
        total: compra.total,
        quantidadeParcelas: compra.quantidade_parcelas,
        parcelas: parcelasPDF,
        observacoes: `Compra #${compra.numero_transacao} - ${compra.itens.length} item(ns) - Fornecedor: ${compra.fornecedor}`
      }
      
      const gerador = new GeradorPDF(logoConfig)
      gerador.gerarPDFDetalhadoTransacao(dadosPDF)
      
      const nomeArquivo = `compra_detalhada_${compra.numero_transacao}_${compra.fornecedor.replace(/\s+/g, '_')}.pdf`
      gerador.salvar(nomeArquivo)
      
      alert('✅ PDF detalhado gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('❌ Erro ao gerar PDF. Verifique o console para mais detalhes.')
    }
  }

  if (compras.length === 0) {
    return <div className="text-center py-4 text-gray-500">Nenhuma compra encontrada</div>
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-2 py-1 text-left font-semibold text-gray-700">Data</th>
              <th className="px-2 py-1 text-left font-semibold text-gray-700">Transação</th>
              <th className="px-2 py-1 text-left font-semibold text-gray-700">Fornecedor</th>
              <th className="px-2 py-1 text-right font-semibold text-gray-700">Valor Total</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Parcelas</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Tipo</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Status</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {comprasComDetalhes.map((compra) => (
              <React.Fragment key={compra.id}>
                <tr
                  onClick={() => toggleExpandir(compra.id)}
                  className={`border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors ${
                    expandidos.has(compra.id) 
                      ? 'bg-blue-100 border-l-4 border-l-blue-600 shadow-sm' 
                      : ''
                  }`}
                >
                  <td className="px-2 py-1 text-gray-700">
                    {formatarDataParaExibicao(compra.data_compra)}
                  </td>
                  <td className="px-2 py-1 text-gray-700">#{compra.numero_transacao}</td>
                  <td className="px-2 py-1 text-gray-700">{compra.fornecedor}</td>
                  <td className="px-2 py-1 text-right text-red-600 font-bold">
                    R$ {compra.total.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-center text-gray-700">
                    {compra.quantidade_parcelas}x
                  </td>
                  <td className="px-2 py-1 text-center">
                    <span className="px-2 py-0.5 rounded text-white font-bold text-xs bg-orange-500">
                      COMPRA
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(compra.status_pagamento)}`}>
                      {compra.status_pagamento.charAt(0).toUpperCase() + compra.status_pagamento.slice(1)}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          gerarPDFCompra(compra)
                        }}
                        className="text-red-500 hover:text-red-700 font-medium text-xs px-1 py-0.5 bg-red-50 rounded hover:bg-red-100"
                        title="Gerar PDF Detalhado"
                      >
                        📄
                      </button>
                      <BotaoExcluirCompra
                        compraId={compra.id}
                        numeroTransacao={compra.numero_transacao}
                        fornecedor={compra.fornecedor}
                        onExcluido={() => {
                          const novasCompras = compras.filter(c => c.id !== compra.id)
                          onAtualizar()
                        }}
                      />
                    </div>
                  </td>
                </tr>

                {expandidos.has(compra.id) && (
                  <tr className="bg-blue-50">
                    <td colSpan={8} className="px-3 py-2">
                      <div className="space-y-2 border-2 border-blue-300 rounded-lg p-2 bg-white shadow-inner">
                        {compra.itens && compra.itens.length > 0 ? (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-1 text-[11px]">Itens da Compra ({compra.itens.length}):</h4>
                            <table className="w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-blue-100 border-b border-gray-300">
                                  <th className="px-1 py-0.5 text-left">Código</th>
                                  <th className="px-1 py-0.5 text-left">Descrição</th>
                                  <th className="px-1 py-0.5 text-center">Qtd</th>
                                  <th className="px-1 py-0.5 text-right">Preço Unit.</th>
                                  <th className="px-1 py-0.5 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {compra.itens.map((item: ItemCompra, idx: number) => (
                                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-1 py-0.5 font-mono text-[10px]">{item.codigo || 'N/A'}</td>
                                    <td className="px-1 py-0.5 truncate max-w-[120px]">{item.descricao}</td>
                                    <td className="px-1 py-0.5 text-center">{item.quantidade}</td>
                                    <td className="px-1 py-0.5 text-right">
                                      R$ {item.preco_custo.toFixed(2)}
                                    </td>
                                    <td className="px-1 py-0.5 text-right font-bold text-blue-600">
                                      R$ {(item.quantidade * item.preco_custo).toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-gray-500 text-[11px] italic bg-gray-50 p-1 rounded">
                            Nenhum item registrado para esta compra
                          </div>
                        )}

                        {compra.parcelas && compra.parcelas.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-1 text-[11px]">
                              Parcelas ({compra.parcelas.length}) - Prazo: {compra.prazoparcelas || 'mensal'}
                            </h4>
                            <table className="w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-orange-100 border-b border-gray-300">
                                  <th className="px-1 py-0.5 text-left">Parcela</th>
                                  <th className="px-1 py-0.5 text-left">Vencimento</th>
                                  <th className="px-1 py-0.5 text-right">Valor</th>
                                  <th className="px-1 py-0.5 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {compra.parcelas
                                  .sort((a, b) => a.numero - b.numero)
                                  .map((parcela: ParcelaCompra, idx: number) => (
                                  <tr key={parcela.id || idx} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-1 py-0.5 font-medium">{parcela.numero}ª</td>
                                    <td className="px-1 py-0.5">
                                      {formatarDataParaExibicao(parcela.data)}
                                    </td>
                                    <td className="px-1 py-0.5 text-right font-bold text-red-600">
                                      R$ {parcela.valor.toFixed(2)}
                                    </td>
                                    <td className="px-1 py-0.5 text-center">
                                      <span className={`px-1 py-0.5 rounded text-[10px] font-semibold ${getStatusColor(parcela.status)}`}>
                                        {parcela.status.charAt(0).toUpperCase() + parcela.status.slice(1)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="bg-gray-100 p-2 rounded-lg border border-gray-300 shadow-sm">
                          <div className="flex gap-1 items-center justify-between">
                            <span className="font-semibold text-gray-800 text-[11px]">Total da Compra:</span>
                            <span className="font-bold text-gray-800 text-sm">
                              R$ {compra.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {modalEditar.aberto && (
        <ModalEditarProduto
          produto={modalEditar.produto}
          onClose={() => setModalEditar({ aberto: false, produto: null })}
          onSave={() => {
            setModalEditar({ aberto: false, produto: null })
            onAtualizar()
          }}
        />
      )}
    </div>
  )
}