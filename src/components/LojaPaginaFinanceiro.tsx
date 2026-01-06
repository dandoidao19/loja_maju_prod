'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarDataParaExibicao, getDataAtualBrasil } from '@/lib/dateUtils'
import FiltrosLancamentos from './FiltrosLancamentos'
import CaixaLojaDetalhado from './CaixaLojaDetalhado'
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
  status_pagamento: string | null
  quantidade_parcelas: number
  cliente_fornecedor?: string
  parcela_numero?: number
  parcela_total?: number
  transacao_principal_id?: string
  origem_id?: string
}

let cacheGlobalTransacoes: Transacao[] = []
let cacheGlobalUltimaAtualizacao: number = 0
const CACHE_TEMPO_VIDA = 30000

export default function LojaPaginaFinanceiro() {
  const [transacoes, setTransacoes] = useState<Transacao[]>(cacheGlobalTransacoes)
  const [transacoesFiltradas, setTransacoesFiltradas] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(false)
  const [verTodas, setVerTodas] = useState(false)
  
  const ultimaBuscaRef = useRef<number>(cacheGlobalUltimaAtualizacao)
  const buscaEmAndamentoRef = useRef<boolean>(false)

  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroNumeroTransacao, setFiltroNumeroTransacao] = useState('')
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const [modalPagarTransacao, setModalPagarTransacao] = useState<{ aberto: boolean, transacao: any | null }>({ aberto: false, transacao: null })
  const [modalEstornarTransacao, setModalEstornarTransacao] = useState<{ aberto: boolean, transacao: any | null }>({ aberto: false, transacao: null })

  const { dados, atualizarCaixaReal } = useDadosFinanceiros()

  // Helpers locais para cálculo de datas
  const addDias = useCallback((dataStr: string, dias: number) => {
    const dt = new Date(`${dataStr}T12:00:00`)
    dt.setDate(dt.getDate() + dias)
    return dt.toISOString().slice(0, 10)
  }, [])

  // Processar transações
  const processarTransacoes = useCallback(async (transacoesLoja: any[]) => {
    if (!transacoesLoja || transacoesLoja.length === 0) return []

    return transacoesLoja.map(trans => {
      let parcela_numero = 1
      let parcela_total = 1
      let descricaoLimpa = trans.descricao || ''

      const matchParcela = (trans.descricao || '').match(/\((\d+)\/(\d+)\)/)
      if (matchParcela) {
        parcela_numero = parseInt(matchParcela[1])
        parcela_total = parseInt(matchParcela[2])
        descricaoLimpa = (trans.descricao || '').replace(/\s*\(\d+\/\d+\)/, '').trim()
      }
      descricaoLimpa = descricaoLimpa.replace(/^(Venda|Compra)\s+/i, '').trim()

      return {
        id: trans.id,
        numero_transacao: trans.numero_transacao || 0,
        data: trans.data_original || trans.data,
        data_pagamento: trans.data_pagamento,
        data_original: trans.data_original || trans.data,
        tipo: trans.tipo,
        descricao: descricaoLimpa || trans.descricao,
        valor: trans.total,
        valor_pago: trans.valor_pago,
        juros_descontos: trans.juros_descontos,
        status_pagamento: trans.status_pagamento || 'pendente',
        quantidade_parcelas: trans.quantidade_parcelas || 1,
        parcela_numero,
        parcela_total: trans.quantidade_parcelas || parcela_total,
        cliente_fornecedor: descricaoLimpa,
        origem_id: trans.id,
      }
    })
  }, [])

  const buscarTransacoes = useCallback(async (forcarAtualizacao = false) => {
    if (buscaEmAndamentoRef.current) {
      console.log('⏭️ Busca já em andamento')
      return
    }

    const agora = Date.now()
    if (!forcarAtualizacao && cacheGlobalTransacoes.length > 0 && (agora - cacheGlobalUltimaAtualizacao < CACHE_TEMPO_VIDA)) {
      setTransacoes(cacheGlobalTransacoes)
      return
    }
    if (!forcarAtualizacao && agora - ultimaBuscaRef.current < 5000) return

    buscaEmAndamentoRef.current = true
    setLoading(true)

    try {
      console.log('📊 Buscando transações da loja...')
      const { data: transacoesLoja, error: errorTransacoes } = await supabase
        .from('transacoes_loja')
        .select('*')
        .order('data', { ascending: true })

      if (errorTransacoes) throw errorTransacoes

      if (!transacoesLoja || transacoesLoja.length === 0) {
        console.log('📭 Nenhuma transação encontrada')
        setTransacoes([])
        cacheGlobalTransacoes = []
        cacheGlobalUltimaAtualizacao = agora
        return
      }

      console.log(`🔍 Processando ${transacoesLoja.length} transações...`)
      const transacoesFormatadas = await processarTransacoes(transacoesLoja)
      
      console.log(`✅ ${transacoesFormatadas.length} transações processadas`)
      
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
  }, [processarTransacoes])

  useEffect(() => {
    const agora = Date.now()
    
    if (cacheGlobalTransacoes.length > 0 && (agora - cacheGlobalUltimaAtualizacao < CACHE_TEMPO_VIDA)) {
      console.log('🚀 Inicializando com cache válido')
      setTransacoes(cacheGlobalTransacoes)
    } else {
      console.log('🚀 Cache expirado ou vazio, buscando...')
      buscarTransacoes()
    }
    
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
          cacheGlobalUltimaAtualizacao = 0
          buscarTransacoes(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [buscarTransacoes])

  // Verifica período e mês
  const estaNoPeriodo = useCallback((dataString: string, inicio: string, fim: string) => {
    try {
      const data = new Date(dataString + 'T12:00:00')
      const dataInicio = new Date(inicio + 'T00:00:00')
      const dataFim = new Date(fim + 'T23:59:59')
      return data >= dataInicio && data <= dataFim
    } catch (error) {
      return false
    }
  }, [])

  const estaNoMesAtual = useCallback((dataString: string) => {
    try {
      if (!dataString) return false
      const data = new Date(dataString + 'T12:00:00')
      const hoje = new Date()
      if (isNaN(data.getTime())) return false
      return data.getFullYear() === hoje.getFullYear() && data.getMonth() === hoje.getMonth()
    } catch {
      return false
    }
  }, [])

  // APLICAR FILTROS — padrão: 30 dias a partir de ontem quando não há filtros e verTodas=false
  const aplicarFiltros = useCallback(() => {
    let resultado = [...transacoes]

    const temFiltros =
      !!filtroDataInicio ||
      !!filtroDataFim ||
      !!filtroMes ||
      !!filtroNumeroTransacao ||
      !!filtroDescricao ||
      filtroTipo !== 'todos' ||
      filtroStatus !== 'todos'

    if (!temFiltros && !verTodas) {
      const hoje = getDataAtualBrasil()
      const inicio = addDias(hoje, -1)
      const fim = addDias(inicio, 29)
      resultado = resultado.filter(transacao => estaNoPeriodo(transacao.data, inicio, fim))
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
        if (filtroTipo === 'compra') return transacao.tipo === 'saida'
        if (filtroTipo === 'venda') return transacao.tipo === 'entrada'
        return true
      })
    }

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(transacao => transacao.status_pagamento === filtroStatus)
    }

    if (filtroDataInicio && filtroDataFim) {
      resultado = resultado.filter(transacao => estaNoPeriodo(transacao.data, filtroDataInicio, filtroDataFim))
    }

    if (filtroMes) {
      const [ano, mes] = filtroMes.split('-')
      const primeiroDia = `${ano}-${mes}-01`
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
      const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
      resultado = resultado.filter(transacao => estaNoPeriodo(transacao.data, primeiroDia, ultimoDiaStr))
    }

    console.log(`✅ Filtros aplicados: ${resultado.length} transações`)
    setTransacoesFiltradas(resultado)
  }, [transacoes, filtroDataInicio, filtroDataFim, filtroMes, filtroNumeroTransacao, filtroDescricao, filtroTipo, filtroStatus, verTodas, addDias, estaNoPeriodo])

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
        status: transacao.status_pagamento || 'pendente'
      }))
      const totalGeral = transacoesFiltradas.reduce((total, transacao) => total + (transacao.valor_pago || transacao.valor), 0)
      const filtrosAplicados = []
      if (filtroDataInicio && filtroDataFim) filtrosAplicados.push(`Período: ${filtroDataInicio} até ${filtroDataFim}`)
      if (filtroMes) filtrosAplicados.push(`Mês: ${filtroMes}`)
      if (filtroNumeroTransacao) filtrosAplicados.push(`Transação: ${filtroNumeroTransacao}`)
      if (filtroDescricao) filtrosAplicados.push(`Cliente/Fornecedor: ${filtroDescricao}`)
      if (filtroTipo !== 'todos') filtrosAplicados.push(`Tipo: ${filtroTipo}`)
      if (filtroStatus !== 'todos') filtrosAplicados.push(`Status: ${filtroStatus}`)
      const dadosRelatorio = { tipo: 'financeiro' as const, transacoes: transacoesPDF, filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined, totalGeral }
      const gerador = new GeradorPDF(logoConfig)
      gerador.gerarRelatorioFinanceiro(dadosRelatorio)
      const nomeArquivo = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`
      gerador.salvar(nomeArquivo)
      alert(`✅ Relatório financeiro gerado com sucesso! ${transacoesFiltradas.length} transação(ões) no relatório.`)
    } catch (error) {
      console.error('Erro ao gerar relatório financeiro:', error)
      alert('❌ Erro ao gerar relatório financeiro.')
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

  const getStatusColor = useCallback((status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    if (status === 'pago') return 'bg-green-700 text-white font-bold'
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getStatusLabel = useCallback((status: string | null) => {
    if (!status) return 'N/A'
    if (status === 'pago') return '✓Pago'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }, [])

  const getTipoColor = useCallback((tipo: string) => tipo === 'entrada' ? 'bg-green-500' : 'bg-orange-500', [])
  const getTipoLabel = useCallback((tipo: string) => tipo === 'entrada' ? 'VENDA' : 'COMPRA', [])
  const getValorExibicao = useCallback((transacao: Transacao) => transacao.valor_pago ?? transacao.valor, [])
  const getDiferenca = useCallback((transacao: Transacao) => {
    if (transacao.valor_pago === undefined || transacao.valor_pago === null) return 0
    return transacao.valor_pago - transacao.valor
  }, [])
  const temPagamento = useCallback((transacao: Transacao) => !!transacao.data_pagamento, [])

  const handlePagamentoRealizado = useCallback(() => {
    cacheGlobalUltimaAtualizacao = 0
    cacheGlobalTransacoes = []
    ultimaBuscaRef.current = 0
    atualizarCaixaReal('loja')
    buscarTransacoes(true)
  }, [atualizarCaixaReal, buscarTransacoes])

  const handleEstornoRealizado = useCallback(() => {
    cacheGlobalUltimaAtualizacao = 0
    cacheGlobalTransacoes = []
    ultimaBuscaRef.current = 0
    atualizarCaixaReal('loja')
    buscarTransacoes(true)
  }, [atualizarCaixaReal, buscarTransacoes])

  const tituloLista = useMemo(() => {
    const temFiltros =
      !!filtroNumeroTransacao ||
      !!filtroDescricao ||
      filtroTipo !== 'todos' ||
      filtroStatus !== 'todos' ||
      !!filtroDataInicio ||
      !!filtroDataFim ||
      !!filtroMes

    if (verTodas) {
      return 'Todas as Parcelas'
    } else if (temFiltros) {
      return 'Parcelas Filtradas'
    } else {
      const hoje = getDataAtualBrasil()
      const inicio = addDias(hoje, -1)
      const fim = addDias(inicio, 29)
      return `30 Dias: ${formatarDataParaExibicao(inicio)} a ${formatarDataParaExibicao(fim)}`
    }
  }, [verTodas, filtroNumeroTransacao, filtroDescricao, filtroTipo, filtroStatus, filtroDataInicio, filtroDataFim, filtroMes, addDias])

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
        titulo="Filtros de Financeiro - Loja"
        tipo="geral"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-start">
        <div className="lg:col-span-1">
          <CaixaLojaDetalhado onToggleTudo={(mostrarTudo) => {
            // Quando painel esquerdo solicitar "mostrar tudo", ativamos Ver Todas no painel direito
            setVerTodas(Boolean(mostrarTudo))
          }} />
        </div>

        <div className="lg:col-span-3 min-h-0">
          <div className="bg-white rounded-lg shadow-md p-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">
                {tituloLista}
                {transacoesFiltradas.length !== transacoes.length && ` (${transacoesFiltradas.length} de ${transacoes.length} filtradas)`}
              </h3>
              <button
                onClick={() => setVerTodas(!verTodas)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${verTodas ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {verTodas ? 'Mês Atual' : 'Ver Todas'}
              </button>
            </div>

            {loading && transacoes.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-xs">Carregando transações...</div>
            ) : transacoesFiltradas.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-xs">{verTodas ? 'Nenhuma transação encontrada' : 'Nenhuma parcela encontrada para o período selecionado'}</div>
            ) : (
              <div className="overflow-x-auto">
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
                        <tr key={`${transacao.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-1 py-0.5 text-gray-700" style={{ fontSize: '11px' }}>{formatarDataParaExibicao(transacao.data)}</td>
                          <td className="px-1 py-0.5 text-gray-700" style={{ fontSize: '11px' }}>{transacao.data_pagamento ? <span className="text-green-600 font-medium">{formatarDataParaExibicao(transacao.data_pagamento)}</span> : <span className="text-gray-400">—</span>}</td>
                          <td className="px-1 py-0.5 text-gray-700" style={{ fontSize: '11px' }}>#{transacao.numero_transacao || 'N/A'}</td>
                          <td className="px-1 py-0.5 text-gray-700 truncate max-w-[100px]" style={{ fontSize: '11px' }}>{transacao.descricao}</td>
                          <td className="px-1 py-0.5 text-right">
                            <span className={transacao.status_pagamento === 'pago' ? (transacao.tipo === 'entrada' ? 'bg-green-700 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs' : 'bg-red-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs') : (transacao.tipo === 'entrada' ? 'text-green-600 font-bold text-xs' : 'text-red-600 font-bold text-xs')}>
                              R$ {transacao.valor.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-1 py-0.5 text-right">
                            {temPag ? <span className={transacao.status_pagamento === 'pago' ? (transacao.tipo === 'entrada' ? 'bg-green-700 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs' : 'bg-red-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs') : (transacao.tipo === 'entrada' ? 'text-green-600 font-bold text-xs' : 'text-red-600 font-bold text-xs')}>R$ {valorExibicao.toFixed(2)}</span> : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-1 py-0.5 text-right">{temPag && diferenca !== 0 ? <span className={transacao.status_pagamento === 'pago' ? (diferenca > 0 ? 'bg-yellow-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs' : 'bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded inline-block text-xs') : (diferenca > 0 ? 'text-yellow-600 font-bold text-xs' : 'text-blue-600 font-bold text-xs')}>{diferenca > 0 ? '+' : ''}R$ {Math.abs(diferenca).toFixed(2)}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                          <td className="px-1 py-0.5 text-center text-gray-700" style={{ fontSize: '11px' }}><span>{transacao.parcela_numero || 1}/{transacao.parcela_total || transacao.quantidade_parcelas || 1}</span></td>
                          <td className="px-1 py-0.5 text-center"><span className={`px-1.5 py-0.5 rounded text-white font-bold text-xs ${getTipoColor(transacao.tipo)}`}>{getTipoLabel(transacao.tipo)}</span></td>
                          <td className="px-1 py-0.5 text-center"><span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getStatusColor(transacao.status_pagamento)}`}>{getStatusLabel(transacao.status_pagamento)}</span></td>
                          <td className="px-1 py-0.5 text-center">
                            {transacao.status_pagamento === 'pago' ? (
                              <button onClick={() => setModalEstornarTransacao({ aberto: true, transacao: { ...transacao, status_pagamento: transacao.status_pagamento || 'pendente' } })} className="text-yellow-500 hover:text-yellow-700 font-medium text-xs px-1.5 py-0.5 bg-yellow-50 rounded hover:bg-yellow-100 transition-colors" title="Estornar">↩️ Estornar</button>
                            ) : (
                              <button onClick={() => setModalPagarTransacao({ aberto: true, transacao: { ...transacao, status_pagamento: transacao.status_pagamento || 'pendente' } })} className="text-green-500 hover:text-green-700 font-medium text-xs px-1.5 py-0.5 bg-green-50 rounded hover:bg-green-100 transition-colors" title="Pagar">💰 Pagar</button>
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

      <ModalPagarTransacao aberto={modalPagarTransacao.aberto} transacao={modalPagarTransacao.transacao} onClose={() => setModalPagarTransacao({ aberto: false, transacao: null })} onPagamentoRealizado={handlePagamentoRealizado} />
      <ModalEstornarTransacao aberto={modalEstornarTransacao.aberto} transacao={modalEstornarTransacao.transacao} onClose={() => setModalEstornarTransacao({ aberto: false, transacao: null })} onEstornoRealizado={handleEstornoRealizado} />
    </div>
  )
}