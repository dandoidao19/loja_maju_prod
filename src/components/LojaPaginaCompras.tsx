'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import FormularioCompra from './FormularioCompra'
import ListaCompras from './ListaCompras'
import FiltrosLancamentos from './FiltrosLancamentos'
import { GeradorPDF, obterConfigLogos } from '@/lib/gerador-pdf-utils'

interface Compra {
  id: string
  numero_transacao: number
  data_compra: string
  fornecedor: string
  total: number
  quantidade_itens: number
  quantidade_parcelas: number
  status_pagamento: string
  itens?: ItemCompra[]
}

interface ItemCompra {
  id: string
  produto_id: string
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
}

// CACHE GLOBAL PARA COMPRAS
let cacheGlobalCompras: Compra[] = []
let cacheGlobalUltimaAtualizacaoCompras: number = 0
const CACHE_TEMPO_VIDA_COMPRAS = 30000 // 30 segundos

// CACHE GLOBAL PARA TRANSAÇÕES (compartilhado com TelaInicialLoja)
let cacheGlobalTransacoes: any[] = []
let cacheGlobalUltimaAtualizacao: number = 0

export default function LojaPaginaCompras() {
  const [compras, setCompras] = useState<Compra[]>(cacheGlobalCompras)
  const [comprasFiltradas, setComprasFiltradas] = useState<Compra[]>([])
  const [loading, setLoading] = useState(cacheGlobalCompras.length === 0)
  const buscaEmAndamentoRef = useRef<boolean>(false)
  
  // Estados para filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroNumeroTransacao, setFiltroNumeroTransacao] = useState('')
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const carregarCompras = useCallback(async (forcarAtualizacao = false) => {
    if (buscaEmAndamentoRef.current) {
      return
    }

    const agora = Date.now()
    
    // VERIFICA CACHE GLOBAL - Não busca se cache ainda é válido
    if (!forcarAtualizacao && 
        cacheGlobalCompras.length > 0 && 
        (agora - cacheGlobalUltimaAtualizacaoCompras < CACHE_TEMPO_VIDA_COMPRAS)) {
      console.log('📦 Usando cache global de compras')
      setCompras(cacheGlobalCompras)
      setLoading(false)
      return
    }
    
    // Evita múltiplas buscas em sequência
    if (!forcarAtualizacao && agora - cacheGlobalUltimaAtualizacaoCompras < 5000) {
      console.log('⏭️ Busca de compras ignorada (muito recente)')
      return
    }

    buscaEmAndamentoRef.current = true
    setLoading(true)
    
    try {
      console.log('📊 Buscando compras...')
      const { data, error } = await supabase
        .from('compras')
        .select(`
          *,
          itens_compra (
            id,
            produto_id,
            descricao,
            quantidade,
            categoria,
            preco_custo,
            preco_venda
          )
        `)
        .order('data_compra', { ascending: false })

      if (error) throw error
      
      console.log(`✅ ${data?.length || 0} compras carregadas`)
      
      // ATUALIZA CACHE GLOBAL E ESTADO LOCAL
      setCompras(data || [])
      cacheGlobalCompras = data || []
      cacheGlobalUltimaAtualizacaoCompras = agora
      
    } catch (error) {
      console.error('Erro ao carregar compras:', error)
    } finally {
      setLoading(false)
      buscaEmAndamentoRef.current = false
    }
  }, [])

  // Efeito inicial - usa cache se disponível
  useEffect(() => {
    const agora = Date.now()
    
    // Se cache é válido, usa cache. Senão, busca.
    if (cacheGlobalCompras.length > 0 && 
        (agora - cacheGlobalUltimaAtualizacaoCompras < CACHE_TEMPO_VIDA_COMPRAS)) {
      console.log('🚀 Inicializando compras com cache válido')
      setCompras(cacheGlobalCompras)
      setLoading(false)
    } else {
      console.log('🚀 Cache de compras expirado ou vazio, buscando...')
      carregarCompras()
    }
    
    // Configurar listener para atualizações em tempo real
    const channel = supabase
      .channel('compras-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compras'
        },
        (payload) => {
          console.log('🔄 Mudança detectada na tabela compras:', payload.eventType)
          // Forçar atualização do cache global
          cacheGlobalUltimaAtualizacaoCompras = 0
          carregarCompras(true)
        }
      )
      .subscribe()

    // Listener para itens_compra também
    const channelItens = supabase
      .channel('itens-compra-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itens_compra'
        },
        () => {
          console.log('🔄 Mudança detectada na tabela itens_compra')
          cacheGlobalUltimaAtualizacaoCompras = 0
          carregarCompras(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(channelItens)
    }
  }, [carregarCompras])

  const aplicarFiltros = useCallback(() => {
    let resultado = [...compras]

    // Verificar se há filtros NÃO de data aplicados
    const filtrosNaoDataAplicados = 
      !!filtroNumeroTransacao || 
      !!filtroDescricao || 
      filtroStatus !== 'todos'

    // Aplicar filtro por número de transação
    if (filtroNumeroTransacao) {
      resultado = resultado.filter(compra => 
        compra.numero_transacao.toString().includes(filtroNumeroTransacao)
      )
    }

    // Filtro por fornecedor
    if (filtroDescricao) {
      resultado = resultado.filter(compra => 
        compra.fornecedor.toLowerCase().includes(filtroDescricao.toLowerCase())
      )
    }

    // Filtro por status
    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(compra => compra.status_pagamento === filtroStatus)
    }

    // Filtro por data início/fim (apenas quando não há filtros não de data OU quando especificados)
    if (!filtrosNaoDataAplicados || (filtroDataInicio && filtroDataFim)) {
      if (filtroDataInicio && filtroDataFim) {
        resultado = resultado.filter(compra => {
          const dataCompra = new Date(compra.data_compra)
          const inicio = new Date(filtroDataInicio)
          const fim = new Date(filtroDataFim)
          return dataCompra >= inicio && dataCompra <= fim
        })
      }
    }

    // Filtro por mês (apenas quando não há filtros não de data OU quando especificado)
    if (!filtrosNaoDataAplicados || filtroMes) {
      if (filtroMes) {
        const [ano, mes] = filtroMes.split('-')
        resultado = resultado.filter(compra => {
          const dataCompra = new Date(compra.data_compra)
          return dataCompra.getFullYear() === parseInt(ano) && 
                 (dataCompra.getMonth() + 1) === parseInt(mes)
        })
      }
    }

    setComprasFiltradas(resultado)
  }, [compras, filtroDataInicio, filtroDataFim, filtroMes, filtroNumeroTransacao, filtroDescricao, filtroStatus])

  useEffect(() => {
    aplicarFiltros()
  }, [aplicarFiltros])

  const gerarPDFComprasFiltradas = () => {
    try {
      const logoConfig = obterConfigLogos()
      
      // Preparar compras resumidas para o relatório
      const comprasPDF = comprasFiltradas.map(compra => ({
        data: compra.data_compra,
        transacao: compra.numero_transacao,
        fornecedor: compra.fornecedor,
        valorTotal: compra.total,
        parcelas: compra.quantidade_parcelas || 1,
        status: compra.status_pagamento
      }))
      
      // Calcular total geral
      const totalGeral = comprasFiltradas.reduce((total, compra) => total + compra.total, 0)
      
      // Preparar filtros aplicados
      const filtrosAplicados = []
      if (filtroNumeroTransacao) filtrosAplicados.push(`Transação: ${filtroNumeroTransacao}`)
      if (filtroDescricao) filtrosAplicados.push(`Fornecedor: ${filtroDescricao}`)
      if (filtroStatus !== 'todos') filtrosAplicados.push(`Status: ${filtroStatus}`)
      if (filtroDataInicio && filtroDataFim) filtrosAplicados.push(`Período: ${filtroDataInicio} até ${filtroDataFim}`)
      if (filtroMes) filtrosAplicados.push(`Mês: ${filtroMes}`)
      
      const dadosRelatorio = {
        tipo: 'compras_resumido' as const,
        compras: comprasPDF,
        filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined,
        totalGeral
      }
      
      const gerador = new GeradorPDF(logoConfig)
      gerador.gerarRelatorioCompras(dadosRelatorio)
      
      const nomeArquivo = `relatorio_compras_${new Date().toISOString().split('T')[0]}.pdf`
      gerador.salvar(nomeArquivo)
      
      alert(`✅ Relatório de compras gerado com sucesso! ${comprasFiltradas.length} compra(s) no relatório.`)
    } catch (error) {
      console.error('Erro ao gerar relatório de compras:', error)
      alert('❌ Erro ao gerar relatório de compras. Verifique o console para mais detalhes.')
    }
  }

  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroMes('')
    setFiltroNumeroTransacao('')
    setFiltroDescricao('')
    setFiltroStatus('todos')
  }

  const handleCompraAdicionada = () => {
    // Invalida cache global para forçar atualização
    cacheGlobalUltimaAtualizacaoCompras = 0
    cacheGlobalCompras = []
    
    // TAMBÉM invalida cache de transações da TelaInicialLoja
    cacheGlobalUltimaAtualizacao = 0
    cacheGlobalTransacoes = []
    
    carregarCompras(true)
  }

  if (loading && compras.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600">Carregando compras...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros - Corrigido: removido centrosCusto */}
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
        filtroStatus={filtroStatus}
        setFiltroStatus={setFiltroStatus}
        onLimpar={limparFiltros}
        onGerarPDF={gerarPDFComprasFiltradas}
        mostrarCDC={false}
        mostrarNumeroTransacao={true}
        titulo="Filtros de Compras"
        tipo="compra"
      />
      
      {/* Layout: Formulário à esquerda, Transações à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna Esquerda: Formulário */}
        <div className="lg:col-span-1">
          <FormularioCompra
            onCompraAdicionada={handleCompraAdicionada}
          />
        </div>

        {/* Coluna Direita: Transações */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">
                Compras {comprasFiltradas.length !== compras.length ? `(${comprasFiltradas.length} de ${compras.length} filtradas)` : `(${compras.length})`}
              </h3>
              {comprasFiltradas.length !== compras.length && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  Filtros aplicados
                </span>
              )}
            </div>
            <ListaCompras compras={comprasFiltradas} onAtualizar={() => carregarCompras(true)} />
          </div>
        </div>
      </div>
    </div>
  )
}