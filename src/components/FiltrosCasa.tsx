'use client'

import { useState } from 'react'

interface FiltrosCasaProps {
  // Filtros
  filtroDataInicio: string
  setFiltroDataInicio: (v: string) => void
  filtroDataFim: string
  setFiltroDataFim: (v: string) => void
  filtroMes: string
  setFiltroMes: (v: string) => void
  filtroDescricao: string
  setFiltroDescricao: (v: string) => void
  filtroCDC: string
  setFiltroCDC: (v: string) => void
  filtroStatus: string
  setFiltroStatus: (v: string) => void
  
  // Dados
  centrosCusto?: any[]
  
  // Ações
  onLimpar: () => void
  onGerarPDF?: () => void
  // Removido: onVerTudo e mostrarTodos
}

export default function FiltrosCasa({
  filtroDataInicio,
  setFiltroDataInicio,
  filtroDataFim,
  setFiltroDataFim,
  filtroMes,
  setFiltroMes,
  filtroDescricao,
  setFiltroDescricao,
  filtroCDC,
  setFiltroCDC,
  filtroStatus,
  setFiltroStatus,
  centrosCusto = [],
  onLimpar,
  onGerarPDF
}: FiltrosCasaProps) {
  const [aberto, setAberto] = useState(false)

  // Gerar lista de meses (últimos 12 meses + próximos 12 meses)
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

  // Opções de status
  const getStatusOptions = () => {
    return [
      { value: 'todos', label: 'Todos' },
      { value: 'realizado', label: 'Realizado' },
      { value: 'previsto', label: 'Previsto' }
    ]
  }

  return (
    <div className="bg-white rounded-lg shadow-md mb-3">
      {/* Cabeçalho Minimizado */}
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <span>🔍 Filtros de Lançamentos</span>
        <span className="text-lg">{aberto ? '▼' : '▶'}</span>
      </button>

      {/* Conteúdo dos Filtros */}
      {aberto && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-200">
          {/* Grid com 6 colunas - ORDEM: Data Início, Data Fim, Mês, Descrição, CDC, Status */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1">
            {/* Data Início */}
            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                Início Data
              </label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Data Fim */}
            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                Fim Data
              </label>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Mês Fechado */}
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

            {/* Descrição */}
            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                Descrição
              </label>
              <input
                type="text"
                value={filtroDescricao}
                onChange={(e) => setFiltroDescricao(e.target.value)}
                placeholder="Buscar descrição..."
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* CDC */}
            <div className="col-span-1">
              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                CDC
              </label>
              <select
                value={filtroCDC}
                onChange={(e) => setFiltroCDC(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {centrosCusto.map(centro => (
                  <option key={centro.id} value={centro.id} className="text-[10px]">
                    {centro.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
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

          {/* Botões de Ação */}
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