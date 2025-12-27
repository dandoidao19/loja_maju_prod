'use client'

import { useState } from 'react'

interface FiltroModularProps {
  modulo: 'compra' | 'venda' | 'condicional' | 'estoque' | 'casa' | 'loja'
  filtroAberto: boolean
  onToggleFiltro: (aberto: boolean) => void
  filtroDescricao?: string
  onFiltroDescricaoChange?: (valor: string) => void
  filtroDataInicio?: string
  onFiltroDataInicioChange?: (valor: string) => void
  filtroDataFim?: string
  onFiltroDataFimChange?: (valor: string) => void
  filtroStatus?: string
  onFiltroStatusChange?: (valor: string) => void
  onLimparFiltros?: () => void
  onGerarPDF?: () => void
  totalRegistros?: number
  registrosFiltrados?: number
}

export default function FiltroModular({
  modulo,
  filtroAberto,
  onToggleFiltro,
  filtroDescricao = '',
  onFiltroDescricaoChange,
  filtroDataInicio = '',
  onFiltroDataInicioChange,
  filtroDataFim = '',
  onFiltroDataFimChange,
  filtroStatus = 'todos',
  onFiltroStatusChange,
  onLimparFiltros,
  onGerarPDF,
  totalRegistros = 0,
  registrosFiltrados = 0
}: FiltroModularProps) {
  const estilos = {
    compra: {
      bg: 'bg-purple-50',
      border: 'border-purple-300',
      header: 'bg-purple-100 hover:bg-purple-200',
      texto: 'text-purple-800',
      botao: 'bg-purple-500 hover:bg-purple-600',
      icone: '🛒',
      titulo: 'Filtros de Compra'
    },
    venda: {
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      header: 'bg-blue-100 hover:bg-blue-200',
      texto: 'text-blue-800',
      botao: 'bg-blue-500 hover:bg-blue-600',
      icone: '💰',
      titulo: 'Filtros de Venda'
    },
    condicional: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      header: 'bg-amber-100 hover:bg-amber-200',
      texto: 'text-amber-800',
      botao: 'bg-amber-500 hover:bg-amber-600',
      icone: '📦',
      titulo: 'Filtros Condicional'
    },
    estoque: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      header: 'bg-green-100 hover:bg-green-200',
      texto: 'text-green-800',
      botao: 'bg-green-500 hover:bg-green-600',
      icone: '📊',
      titulo: 'Filtros de Estoque'
    },
    casa: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-300',
      header: 'bg-indigo-100 hover:bg-indigo-200',
      texto: 'text-indigo-800',
      botao: 'bg-indigo-500 hover:bg-indigo-600',
      icone: '🏠',
      titulo: 'Filtros Casa'
    },
    loja: {
      bg: 'bg-rose-50',
      border: 'border-rose-300',
      header: 'bg-rose-100 hover:bg-rose-200',
      texto: 'text-rose-800',
      botao: 'bg-rose-500 hover:bg-rose-600',
      icone: '🏪',
      titulo: 'Filtros Loja'
    }
  }

  const estilo = estilos[modulo]

  return (
    <div className={`${estilo.bg} border-2 ${estilo.border} rounded-xl shadow-md overflow-hidden`}>
      {/* Header Clicável */}
      <button
        onClick={() => onToggleFiltro(!filtroAberto)}
        className={`w-full px-4 py-3 flex justify-between items-center ${estilo.header} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{estilo.icone}</span>
          <span className={`font-semibold ${estilo.texto}`}>{estilo.titulo}</span>
          {registrosFiltrados > 0 && (
            <span className={`text-xs font-bold ${estilo.texto} ml-2`}>
              ({registrosFiltrados}/{totalRegistros})
            </span>
          )}
        </div>
        <span className={`text-lg ${estilo.texto}`}>{filtroAberto ? '▲' : '▼'}</span>
      </button>

      {/* Conteúdo do Filtro */}
      {filtroAberto && (
        <div className="p-4 space-y-3">
          {/* Campo de Descrição/Busca */}
          {onFiltroDescricaoChange && (
            <div>
              <label className={`block text-xs font-semibold ${estilo.texto} mb-1 uppercase tracking-wide`}>
                🔍 Buscar
              </label>
              <input
                type="text"
                value={filtroDescricao}
                onChange={(e) => onFiltroDescricaoChange(e.target.value)}
                placeholder="Digite para filtrar..."
                className={`w-full px-3 py-2 border-2 ${estilo.border} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2`}
              />
            </div>
          )}

          {/* Campos de Data */}
          {(onFiltroDataInicioChange || onFiltroDataFimChange) && (
            <div className="grid grid-cols-2 gap-2">
              {onFiltroDataInicioChange && (
                <div>
                  <label className={`block text-xs font-semibold ${estilo.texto} mb-1 uppercase tracking-wide`}>
                    📅 Data Início
                  </label>
                  <input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => onFiltroDataInicioChange(e.target.value)}
                    className={`w-full px-3 py-2 border-2 ${estilo.border} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2`}
                  />
                </div>
              )}
              {onFiltroDataFimChange && (
                <div>
                  <label className={`block text-xs font-semibold ${estilo.texto} mb-1 uppercase tracking-wide`}>
                    📅 Data Fim
                  </label>
                  <input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => onFiltroDataFimChange(e.target.value)}
                    className={`w-full px-3 py-2 border-2 ${estilo.border} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Campo de Status */}
          {onFiltroStatusChange && (
            <div>
              <label className={`block text-xs font-semibold ${estilo.texto} mb-1 uppercase tracking-wide`}>
                ✓ Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => onFiltroStatusChange(e.target.value)}
                className={`w-full px-3 py-2 border-2 ${estilo.border} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                <option value="todos">Todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="parcial">Parcial</option>
              </select>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2">
            {onLimparFiltros && (
              <button
                onClick={onLimparFiltros}
                className="flex-1 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                🔄 Limpar
              </button>
            )}
            {onGerarPDF && (
              <button
                onClick={onGerarPDF}
                className={`flex-1 px-3 py-2 ${estilo.botao} text-white rounded-lg text-xs font-semibold transition-colors`}
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
