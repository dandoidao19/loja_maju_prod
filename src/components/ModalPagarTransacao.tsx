'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface ModalPagarTransacaoProps {
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
    data?: string
    valor_pago?: number
    juros_descontos?: number
  } | null
  onClose: () => void
  onPagamentoRealizado: () => void
}

export default function ModalPagarTransacao({ 
  aberto, 
  transacao, 
  onClose, 
  onPagamentoRealizado 
}: ModalPagarTransacaoProps) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [dataPagamento, setDataPagamento] = useState(getDataAtualBrasil())
  const [pagarValorTotal, setPagarValorTotal] = useState(true)
  const [valorPago, setValorPago] = useState(0)
  const [jurosDescontos, setJurosDescontos] = useState(0)
  const { atualizarCaixaReal } = useDadosFinanceiros()

  useEffect(() => {
    if (aberto && transacao) {
      setDataPagamento(getDataAtualBrasil())
      setPagarValorTotal(true)
      setValorPago(transacao.valor)
      setJurosDescontos(0)
      setErro('')
    }
  }, [aberto, transacao])

  useEffect(() => {
    if (transacao && !pagarValorTotal) {
      const diferenca = valorPago - transacao.valor
      setJurosDescontos(diferenca)
    }
  }, [valorPago, transacao, pagarValorTotal])

  const formatarDataDisplay = (dataISO: string) => {
    if (!dataISO) return ''
    return formatarDataParaExibicao(dataISO)
  }

  const formatarDataParaInput = (dataISO: string) => {
    if (!dataISO) return ''
    
    try {
      if (dataISO.includes('/')) {
        const [dia, mes, ano] = dataISO.split('/')
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
      }
      return dataISO
    } catch {
      return dataISO
    }
  }

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value
    setDataPagamento(valor)
  }

  const handleValorPagoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value) || 0
    setValorPago(valor)
  }

  const handleJurosDescontosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value) || 0
    setJurosDescontos(valor)
    
    if (transacao) {
      setValorPago(transacao.valor + valor)
    }
  }

  const calcularTotalImpacto = () => {
    if (!transacao) return 0
    return valorPago
  }

  const getSinalJurosDescontos = () => {
    if (!transacao) return ''
    const diferenca = valorPago - transacao.valor
    return diferenca === 0 ? '' : diferenca > 0 ? '+' : '-'
  }

  const getTipoJurosDescontos = () => {
    if (!transacao) return ''
    
    const diferenca = valorPago - transacao.valor
    
    if (transacao.tipo === 'entrada') {
      return diferenca > 0 ? 'Juros' : 'Desconto'
    } else {
      return diferenca > 0 ? 'Desconto' : 'Juros'
    }
  }

  const validarDados = () => {
    if (!dataPagamento) {
      setErro('Data do pagamento é obrigatória')
      return false
    }

    if (!pagarValorTotal && valorPago <= 0) {
      setErro('Valor pago deve ser maior que zero')
      return false
    }

    if (dataPagamento && new Date(dataPagamento) > new Date()) {
      if (!confirm('⚠️ Data de pagamento é futura. Deseja continuar?')) {
        return false
      }
    }

    return true
  }

  const handlePagar = async () => {
    if (!transacao) return
    
    if (!validarDados()) {
      return
    }
    
    setLoading(true)
    setErro('')
    
    try {
      const dataPagamentoFormatada = prepararDataParaInsert(dataPagamento)
      
      // ✅ CALCULAR juros_descontos (valor_pago - valor_original)
      const jurosDescontosCalculado = valorPago - transacao.valor
      
      console.log('📅 Pagamento da transação:', {
        transacaoId: transacao.origem_id,
        numeroTransacao: transacao.numero_transacao,
        dataPagamento: dataPagamentoFormatada,
        tipo: transacao.tipo,
        valorOriginal: transacao.valor,
        valorPago: valorPago,
        jurosDescontos: jurosDescontosCalculado,
        totalImpacto: calcularTotalImpacto()
      })

      // SEMPRE status 'pago', não permite 'parcial'
      const statusPagamento = 'pago'

      if (transacao.origem_id) {
        const { error: errorTransacaoLoja } = await supabase
          .from('transacoes_loja')
          .update({ 
            status_pagamento: statusPagamento,
            data_pagamento: dataPagamentoFormatada,
            data_original: transacao.data,
            // ✅ GRAVAR valor_pago E juros_descontos
            valor_pago: valorPago,
            juros_descontos: jurosDescontosCalculado
          })
          .eq('id', transacao.origem_id)
        
        if (errorTransacaoLoja) {
          throw new Error(`Erro ao atualizar transação: ${errorTransacaoLoja.message}`)
        }
        
        console.log('✅ Transação atualizada com valor_pago:', {
          dataPagamento: dataPagamentoFormatada,
          valorOriginal: transacao.valor,
          valorPago: valorPago,
          jurosDescontos: jurosDescontosCalculado,
          status: statusPagamento
        })
        
        if (transacao.tipo === 'entrada') {
          const { error: errorVenda } = await supabase
            .from('vendas')
            .update({ 
              status_pagamento: statusPagamento
            })
            .ilike('cliente', `%${transacao.descricao}%`)
            .eq('numero_transacao', transacao.numero_transacao)
          
          if (errorVenda) {
            console.warn('⚠️ Não foi possível atualizar status da venda:', errorVenda.message)
          }
        }
        
        if (transacao.tipo === 'saida') {
          const { error: errorCompra } = await supabase
            .from('compras')
            .update({ 
              status_pagamento: statusPagamento
            })
            .ilike('fornecedor', `%${transacao.descricao}%`)
            .eq('numero_transacao', transacao.numero_transacao)
          
          if (errorCompra) {
            console.warn('⚠️ Não foi possível atualizar status da compra:', errorCompra.message)
          }
        }
      }
      
      await atualizarCaixaReal('loja')
      
      let mensagem = `✅ Parcela da ${transacao.tipo === 'entrada' ? 'venda' : 'compra'} #${transacao.numero_transacao} `
      
      if (pagarValorTotal) {
        mensagem += `paga integralmente em ${formatarDataDisplay(dataPagamento)}`
      } else {
        mensagem += `com pagamento de R$ ${valorPago.toFixed(2)} em ${formatarDataDisplay(dataPagamento)}`
        
        if (jurosDescontosCalculado !== 0) {
          mensagem += ` (${getSinalJurosDescontos()} R$ ${Math.abs(jurosDescontosCalculado).toFixed(2)} de ${getTipoJurosDescontos()})`
        }
      }
      
      alert(mensagem)
      
      onPagamentoRealizado()
      onClose()
    } catch (error) {
      console.error('❌ Erro ao processar pagamento:', error)
      setErro(error instanceof Error ? error.message : 'Erro ao processar pagamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!aberto || !transacao) return null

  const dataDisplay = formatarDataDisplay(dataPagamento)
  const dataInputValue = formatarDataParaInput(dataPagamento)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Pagamento</h3>
            <div className="h-1 w-12 bg-green-500 rounded"></div>
          </div>
          
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-semibold text-gray-700">Transação:</span>
                <p className="text-gray-800">#{transacao.numero_transacao}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Tipo:</span>
                <p className="text-gray-800">{transacao.tipo === 'entrada' ? 'Venda' : 'Compra'}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Descrição:</span>
                <p className="text-gray-800 truncate">{transacao.descricao}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Vencimento:</span>
                <p className="text-gray-800">{transacao.data ? formatarDataDisplay(transacao.data) : '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-gray-700">Valor Original da Parcela:</span>
                <p className={`text-lg font-bold ${transacao.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  {transacao.tipo === 'entrada' ? '+' : '-'} R$ {transacao.valor.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data do Pagamento *
            </label>
            <input
              type="date"
              value={dataInputValue}
              onChange={handleDataChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Será exibida como: <span className="font-medium">{dataDisplay}</span>
            </p>
          </div>

          <div className="mb-4">
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="pagarTotal"
                checked={pagarValorTotal}
                onChange={(e) => {
                  setPagarValorTotal(e.target.checked)
                  if (e.target.checked) {
                    setValorPago(transacao.valor)
                    setJurosDescontos(0)
                  }
                }}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <label htmlFor="pagarTotal" className="ml-2 text-sm font-medium text-gray-700">
                Pagar valor total da parcela (R$ {transacao.valor.toFixed(2)})
              </label>
            </div>

            {!pagarValorTotal && (
              <div className="pl-6 border-l-2 border-green-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor a Pagar *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorPago}
                    onChange={handleValorPagoChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Digite o valor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getTipoJurosDescontos()} ({jurosDescontos > 0 ? '+' : '-'} R$ {Math.abs(jurosDescontos).toFixed(2)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={jurosDescontos}
                    onChange={handleJurosDescontosChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Valor de juros ou descontos"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {transacao.tipo === 'entrada' 
                      ? 'Positivo = juros (cliente paga mais), Negativo = desconto (cliente paga menos)'
                      : 'Positivo = desconto (você paga menos), Negativo = juros (você paga mais)'
                    }
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Valor Original:</span>
                    <span className="font-medium">R$ {transacao.valor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{getTipoJurosDescontos()}:</span>
                    <span className={`font-medium ${jurosDescontos > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {getSinalJurosDescontos()} R$ {Math.abs(jurosDescontos).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-300">
                    <span className="text-gray-800">Total Impacto no Caixa:</span>
                    <span className={`${transacao.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {transacao.tipo === 'entrada' ? '+' : '-'} R$ {calcularTotalImpacto().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
              {erro}
            </div>
          )}

          <p className="text-sm text-gray-600 mb-6">
            {pagarValorTotal 
              ? `Confirmar pagamento integral em ${dataDisplay}?` 
              : `Confirmar pagamento em ${dataDisplay}?`
            }
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
              onClick={handlePagar}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processando...' : `Confirmar Pagamento`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}