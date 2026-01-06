'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FormularioVenda from './FormularioVenda'
import ListaVendas from './ListaVendas'
import FiltrosLancamentos from './FiltrosLancamentos'
import { GeradorPDF, obterConfigLogos } from '@/lib/gerador-pdf-utils'
import type { Venda as TipoVenda } from '@/types'

// CACHE GLOBAL PARA TRANSAÇÕES (compartilhado com TelaInicialLoja)
let cacheGlobalTransacoes: any[] = []
let cacheGlobalUltimaAtualizacao: number = 0

export default function LojaPaginaVendas() {
  const [vendas, setVendas] = useState<TipoVenda[]>([])
  const [vendasFiltradas, setVendasFiltradas] = useState<TipoVenda[]>([])
  const [loading, setLoading] = useState(true)
  
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroNumeroTransacao, setFiltroNumeroTransacao] = useState('')
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  useEffect(() => {
    carregarVendas()
  }, [])

  useEffect(() => {
    aplicarFiltros()
  }, [vendas, filtroDataInicio, filtroDataFim, filtroMes, filtroNumeroTransacao, filtroDescricao, filtroStatus])

  const carregarVendas = async () => {
    try {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          itens_venda (
            id,
            produto_id,
            descricao,
            quantidade,
            preco_venda
          )
        `)
        .order('data_venda', { ascending: false })

      if (error) throw error
      
      const vendasFormatadas: TipoVenda[] = (data || []).map((venda: any) => ({
        id: venda.id,
        numero_transacao: venda.numero_transacao,
        data_venda: venda.data_venda,
        cliente: venda.cliente,
        total: venda.total,
        quantidade_itens: venda.quantidade_itens || 0,
        quantidade_parcelas: venda.quantidade_parcelas || 1,
        forma_pagamento: venda.forma_pagamento || 'dinheiro',
        status_pagamento: venda.status_pagamento || 'pendente',
        prazoparcelas: venda.prazoparcelas || 'mensal',
        itens: venda.itens_venda || [],
        status: venda.status_pagamento || 'pendente'
      }))
      
      setVendas(vendasFormatadas)
      setVendasFiltradas(vendasFormatadas)
    } catch (error) {
      console.error('Erro ao carregar vendas:', error)
    } finally {
      setLoading(false)
    }
  }

  const aplicarFiltros = () => {
    let resultado = [...vendas]

    // Verificar se há filtros NÃO de data aplicados
    const filtrosNaoDataAplicados = 
      !!filtroNumeroTransacao || 
      !!filtroDescricao || 
      filtroStatus !== 'todos'

    // Aplicar filtro por número de transação
    if (filtroNumeroTransacao) {
      resultado = resultado.filter(venda => 
        venda.numero_transacao.toString().includes(filtroNumeroTransacao)
      )
    }

    // Filtro por cliente
    if (filtroDescricao) {
      resultado = resultado.filter(venda => 
        venda.cliente.toLowerCase().includes(filtroDescricao.toLowerCase())
      )
    }

    // Filtro por status
    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(venda => venda.status_pagamento === filtroStatus)
    }

    // Filtro por data início/fim (apenas quando não há filtros não de data OU quando especificados)
    if (!filtrosNaoDataAplicados || (filtroDataInicio && filtroDataFim)) {
      if (filtroDataInicio && filtroDataFim) {
        resultado = resultado.filter(venda => {
          const dataVenda = new Date(venda.data_venda)
          const inicio = new Date(filtroDataInicio)
          const fim = new Date(filtroDataFim)
          return dataVenda >= inicio && dataVenda <= fim
        })
      }
    }

    // Filtro por mês (apenas quando não há filtros não de data OU quando especificado)
    if (!filtrosNaoDataAplicados || filtroMes) {
      if (filtroMes) {
        const [ano, mes] = filtroMes.split('-')
        resultado = resultado.filter(venda => {
          const dataVenda = new Date(venda.data_venda)
          return dataVenda.getFullYear() === parseInt(ano) && 
                 (dataVenda.getMonth() + 1) === parseInt(mes)
        })
      }
    }

    setVendasFiltradas(resultado)
  }

  const gerarPDFVendasFiltradas = () => {
    try {
      const logoConfig = obterConfigLogos()
      
      // Preparar vendas resumidas para o relatório
      const vendasPDF = vendasFiltradas.map(venda => ({
        data: venda.data_venda,
        transacao: venda.numero_transacao,
        cliente: venda.cliente,
        valorTotal: venda.total,
        parcelas: venda.quantidade_parcelas || 1,
        status: venda.status_pagamento
      }))
      
      // Calcular total geral
      const totalGeral = vendasFiltradas.reduce((total, venda) => total + venda.total, 0)
      
      // Preparar filtros aplicados
      const filtrosAplicados = []
      if (filtroNumeroTransacao) filtrosAplicados.push(`Transação: ${filtroNumeroTransacao}`)
      if (filtroDescricao) filtrosAplicados.push(`Cliente: ${filtroDescricao}`)
      if (filtroStatus !== 'todos') filtrosAplicados.push(`Status: ${filtroStatus}`)
      if (filtroDataInicio && filtroDataFim) filtrosAplicados.push(`Período: ${filtroDataInicio} até ${filtroDataFim}`)
      if (filtroMes) filtrosAplicados.push(`Mês: ${filtroMes}`)
      
      const dadosRelatorio = {
        tipo: 'vendas_resumido' as const,
        vendas: vendasPDF,
        filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined,
        totalGeral
      }
      
      const gerador = new GeradorPDF(logoConfig)
      gerador.gerarRelatorioVendas(dadosRelatorio)
      
      const nomeArquivo = `relatorio_vendas_${new Date().toISOString().split('T')[0]}.pdf`
      gerador.salvar(nomeArquivo)
      
      alert(`✅ Relatório de vendas gerado com sucesso! ${vendasFiltradas.length} venda(s) no relatório.`)
    } catch (error) {
      console.error('Erro ao gerar relatório de vendas:', error)
      alert('❌ Erro ao gerar relatório de vendas. Verifique o console para mais detalhes.')
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

  const handleVendaAdicionada = () => {
    // TAMBÉM invalida cache de transações da TelaInicialLoja
    cacheGlobalUltimaAtualizacao = 0
    cacheGlobalTransacoes = []
    
    carregarVendas()
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600">Carregando vendas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
        onGerarPDF={gerarPDFVendasFiltradas}
        mostrarCDC={false}
        mostrarNumeroTransacao={true}
        titulo="Filtros de Vendas"
        tipo="venda"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <FormularioVenda
            onVendaAdicionada={handleVendaAdicionada}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">
                Vendas {vendasFiltradas.length !== vendas.length ? `(${vendasFiltradas.length} de ${vendas.length} filtradas)` : `(${vendas.length})`}
              </h3>
              {vendasFiltradas.length !== vendas.length && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  Filtros aplicados
                </span>
              )}
            </div>
            <ListaVendas vendas={vendasFiltradas} onAtualizar={carregarVendas} />
          </div>
        </div>
      </div>
    </div>
  )
}