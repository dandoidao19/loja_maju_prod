'use client'

import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'

interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  data_prevista: string
  centro_custo_id: string
  status: string
  centros_de_custo?: {
    nome: string
  }
}

interface CentroCusto {
  id: string
  nome: string
  contexto: string
  tipo: string
  categoria: string
  recorrencia: string
}

interface EdicaoEmLoteProps {
  onDataChange: () => void
}

export default function EdicaoEmLote({ onDataChange }: EdicaoEmLoteProps) {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // Filtros de busca
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroCDCOrigem, setFiltroCDCOrigem] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  
  // Dados para edição
  const [cdcDestino, setCdcDestino] = useState('')
  const [transacoesSelecionadas, setTransacoesSelecionadas] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [tipoMensagem, setTipoMensagem] = useState<'sucesso' | 'erro' | ''>('')

  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Carregar centros de custo
      const { data: centros, error: errorCentros } = await supabase
        .from('centros_de_custo')
        .select('*')
        .eq('contexto', 'casa')
        .order('nome')

      if (errorCentros) throw errorCentros
      setCentrosCusto(centros || [])

      // Carregar lançamentos
      const { data: lanc, error: errorLanc } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        // .eq('user_id', user?.id)
        .order('data_prevista', { ascending: false })

      if (errorLanc) throw errorLanc
      setLancamentos(lanc || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setMensagem('❌ Erro ao carregar dados')
      setTipoMensagem('erro')
    }
  }

  // Filtrar lançamentos baseado nos critérios
  const lancamentosFiltrados = lancamentos.filter(lanc => {
    if (filtroDescricao && !lanc.descricao.toLowerCase().includes(filtroDescricao.toLowerCase())) {
      return false
    }
    if (filtroCDCOrigem && lanc.centro_custo_id !== filtroCDCOrigem) {
      return false
    }
    if (filtroTipo && lanc.tipo !== filtroTipo) {
      return false
    }
    return true
  })

  const handleSelecionarTodos = () => {
    if (transacoesSelecionadas.length === lancamentosFiltrados.length) {
      setTransacoesSelecionadas([])
    } else {
      setTransacoesSelecionadas(lancamentosFiltrados.map(l => l.id))
    }
  }

  const handleSelecionarTransacao = (id: string) => {
    if (transacoesSelecionadas.includes(id)) {
      setTransacoesSelecionadas(transacoesSelecionadas.filter(t => t !== id))
    } else {
      setTransacoesSelecionadas([...transacoesSelecionadas, id])
    }
  }

  const executarEdicaoEmLote = async () => {
    if (transacoesSelecionadas.length === 0) {
      setMensagem('❌ Selecione pelo menos uma transação')
      setTipoMensagem('erro')
      return
    }

    if (!cdcDestino) {
      setMensagem('❌ Selecione um Centro de Custo de destino')
      setTipoMensagem('erro')
      return
    }

    if (filtroTipo && filtroTipo === 'entrada') {
      const todasSaoReceita = transacoesSelecionadas.every(id => {
        const lanc = lancamentos.find(l => l.id === id)
        return lanc?.tipo === 'entrada'
      })

      if (!todasSaoReceita) {
        setMensagem('❌ ATENÇÃO: Nem todas as transações selecionadas são RECEITA. Operação cancelada por segurança.')
        setTipoMensagem('erro')
        return
      }
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('lancamentos_financeiros')
        .update({ centro_custo_id: cdcDestino })
        .in('id', transacoesSelecionadas)

      if (error) throw error

      setMensagem(`✅ ${transacoesSelecionadas.length} transação(ões) atualizada(s) com sucesso!`)
      setTipoMensagem('sucesso')
      
      setTransacoesSelecionadas([])
      setCdcDestino('')
      setFiltroDescricao('')
      setFiltroCDCOrigem('')
      setFiltroTipo('')
      
      await carregarDados()
      onDataChange()
    } catch (error: any) {
      console.error('Erro ao atualizar:', error)
      setMensagem(`❌ Erro ao atualizar: ${error.message}`)
      setTipoMensagem('erro')
    } finally {
      setLoading(false)
    }
  }

  const limparFiltros = () => {
    setFiltroDescricao('')
    setFiltroCDCOrigem('')
    setFiltroTipo('')
    setTransacoesSelecionadas([])
  }

  return (
    <div className="space-y-2">
      <div className="bg-white p-3 rounded shadow">
        <h2 className="text-sm font-semibold mb-2">🔄 Edição em Lote de Transações</h2>

        {mensagem && (
          <div className={`p-2 rounded mb-2 text-xs ${tipoMensagem === 'sucesso' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {mensagem}
          </div>
        )}

        {/* Seção de Filtros */}
        <div className="bg-gray-50 p-2 rounded mb-2 border border-gray-200">
          <h3 className="text-xs font-semibold mb-1">🔍 Filtrar Transações</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Descrição (contém)</label>
              <input
                type="text"
                value={filtroDescricao}
                onChange={(e) => setFiltroDescricao(e.target.value)}
                placeholder="Ex: UBER, TRANSPORTE..."
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Centro de Custo (Origem)</label>
              <select
                value={filtroCDCOrigem}
                onChange={(e) => setFiltroCDCOrigem(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {centrosCusto.map(cdc => (
                  <option key={cdc.id} value={cdc.id}>{cdc.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="entrada">Entrada (Receita)</option>
                <option value="saida">Saída (Despesa)</option>
              </select>
            </div>
          </div>

          <button
            onClick={limparFiltros}
            className="text-xs px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            🗑️ Limpar Filtros
          </button>
        </div>

        {/* Seção de Edição */}
        <div className="bg-blue-50 p-2 rounded mb-2 border border-blue-200">
          <h3 className="text-xs font-semibold mb-1">✏️ Atualizar Centro de Custo</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-1">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Novo Centro de Custo *</label>
              <select
                value={cdcDestino}
                onChange={(e) => setCdcDestino(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">Selecione...</option>
                {centrosCusto.map(cdc => (
                  <option key={cdc.id} value={cdc.id}>{cdc.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Transações Selecionadas</label>
              <div className="px-2 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-blue-600">
                {transacoesSelecionadas.length} de {lancamentosFiltrados.length}
              </div>
            </div>
          </div>

          <button
            onClick={executarEdicaoEmLote}
            disabled={loading || transacoesSelecionadas.length === 0 || !cdcDestino}
            className="w-full text-xs px-3 py-1.5 bg-blue-500 text-white font-medium rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : `✅ Atualizar ${transacoesSelecionadas.length} Transação(ões)`}
          </button>
        </div>

        {/* Tabela de Transações */}
        <div>
          <h3 className="text-xs font-semibold mb-1">📋 Transações Encontradas ({lancamentosFiltrados.length})</h3>

          {lancamentosFiltrados.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Nenhuma transação encontrada com os filtros aplicados</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">
                      <input
                        type="checkbox"
                        checked={transacoesSelecionadas.length === lancamentosFiltrados.length && lancamentosFiltrados.length > 0}
                        onChange={handleSelecionarTodos}
                        className="rounded"
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">Data</th>
                    <th className="px-2 py-1.5 text-left font-medium">Descrição</th>
                    <th className="px-2 py-1.5 text-left font-medium">Tipo</th>
                    <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                    <th className="px-2 py-1.5 text-left font-medium">CDC Atual</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentosFiltrados.map((lanc) => (
                    <tr key={lanc.id} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={transacoesSelecionadas.includes(lanc.id)}
                          onChange={() => handleSelecionarTransacao(lanc.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {new Date(lanc.data_prevista).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-2 py-1.5 truncate max-w-[150px]">
                        {lanc.descricao}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded ${lanc.tipo === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {lanc.tipo === 'entrada' ? '📈 Entrada' : '📉 Saída'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium">
                        R$ {lanc.valor.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">
                          {centrosCusto.find(c => c.id === lanc.centro_custo_id)?.nome || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Instruções de Uso */}
      <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
        <h3 className="text-xs font-semibold text-yellow-900 mb-1">📌 Como Usar:</h3>
        <ul className="text-xs text-yellow-800 space-y-0.5">
          <li>✓ Use os filtros para encontrar as transações que deseja atualizar</li>
          <li>✓ Selecione as transações usando os checkboxes</li>
          <li>✓ Escolha o novo Centro de Custo de destino</li>
          <li>✓ Clique em "Atualizar" para aplicar a mudança em lote</li>
          <li>⚠️ Se filtrar por "Entrada", apenas transações RECEITA serão atualizadas</li>
        </ul>
      </div>
    </div>
  )
}