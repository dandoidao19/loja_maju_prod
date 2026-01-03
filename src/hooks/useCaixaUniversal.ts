// hooks/useCaixaUniversal.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { useCaixaPrevisto, DiaCaixa } from './useCaixaPrevisto'

export const useCaixaUniversal = (contexto: 'casa' | 'loja') => {
  const { dados } = useDadosFinanceiros()
  const { buildCumulativeSeries } = useCaixaPrevisto()

  const [caixaReal, setCaixaReal] = useState(0)
  const [entradasHoje, setEntradasHoje] = useState(0)
  const [saidasHoje, setSaidasHoje] = useState(0)
  const [caixaPrevisto, setCaixaPrevisto] = useState<DiaCaixa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0)

  const carregandoRef = useRef(false)
  const lastLoadRef = useRef(0)

  const fetchAll = useCallback(
    async (fromTable: string, selectFields = '*', orderColumn = 'id') => {
      const all: any[] = []
      let offset = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from(fromTable)
          .select(selectFields)
          .order(orderColumn, { ascending: true })
          .range(offset, offset + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...data)
        offset += pageSize
      }
      return all
    },
    []
  )

  const calcularHoje = useCallback(async () => {
    try {
      const hoje = getDataAtualBrasil()
      let entradas = 0
      let saidas = 0

      if (contexto === 'casa') {
        const { data, error } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo')
          .eq('status', 'realizado')
          .eq('data_lancamento', hoje)
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
        if (error) throw error
        if (data) {
          data.forEach(item => {
            if (item.tipo === 'entrada') entradas += item.valor || 0
            else saidas += item.valor || 0
          })
        }
      } else {
        const { data, error } = await supabase
          .from('transacoes_loja')
          .select('tipo, total, valor_pago, status_pagamento')
          .eq('status_pagamento', 'pago')
          .eq('data', hoje)
        if (error) throw error
        if (data) {
          data.forEach(item => {
            const valor = item.valor_pago ?? item.total
            if (item.tipo === 'entrada') entradas += valor || 0
            else saidas += valor || 0
          })
        }
      }
      setEntradasHoje(entradas)
      setSaidasHoje(saidas)
    } catch (error) {
      console.error(`Erro ao calcular hoje (${contexto}):`, error)
    }
  }, [contexto])

  const carregarCaixaPrevisto = useCallback(
    async (
      modo: '10dias' | '30dias' | 'mes' | 'tudo',
      mesFiltro?: string
    ) => {
      const now = Date.now()
      if (now - lastLoadRef.current < 700) return
      lastLoadRef.current = now

      if (carregandoRef.current) return
      carregandoRef.current = true
      setCarregando(caixaPrevisto.length === 0)

      try {
        const hoje = getDataAtualBrasil()
        const lancamentosPromise =
          contexto === 'casa'
            ? fetchAll('lancamentos_financeiros')
            : fetchAll('transacoes_loja')
        const comprasPromise =
          contexto === 'loja' ? fetchAll('compras') : Promise.resolve([])

        const [lancamentos, compras] = await Promise.all([
          lancamentosPromise,
          comprasPromise
        ])

        const combinedData = [...lancamentos, ...compras]
        const { series } = buildCumulativeSeries(combinedData)
        setCaixaPrevisto(series)
        setUltimaAtualizacao(Date.now())
      } catch (error) {
        console.error(`Erro ao carregar caixa previsto (${contexto}):`, error)
      } finally {
        setCarregando(false)
        carregandoRef.current = false
      }
    },
    [contexto, buildCumulativeSeries, fetchAll, caixaPrevisto.length]
  )

  useEffect(() => {
    const caixaContexto =
      contexto === 'casa' ? dados.caixaRealCasa : dados.caixaRealLoja
    if (caixaContexto !== undefined && caixaContexto !== caixaReal) {
      setCaixaReal(caixaContexto)
    }
  }, [dados.caixaRealCasa, dados.caixaRealLoja, contexto, caixaReal])

  useEffect(() => {
    if (dados.ultimaAtualizacao > ultimaAtualizacao) {
      calcularHoje()
    }
  }, [
    dados.ultimaAtualizacao,
    ultimaAtualizacao,
    calcularHoje
  ])

  return {
    caixaReal,
    entradasHoje,
    saidasHoje,
    caixaPrevisto,
    carregando,
    calcularHoje,
    carregarCaixaPrevisto,
    ultimaAtualizacao
  }
}
