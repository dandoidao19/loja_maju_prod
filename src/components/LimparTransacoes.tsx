'use client'

import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'

interface CentroCusto {
  id: string
  nome: string
  contexto: string
  tipo: string
  categoria: string
  recorrencia: string
}

interface LimparTransacoesProps {
  onDataChange: () => void;
}

export default function LimparTransacoes({ onDataChange }: LimparTransacoesProps) {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [statusAtual, setStatusAtual] = useState('')
  const [user, setUser] = useState<any>(null)
  const [mesesDisponiveis, setMesesDisponiveis] = useState<{ano: number, mes: number, label: string}[]>([])
  
  // Filtros
  const [filtroContexto, setFiltroContexto] = useState<'todos' | 'casa' | 'loja'>('todos')
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'previsto' | 'realizado'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  
  // Novos filtros de período
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | 'mes_especifico' | 'periodo_personalizado'>('todos')
  const [mesSelecionado, setMesSelecionado] = useState<string>('')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')
  
  // Lançamentos a serem excluídos
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [selecionados, setSelecionados] = useState<string[]>([])

  const carregarCentrosCusto = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    
    const { data: centros, error } = await supabase
      .from('centros_de_custo')
      .select('*')
      .order('nome')

    if (error) {
      console.error('Erro ao carregar centros:', error)
    } else if (centros) {
      setCentrosCusto(centros)
    }
  }, [])

  const carregarMesesDisponiveis = useCallback(async () => {
    if (!user) return
    
    try {
      // Buscar todos os anos/meses únicos dos lançamentos
      const { data, error } = await supabase
        .from('lancamentos_financeiros')
        .select('data_prevista')
        // .eq('user_id', user.id)
        .order('data_prevista', { ascending: false })

      if (error) throw error

      // Extrair meses únicos
      const mesesUnicos = new Set<string>()
      const mesesFormatados: {ano: number, mes: number, label: string}[] = []

      data?.forEach(item => {
        if (item.data_prevista) {
          const date = new Date(item.data_prevista)
          const ano = date.getFullYear()
          const mes = date.getMonth() + 1
          const chave = `${ano}-${mes.toString().padStart(2, '0')}`
          
          if (!mesesUnicos.has(chave)) {
            mesesUnicos.add(chave)
            
            const nomeMes = date.toLocaleDateString('pt-BR', { month: 'long' })
            mesesFormatados.push({
              ano,
              mes,
              label: `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}/${ano}`
            })
          }
        }
      })

      // Ordenar por ano e mês (mais recente primeiro)
      mesesFormatados.sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano
        return b.mes - a.mes
      })

      setMesesDisponiveis(mesesFormatados)
      
      // Selecionar o mês atual por padrão se houver dados
      if (mesesFormatados.length > 0) {
        const hoje = new Date()
        const mesAtual = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`
        
        const mesAtualDisponivel = mesesFormatados.find(m => 
          `${m.ano}-${m.mes.toString().padStart(2, '0')}` === mesAtual
        )
        
        if (mesAtualDisponivel) {
          setMesSelecionado(`${mesAtualDisponivel.ano}-${mesAtualDisponivel.mes.toString().padStart(2, '0')}`)
        } else {
          setMesSelecionado(`${mesesFormatados[0].ano}-${mesesFormatados[0].mes.toString().padStart(2, '0')}`)
        }
      }
      
    } catch (error) {
      console.error('Erro ao carregar meses disponíveis:', error)
    }
  }, [user])

  useEffect(() => {
    carregarCentrosCusto()
    
    // Definir datas padrão para o período personalizado (últimos 30 dias)
    const hoje = new Date()
    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(hoje.getDate() - 30)
    
    setDataFim(hoje.toISOString().split('T')[0])
    setDataInicio(trintaDiasAtras.toISOString().split('T')[0])
  }, [carregarCentrosCusto])

  useEffect(() => {
    if (user) {
      carregarMesesDisponiveis()
    }
  }, [user, carregarMesesDisponiveis])

  const buscarLancamentos = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    setStatusAtual('Buscando lançamentos...')
    setLancamentos([])
    setSelecionados([])

    try {
      // 1. Criar mapa de Centros de Custo
      const centrosMap = new Map(centrosCusto.map(c => [c.id, c.nome]))

      let query = supabase
        .from('lancamentos_financeiros')
        .select('id, descricao, valor, tipo, status, data_prevista, centro_custo_id') 
        // .eq('user_id', user.id)
        .order('data_prevista', { ascending: false })

      // Aplicar filtros básicos
      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus)
      }
      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo)
      }
      
      // Filtro de contexto (casa/loja)
      if (filtroContexto !== 'todos') {
        const centrosFiltrados = centrosCusto.filter(c => c.contexto === filtroContexto).map(c => c.id)
        
        if (centrosFiltrados.length === 0) {
          setLancamentos([])
          setStatusAtual('Nenhum centro de custo encontrado para o contexto selecionado.')
          setLoading(false)
          return
        }
        
        query = query.in('centro_custo_id', centrosFiltrados)
      }

      // Filtro de centro de custo específico
      if (filtroCentroCusto !== 'todos') {
        query = query.eq('centro_custo_id', filtroCentroCusto)
      }

      // Filtro de período
      if (filtroPeriodo !== 'todos') {
        if (filtroPeriodo === 'mes_especifico' && mesSelecionado) {
          // Filtrar por mês específico
          const [ano, mes] = mesSelecionado.split('-').map(Number)
          const dataInicioMes = new Date(ano, mes - 1, 1)
          const dataFimMes = new Date(ano, mes, 0) // Último dia do mês
          
          query = query
            .gte('data_prevista', dataInicioMes.toISOString().split('T')[0])
            .lte('data_prevista', dataFimMes.toISOString().split('T')[0])
            
        } else if (filtroPeriodo === 'periodo_personalizado' && dataInicio && dataFim) {
          // Buscar entre datas específicas
          query = query.gte('data_prevista', dataInicio).lte('data_prevista', dataFim)
        }
      }

      const { data, error } = await query

      if (error) throw error

      // 2. Mapear os resultados para adicionar o nome do Centro de Custo
      const lancamentosMapeados = (data || []).map(lancamento => ({
        ...lancamento,
        centros_de_custo: {
          nome: centrosMap.get(lancamento.centro_custo_id) || '-'
        }
      }))

      setLancamentos(lancamentosMapeados)
      setStatusAtual(`Encontrados ${lancamentosMapeados.length} lançamentos.`)
      
    } catch (error: any) {
      console.error('Erro ao buscar lançamentos:', error.message || error)
      setStatusAtual('Erro ao buscar lançamentos.')
    } finally {
      setLoading(false)
    }
  }, [user, filtroContexto, filtroCentroCusto, filtroStatus, filtroTipo, filtroPeriodo, mesSelecionado, dataInicio, dataFim, centrosCusto])

  useEffect(() => {
    buscarLancamentos()
  }, [buscarLancamentos])

  const toggleSelecao = (id: string) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelecaoTodos = () => {
    if (selecionados.length === lancamentos.length) {
      setSelecionados([])
    } else {
      setSelecionados(lancamentos.map(l => l.id))
    }
  }

  const executarExclusao = async () => {
    if (selecionados.length === 0) {
      alert('Selecione pelo menos um lançamento para excluir.')
      return
    }

    if (!confirm(`Tem certeza que deseja excluir ${selecionados.length} lançamento(s)? Esta ação é irreversível.`)) {
      return
    }

    setLoading(true)
    setProgresso(0)
    setStatusAtual('Iniciando exclusão em lote...')

    try {
      const total = selecionados.length
      let excluidos = 0

      // Excluir em lotes
      for (let i = 0; i < total; i++) {
        const id = selecionados[i]
        
        const { error } = await supabase
          .from('lancamentos_financeiros')
          .delete()
          .eq('id', id)

        if (error) {
          console.error(`Erro ao excluir lançamento ${id}:`, error)
        } else {
          excluidos++
        }

        // Atualizar barra de progresso
        const progressoAtual = Math.round((excluidos / total) * 100)
        setProgresso(progressoAtual)
        setStatusAtual(`Excluindo... ${excluidos} de ${total} concluídos.`)
      }

      alert(`✅ Exclusão concluída! ${excluidos} lançamento(s) excluído(s).`)
      onDataChange() // Notificar o pai
      buscarLancamentos() // Recarregar a lista
      carregarMesesDisponiveis() // Atualizar lista de meses
      
    } catch (error) {
      alert('❌ Erro fatal durante a exclusão.')
      console.error('Erro fatal:', error)
    } finally {
      setLoading(false)
      setProgresso(0)
      setStatusAtual('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Limpar Transações em Lote</h2>
        
        {/* Filtros - Layout mais compacto */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {/* Filtro Contexto */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Contexto</label>
            <select
              value={filtroContexto}
              onChange={(e) => setFiltroContexto(e.target.value as 'todos' | 'casa' | 'loja')}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              <option value="casa">Casa</option>
              <option value="loja">Loja</option>
            </select>
          </div>
          
          {/* Filtro Centro de Custo */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Centro de Custo</label>
            <select
              value={filtroCentroCusto}
              onChange={(e) => setFiltroCentroCusto(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              {centrosCusto
                .filter(c => filtroContexto === 'todos' || c.contexto === filtroContexto)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'previsto' | 'realizado')}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              <option value="previsto">Previsto</option>
              <option value="realizado">Pago</option>
            </select>
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'entrada' | 'saida')}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>

          {/* Filtro Período */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Período</label>
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value as 'todos' | 'mes_especifico' | 'periodo_personalizado')}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              <option value="mes_especifico">Mês Específico</option>
              <option value="periodo_personalizado">Período Personalizado</option>
            </select>
          </div>
        </div>

        {/* Filtro de Mês Específico */}
        {filtroPeriodo === 'mes_especifico' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Selecionar Mês</label>
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Selecione um mês</option>
              {mesesDisponiveis.map(mes => (
                <option key={`${mes.ano}-${mes.mes}`} value={`${mes.ano}-${mes.mes.toString().padStart(2, '0')}`}>
                  {mes.label}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 mt-1">
              {mesesDisponiveis.length > 0 
                ? `${mesesDisponiveis.length} meses disponíveis nos dados`
                : 'Carregando meses disponíveis...'}
            </div>
          </div>
        )}

        {/* Filtros de data para período personalizado */}
        {filtroPeriodo === 'periodo_personalizado' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={buscarLancamentos}
                className="w-full text-xs bg-gray-600 text-white px-3 py-1.5 rounded hover:bg-gray-700"
              >
                Aplicar Período
              </button>
            </div>
          </div>
        )}

        {/* Botões de ação rápida */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={buscarLancamentos}
            disabled={loading}
            className="flex-1 text-xs bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {loading ? 'Buscando...' : `Buscar Lançamentos (${lancamentos.length})`}
          </button>
          
          {(filtroPeriodo === 'mes_especifico' && mesSelecionado) && (
            <div className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded border border-blue-200">
              Mês: {mesesDisponiveis.find(m => `${m.ano}-${m.mes.toString().padStart(2, '0')}` === mesSelecionado)?.label}
            </div>
          )}
        </div>

        {/* Barra de Progresso */}
        {loading && progresso > 0 && (
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-xs text-gray-600">
              <span>{statusAtual}</span>
              <span>{progresso}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Tabela de Seleção - Mais compacta */}
        <div className="overflow-x-auto max-h-80 border border-gray-200 rounded">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  <input
                    type="checkbox"
                    checked={selecionados.length === lancamentos.length && lancamentos.length > 0}
                    onChange={toggleSelecaoTodos}
                    className="rounded text-red-600"
                    disabled={lancamentos.length === 0}
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Data</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Descrição</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Valor</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">CDC</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lancamentos.map((lancamento) => (
                <tr key={lancamento.id} className={selecionados.includes(lancamento.id) ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(lancamento.id)}
                      onChange={() => toggleSelecao(lancamento.id)}
                      className="rounded text-red-600"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-600">{lancamento.data_prevista}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{lancamento.descricao}</td>
                  <td className={`px-3 py-2 text-right ${
                    lancamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lancamento.valor)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{lancamento.centros_de_custo?.nome || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      lancamento.status === 'realizado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lancamento.status === 'realizado' ? 'Pago' : 'Previsto'}
                    </span>
                  </td>
                </tr>
              ))}
              {lancamentos.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500 text-xs">
                    Nenhum lançamento encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Resumo e botão de exclusão */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-600">
            <span className="font-medium">{selecionados.length}</span> de <span className="font-medium">{lancamentos.length}</span> lançamentos selecionados
          </div>
          
          <button
            onClick={executarExclusao}
            disabled={loading || selecionados.length === 0}
            className="text-xs bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 font-medium"
          >
            {loading ? statusAtual : `Excluir ${selecionados.length} Selecionado(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}