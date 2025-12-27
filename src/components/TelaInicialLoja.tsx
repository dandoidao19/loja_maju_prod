'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao, getDataAtualBrasil } from '@/lib/dateUtils'
import FiltrosLancamentos from './FiltrosLancamentos'
import VisualizacaoCaixaDetalhada from './VisualizacaoCaixaDetalhada'
import ModalPagarTransacao from './ModalPagarTransacao'
import ModalEstornarTransacao from './ModalEstornarTransacao'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { GeradorPDF, obterConfigLogos } from '@/lib/gerador-pdf-utils'

interface Transacao {
  id: string
  numero_transacao: number
  data: string
  data_pagamento?: string
  data_original?: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  valor_pago?: number
  juros_descontos?: number
  status_pagamento: string
  quantidade_parcelas: number
  cliente_fornecedor?: string
  parcela_numero?: number
  parcela_total?: number
  transacao_principal_id?: string
  origem_id?: string
}

interface CacheVendaCompra {
  [key: string]: {
    numero_transacao: number
    quantidade_parcelas: number
    timestamp: number
  }
}

// CACHE GLOBAL - Compartilhado entre todas as instâncias
let cacheGlobalTransacoes: Transacao[] = []
let cacheGlobalUltimaAtualizacao: number = 0
const CACHE_TEMPO_VIDA = 30000 // 30 segundos

