'use client'

import { useState } from 'react'

interface FiltrosLancamentosProps {
  filtroDataInicio: string
  setFiltroDataInicio: (v: string) => void
  filtroDataFim: string
  setFiltroDataFim: (v: string) => void
  filtroMes: string
  setFiltroMes: (v: string) => void
  filtroNumeroTransacao: string
  setFiltroNumeroTransacao: (v: string) => void
  filtroDescricao: string
  setFiltroDescricao: (v: string) => void
  filtroTipo?: string
  setFiltroTipo?: (v: string) => void
  filtroStatus: string
  setFiltroStatus: (v: string) => void
  filtroCDC?: string
  setFiltroCDC?: (v: string) => void
  
  centrosCusto?: any[]
  
  onLimpar: () => void
  onGerarPDF?: () => void
  
  mostrarCDC?: boolean
  mostrarNumeroTransacao?: boolean
  mostrarTipo?: boolean
  labelsDataComoVencimento?: boolean
  titulo?: string
  tipo?: 'venda' | 'compra' | 'geral'
}

export default function FiltrosLancamentos({
  filtroDataInicio,
  setFiltroDataInicio,
  filtroDataFim,
  setFiltroDataFim,
  filtroMes,
  setFiltroMes,
  filtroNumeroTransacao,
  setFiltroNumeroTransacao,
  filtroDescricao,
  setFiltroDescricao,
  filtroTipo,
  setFiltroTipo,
  filtroStatus,
  setFiltroStatus,
  filtroCDC,
  setFiltroCDC,
  centrosCusto = [],
  onLimpar,
  onGerarPDF,
  mostrarCDC = true,
  mostrarNumeroTransacao = true,
  mostrarTipo = false,
  labelsDataComoVencimento = false,
  titulo = 'Filtros',
  tipo = 'geral'
}: FiltrosLancamentosProps) {
  const [aberto, setAberto] = useState(false)

  const gerarMeses = () => {
    const meses = []
    const hoje = new Date()
    
    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const ano = data.getFullYear()
      const mes = String(data.getMonth() + 1).padStart(2, '0')
      const valor = `${ano}-${mes}`
      
      const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      meses.push({ valor, nome: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) })
    }
    
    for (let i = 1; i <= 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const ano = data.getFullYear()
      const mes = String(data.getMonth() + 1).padStart(2, '0')
      const valor = `${ano}-${mes}`
      
      const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      meses.push({ valor, nome: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) })
    }
    
    return meses
  }

  const meses = gerarMeses()

  // ✅ CORREÇÃO: Status parcial APENAS para vendas/compras, NÃO para geral
  const getStatusOptions = () => {
    if (tipo === 'venda' || tipo === 'compra') {
      // Para telas de Vendas e Compras: mostra parcial
      return [
        { value: 'todos', label: 'Todos' },
        { value: 'pendente', label: 'Pendente' },
        { value: 'pago', label: 'Pago' },
        { value: 'parcial', label: 'Parcial' } // ✅ Mantido aqui
      ]
    } else {
      // Para TelaInicialLoja (tipo='geral'): SEM parcial
      return [
        { value: 'todos', label: 'Todos' },
        { value: 'pendente', label: 'Pendente' },
        { value: 'pago', label: 'Pago' }
        // ❌ Parcial removido aqui
      ]
    }
  }

  const getTipoOptions = () => {
    return [
      { value: 'todos', label: 'Todos' },
      { value: 'compra', label: 'Compra' },
      { value: 'venda', label: 'Venda' }
    ]
  }

  const getDescricaoLabel = () => {
    if (tipo === 'venda') return 'Cliente'
    if (tipo === 'compra') return 'Fornecedor'
    return 'Cliente/Fornecedor'
  }

  const getDescricaoPlaceholder = () => {
    if (tipo === 'venda') return 'Buscar cliente...'
    if (tipo === 'compra') return 'Buscar fornecedor...'
    return 'Buscar cliente/fornecedor...'
  }

  const getDataLabel = (prefixo: string) => {
    if (labelsDataComoVencimento) {
      return `${prefixo} Vencimento`
    }
    return `${prefixo} Data`
  }

  return (
    <div className="bg-white rounded-lg shadow-md mb-3">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <span>🔍 {titulo}</span>
        <span className="text-lg">{aberto ? '▼' : '▶'}</span>
      </button>

      {aberto && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-1">
            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                {getDataLabel('Início')}
              </label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                {getDataLabel('Fim')}
              </label>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                Mês Fechado
              </label>
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {meses.map(m => (
                  <option key={m.valor} value={m.valor} className="text-[10px]">{m.nome}</option>
                ))}
              </select>
            </div>

            {mostrarNumeroTransacao && (
              <div className="col-span-1">
                <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                  Nº Transação
                </label>
                <input
                  type="text"
                  value={filtroNumeroTransacao}
                  onChange={(e) => setFiltroNumeroTransacao(e.target.value)}
                  placeholder="Ex: 123"
                  className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                {getDescricaoLabel()}
              </label>
              <input
                type="text"
                value={filtroDescricao}
                onChange={(e) => setFiltroDescricao(e.target.value)}
                placeholder={getDescricaoPlaceholder()}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {mostrarTipo && setFiltroTipo && (
              <div className="col-span-1">
                <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                  Tipo
                </label>
                <select
                  value={filtroTipo || 'todos'}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {getTipoOptions().map(option => (
                    <option key={option.value} value={option.value} className="text-[10px]">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {getStatusOptions().map(option => (
                  <option key={option.value} value={option.value} className="text-[10px]">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={onLimpar}
              className="px-2 py-0.5 bg-gray-500 text-white text-[10px] rounded hover:bg-gray-600 transition-colors"
            >
              🗑️ Limpar
            </button>
            
            {onGerarPDF && (
              <button
                onClick={onGerarPDF}
                className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded hover:bg-red-600 transition-colors"
              >
                📄 PDF
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}