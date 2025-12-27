'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

interface CentroCusto {
  id: string
  nome: string
  contexto: string
  tipo: string
  categoria: string
  recorrencia: string
}

interface ControleCDCProps {
  onDataChange: () => void;
}

export default function ControleCDC({ onDataChange }: ControleCDCProps) {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  
  // Estado do formulário
  const [formCentroCusto, setFormCentroCusto] = useState({
    nome: '',
    contexto: 'casa' as 'casa' | 'loja',
    tipo: 'DESPESA' as 'RECEITA' | 'DESPESA',
    categoria: '',
    recorrencia: 'VARIAVEL' as 'FIXO' | 'VARIAVEL'
  })

  useEffect(() => {
    carregarUsuarioECentros()
  }, [])

  const carregarUsuarioECentros = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    
    const { data: centros, error } = await supabase
      .from('centros_de_custo')
      .select('*')
      .order('contexto')
      .order('tipo')
      .order('nome')

    if (error) {
      console.error('Erro ao carregar centros:', error)
    } else if (centros) {
      setCentrosCusto(centros)
    }
  }

  const adicionarCentroCusto = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      alert('Erro: Usuário não identificado')
      return
    }

    const dadosValidados = {
      // user_id: user.id,
      nome: formCentroCusto.nome.toUpperCase().trim(),
      contexto: formCentroCusto.contexto,
      tipo: formCentroCusto.tipo,
      categoria: formCentroCusto.categoria.toUpperCase().trim() || 'OUTROS',
      recorrencia: formCentroCusto.recorrencia
    }

    console.log('Tentando inserir:', dadosValidados)

    setLoading(true)

    try {
      const { error } = await supabase
        .from('centros_de_custo')
        .insert(dadosValidados)

      if (error) {
        throw error
      }

      // Sucesso
      setFormCentroCusto({
        nome: '',
        contexto: 'casa',
        tipo: 'DESPESA',
        categoria: '',
        recorrencia: 'VARIAVEL'
      })
      
      await carregarUsuarioECentros()
      onDataChange()
      alert('✅ Centro de custo adicionado com sucesso!')
      
    } catch (error: any) {
      console.error('Erro detalhado:', error)
      alert('❌ Erro ao adicionar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const iniciarEdicao = (centro: CentroCusto) => {
    setEditandoId(centro.id)
    setFormCentroCusto({
      nome: centro.nome,
      contexto: centro.contexto as 'casa' | 'loja',
      tipo: centro.tipo as 'RECEITA' | 'DESPESA',
      categoria: centro.categoria,
      recorrencia: centro.recorrencia as 'FIXO' | 'VARIAVEL'
    })
  }

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editandoId || !user) {
      alert('Erro: Centro de custo não identificado')
      return
    }

    const dadosValidados = {
      nome: formCentroCusto.nome.toUpperCase().trim(),
      contexto: formCentroCusto.contexto,
      tipo: formCentroCusto.tipo,
      categoria: formCentroCusto.categoria.toUpperCase().trim() || 'OUTROS',
      recorrencia: formCentroCusto.recorrencia
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('centros_de_custo')
        .update(dadosValidados)
        .eq('id', editandoId)

      if (error) {
        throw error
      }

      // Sucesso
      setEditandoId(null)
      setFormCentroCusto({
        nome: '',
        contexto: 'casa',
        tipo: 'DESPESA',
        categoria: '',
        recorrencia: 'VARIAVEL'
      })
      
      await carregarUsuarioECentros()
      onDataChange()
      alert('✅ Centro de custo atualizado com sucesso!')
      
    } catch (error: any) {
      console.error('Erro detalhado:', error)
      alert('❌ Erro ao atualizar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setFormCentroCusto({
      nome: '',
      contexto: 'casa',
      tipo: 'DESPESA',
      categoria: '',
      recorrencia: 'VARIAVEL'
    })
  }

  const deletarCentroCusto = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este centro de custo?')) {
      return
    }

    const { error } = await supabase
      .from('centros_de_custo')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
    } else {
      carregarUsuarioECentros()
      onDataChange()
      alert('Centro de custo excluído com sucesso!')
    }
  }

  // Estatísticas
  const estatisticas = {
    total: centrosCusto.length,
    casa: centrosCusto.filter(c => c.contexto === 'casa').length,
    loja: centrosCusto.filter(c => c.contexto === 'loja').length,
    receitas: centrosCusto.filter(c => c.tipo === 'RECEITA').length,
    despesas: centrosCusto.filter(c => c.tipo === 'DESPESA').length
  }

  return (
    <div className="space-y-3">
      {/* Estatísticas - Compactadas */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="bg-blue-50 p-2 rounded border border-blue-200">
          <h3 className="text-xs font-medium text-blue-800">Total</h3>
          <p className="text-base font-bold text-blue-600">{estatisticas.total}</p>
        </div>
        <div className="bg-green-50 p-2 rounded border border-green-200">
          <h3 className="text-xs font-medium text-green-800">Casa</h3>
          <p className="text-base font-bold text-green-600">{estatisticas.casa}</p>
        </div>
        <div className="bg-purple-50 p-2 rounded border border-purple-200">
          <h3 className="text-xs font-medium text-purple-800">Loja</h3>
          <p className="text-base font-bold text-purple-600">{estatisticas.loja}</p>
        </div>
        <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
          <h3 className="text-xs font-medium text-emerald-800">Receitas</h3>
          <p className="text-base font-bold text-emerald-600">{estatisticas.receitas}</p>
        </div>
        <div className="bg-red-50 p-2 rounded border border-red-200">
          <h3 className="text-xs font-medium text-red-800">Despesas</h3>
          <p className="text-base font-bold text-red-600">{estatisticas.despesas}</p>
        </div>
      </div>

      <div className="bg-white p-3 rounded shadow">
        <h2 className="text-base font-semibold mb-2 text-gray-800">Centros de Custo</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Formulário */}
          <div>
            <h3 className="text-sm font-semibold mb-2">
              {editandoId ? 'Editar Centro de Custo' : 'Adicionar Centro de Custo'}
            </h3>
            <form onSubmit={editandoId ? salvarEdicao : adicionarCentroCusto} className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Nome *</label>
                <input
                  type="text"
                  value={formCentroCusto.nome}
                  onChange={(e) => setFormCentroCusto({...formCentroCusto, nome: e.target.value})}
                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  required
                  placeholder="EX: MERCADO, SALARIO..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Contexto *</label>
                  <select
                    value={formCentroCusto.contexto}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, contexto: e.target.value as 'casa' | 'loja'})}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="casa">Casa</option>
                    <option value="loja">Loja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Tipo *</label>
                  <select
                    value={formCentroCusto.tipo}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, tipo: e.target.value as 'RECEITA' | 'DESPESA'})}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="RECEITA">Receita</option>
                    <option value="DESPESA">Despesa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Categoria *</label>
                  <input
                    type="text"
                    value={formCentroCusto.categoria}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, categoria: e.target.value})}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 uppercase"
                    required
                    placeholder="EX: ALIMENTAÇÃO..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Recorrência *</label>
                  <select
                    value={formCentroCusto.recorrencia}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, recorrencia: e.target.value as 'FIXO' | 'VARIAVEL'})}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="FIXO">Fixo</option>
                    <option value="VARIAVEL">Variável</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-xs bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editandoId ? 'Atualizar' : 'Adicionar'}
                </button>
                {editandoId && (
                  <button
                    type="button"
                    onClick={cancelarEdicao}
                    className="flex-1 text-xs bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Centros de Custo ({centrosCusto.length})</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto border border-gray-200 rounded p-1">
              {centrosCusto.map(centro => (
                <div key={centro.id} className="border border-gray-200 rounded p-2 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
                        <span className="font-medium text-xs text-gray-800">{centro.nome}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${centro.contexto === 'casa' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                          {centro.contexto}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${centro.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {centro.tipo}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div><span className="font-medium">Categoria:</span> {centro.categoria}</div>
                        <div><span className="font-medium">Recorrência:</span> {centro.recorrencia}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-1">
                      <button
                        onClick={() => iniciarEdicao(centro)}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deletarCentroCusto(centro.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {centrosCusto.length === 0 && (
                <p className="text-gray-500 text-xs text-center py-3">Nenhum centro de custo cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}