export default function TelaInicialLoja() {
  const [transacoes, setTransacoes] = useState<Transacao[]>(cacheGlobalTransacoes)
  const [transacoesFiltradas, setTransacoesFiltradas] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(false)
  const [verTodas, setVerTodas] = useState(false)
  
  const cacheVendasRef = useRef<CacheVendaCompra>({})
  const cacheComprasRef = useRef<CacheVendaCompra>({})
  const ultimaBuscaRef = useRef<number>(cacheGlobalUltimaAtualizacao)
  const buscaEmAndamentoRef = useRef<boolean>(false)

  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroNumeroTransacao, setFiltroNumeroTransacao] = useState('')
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const [modalPagarTransacao, setModalPagarTransacao] = useState<{
    aberto: boolean
    transacao: Transacao | null
  }>({
    aberto: false,
    transacao: null
  })

  const [modalEstornarTransacao, setModalEstornarTransacao] = useState<{
    aberto: boolean
    transacao: Transacao | null
  }>({
    aberto: false,
    transacao: null
  })

  const { dados, atualizarCaixaReal } = useDadosFinanceiros()

  const limparCacheAntigo = useCallback(() => {
    const agora = Date.now()
    const cincoMinutos = 5 * 60 * 1000
    
    Object.keys(cacheVendasRef.current).forEach(key => {
      if (agora - cacheVendasRef.current[key].timestamp > cincoMinutos) {
        delete cacheVendasRef.current[key]
      }
    })
    
    Object.keys(cacheComprasRef.current).forEach(key => {
      if (agora - cacheComprasRef.current[key].timestamp > cincoMinutos) {
        delete cacheComprasRef.current[key]
      }
    })
  }, [])

  const buscarVendaCache = useCallback(async (cliente: string, origem_id?: string) => {
    const cacheKey = `${cliente}-${origem_id || ''}`
    
    const cached = cacheVendasRef.current[cacheKey]
    if (cached && (Date.now() - cached.timestamp < 30000)) {
      return cached
    }

    try {
      let query = supabase
        .from('vendas')
        .select('numero_transacao, quantidade_parcelas')
        .ilike('cliente', `%${cliente}%`)
        .order('data_venda', { ascending: false })

      if (origem_id) {
        query = query.eq('origem_id', origem_id)
      }

      const { data } = await query.limit(1).maybeSingle()
      
      if (data) {
        cacheVendasRef.current[cacheKey] = {
          numero_transacao: data.numero_transacao,
          quantidade_parcelas: data.quantidade_parcelas,
          timestamp: Date.now()
        }
      }
      
      return data
    } catch (error) {
      console.error(`❌ Erro ao buscar venda cache para ${cliente}:`, error)
      return null
    }
  }, [])

  const buscarCompraCache = useCallback(async (fornecedor: string, origem_id?: string) => {
    const cacheKey = `${fornecedor}-${origem_id || ''}`
    
    const cached = cacheComprasRef.current[cacheKey]
    if (cached && (Date.now() - cached.timestamp < 30000)) {
      return cached
    }

    try {
      let query = supabase
        .from('compras')
        .select('numero_transacao, quantidade_parcelas')
        .ilike('fornecedor', `%${fornecedor}%`)
        .order('data_compra', { ascending: false })

      if (origem_id) {
        query = query.eq('origem_id', origem_id)
      }

      const { data } = await query.limit(1).maybeSingle()
      
      if (data) {
        cacheComprasRef.current[cacheKey] = {
          numero_transacao: data.numero_transacao,
          quantidade_parcelas: data.quantidade_parcelas,
          timestamp: Date.now()
        }
      }
      
      return data
    } catch (error) {
      console.error(`❌ Erro ao buscar compra cache para ${fornecedor}:`, error)
      return null
    }
  }, [])

  const processarTransacoesBatch = useCallback(async (transacoesLoja: any[]) => {
    if (!transacoesLoja || transacoesLoja.length === 0) return []

    const transacoesVenda: any[] = []
    const transacoesCompra: any[] = []
    
    transacoesLoja.forEach(trans => {
      if (trans.tipo === 'entrada') {
        transacoesVenda.push(trans)
      } else {
        transacoesCompra.push(trans)
      }
    })

    // Extrair nomes de forma segura
    const extrairNome = (descricao: string) => {
      const matchCompraComNumero = descricao.match(/Compra #(\d+)\s+(.+?)\s+\((\d+)\/(\d+)\)/)
      const matchCompraAntiga = descricao.match(/Compra\s+(.+?)\s+\((\d+)\/(\d+)\)/)
      const matchVenda = descricao.match(/Venda\s+(.+?)\s+\((\d+)\/(\d+)\)/)
      
      if (matchCompraComNumero) {
        return matchCompraComNumero[2].trim()
      } else if (matchCompraAntiga) {
        return matchCompraAntiga[1].trim()
      } else if (matchVenda) {
        return matchVenda[1].trim()
      } else {
        // Remove prefixo e sufixo de parcela
        let nome = descricao.replace(/^(Compra|Venda)\s+/, '')
        nome = nome.replace(/\s*\(\d+\/\d+\)/, '')
        return nome.trim()
      }
    }

    const clientesVenda = [...new Set(transacoesVenda.map(t => extrairNome(t.descricao)))].filter(Boolean)
    const fornecedoresCompra = [...new Set(transacoesCompra.map(t => extrairNome(t.descricao)))].filter(Boolean)
    
    const vendasCache: Record<string, any> = {}
    const comprasCache: Record<string, any> = {}

    // Buscar caches em paralelo
    await Promise.all([
      ...clientesVenda.map(async (cliente) => {
        const venda = await buscarVendaCache(cliente)
        if (venda) {
          vendasCache[cliente] = venda
        }
      }),
      ...fornecedoresCompra.map(async (fornecedor) => {
        const compra = await buscarCompraCache(fornecedor)
        if (compra) {
          comprasCache[fornecedor] = compra
        }
      })
    ])

    return transacoesLoja.map(trans => {
      let parcela_numero = 1
      let parcela_total = 1
      let nomeClienteFornecedor = extrairNome(trans.descricao)
      let numeroTransacaoPrincipal = 0
      let quantidadeParcelasPrincipal = 1

      const matchCompraComNumero = trans.descricao.match(/Compra #(\d+)\s+(.+?)\s+\((\d+)\/(\d+)\)/)
      const matchCompraAntiga = trans.descricao.match(/Compra\s+(.+?)\s+\((\d+)\/(\d+)\)/)
      const matchVenda = trans.descricao.match(/Venda\s+(.+?)\s+\((\d+)\/(\d+)\)/)

      if (trans.tipo === 'saida' && matchCompraComNumero) {
        numeroTransacaoPrincipal = parseInt(matchCompraComNumero[1])
        parcela_numero = parseInt(matchCompraComNumero[3])
        parcela_total = parseInt(matchCompraComNumero[4])
        nomeClienteFornecedor = matchCompraComNumero[2].trim()
        quantidadeParcelasPrincipal = parcela_total
      } else if (trans.tipo === 'saida' && matchCompraAntiga) {
        parcela_numero = parseInt(matchCompraAntiga[2])
        parcela_total = parseInt(matchCompraAntiga[3])
        nomeClienteFornecedor = matchCompraAntiga[1].trim()
        
        const compra = comprasCache[nomeClienteFornecedor]
        if (compra) {
          numeroTransacaoPrincipal = compra.numero_transacao
          quantidadeParcelasPrincipal = compra.quantidade_parcelas
        }
      } else if (trans.tipo === 'entrada' && matchVenda) {
        parcela_numero = parseInt(matchVenda[2])
        parcela_total = parseInt(matchVenda[3])
        nomeClienteFornecedor = matchVenda[1].trim()
        
        const venda = vendasCache[nomeClienteFornecedor]
        if (venda) {
          numeroTransacaoPrincipal = venda.numero_transacao
          quantidadeParcelasPrincipal = venda.quantidade_parcelas
        }
      } else {
        const match = trans.descricao.match(/\((\d+)\/(\d+)\)/)
        if (match) {
          parcela_numero = parseInt(match[1])
          parcela_total = parseInt(match[2])
        }

        if (trans.tipo === 'entrada') {
          const venda = vendasCache[nomeClienteFornecedor]
          if (venda) {
            numeroTransacaoPrincipal = venda.numero_transacao
            quantidadeParcelasPrincipal = venda.quantidade_parcelas
          }
        } else {
          const compra = comprasCache[nomeClienteFornecedor]
          if (compra) {
            numeroTransacaoPrincipal = compra.numero_transacao
            quantidadeParcelasPrincipal = compra.quantidade_parcelas
          }
        }
      }

      if (numeroTransacaoPrincipal === 0) {
        numeroTransacaoPrincipal = trans.numero_transacao
      }

      return {
        id: trans.id,
        numero_transacao: numeroTransacaoPrincipal,
        data: trans.data_original || trans.data,
        data_pagamento: trans.data_pagamento,
        data_original: trans.data_original || trans.data,
        tipo: trans.tipo,
        descricao: nomeClienteFornecedor || trans.descricao,
        valor: trans.total,
        valor_pago: trans.valor_pago,
        juros_descontos: trans.juros_descontos,
        status_pagamento: trans.status_pagamento,
        quantidade_parcelas: quantidadeParcelasPrincipal,
        parcela_numero,
        parcela_total: quantidadeParcelasPrincipal,
        cliente_fornecedor: nomeClienteFornecedor,
        origem_id: trans.id,
      }
    })
  }, [buscarVendaCache, buscarCompraCache])

  const buscarTransacoes = useCallback(async (forcarAtualizacao = false) => {
    if (buscaEmAndamentoRef.current) {
      return
    }

    const agora = Date.now()
    
    // VERIFICA CACHE GLOBAL - Não busca se cache ainda é válido
    if (!forcarAtualizacao && 
        cacheGlobalTransacoes.length > 0 && 
        (agora - cacheGlobalUltimaAtualizacao < CACHE_TEMPO_VIDA)) {
      console.log('📦 Usando cache global de transações')
      setTransacoes(cacheGlobalTransacoes)
      return
    }
    
    // Evita múltiplas buscas em sequência
    if (!forcarAtualizacao && agora - ultimaBuscaRef.current < 5000) {
      console.log('⏭️ Busca ignorada (muito recente)')
      return
    }

    buscaEmAndamentoRef.current = true
    setLoading(true)
    
    try {
      limparCacheAntigo()
      
      console.log('📊 Buscando transações da loja...')
      const { data: transacoesLoja, error: errorTransacoes } = await supabase
        .from('transacoes_loja')
        .select('*')
        .order('data', { ascending: true })

      if (errorTransacoes) {
        throw errorTransacoes
      }

      if (!transacoesLoja || transacoesLoja.length === 0) {
        console.log('📭 Nenhuma transação encontrada')
        setTransacoes([])
        cacheGlobalTransacoes = []
        cacheGlobalUltimaAtualizacao = agora
        return
      }

      console.log(`🔍 Processando ${transacoesLoja.length} transações...`)
      const transacoesFormatadas = await processarTransacoesBatch(transacoesLoja)
      
      console.log(`✅ ${transacoesFormatadas.length} transações processadas`)
      
      // ATUALIZA CACHE GLOBAL E ESTADO LOCAL
      setTransacoes(transacoesFormatadas)
      cacheGlobalTransacoes = transacoesFormatadas
      cacheGlobalUltimaAtualizacao = agora
      ultimaBuscaRef.current = agora
      
    } catch (error) {
      console.error('Erro ao buscar transações:', error)
    } finally {
      setLoading(false)
      buscaEmAndamentoRef.current = false
    }
  }, [limparCacheAntigo, processarTransacoesBatch])

  // Efeito inicial - busca apenas se cache expirou
  useEffect(() => {
    const agora = Date.now()
    
    // Se cache é válido, usa cache. Senão, busca.
    if (cacheGlobalTransacoes.length > 0 && 
        (agora - cacheGlobalUltimaAtualizacao < CACHE_TEMPO_VIDA)) {
      console.log('🚀 Inicializando com cache válido')
      setTransacoes(cacheGlobalTransacoes)
    } else {
      console.log('🚀 Cache expirado ou vazio, buscando...')
      buscarTransacoes()
    }
    
    // Configurar listener para atualizações em tempo real
    const channel = supabase
      .channel('transacoes-loja-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacoes_loja'
        },
        (payload) => {
          console.log('🔄 Mudança detectada na tabela transacoes_loja:', payload.eventType)
          // Forçar atualização do cache global
          cacheGlobalUltimaAtualizacao = 0
          buscarTransacoes(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [buscarTransacoes])

  const aplicarFiltros = useCallback(() => {
    let resultado = [...transacoes]

    const filtrosAplicados = 
      !!filtroNumeroTransacao || 
      !!filtroDescricao || 
      filtroTipo !== 'todos' || 
      filtroStatus !== 'todos' ||
      !!filtroDataInicio ||
      !!filtroDataFim ||
      !!filtroMes

    if (!filtrosAplicados && !verTodas) {
      const hoje = getDataAtualBrasil()
      const dataInicio = new Date(hoje)
      dataInicio.setDate(dataInicio.getDate() - 1)
      const dataFim = new Date(hoje)
      dataFim.setDate(dataFim.getDate() + 9)

      resultado = resultado.filter(transacao => {
        const dataTransacao = new Date(transacao.data)
        return dataTransacao >= dataInicio && dataTransacao <= dataFim
      })
    }

    if (filtroNumeroTransacao) {
      resultado = resultado.filter(transacao => 
        transacao.numero_transacao.toString().includes(filtroNumeroTransacao)
      )
    }

    if (filtroDescricao) {
      resultado = resultado.filter(transacao => 
        transacao.descricao.toLowerCase().includes(filtroDescricao.toLowerCase())
      )
    }

    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(transacao => {
        if (filtroTipo === 'compra') {
          return transacao.tipo === 'saida'
        } else if (filtroTipo === 'venda') {
          return transacao.tipo === 'entrada'
        }
        return true
      })
    }

    // REMOVIDO: status 'parcial' - apenas pago e pendente
    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(transacao => transacao.status_pagamento === filtroStatus)
    }

    if (filtroDataInicio && filtroDataFim) {
      resultado = resultado.filter(transacao => {
        const dataTransacao = new Date(transacao.data)
        const inicio = new Date(filtroDataInicio)
        const fim = new Date(filtroDataFim)
        return dataTransacao >= inicio && dataTransacao <= fim
      })
    }

    if (filtroMes) {
      const [ano, mes] = filtroMes.split('-')
      resultado = resultado.filter(transacao => {
        const dataTransacao = new Date(transacao.data)
        return dataTransacao.getFullYear() === parseInt(ano) && 
               (dataTransacao.getMonth() + 1) === parseInt(mes)
      })
    }

    setTransacoesFiltradas(resultado)
  }, [transacoes, filtroDataInicio, filtroDataFim, filtroMes, filtroNumeroTransacao, filtroDescricao, filtroTipo, filtroStatus, verTodas])

  useEffect(() => {
    aplicarFiltros()
  }, [aplicarFiltros])

  const gerarPDFFinanceiroFiltrado = () => {
    try {
      const logoConfig = obterConfigLogos()
      
      const transacoesPDF = transacoesFiltradas.map(transacao => ({
        vencimento: transacao.data,
        transacao: transacao.numero_transacao,
        clienteFornecedor: transacao.descricao,
        valor: transacao.valor_pago || transacao.valor,
        parcela: `${transacao.parcela_numero || 1}/${transacao.parcela_total || transacao.quantidade_parcelas || 1}`,
        tipo: transacao.tipo === 'entrada' ? 'VENDA' : 'COMPRA' as 'VENDA' | 'COMPRA',
        status: transacao.status_pagamento
      }))
      
      const totalGeral = transacoesFiltradas.reduce((total, transacao) => {
        return total + (transacao.valor_pago || transacao.valor)
      }, 0)
      
      const filtrosAplicados = []
      if (filtroNumeroTransacao) filtrosAplicados.push(`Transação: ${filtroNumeroTransacao}`)
      if (filtroDescricao) filtrosAplicados.push(`Cliente/Fornecedor: ${filtroDescricao}`)
      if (filtroTipo !== 'todos') filtrosAplicados.push(`Tipo: ${filtroTipo}`)
      if (filtroStatus !== 'todos') filtrosAplicados.push(`Status: ${filtroStatus}`)
      if (filtroDataInicio && filtroDataFim) filtrosAplicados.push(`Período: ${filtroDataInicio} até ${filtroDataFim}`)
      if (filtroMes) filtrosAplicados.push(`Mês: ${filtroMes}`)
      
      const dadosRelatorio = {
        tipo: 'financeiro' as const,
        transacoes: transacoesPDF,
        filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined,
        totalGeral
      }
      
      const gerador = new GeradorPDF(logoConfig)
      gerador.gerarRelatorioFinanceiro(dadosRelatorio)
      
      const nomeArquivo = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`
      gerador.salvar(nomeArquivo)
      
      alert(`✅ Relatório financeiro gerado com sucesso! ${transacoesFiltradas.length} transação(ões) no relatório.`)
    } catch (error) {
      console.error('Erro ao gerar relatório financeiro:', error)
      alert('❌ Erro ao gerar relatório financeiro. Verifique o console para mais detalhes.')
    }
  }

  const limparFiltros = useCallback(() => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroMes('')
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
    setVerTodas(false)
  }, [])

  const getStatusColor = useCallback((status: string) => {
    if (status === 'pago') {
      return 'bg-green-700 text-white font-bold'
    }
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getStatusLabel = useCallback((status: string) => {
    if (status === 'pago') {
      return '✓Pago'
    }
    return status.charAt(0).toUpperCase() + status.slice(1)
  }, [])

  const getTipoColor = useCallback((tipo: string) => {
    return tipo === 'entrada' ? 'bg-green-500' : 'bg-orange-500'
  }, [])

  const getTipoLabel = useCallback((tipo: string) => {
    return tipo === 'entrada' ? 'VENDA' : 'COMPRA'
  }, [])

  const getValorExibicao = useCallback((transacao: Transacao) => {
    // ✅ Retorna o valor a ser exibido: valor_pago se existir, senão valor
    return transacao.valor_pago !== undefined && transacao.valor_pago !== null 
      ? transacao.valor_pago 
      : transacao.valor
  }, [])

  const getDiferenca = useCallback((transacao: Transacao) => {
    // ✅ Calcula diferença entre valor_pago e valor
    if (transacao.valor_pago === undefined || transacao.valor_pago === null) {
      return 0
    }
    return transacao.valor_pago - transacao.valor
  }, [])

  const temPagamento = useCallback((transacao: Transacao) => {
    // ✅ Verifica se há pagamento (data_pagamento existe)
    return !!transacao.data_pagamento
  }, [])

  const handlePagamentoRealizado = useCallback(() => {
    // Invalida cache global para forçar atualização
    cacheGlobalUltimaAtualizacao = 0
    cacheGlobalTransacoes = []
    ultimaBuscaRef.current = 0
    cacheVendasRef.current = {}
    cacheComprasRef.current = {}
    atualizarCaixaReal('loja')
    buscarTransacoes(true)
  }, [atualizarCaixaReal, buscarTransacoes])

  const handleEstornoRealizado = useCallback(() => {
    // Invalida cache global para forçar atualização
    cacheGlobalUltimaAtualizacao = 0
    cacheGlobalTransacoes = []
    ultimaBuscaRef.current = 0
    cacheVendasRef.current = {}
    cacheComprasRef.current = {}
    atualizarCaixaReal('loja')
    buscarTransacoes(true)
  }, [atualizarCaixaReal, buscarTransacoes])

  const tituloLista = useMemo(() => {
    const filtrosAplicados = 
      !!filtroNumeroTransacao || 
      !!filtroDescricao || 
      filtroTipo !== 'todos' || 
      filtroStatus !== 'todos' ||
      !!filtroDataInicio ||
      !!filtroDataFim ||
      !!filtroMes

    return verTodas ? 'Todas as Parcelas' : 
           filtrosAplicados ? 'Parcelas Filtradas' : 
           'Próximas Parcelas (11 dias)'
  }, [verTodas, filtroNumeroTransacao, filtroDescricao, filtroTipo, filtroStatus, filtroDataInicio, filtroDataFim, filtroMes])

  if (loading && transacoes.length === 0) {
    return <div className="text-center py-4 text-gray-500 text-xs">Carregando...</div>
  }

  return (
    <div className="space-y-3">
      <FiltrosLancamentos
        filtroDataInicio={filtroDataInicio}
        setFiltroDataInicio={setFiltroDataInicio}
        filtroDataFim={filtroDataFim}
        setFiltroDataFim={setFiltroDataFim}
        filtroMes={filtroMes}
        setFiltroMes={setFiltroMes}
        filtroNumeroTransacao={filtroNumeroTransacao}
        setFiltroNumeroTransacao={setFiltroNumeroTransacao}
        filtroDescricao={filtroDescricao}
        setFiltroDescricao={setFiltroDescricao}
        filtroTipo={filtroTipo}
        setFiltroTipo={setFiltroTipo}
        filtroStatus={filtroStatus}
        setFiltroStatus={setFiltroStatus}
        onLimpar={limparFiltros}
        onGerarPDF={gerarPDFFinanceiroFiltrado}
        mostrarCDC={false}
        mostrarNumeroTransacao={true}
        mostrarTipo={true}
        labelsDataComoVencimento={true}
        titulo="Filtros de Financeiro"
        tipo="geral"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Caixa reduzido para 25% da largura */}
        <div className="lg:col-span-1">
          <VisualizacaoCaixaDetalhada contexto="loja" />
        </div>

        {/* Transações expandidas para 75% da largura */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-md p-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">
                {tituloLista}
                {transacoesFiltradas.length !== transacoes.length && 
                  ` (${transacoesFiltradas.length} de ${transacoes.length} filtradas)`}
              </h3>
              <button
                onClick={() => setVerTodas(!verTodas)}
                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {verTodas ? 'Próximas Parcelas' : 'Ver Todas'}
              </button>
            </div>

            {transacoesFiltradas.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-xs">
                Nenhuma parcela encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* TABELA COM COLUNAS ADICIONAIS: Valor Pago e Diferença */}
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-1 py-0.5 text-left font-semibold text-gray-700" style={{ fontSize: '10px' }}>Vencimento</th>
                      <th className="px-1 py-0.5 text-left font-semibold text-gray-700" style={{ fontSize: '10px' }}>Pagamento</th>
                      <th className="px-1 py-0.5 text-left font-semibold text-gray-700" style={{ fontSize: '10px' }}>Transação</th>
                      <th className="px-1 py-0.5 text-left font-semibold text-gray-700" style={{ fontSize: '10px' }}>Cliente/Fornecedor</th>
                      <th className="px-1 py-0.5 text-right font-semibold text-gray-700" style={{ fontSize: '10px' }}>Valor Parcela</th>
                      <th className="px-1 py-0.5 text-right font-semibold text-gray-700" style={{ fontSize: '10px' }}>Valor Pago</th>
                      <th className="px-1 py-0.5 text-right font-semibold text-gray-700" style={{ fontSize: '10px' }}>Diferença</th>
                      <th className="px-1 py-0.5 text-center font-semibold text-gray-700" style={{ fontSize: '10px' }}>Parcela</th>
                      <th className="px-1 py-0.5 text-center font-semibold text-gray-700" style={{ fontSize: '10px' }}>Tipo</th>
                      <th className="px-1 py-0.5 text-center font-semibold text-gray-700" style={{ fontSize: '10px' }}>Status</th>
                      <th className="px-1 py-0.5 text-center font-semibold text-gray-700" style={{ fontSize: '10px' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoesFiltradas.map((transacao, index) => {
                      const valorExibicao = getValorExibicao(transacao)
                      const diferenca = getDiferenca(transacao)
                      const temPag = temPagamento(transacao)
                      
                      return (
                        <tr key={`${transacao.origem_id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-1 py-0.5 text-gray-700" style={{ fontSize: '11px' }}>
                            {formatarDataParaExibicao(transacao.data)}
                          </td>
                          <td className="px-1 py-0.5 text-gray-700" style={{ fontSize: '11px' }}>
                            {transacao.data_pagamento ? (
                              <span className="text-green-600 font-medium">
                                {formatarDataParaExibicao(transacao.data_pagamento)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-1 py-0.5 text-gray-700" style={{ fontSize: '11px' }}>
                            #{transacao.numero_transacao}
                          </td>
                          <td className="px-1 py-0.5 text-gray-700 truncate max-w-[100px]" style={{ fontSize: '11px' }}>{transacao.descricao}</td>
                          
                          {/* COLUNA VALOR DA PARCELA (ORIGINAL) */}
                          <td className="px-1 py-0.5 text-right">
                            <span className={
                              transacao.status_pagamento === 'pago'
                                ? transacao.tipo === 'entrada'
                                  ? 'bg-green-700 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs'
                                  : 'bg-red-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs'
                                : transacao.tipo === 'entrada'
                                  ? 'text-green-600 font-bold text-xs'
                                  : 'text-red-600 font-bold text-xs'
                            }>
                              R$ {transacao.valor.toFixed(2)}
                            </span>
                          </td>
                          
                          {/* ✅ COLUNA VALOR PAGO (SÓ SE HOUVER PAGAMENTO) */}
                          <td className="px-1 py-0.5 text-right">
                            {temPag ? (
                              <span className={
                                transacao.status_pagamento === 'pago'
                                  ? transacao.tipo === 'entrada'
                                    ? 'bg-green-700 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs'
                                    : 'bg-red-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs'
                                  : transacao.tipo === 'entrada'
                                    ? 'text-green-600 font-bold text-xs'
                                    : 'text-red-600 font-bold text-xs'
                              }>
                                R$ {valorExibicao.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          
                          {/* ✅ COLUNA DIFERENÇA (SÓ SE HOUVER PAGAMENTO E DIFERENÇA) */}
                          <td className="px-1 py-0.5 text-right">
                            {temPag && diferenca !== 0 ? (
                              <span className={
                                transacao.status_pagamento === 'pago'
                                  ? diferenca > 0
                                    ? 'bg-yellow-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs'
                                    : 'bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs'
                                  : diferenca > 0
                                    ? 'text-yellow-600 font-bold text-xs'
                                    : 'text-blue-600 font-bold text-xs'
                              }>
                                {diferenca > 0 ? '+' : ''}R$ {Math.abs(diferenca).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          
                          <td className="px-1 py-0.5 text-center text-gray-700" style={{ fontSize: '11px' }}>
                            <span>
                              {transacao.parcela_numero || 1}/{transacao.parcela_total || transacao.quantidade_parcelas || 1}
                            </span>
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-white font-bold text-xs ${getTipoColor(transacao.tipo)}`}>
                              {getTipoLabel(transacao.tipo)}
                            </span>
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getStatusColor(transacao.status_pagamento)}`}>
                              {getStatusLabel(transacao.status_pagamento)}
                            </span>
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            {transacao.status_pagamento === 'pago' ? (
                              <button
                                onClick={() => {
                                  setModalEstornarTransacao({
                                    aberto: true,
                                    transacao
                                  })
                                }}
                                className="text-yellow-500 hover:text-yellow-700 font-medium text-xs px-1.5 py-0.5 bg-yellow-50 rounded hover:bg-yellow-100 transition-colors"
                                title="Estornar"
                              >
                                ↩️ Estornar
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setModalPagarTransacao({
                                    aberto: true,
                                    transacao
                                  })
                                }}
                                className="text-green-500 hover:text-green-700 font-medium text-xs px-1.5 py-0.5 bg-green-50 rounded hover:bg-green-100 transition-colors"
                                title="Pagar"
                              >
                                💰 Pagar
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalPagarTransacao
        aberto={modalPagarTransacao.aberto}
        transacao={modalPagarTransacao.transacao}
        onClose={() => setModalPagarTransacao({ aberto: false, transacao: null })}
        onPagamentoRealizado={handlePagamentoRealizado}
      />

      <ModalEstornarTransacao
        aberto={modalEstornarTransacao.aberto}
        transacao={modalEstornarTransacao.transacao}
        onClose={() => setModalEstornarTransacao({ aberto: false, transacao: null })}
        onEstornoRealizado={handleEstornoRealizado}
      />
    </div>
  )
}