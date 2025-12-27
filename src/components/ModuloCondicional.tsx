'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'
import { GeradorPDFLancamentos } from '@/lib/gerador-pdf-lancamentos'

interface ItemCondicional {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
  status: 'pendente' | 'devolvido' | 'efetivado'
  valor_efetivado?: number
  minimizado?: boolean
  isNovoCadastro?: boolean
}

interface TransacaoCondicional {
  id: string
  numero_transacao: number
  tipo: 'recebido' | 'enviado'
  origem: string
  data_transacao: string
  observacao: string
  status: 'pendente' | 'resolvido' | 'cancelado'
  itens: ItemCondicional[]
}

export default function ModuloCondicional() {
  const [tipo, setTipo] = useState<'recebido' | 'enviado'>('recebido')
  const [origem, setOrigem] = useState('')
  const [dataTransacao, setDataTransacao] = useState(getDataAtualBrasil())
  const [observacao, setObservacao] = useState('')
  const [itens, setItens] = useState<ItemCondicional[]>([
    {
      id: Date.now().toString(),
      produto_id: null,
      descricao: '',
      quantidade: 1,
      categoria: '',
      preco_custo: 0,
      preco_venda: 0,
      status: 'pendente',
      minimizado: false,
      isNovoCadastro: false,
    },
  ])
  const [categorias, setCategorias] = useState<any[]>([])
  const [transacoes, setTransacoes] = useState<TransacaoCondicional[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<TransacaoCondicional | null>(null)
  const [transacoesExpandidas, setTransacoesExpandidas] = useState<Set<string>>(new Set())

  // Estados de filtro
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'resolvido' | 'cancelado'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'recebido' | 'enviado'>('todos')
  const [transacoesFiltradas, setTransacoesFiltradas] = useState<TransacaoCondicional[]>([])

  useEffect(() => {
    carregarCategorias()
    carregarTransacoes()
  }, [])

  useEffect(() => {
    aplicarFiltros()
  }, [transacoes, filtroOrigem, filtroDataInicio, filtroDataFim, filtroStatus, filtroTipo])

  const aplicarFiltros = () => {
    let resultado = [...transacoes]

    if (filtroOrigem) {
      resultado = resultado.filter(t =>
        t.origem.toLowerCase().includes(filtroOrigem.toLowerCase())
      )
    }

    if (filtroDataInicio) {
      resultado = resultado.filter(t => t.data_transacao >= filtroDataInicio)
    }

    if (filtroDataFim) {
      resultado = resultado.filter(t => t.data_transacao <= filtroDataFim)
    }

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(t => t.status === filtroStatus)
    }

    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(t => t.tipo === filtroTipo)
    }

    setTransacoesFiltradas(resultado)
  }

  const limparFiltros = () => {
    setFiltroOrigem('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroStatus('todos')
    setFiltroTipo('todos')
  }

  const gerarPDF = () => {
    if (transacoesFiltradas.length === 0) {
      alert('❌ Nenhuma transação para gerar PDF com os filtros aplicados')
      return
    }

    try {
      const gerador = new GeradorPDFLancamentos()
      const lancamentos = transacoesFiltradas.map(t => ({
        descricao: `${t.tipo.toUpperCase()} - ${t.origem}`,
        valor: t.itens.reduce((sum, item) => sum + (item.quantidade * item.preco_custo), 0),
        tipo: t.tipo === 'recebido' ? 'entrada' : 'saida',
        data_lancamento: t.data_transacao,
        status: t.status,
        parcelas: `${t.itens.length} itens`
      }))

      gerador.gerarPDFTransacoesLoja(lancamentos, 'Transações Condicionais')
      alert('✅ PDF gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('❌ Erro ao gerar PDF')
    }
  }

  const toggleTransacao = (id: string) => {
    const novasExpandidas = new Set(transacoesExpandidas)
    if (novasExpandidas.has(id)) {
      novasExpandidas.delete(id)
    } else {
      novasExpandidas.add(id)
    }
    setTransacoesExpandidas(novasExpandidas)
  }

  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_estoque')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setCategorias(data || [])
      if (data && data.length > 0) {
        setItens((prev) => [{ ...prev[0], categoria: data[0].nome }])
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  const carregarTransacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('transacoes_condicionais')
        .select(`
          *,
          itens_condicionais (
            *,
            produtos (descricao, categoria)
          )
        `)
        .order('data_transacao', { ascending: false })

      if (error) throw error

      const transacoesFormatadas = data?.map((t: any) => ({
        id: t.id,
        numero_transacao: t.numero_transacao,
        tipo: t.tipo,
        origem: t.origem,
        data_transacao: t.data_transacao,
        observacao: t.observacao,
        status: t.status,
        itens: t.itens_condicionais?.map((i: any) => ({
          id: i.id,
          produto_id: i.produto_id,
          descricao: i.produtos?.descricao || '',
          quantidade: i.quantidade,
          categoria: i.produtos?.categoria || '',
          status: i.status,
          valor_efetivado: i.valor_efetivado,
          preco_custo: 0,
          preco_venda: 0,
        })) || [],
      })) || []

      setTransacoes(transacoesFormatadas)
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
      setErro('Erro ao carregar transações condicionais')
    }
  }

  const adicionarItem = () => {
    setItens((prev) =>
      prev.map((item, idx) => (idx === prev.length - 1 ? { ...item, minimizado: true } : item))
    )

    setItens((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        produto_id: null,
        descricao: '',
        quantidade: 1,
        categoria: categorias[0]?.nome || '',
        preco_custo: 0,
        preco_venda: 0,
        status: 'pendente',
        minimizado: false,
        isNovoCadastro: true,
      },
    ])
  }

  const atualizarItem = (id: string, campo: string, valor: any) => {
    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
    )
  }

  const removerItem = (id: string) => {
    if (itens.length === 1) {
      alert('❌ Você precisa ter pelo menos um item na transação')
      return
    }
    setItens((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSelecionarProduto = (produto: any, itemId: string) => {
    atualizarItem(itemId, 'produto_id', produto.id)
    atualizarItem(itemId, 'descricao', produto.descricao)
    atualizarItem(itemId, 'categoria', produto.categoria)
    atualizarItem(itemId, 'preco_custo', produto.preco_custo)
    atualizarItem(itemId, 'preco_venda', produto.preco_venda)
    atualizarItem(itemId, 'isNovoCadastro', false)
  }

  const registrarTransacao = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!origem.trim()) {
      alert('❌ Informe a origem da transação')
      return
    }

    if (itens.some((item) => !item.descricao.trim())) {
      alert('❌ Todos os itens precisam ter uma descrição')
      return
    }

    setLoading(true)

    try {
      // Gerar numero_transacao sequencial
      const { data: ultimaTransacao } = await supabase
        .from('transacoes_condicionais')
        .select('numero_transacao')
        .order('numero_transacao', { ascending: false })
        .limit(1)
        .single()

      const proximoNumero = (ultimaTransacao?.numero_transacao || 0) + 1

      const { data: transacao, error: erroTransacao } = await supabase
        .from('transacoes_condicionais')
        .insert({
          numero_transacao: proximoNumero,
          tipo,
          origem,
          data_transacao: dataTransacao,
          observacao,
          status: 'pendente',
        })
        .select()
        .single()

      if (erroTransacao) throw erroTransacao

      for (const item of itens) {
        const { error: erroItem } = await supabase
          .from('itens_condicionais')
          .insert({
            transacao_id: transacao.id,
            produto_id: item.produto_id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            categoria: item.categoria,
            preco_custo: item.preco_custo,
            preco_venda: item.preco_venda,
            status: 'pendente',
          })

        if (erroItem) throw erroItem
      }

      alert('✅ Transação registrada com sucesso!')
      setOrigem('')
      setObservacao('')
      setDataTransacao(getDataAtualBrasil())
      setItens([
        {
          id: Date.now().toString(),
          produto_id: null,
          descricao: '',
          quantidade: 1,
          categoria: categorias[0]?.nome || '',
          preco_custo: 0,
          preco_venda: 0,
          status: 'pendente',
          minimizado: false,
          isNovoCadastro: false,
        },
      ])

      carregarTransacoes()
    } catch (error) {
      console.error('Erro ao registrar transação:', error)
      setErro('Erro ao registrar transação')
      alert('❌ Erro ao registrar transação')
    } finally {
      setLoading(false)
    }
  }

  const resolverTransacao = async (transacao: TransacaoCondicional) => {
    setTransacaoSelecionada(transacao)
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolvido':
        return 'bg-green-100 text-green-800'
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelado':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* COLUNA ESQUERDA: FORMULÁRIO */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-md p-3 space-y-3">
          <h2 className="text-sm font-semibold text-purple-800">Registrar Transação Condicional</h2>

          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs">
              {erro}
            </div>
          )}

          <form onSubmit={registrarTransacao} className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Transação *</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'recebido' | 'enviado')}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="recebido">📥 Recebido</option>
                <option value="enviado">📤 Enviado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Origem/Fornecedor *</label>
              <input
                type="text"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data da Transação *</label>
              <input
                type="date"
                value={dataTransacao}
                onChange={(e) => setDataTransacao(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Notas adicionais..."
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                rows={2}
              />
            </div>

            <div className="border-t pt-2">
              <p className="text-xs font-semibold text-gray-700 mb-2">Itens ({itens.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {itens.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-2 border rounded ${
                      item.minimizado ? 'bg-gray-50' : 'bg-white border-purple-200'
                    }`}
                  >
                    {item.minimizado ? (
                      <button
                        type="button"
                        onClick={() => atualizarItem(item.id, 'minimizado', false)}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        ▶ Item {idx + 1}: {item.descricao || 'Sem descrição'}
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-700">Item {idx + 1}</span>
                          {itens.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removerItem(item.id)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {item.produto_id ? (
                          <div>
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                              Produto Selecionado
                            </label>
                            <input
                              type="text"
                              value={item.descricao}
                              disabled
                              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => atualizarItem(item.id, 'produto_id', null)}
                              className="text-xs text-blue-600 hover:text-blue-800 mt-0.5"
                            >
                              Trocar Produto
                            </button>
                          </div>
                        ) : (
                          <SeletorProduto
                            onSelecionarProduto={(produto) => handleSelecionarProduto(produto, item.id)}
                          />
                        )}

                        {!item.produto_id && (
                          <div>
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                              Descrição do Produto *
                            </label>
                            <input
                              type="text"
                              value={item.descricao}
                              onChange={(e) => atualizarItem(item.id, 'descricao', e.target.value)}
                              placeholder="Nome do novo produto"
                              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded"
                              required
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                            Categoria *
                          </label>
                          {!item.isNovoCadastro ? (
                            <input
                              type="text"
                              value={item.categoria}
                              disabled
                              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-gray-100"
                            />
                          ) : (
                            <select
                              value={item.categoria}
                              onChange={(e) => atualizarItem(item.id, 'categoria', e.target.value)}
                              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded"
                              required
                            >
                              <option value="">Selecione uma categoria</option>
                              {categorias.map((cat) => (
                                <option key={cat.id} value={cat.nome}>
                                  {cat.nome}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                              Quantidade *
                            </label>
                            <input
                              type="number"
                              value={item.quantidade}
                              onChange={(e) =>
                                atualizarItem(item.id, 'quantidade', parseInt(e.target.value) || 0)
                              }
                              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                              Preço Custo (R$) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.preco_custo}
                              onChange={(e) =>
                                atualizarItem(item.id, 'preco_custo', parseFloat(e.target.value) || 0)
                              }
                              placeholder="0.00"
                              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded"
                              required={item.isNovoCadastro}
                              disabled={!item.isNovoCadastro && !item.produto_id}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => atualizarItem(item.id, 'minimizado', true)}
                          className="w-full text-xs text-gray-600 hover:text-gray-800 py-1"
                        >
                          ▼ Minimizar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={adicionarItem}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-1 rounded font-medium text-xs"
            >
              + Adicionar Item
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-1.5 rounded font-semibold text-xs"
            >
              {loading ? 'Registrando...' : 'Registrar Transação'}
            </button>
          </form>
        </div>
      </div>

      {/* COLUNA DIREITA: TRANSAÇÕES COM FILTRO */}
      <div className="lg:col-span-2">
        <div className="space-y-3">
          {/* FILTRO MINIMIZADO */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <button
              onClick={() => setFiltroAberto(!filtroAberto)}
              className="w-full px-3 py-2 flex justify-between items-center hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-800">🔍 Filtros</span>
              <span className="text-xs text-gray-600">{filtroAberto ? '▲' : '▼'}</span>
            </button>

            {filtroAberto && (
              <div className="p-3 border-t border-gray-200">
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Origem</label>
                    <input
                      type="text"
                      value={filtroOrigem}
                      onChange={(e) => setFiltroOrigem(e.target.value)}
                      placeholder="Filtrar..."
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
                    <input
                      type="date"
                      value={filtroDataInicio}
                      onChange={(e) => setFiltroDataInicio(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
                    <input
                      type="date"
                      value={filtroDataFim}
                      onChange={(e) => setFiltroDataFim(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value as any)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="todos">Todos</option>
                      <option value="pendente">Pendente</option>
                      <option value="resolvido">Resolvido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value as any)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="todos">Todos</option>
                      <option value="recebido">Recebido</option>
                      <option value="enviado">Enviado</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={limparFiltros}
                    className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={gerarPDF}
                    className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                  >
                    📄 PDF
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* TRANSAÇÕES */}
          <div className="bg-white rounded-lg shadow-md p-3">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">Transações Condicionais</h2>

            {transacoesFiltradas.length === 0 ? (
              <p className="text-gray-600 text-xs">📭 Nenhuma transação encontrada</p>
            ) : (
              <div className="space-y-2">
                {transacoesFiltradas.map((transacao) => {
                  const expandida = transacoesExpandidas.has(transacao.id)

                  return (
                    <div
                      key={transacao.id}
                      className={`border rounded overflow-hidden hover:border-purple-300 transition-colors ${
                        transacao.status === 'resolvido' ? 'border-green-300' : 'border-gray-200'
                      }`}
                    >
                      <div
                        onClick={() => toggleTransacao(transacao.id)}
                        className={`p-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                          transacao.status === 'resolvido' ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">#{transacao.numero_transacao}</span>
                              <span className="text-xs text-gray-600">{transacao.origem}</span>
                              <span className="text-xs text-gray-500">{formatarData(transacao.data_transacao)}</span>
                              {transacao.status === 'resolvido' && (
                                <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded">
                                  ✓ Resolvido
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-600">
                                {transacao.tipo === 'recebido' ? '📥 Recebido' : '📤 Enviado'}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {transacao.itens?.length || 0} {transacao.itens?.length === 1 ? 'item' : 'itens'}
                              </span>
                            </div>
                          </div>
                          <div className="text-gray-400 text-xs">
                            {expandida ? '▼' : '▶'}
                          </div>
                        </div>
                      </div>

                      {expandida && (
                        <div className="p-2 bg-white border-t border-gray-200">
                          {transacao.observacao && (
                            <p className="text-xs text-gray-600 mb-2">
                              <span className="font-medium">Obs:</span> {transacao.observacao}
                            </p>
                          )}

                          <div className="border-t pt-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Itens:</p>
                            <div className="space-y-1">
                              {transacao.itens.map((item) => (
                                <div key={item.id} className="bg-gray-50 p-1.5 rounded text-xs">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-800 text-[10px]">
                                        {item.descricao}
                                        {transacao.status === 'resolvido' && (
                                          <span className={`ml-1 ${
                                            item.status === 'efetivado' ? 'text-green-600' : 'text-orange-600'
                                          }`}>
                                            ({item.status === 'efetivado' ? 'Efetivado' : 'Devolvido'})
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-[9px] text-gray-600">
                                        Qtd: {item.quantidade}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
