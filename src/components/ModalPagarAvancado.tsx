'use client'

import React from 'react'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

// Interfaces (devem ser importadas do arquivo principal ou definidas aqui se for um arquivo separado)
interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  data_prevista: string
  centro_custo_id: string
  status: string
  parcelamento?: { atual: number; total: number }
  recorrencia?: any
  caixa_id?: string
  origem?: string
  centros_de_custo?: {
    nome: string
  }
}

interface ModalPagarState {
  aberto: boolean
  lancamento: Lancamento | null
  passo: 'confirmar_total' | 'valor_parcial' | 'nova_parcela' | 'nova_parcela_data'
  valorPago: number | null
  novaDataVencimento: string
}

interface ModalPagarAvancadoProps {
  modalPagar: ModalPagarState
  setModalPagar: React.Dispatch<React.SetStateAction<ModalPagarState>>
  processarPagamento: () => Promise<void>
}

export default function ModalPagarAvancado({ modalPagar, setModalPagar, processarPagamento }: ModalPagarAvancadoProps) {
  if (!modalPagar.aberto || !modalPagar.lancamento) return null

  const lancamento = modalPagar.lancamento
  const valorRestante = lancamento.valor - (modalPagar.valorPago || 0)

  const fecharModal = () => setModalPagar({ 
    aberto: false, 
    lancamento: null, 
    passo: 'confirmar_total', 
    valorPago: null, 
    novaDataVencimento: getDataAtualBrasil() 
  })

  const avancarPasso = (passo: 'confirmar_total' | 'valor_parcial' | 'nova_parcela' | 'nova_parcela_data', valor?: number) => {
    setModalPagar(prev => ({
      ...prev,
      passo,
      valorPago: valor !== undefined ? valor : prev.valorPago,
      novaDataVencimento: prev.novaDataVencimento || getDataAtualBrasil()
    }))
  }

  // Função de manipulação de valor para evitar a recriação do componente
  const handleValorParcialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value)
    setModalPagar(prev => ({ ...prev, valorPago: isNaN(valor) ? null : valor }))
  }

  // Função de manipulação de data para evitar a recriação do componente
  const handleNovaDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModalPagar(prev => ({ ...prev, novaDataVencimento: e.target.value }))
  }

  const renderPasso = () => {
    switch (modalPagar.passo) {
      case 'confirmar_total':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Pagamento</h3>
              <div className="h-1 w-12 bg-blue-500 rounded"></div>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Lançamento:</span> {lancamento.descricao}
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-semibold">Valor Total:</span> <span className="text-lg font-bold text-blue-600">R$ {lancamento.valor.toFixed(2)}</span>
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Deseja pagar o valor total deste lançamento?
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => avancarPasso('valor_parcial', 0)}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                Pagamento Parcial
              </button>
              <button
                onClick={() => processarPagamento()}
                className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Pagar Total
              </button>
            </div>
          </>
        )
      case 'valor_parcial':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Pagamento Parcial</h3>
              <div className="h-1 w-12 bg-yellow-500 rounded"></div>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Lançamento:</span> {lancamento.descricao}
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-semibold">Valor Original:</span> <span className="text-lg font-bold text-yellow-600">R$ {lancamento.valor.toFixed(2)}</span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Valor a Pagar *</label>
              <input
                type="number"
                step="0.01"
                value={modalPagar.valorPago === null ? '' : modalPagar.valorPago}
                onChange={handleValorParcialChange}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                placeholder="0.00"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Máximo: R$ {lancamento.valor.toFixed(2)}
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (modalPagar.valorPago === null || modalPagar.valorPago <= 0 || modalPagar.valorPago > lancamento.valor) {
                    alert('Valor pago inválido.')
                    return
                  }
                  if (lancamento.valor - modalPagar.valorPago > 0.01) { // Verifica se o restante é significativo
                    avancarPasso('nova_parcela')
                  } else {
                    processarPagamento() // Se o valor pago for igual ao total, processa
                  }
                }}
                disabled={modalPagar.valorPago === null || modalPagar.valorPago <= 0}
                className="px-4 py-2.5 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continuar
              </button>
            </div>
          </>
        )
      case 'nova_parcela':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Gerar Nova Parcela?</h3>
              <div className="h-1 w-12 bg-blue-500 rounded"></div>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Valor Pago:</span> <span className="text-lg font-bold text-green-600">R$ {(modalPagar.valorPago || 0).toFixed(2)}</span>
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-semibold">Valor Restante:</span> <span className="text-lg font-bold text-red-600">R$ {valorRestante.toFixed(2)}</span>
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Deseja criar uma nova parcela para o valor restante?
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => processarPagamento()}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Não (Apenas Alterar Status)
              </button>
              <button
                onClick={() => avancarPasso('nova_parcela_data')}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sim (Gerar Parcela)
              </button>
            </div>
          </>
        )
      case 'nova_parcela_data':
        return (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Nova Data de Vencimento</h3>
              <div className="h-1 w-12 bg-green-500 rounded"></div>
            </div>
            
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Valor da Nova Parcela:</span> <span className="text-lg font-bold text-green-600">R$ {valorRestante.toFixed(2)}</span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nova Data de Vencimento *</label>
              <input
                type="date"
                value={modalPagar.novaDataVencimento}
                onChange={handleNovaDataChange}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Data selecionada: <span className="font-semibold">{formatarDataParaExibicao(modalPagar.novaDataVencimento)}</span>
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => processarPagamento()}
                disabled={!modalPagar.novaDataVencimento}
                className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Confirmar e Gerar Parcela
              </button>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-96 overflow-y-auto">
        <div className="p-6">
          {renderPasso()}
        </div>
      </div>
    </div>
  )
}
