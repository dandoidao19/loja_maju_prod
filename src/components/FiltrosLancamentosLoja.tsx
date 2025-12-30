'use client'

import { useState, useEffect } from 'react'
import { getDataAtualBrasil } from '@/lib/dateUtils'

interface FiltrosLancamentosLojaProps {
  filtroDataInicio: string
  setFiltroDataInicio: (value: string) => void
  filtroDataFim: string
  setFiltroDataFim: (value: string) => void
  filtroMes: string
  setFiltroMes: (value: string) => void
  filtroNumeroTransacao: string
  setFiltroNumeroTransacao: (value: string) => void
  filtroDescricao: string
  setFiltroDescricao: (value: string) => void
  filtroTipo: string
  setFiltroTipo: (value: string) => void
  filtroStatus: string
  setFiltroStatus: (value: string) => void
  onLimpar: () => void
  onGerarPDF: () => void
  mostrarCDC?: boolean
  mostrarNumeroTransacao?: boolean
  mostrarTipo?: boolean
  labelsDataComoVencimento?: boolean
  titulo?: string
  tipo?: string
}

export default function FiltrosLancamentosLoja({
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
  onLimpar,
  onGerarPDF,
  mostrarCDC = false,
  mostrarNumeroTransacao = true,
  mostrarTipo = true,
  labelsDataComoVencimento = true,
  titulo = "Filtros de Financeiro - Loja",
  tipo = "geral"
}: FiltrosLancamentosLojaProps) {
  
  // ✅ INICIALIZAR COM MÊS ATUAL (apenas para Loja)
  useEffect(() => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    
    // Definir primeiro e último dia do mês atual
    const primeiroDia = `${ano}-${mes}-01`
    const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()
    const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
    
    // Definir filtro do mês atual
    setFiltroMes(`${ano}-${mes}`)
    
    // Definir período do mês atual
    if (!filtroDataInicio && !filtroDataFim) {
      setFiltroDataInicio(primeiroDia)
      setFiltroDataFim(ultimoDiaStr)
    }
    
    console.log(`🎯 Loja - Filtro padrão: Mês ${mes}/${ano} (${primeiroDia} até ${ultimoDiaStr})`)
  }, [])

  // ✅ FUNÇÃO para definir filtro rápido do mês atual
  const definirMesAtual = () => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    
    const primeiroDia = `${ano}-${mes}-01`
    const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()
    const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
    
    setFiltroDataInicio(primeiroDia)
    setFiltroDataFim(ultimoDiaStr)
    setFiltroMes(`${ano}-${mes}`)
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
    
    console.log(`🎯 Loja - Filtro rápido: Mês Atual (${primeiroDia} até ${ultimoDiaStr})`)
  }

  // ✅ FUNÇÃO para definir filtro rápido dos últimos 30 dias
  const definirUltimos30Dias = () => {
    const hoje = new Date()
    const fim = hoje.toISOString().split('T')[0]
    
    const inicio = new Date(hoje)
    inicio.setDate(hoje.getDate() - 30)
    const inicioStr = inicio.toISOString().split('T')[0]
    
    setFiltroDataInicio(inicioStr)
    setFiltroDataFim(fim)
    setFiltroMes('')
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
    
    console.log(`🎯 Loja - Filtro rápido: Últimos 30 dias (${inicioStr} até ${fim})`)
  }

  // ✅ FUNÇÃO para definir filtro rápido de hoje
  const definirHoje = () => {
    const hoje = getDataAtualBrasil()
    setFiltroDataInicio(hoje)
    setFiltroDataFim(hoje)
    setFiltroMes('')
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
    
    console.log(`🎯 Loja - Filtro rápido: Hoje (${hoje})`)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">{titulo}</h2>
      
      {/* ✅ FILTROS RÁPIDOS ESPECÍFICOS PARA LOJA */}
      <div className="flex flex-wrap gap-1 mb-2">
        <button
          onClick={definirMesAtual}
          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
        >
          📅 Mês Atual
        </button>
        <button
          onClick={definirUltimos30Dias}
          className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
        >
          📊 Últimos 30 Dias
        </button>
        <button
          onClick={definirHoje}
          className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors"
        >
          🎯 Hoje
        </button>
        <button
          onClick={onLimpar}
          className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
        >
          🧹 Limpar
        </button>
        <button
          onClick={onGerarPDF}
          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
        >
          📄 Gerar PDF
        </button>
      </div>

      {/* FILTROS MANUAIS */}
      <div className="grid grid-cols-2 gap-2">
        {/* Data Início */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {labelsDataComoVencimento ? 'Vencimento de' : 'Data de'} Início
          </label>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Data Fim */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {labelsDataComoVencimento ? 'Vencimento até' : 'Data até'}
          </label>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Mês */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Mês
          </label>
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Número da Transação */}
        {mostrarNumeroTransacao && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nº Transação
            </label>
            <input
              type="text"
              value={filtroNumeroTransacao}
              onChange={(e) => setFiltroNumeroTransacao(e.target.value)}
              placeholder="Ex: 1001"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Descrição/Cliente/Fornecedor */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cliente/Fornecedor
          </label>
          <input
            type="text"
            value={filtroDescricao}
            onChange={(e) => setFiltroDescricao(e.target.value)}
            placeholder="Nome ou parte"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Tipo (Compra/Venda) */}
        {mostrarTipo && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="todos">Todos</option>
              <option value="venda">Vendas</option>
              <option value="compra">Compras</option>
            </select>
          </div>
        )}

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </div>
      </div>

      {/* ✅ INDICADOR VISUAL DO FILTRO ATUAL */}
      {(filtroDataInicio || filtroDataFim || filtroMes || filtroNumeroTransacao || filtroDescricao || filtroTipo !== 'todos' || filtroStatus !== 'todos') && (
        <div className="bg-blue-50 p-2 rounded border border-blue-200">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Filtro aplicado:</span>
            {filtroDataInicio && filtroDataFim && ` Período: ${filtroDataInicio} até ${filtroDataFim}`}
            {filtroMes && ` | Mês: ${filtroMes}`}
            {filtroNumeroTransacao && ` | Transação: ${filtroNumeroTransacao}`}
            {filtroDescricao && ` | Cliente/Fornecedor: ${filtroDescricao}`}
            {filtroTipo !== 'todos' && ` | Tipo: ${filtroTipo}`}
            {filtroStatus !== 'todos' && ` | Status: ${filtroStatus}`}
          </p>
        </div>
      )}
    </div>
  )
}