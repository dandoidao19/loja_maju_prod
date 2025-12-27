'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao } from '@/lib/dateUtils'
import ModalEditarProduto from './ModalEditarProduto'
import BotaoExcluirVenda from './BotaoExcluirVenda'
import { GeradorPDF, obterConfigLogos } from '@/lib/gerador-pdf-utils'
import type { Venda, ItemVenda } from '@/types'

interface ParcelaVenda {
  id: string
  numero: number
  data: string
  valor: number
  status: string
}

interface ListaVendasProps {
  vendas: Venda[]
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

const extrairNumeroParcela = (descricao: string): number => {
  const match = descricao.match(/\((\d+)\/(\d+)\)/)
  return match ? parseInt(match[1]) : 1
}

export default function ListaVendas({ vendas, onAtualizar }: ListaVendasProps) {
  const [vendasComDetalhes, setVendasComDetalhes] = useState<any[]>([])
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; produto: any | null }>({ 
    aberto: false, 
    produto: null 
  })

  // ✅ NOVA FUNÇÃO: Calcular status da venda baseado nas parcelas
  const calcularStatusVenda = useCallback((parcelas: ParcelaVenda[]): string => {
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
  }, [])

  // ✅ LISTENER PARA ATUALIZAÇÕES EM TEMPO REAL
  useEffect(() => {
    if (vendas.length === 0) return

    const channel = supabase
      .channel('transacoes-loja-vendas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacoes_loja',
          filter: 'tipo=eq.entrada'
        },
        async (payload) => {
          console.log('🔄 Atualização detectada nas transações de venda:', payload)
          
          // Atualizar status das vendas afetadas
          const novasVendasComDetalhes = await Promise.all(
            vendasComDetalhes.map(async (venda) => {
              try {
                const descricaoBusca = `Venda ${venda.cliente}%`
                
                const { data: transacoes } = await supabase
                  .from('transacoes_loja')
                  .select('id, data, total, status_pagamento, descricao')
                  .ilike('descricao', descricaoBusca)
                  .eq('tipo', 'entrada')
                  .order('data', { ascending: true })

                const parcelas: ParcelaVenda[] = []
                
                if (transacoes && transacoes.length > 0) {
                  const transacoesFiltradas = transacoes.filter(trans => {
                    const numParcela = extrairNumeroParcela(trans.descricao)
                    return numParcela <= venda.quantidade_parcelas
                  })
                  
                  transacoesFiltradas.sort((a: any, b: any) => {
                    const numA = extrairNumeroParcela(a.descricao)
                    const numB = extrairNumeroParcela(b.descricao)
                    return numA - numB
                  })
                  
                  transacoesFiltradas.forEach((trans: any, index: number) => {
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
                const novoStatus = calcularStatusVenda(parcelas)
                
                // ✅ Atualizar status na tabela vendas se mudou
                if (novoStatus !== venda.status_pagamento) {
                  await supabase
                    .from('vendas')
                    .update({ status_pagamento: novoStatus })
                    .eq('id', venda.id)
                  
                  console.log(`🔄 Status da venda #${venda.numero_transacao} atualizado: ${venda.status_pagamento} → ${novoStatus}`)
                }
                
                return {
                  ...venda,
                  parcelas,
                  status_pagamento: novoStatus // ✅ Atualizar status local
                }
              } catch (error) {
                console.error('Erro ao atualizar status da venda:', error)
                return venda
              }
            })
          )
          
          setVendasComDetalhes(novasVendasComDetalhes)
          
          // ✅ Forçar atualização da lista se necessário
          if (vendasComDetalhes.some((v, i) => v.status_pagamento !== novasVendasComDetalhes[i].status_pagamento)) {
            onAtualizar()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [vendasComDetalhes, calcularStatusVenda, onAtualizar, vendas.length])

  useEffect(() => {
    const carregarDetalhes = async () => {
      const vendasComRepasse = await Promise.all(
        vendas.map(async (venda) => {
          let itensComRepasse = venda.itens || []
          
          if (itensComRepasse.length > 0) {
            itensComRepasse = await Promise.all(
              itensComRepasse.map(async (item) => {
                if (item.produto_id) {
                  const { data: produto } = await supabase
                    .from('produtos')
                    .select('valor_repasse, codigo')
                    .eq('id', item.produto_id)
                    .single()
                  return { 
                    ...item, 
                    valor_repasse: produto?.valor_repasse || 0,
                    codigo: produto?.codigo || 'N/A'
                  }
                }
                return { ...item, valor_repasse: 0, codigo: 'N/A' }
              })
            )
          }

          const descricaoBusca = `Venda ${venda.cliente}%`
          
          const { data: transacoes } = await supabase
            .from('transacoes_loja')
            .select('id, data, total, status_pagamento, descricao')
            .ilike('descricao', descricaoBusca)
            .eq('tipo', 'entrada')
            .order('data', { ascending: true })

          const parcelas: ParcelaVenda[] = []
          
          if (transacoes && transacoes.length > 0) {
            const transacoesFiltradas = transacoes.filter(trans => {
              const numParcela = extrairNumeroParcela(trans.descricao)
              return numParcela <= venda.quantidade_parcelas
            })
            
            transacoesFiltradas.sort((a: any, b: any) => {
              const numA = extrairNumeroParcela(a.descricao)
              const numB = extrairNumeroParcela(b.descricao)
              return numA - numB
            })
            
            transacoesFiltradas.forEach((trans: any, index: number) => {
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
          
          if (parcelas.length < venda.quantidade_parcelas) {
            const valorParcela = venda.total / venda.quantidade_parcelas
            const prazo = venda.prazoparcelas || 'mensal'
            
            let dataPrimeiraParcela = venda.data_venda
            
            if (parcelas.length > 0) {
              dataPrimeiraParcela = parcelas[0].data
            } else {
              const { data: qualquerTransacao } = await supabase
                .from('transacoes_loja')
                .select('data')
                .ilike('descricao', `Venda ${venda.cliente}%`)
                .eq('tipo', 'entrada')
                .order('data', { ascending: true })
                .limit(1)
              
              if (qualquerTransacao && qualquerTransacao.length > 0) {
                dataPrimeiraParcela = qualquerTransacao[0].data.split('T')[0]
              }
            }
            
            for (let i = 1; i <= venda.quantidade_parcelas; i++) {
              const parcelaExistente = parcelas.find(p => p.numero === i)
              if (!parcelaExistente) {
                const dataParcela = calcularDataParcela(dataPrimeiraParcela, i, prazo, i === 1)
                parcelas.push({
                  id: `simulada-${venda.id}-${i}`,
                  numero: i,
                  data: dataParcela,
                  valor: valorParcela,
                  status: venda.status_pagamento || 'pendente'
                })
              }
            }
            
            parcelas.sort((a, b) => a.numero - b.numero)
          }

          // ✅ Calcular status baseado nas parcelas
          const statusCalculado = calcularStatusVenda(parcelas)
          
          // ✅ Atualizar na tabela vendas se for diferente
          if (statusCalculado !== venda.status_pagamento) {
            try {
              await supabase
                .from('vendas')
                .update({ status_pagamento: statusCalculado })
                .eq('id', venda.id)
              
              console.log(`📝 Status da venda #${venda.numero_transacao} corrigido: ${venda.status_pagamento} → ${statusCalculado}`)
            } catch (error) {
              console.error('Erro ao atualizar status da venda:', error)
            }
          }

          return {
            ...venda,
            itens: itensComRepasse,
            parcelas,
            status_pagamento: statusCalculado // ✅ Usar status calculado
          }
        })
      )
      
      setVendasComDetalhes(vendasComRepasse)
    }

    if (vendas.length > 0) {
      carregarDetalhes()
    }
  }, [vendas, calcularStatusVenda])

  const toggleExpandir = (vendaId: string) => {
    const novoExpandidos = new Set(expandidos)
    if (novoExpandidos.has(vendaId)) {
      novoExpandidos.delete(vendaId)
    } else {
      novoExpandidos.add(vendaId)
    }
    setExpandidos(novoExpandidos)
  }

  const calcularLucroTotal = (venda: any): number => {
    if (!venda.itens) return 0

    return venda.itens.reduce((lucroTotal: number, item: any) => {
      const lucroUnitario = (item.preco_venda - (item.valor_repasse || 0)) * item.quantidade
      return lucroTotal + lucroUnitario
    }, 0)
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

  const handleExcluir = async (vendaId: string) => {
    if (confirm('Tem certeza que deseja excluir esta venda?')) {
      try {
        const { error } = await supabase.from('vendas').delete().eq('id', vendaId)
        if (error) throw error
        onAtualizar()
      } catch (error) {
        console.error('Erro ao excluir venda:', error)
        alert('Erro ao excluir venda')
      }
    }
  }

  const gerarPDFVenda = async (venda: any) => {
    try {
      const logoConfig = obterConfigLogos()
      
      const itensComCodigos = venda.itens?.map((item: any) => ({
        codigo: item.codigo || `VENDA-${venda.numero_transacao}`,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.preco_venda,
        valorTotal: item.quantidade * item.preco_venda,
      })) || []
      
      const parcelasPDF = venda.parcelas?.map((p: any) => ({
        numero: p.numero || 1,
        data: p.data,
        valor: p.valor,
        status: p.status || 'pendente'
      })) || []
      
      const dadosPDF = {
        tipo: 'venda_detalhada' as const,
        numero: venda.numero_transacao,
        data: venda.data_venda,
        clienteFornecedor: venda.cliente,
        itens: itensComCodigos,
        total: venda.total,
        quantidadeParcelas: venda.quantidade_parcelas,
        parcelas: parcelasPDF,
        observacoes: `Venda #${venda.numero_transacao} - ${venda.itens?.length || 0} item(ns) - Cliente: ${venda.cliente}`
      }
      
      const gerador = new GeradorPDF(logoConfig)
      gerador.gerarPDFDetalhadoTransacao(dadosPDF)
      
      const nomeArquivo = `venda_detalhada_${venda.numero_transacao}_${venda.cliente.replace(/\s+/g, '_')}.pdf`
      gerador.salvar(nomeArquivo)
      
      alert('✅ PDF detalhado gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('❌ Erro ao gerar PDF. Verifique o console para mais detalhes.')
    }
  }

  if (vendas.length === 0) {
    return <div className="text-center py-4 text-gray-500">Nenhuma venda encontrada</div>
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-2 py-1 text-left font-semibold text-gray-700">Data</th>
              <th className="px-2 py-1 text-left font-semibold text-gray-700">Transação</th>
              <th className="px-2 py-1 text-left font-semibold text-gray-700">Cliente</th>
              <th className="px-2 py-1 text-right font-semibold text-gray-700">Valor Total</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Parcelas</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Tipo</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Status</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendasComDetalhes.map((venda) => (
              <React.Fragment key={venda.id}>
                <tr
                  onClick={() => toggleExpandir(venda.id)}
                  className={`border-b border-gray-200 hover:bg-green-50 cursor-pointer transition-colors ${
                    expandidos.has(venda.id) 
                      ? 'bg-green-100 border-l-4 border-l-green-600 shadow-sm' 
                      : ''
                  }`}
                >
                  <td className="px-2 py-1 text-gray-700">
                    {formatarDataParaExibicao(venda.data_venda)}
                  </td>
                  <td className="px-2 py-1 text-gray-700">#{venda.numero_transacao}</td>
                  <td className="px-2 py-1 text-gray-700">{venda.cliente}</td>
                  <td className="px-2 py-1 text-right text-green-600 font-bold">
                    R$ {venda.total.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-center text-gray-700">
                    {venda.quantidade_parcelas}x
                  </td>
                  <td className="px-2 py-1 text-center">
                    <span className="px-2 py-0.5 rounded text-white font-bold text-xs bg-green-500">
                      VENDA
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(venda.status_pagamento)}`}>
                      {venda.status_pagamento.charAt(0).toUpperCase() + venda.status_pagamento.slice(1)}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          gerarPDFVenda(venda)
                        }}
                        className="text-red-500 hover:text-red-700 font-medium text-xs px-1 py-0.5 bg-red-50 rounded hover:bg-red-100"
                        title="Gerar PDF Detalhado"
                      >
                        📄
                      </button>
                      <BotaoExcluirVenda
                        vendaId={venda.id}
                        numeroTransacao={venda.numero_transacao}
                        cliente={venda.cliente}
                        onExcluido={() => {
                          const novasVendas = vendas.filter(v => v.id !== venda.id)
                          onAtualizar()
                        }}
                      />
                    </div>
                  </td>
                </tr>

                {expandidos.has(venda.id) && (
                  <tr className="bg-green-50">
                    <td colSpan={8} className="px-3 py-2">
                      <div className="space-y-2 border-2 border-green-300 rounded-lg p-2 bg-white shadow-inner">
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1 text-[11px]">Itens da Venda:</h4>
                          <table className="w-full text-[11px] border-collapse">
                            <thead>
                              <tr className="bg-green-100 border-b border-gray-300">
                                <th className="px-1 py-0.5 text-left">Código</th>
                                <th className="px-1 py-0.5 text-left">Descrição</th>
                                <th className="px-1 py-0.5 text-center">Qtd</th>
                                <th className="px-1 py-0.5 text-right">Preço Unit.</th>
                                <th className="px-1 py-0.5 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {venda.itens?.map((item: any, idx: number) => {
                                const subtotal = item.preco_venda * item.quantidade
                                return (
                                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-1 py-0.5 font-mono text-[10px]">{item.codigo || 'N/A'}</td>
                                    <td className="px-1 py-0.5 truncate max-w-[120px]">{item.descricao}</td>
                                    <td className="px-1 py-0.5 text-center">{item.quantidade}</td>
                                    <td className="px-1 py-0.5 text-right">
                                      R$ {item.preco_venda.toFixed(2)}
                                    </td>
                                    <td className="px-1 py-0.5 text-right font-bold">
                                      R$ {subtotal.toFixed(2)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {venda.parcelas && venda.parcelas.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-1 text-[11px]">
                              Parcelas ({venda.parcelas.length}) - Prazo: {venda.prazoparcelas || 'mensal'}
                            </h4>
                            <table className="w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-blue-100 border-b border-gray-300">
                                  <th className="px-1 py-0.5 text-left">Parcela</th>
                                  <th className="px-1 py-0.5 text-left">Vencimento</th>
                                  <th className="px-1 py-0.5 text-right">Valor</th>
                                  <th className="px-1 py-0.5 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {venda.parcelas
                                  .sort((a: any, b: any) => a.numero - b.numero)
                                  .map((parcela: ParcelaVenda, idx: number) => (
                                  <tr key={parcela.id || idx} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-1 py-0.5 font-medium">{parcela.numero}ª</td>
                                    <td className="px-1 py-0.5">
                                      {formatarDataParaExibicao(parcela.data)}
                                    </td>
                                    <td className="px-1 py-0.5 text-right font-bold text-green-600">
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

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-green-100 p-2 rounded-lg border border-green-300 shadow-sm">
                            <div className="flex gap-1 items-center justify-between">
                              <span className="font-semibold text-gray-800 text-[11px]">Lucro Líquido:</span>
                              <span className="font-bold text-green-700 text-sm">
                                R$ {calcularLucroTotal(venda).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-100 p-2 rounded-lg border border-gray-300 shadow-sm">
                            <div className="flex gap-1 items-center justify-between">
                              <span className="font-semibold text-gray-800 text-[11px]">Total Venda:</span>
                              <span className="font-bold text-gray-800 text-sm">
                                R$ {venda.total.toFixed(2)}
                            </span>
                            </div>
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