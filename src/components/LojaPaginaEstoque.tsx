'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarProduto from './ModalEditarProduto'
import ModalLogProduto from './ModalLogProduto'
import { GeradorPDF, obterConfigLogos } from '@/lib/gerador-pdf-utils'
import { formatarDataParaExibicao } from '@/lib/dateUtils' // ADICIONADO: Importação corrigida

interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  quantidade_condicional?: number
  preco_custo: number
  valor_repasse: number
  preco_venda: number
  data_ultima_compra: string
  status_item?: string
  categoria?: string
}

type OrdenacaoTipo = 'descricao' | 'preco_venda' | 'categoria' | 'quantidade'
type OrdenacaoDirecao = 'asc' | 'desc'

export default function LojaPaginaEstoque() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([])
  const [produtosCondicionais, setProdutosCondicionais] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [modalLogAberto, setModalLogAberto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  
  // Estados de filtro
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'resolvido' | 'condicional'>('todos')
  
  // Estados de ordenação
  const [ordenacaoPor, setOrdenacaoPor] = useState<OrdenacaoTipo>('descricao')
  const [ordenacaoDirecao, setOrdenacaoDirecao] = useState<OrdenacaoDirecao>('asc')

  useEffect(() => {
    carregarProdutos()
  }, [])

  useEffect(() => {
    aplicarFiltrosEOrdenacao()
  }, [produtos, filtroDescricao, filtroCodigo, filtroStatus, ordenacaoPor, ordenacaoDirecao])

  const carregarProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao', { ascending: true })

      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setLoading(false)
    }
  }

  const aplicarFiltrosEOrdenacao = () => {
    let resultado = [...produtos]

    // TAREFA 2.1: Aplicar prioridade de ordenação: saldo positivo → negativo → zerado
    resultado.sort((a, b) => {
      const qtdA = (a.quantidade || 0)
      const qtdB = (b.quantidade || 0)

      // Positivo vem primeiro
      if (qtdA > 0 && qtdB <= 0) return -1
      if (qtdA <= 0 && qtdB > 0) return 1

      // Negativo vem antes de zerado
      if (qtdA < 0 && qtdB === 0) return -1
      if (qtdA === 0 && qtdB < 0) return 1

      return 0
    })

    if (filtroDescricao) {
      resultado = resultado.filter(p => 
        p.descricao.toLowerCase().includes(filtroDescricao.toLowerCase())
      )
    }

    if (filtroCodigo) {
      resultado = resultado.filter(p => 
        p.codigo.toLowerCase().includes(filtroCodigo.toLowerCase())
      )
    }

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(p => 
        (p.status_item || 'resolvido') === filtroStatus
      )
    }

    // Aplicar ordenação adicional
    resultado.sort((a, b) => {
      let comparacao = 0

      switch (ordenacaoPor) {
        case 'descricao':
          comparacao = a.descricao.localeCompare(b.descricao)
          break
        case 'preco_venda':
          comparacao = (a.preco_venda || 0) - (b.preco_venda || 0)
          break
        case 'categoria':
          comparacao = (a.categoria || '').localeCompare(b.categoria || '')
          break
        case 'quantidade':
          comparacao = (a.quantidade || 0) - (b.quantidade || 0)
          break
      }

      return ordenacaoDirecao === 'asc' ? comparacao : -comparacao
    })

    setProdutosFiltrados(resultado)
    
    // Separar produtos condicionais
    const condicionais = resultado.filter(p => (p.status_item || 'resolvido') === 'condicional')
    setProdutosCondicionais(condicionais)
  }

  // CORREÇÃO: Funções para calcular os novos valores do estoque
  const calcularValorRealizadoVenda = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'resolvido') {
        const preco = produto.preco_venda || 0
        return total + (produto.quantidade || 0) * preco
      }
      return total
    }, 0)
  }

  const calcularValorRealizadoRepasse = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'resolvido') {
        const repasse = produto.valor_repasse || 0
        return total + (produto.quantidade || 0) * repasse
      }
      return total
    }, 0)
  }

  const calcularValorCondicionalVenda = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'condicional') {
        const preco = produto.preco_venda || 0
        const qtdCondicional = produto.quantidade_condicional || produto.quantidade || 0
        return total + qtdCondicional * preco
      }
      return total
    }, 0)
  }

  const calcularValorCondicionalRepasse = () => {
    return produtosFiltrados.reduce((total, produto) => {
      if ((produto.status_item || 'resolvido') === 'condicional') {
        const repasse = produto.valor_repasse || 0
        const qtdCondicional = produto.quantidade_condicional || produto.quantidade || 0
        return total + qtdCondicional * repasse
      }
      return total
    }, 0)
  }

  const calcularQuantidadeCondicional = (produto: Produto) => {
    if ((produto.status_item || 'resolvido') === 'condicional') {
      return produto.quantidade_condicional || produto.quantidade || 0
    }
    return 0
  }

  const calcularQuantidadeEfetiva = (produto: Produto) => {
    if ((produto.status_item || 'resolvido') === 'resolvido') {
      return produto.quantidade || 0
    }
    return 0
  }

  const limparFiltros = () => {
    setFiltroDescricao('')
    setFiltroCodigo('')
    setFiltroStatus('todos')
  }

  const alternarOrdenacao = (campo: OrdenacaoTipo) => {
    if (ordenacaoPor === campo) {
      setOrdenacaoDirecao(ordenacaoDirecao === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenacaoPor(campo)
      setOrdenacaoDirecao('asc')
    }
  }

  const abrirModalEditar = (produto: Produto) => {
    setProdutoSelecionado(produto)
    setModalEditarAberto(true)
  }

  const abrirModalLog = (produto: Produto) => {
    setProdutoSelecionado(produto)
    setModalLogAberto(true)
  }

  const fecharModais = () => {
    setModalEditarAberto(false)
    setModalLogAberto(false)
    setProdutoSelecionado(null)
  }

  const handleProdutoAtualizado = () => {
    carregarProdutos()
    fecharModais()
  }

  const gerarPDF = () => {
    try {
      const logoConfig = obterConfigLogos()
      
      const itens = produtosFiltrados.map(produto => ({
        codigo: produto.codigo,
        descricao: produto.descricao,
        quantidade: produto.quantidade,
        valorUnitario: produto.preco_venda || 0,
        valorTotal: (produto.quantidade || 0) * (produto.preco_venda || 0),
        categoria: produto.categoria || 'Sem categoria',
        status: produto.status_item || 'resolvido',
      }))
      
      const filtrosAplicados = []
      if (filtroDescricao) filtrosAplicados.push(`Descrição: ${filtroDescricao}`)
      if (filtroCodigo) filtrosAplicados.push(`Código: ${filtroCodigo}`)
      if (filtroStatus !== 'todos') filtrosAplicados.push(`Status: ${filtroStatus}`)
      
      const dadosPDF = {
        tipo: 'estoque' as const,
        data: new Date().toISOString(),
        itens,
        total: calcularValorRealizadoVenda(),
        filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined,
        observacoes: 'Relatório de estoque gerado automaticamente pelo sistema LUCIUS.',
      }
      
      const gerador = new GeradorPDF(logoConfig)
      gerador.gerarOrdemCompra(dadosPDF)
      
      const nomeArquivo = `estoque_${new Date().toISOString().split('T')[0]}.pdf`
      gerador.salvar(nomeArquivo)
      
      alert('✅ PDF gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('❌ Erro ao gerar PDF. Verifique o console para mais detalhes.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-2 rounded-lg shadow-md text-center">
        <p className="text-gray-600 text-xs">Carregando estoque...</p>
      </div>
    )
  }

  const IconeOrdenacao = ({ campo }: { campo: OrdenacaoTipo }) => {
    if (ordenacaoPor !== campo) return <span className="text-gray-400 text-[10px]">⇅</span>
    return ordenacaoDirecao === 'asc' ? 
      <span className="text-blue-600 text-[10px]">↑</span> : 
      <span className="text-blue-600 text-[10px]">↓</span>
  }

  return (
    <div className="space-y-2">
      {/* FILTRO MINIMIZADO NO TOPO */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => setFiltroAberto(!filtroAberto)}
          className="w-full px-2 py-1.5 flex justify-between items-center hover:bg-gray-50 transition-colors"
        >
          <span className="text-xs font-semibold text-gray-800">🔍 Filtros e Ordenação</span>
          <span className="text-xs text-gray-600">{filtroAberto ? '▲' : '▼'}</span>
        </button>
        
        {filtroAberto && (
          <div className="p-2 border-t border-gray-200">
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Descrição</label>
                <input
                  type="text"
                  value={filtroDescricao}
                  onChange={(e) => setFiltroDescricao(e.target.value)}
                  placeholder="Filtrar por descrição"
                  className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Código</label>
                <input
                  type="text"
                  value={filtroCodigo}
                  onChange={(e) => setFiltroCodigo(e.target.value)}
                  placeholder="Filtrar por código"
                  className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Status</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value as any)}
                  className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs"
                >
                  <option value="todos">Todos</option>
                  <option value="resolvido">Resolvido</option>
                  <option value="condicional">Condicional</option>
                </select>
              </div>

              <div className="flex items-end gap-1">
                <button
                  onClick={limparFiltros}
                  className="px-2 py-0.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                >
                  Limpar
                </button>
                <button
                  onClick={gerarPDF}
                  className="px-2 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  📄 PDF
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-600">
              <strong>Ordenar por:</strong>
              <div className="flex gap-1 mt-1 flex-wrap">
                <button
                  onClick={() => alternarOrdenacao('descricao')}
                  className={`px-2 py-0.5 rounded text-xs ${ordenacaoPor === 'descricao' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  Descrição <IconeOrdenacao campo="descricao" />
                </button>
                <button
                  onClick={() => alternarOrdenacao('preco_venda')}
                  className={`px-2 py-0.5 rounded text-xs ${ordenacaoPor === 'preco_venda' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  Preço <IconeOrdenacao campo="preco_venda" />
                </button>
                <button
                  onClick={() => alternarOrdenacao('categoria')}
                  className={`px-2 py-0.5 rounded text-xs ${ordenacaoPor === 'categoria' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  Categoria <IconeOrdenacao campo="categoria" />
                </button>
                <button
                  onClick={() => alternarOrdenacao('quantidade')}
                  className={`px-2 py-0.5 rounded text-xs ${ordenacaoPor === 'quantidade' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  Quantidade <IconeOrdenacao campo="quantidade" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cabeçalho com Botão e Valores do Estoque - COMPACTO */}
      <div className="bg-white rounded-lg shadow-md p-2">
        <div className="flex justify-between items-start mb-2">
          <button
            onClick={() => {
              setProdutoSelecionado(null)
              setModalEditarAberto(true)
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
          >
            + Cadastrar Item
          </button>

          <div className="text-right">
            <p className="text-[9px] text-gray-600">Total de Produtos</p>
            <p className="text-base font-bold text-gray-800">
              {produtosFiltrados.length} {produtosFiltrados.length === 1 ? 'produto' : 'produtos'}
            </p>
          </div>
        </div>

        {/* NOVO: Quadro de Valores do Estoque */}
        <div className="mt-2 border-t pt-2">
          <p className="text-xs font-semibold text-gray-800 mb-1">VALOR EM ESTOQUE</p>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Coluna Esquerda - Realizado (Destaque Principal) */}
            <div className="space-y-1">
              <div className="bg-green-50 border border-green-300 rounded p-1 shadow-sm">
                <p className="text-[9px] text-green-800 font-medium">Realizado (Venda)</p>
                <p className="text-lg font-bold text-green-700">
                  R$ {calcularValorRealizadoVenda().toFixed(2)}
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-300 rounded p-1">
                <p className="text-[9px] text-blue-800 font-medium">Realizado (Repasse)</p>
                <p className="text-sm font-semibold text-blue-700">
                  R$ {calcularValorRealizadoRepasse().toFixed(2)}
                </p>
              </div>
            </div>
            
            {/* Coluna Direita - Condicional (Menor Destaque) */}
            <div className="space-y-1">
              <div className="bg-yellow-50 border border-yellow-300 rounded p-1">
                <p className="text-[9px] text-yellow-800 font-medium">Condicional (Venda)</p>
                <p className="text-sm font-semibold text-yellow-700">
                  R$ {calcularValorCondicionalVenda().toFixed(2)}
                </p>
              </div>
              
              <div className="bg-orange-50 border border-orange-300 rounded p-1">
                <p className="text-[9px] text-orange-800 font-medium">Condicional (Repasse)</p>
                <p className="text-sm font-semibold text-orange-700">
                  R$ {calcularValorCondicionalRepasse().toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Estoque */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {produtosFiltrados.length === 0 ? (
          <div className="p-2 text-center text-gray-500">
            <p className="text-xs">Nenhum produto encontrado com os filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-1.5 py-1 text-left font-semibold text-gray-700 text-[11px]">Código</th>
                  <th className="px-1.5 py-1 text-left font-semibold text-gray-700 text-[11px]">Descrição</th>
                  <th className="px-1.5 py-1 text-center font-semibold text-gray-700 text-[11px]">Categoria</th>
                  <th className="px-1.5 py-1 text-center font-semibold text-gray-700 text-[11px]">Status</th>
                  <th className="px-1.5 py-1 text-center font-semibold text-gray-700 text-[11px]">Qtd Cond.</th>
                  <th className="px-1.5 py-1 text-center font-semibold text-gray-700 text-[11px]">Qtd Efet.</th>
                  <th className="px-1.5 py-1 text-right font-semibold text-gray-700 text-[11px]">Custo</th>
                  <th className="px-1.5 py-1 text-right font-semibold text-gray-700 text-[11px]">Repasse</th>
                  <th className="px-1.5 py-1 text-right font-semibold text-gray-700 text-[11px]">Venda</th>
                  <th className="px-1.5 py-1 text-left font-semibold text-gray-700 text-[11px]">Ult. Compra</th>
                  <th className="px-1.5 py-1 text-center font-semibold text-gray-700 text-[11px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((produto) => {
                  const qtdCondicional = calcularQuantidadeCondicional(produto)
                  const qtdEfetiva = calcularQuantidadeEfetiva(produto)
                  const temEstoqueNegativo = qtdEfetiva < 0

                  return (
                    <tr
                      key={produto.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        temEstoqueNegativo ? 'bg-red-50' : (produto.status_item || 'resolvido') === 'condicional' ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-1.5 py-1 text-gray-800 font-medium text-xs">{produto.codigo}</td>
                      <td className="px-1.5 py-1 text-gray-800 text-xs">{produto.descricao}</td>
                      <td className="px-1.5 py-1 text-center text-xs">
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[9px] font-medium">
                          {produto.categoria || 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-1.5 py-1 text-center">
                        <span className={`inline-block px-1 py-0.5 rounded-full font-medium text-[9px] ${
                          (produto.status_item || 'resolvido') === 'resolvido' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(produto.status_item || 'resolvido') === 'resolvido' ? '✓ Res.' : '⏳ Cond.'}
                        </span>
                      </td>
                      <td className={`px-1.5 py-1 text-center font-semibold text-xs ${
                        qtdCondicional > 0 ? 'bg-yellow-100 text-yellow-800' : 'text-gray-500'
                      }`}>
                        {qtdCondicional}
                      </td>
                      <td className={`px-1.5 py-1 text-center font-semibold text-xs ${
                        temEstoqueNegativo ? 'bg-red-200 text-red-900 font-bold' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {qtdEfetiva}
                      </td>
                      <td className="px-1.5 py-1 text-right text-gray-700 text-xs">
                        R$ {produto.preco_custo.toFixed(2)}
                      </td>
                      <td className="px-1.5 py-1 text-right text-gray-700 text-xs">
                        R$ {(Number(produto.valor_repasse) || 0).toFixed(2)}
                      </td>
                      <td className="px-1.5 py-1 text-right text-gray-700 font-semibold text-xs">
                        R$ {(Number(produto.preco_venda) || 0).toFixed(2)}
                      </td>
                      <td className="px-1.5 py-1 text-gray-600 text-xs">
                        {/* CORREÇÃO: Usar formatarDataParaExibicao para data correta */}
                        {formatarDataParaExibicao(produto.data_ultima_compra)}
                      </td>
                      <td className="px-1.5 py-1 text-center">
                        <div className="flex gap-0.5 justify-center">
                          <button
                            onClick={() => abrirModalEditar(produto)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors"
                            title="Editar produto"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => abrirModalLog(produto)}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors"
                            title="Ver log de entradas e saídas"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      {modalEditarAberto && (
        <ModalEditarProduto
          produto={produtoSelecionado}
          onClose={fecharModais}
          onSave={handleProdutoAtualizado}
        />
      )}

      {modalLogAberto && produtoSelecionado && (
        <ModalLogProduto produto={produtoSelecionado} onClose={fecharModais} />
      )}
    </div>
  )
}