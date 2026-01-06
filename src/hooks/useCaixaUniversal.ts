// hooks/useCaixaUniversal.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

type Filtro = '30dias' | 'mes' | 'tudo'

export function useCaixaUniversal() {
  const [caixaRealGeral, setCaixaRealGeral] = useState(0)
  const [caixaPrevistoGeral, setCaixaPrevistoGeral] = useState<DiaCaixa[]>([])
  const [entradasHoje, setEntradasHoje] = useState(0)
  const [saidasHoje, setSaidasHoje] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0)

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00`) // Use timezone to avoid UTC issues
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }, [])

  const fetchData = useCallback(async () => {
    setCarregando(true)
    const hoje = getDataAtualBrasil()

    try {
      // 1. Buscar TODOS os dados, de todos os tempos
      const [transacoesLojaRes, lancamentosCasaRes] = await Promise.all([
        supabase.from('transacoes_loja').select('tipo, total, valor_pago, data, data_pagamento, status_pagamento'),
        supabase.from('lancamentos_financeiros').select('tipo, valor, data_prevista, data_lancamento, status')
      ])

      if (transacoesLojaRes.error) throw transacoesLojaRes.error
      if (lancamentosCasaRes.error) throw lancamentosCasaRes.error

      const transacoesLoja = transacoesLojaRes.data || []
      const lancamentosCasa = lancamentosCasaRes.data || []

      // --- Início do Novo Cálculo ---

      // 2. Unificar todas as transações em um formato único
      const allEntries: { data: string; valor: number }[] = []

      transacoesLoja.forEach(t => {
        const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data
        if (!data) return
        const valor = t.valor_pago ?? t.total
        allEntries.push({
          data: data.split('T')[0],
          valor: t.tipo === 'entrada' ? valor : -valor,
        })
      })

      lancamentosCasa.forEach(l => {
        const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista
        if (!data) return
        allEntries.push({
          data: data.split('T')[0],
          valor: l.tipo === 'entrada' ? l.valor : -l.valor,
        })
      })

      // 3. Agrupar por data
      const groupedByDate = allEntries.reduce((acc, curr) => {
        if (!acc[curr.data]) {
          acc[curr.data] = { receitas: 0, despesas: 0 }
        }
        if (curr.valor > 0) {
          acc[curr.data].receitas += curr.valor
        } else {
          acc[curr.data].despesas += Math.abs(curr.valor)
        }
        return acc
      }, {} as Record<string, { receitas: number; despesas: number }>)

      const sortedDates = Object.keys(groupedByDate).sort()
      if (sortedDates.length === 0) {
          setCarregando(false)
          setCaixaPrevistoGeral([])
          setCaixaRealGeral(0)
          setEntradasHoje(0)
          setSaidasHoje(0)
          return
      }

      // 4. Criar a série histórica mestre ("cálculo infinito")
      const masterSeries: DiaCaixa[] = []
      let saldoAcumulado = 0
      const firstDate = new Date(`${sortedDates[0]}T12:00:00`)
      const lastDate = new Date(`${sortedDates[sortedDates.length - 1]}T12:00:00`)

      for (let d = firstDate; d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const { receitas, despesas } = groupedByDate[dateStr] || { receitas: 0, despesas: 0 }
        saldoAcumulado += receitas - despesas
        masterSeries.push({
          data: dateStr,
          data_formatada: formatarDataParaExibicao(dateStr),
          receitas,
          despesas,
          saldo_acumulado: saldoAcumulado,
        })
      }

      // 5. Calcular o Caixa Real com base no novo cálculo
      const caixaRealCalculado = masterSeries
        .filter(d => d.data <= hoje)
        .pop()?.saldo_acumulado || 0
      setCaixaRealGeral(caixaRealCalculado)

      // 6. Calcular Entradas e Saídas de Hoje
      const hojeData = groupedByDate[hoje] || {receitas: 0, despesas: 0};
      setEntradasHoje(hojeData.receitas);
      setSaidasHoje(hojeData.despesas);

      // 7. Filtrar a série para exibição
      let startDateStr: string;
      if (filtro === '30dias') {
        startDateStr = hoje;
      } else if (filtro === 'mes' && mesFiltro) {
        startDateStr = `${mesFiltro}-01`;
      } else { // 'tudo'
        startDateStr = masterSeries[0]?.data || hoje;
      }

      const displaySeries = masterSeries.filter(d => d.data >= startDateStr);
      setCaixaPrevistoGeral(displaySeries);

    } catch (error) {
      console.error("Erro ao buscar dados do caixa universal:", error)
      setCaixaPrevistoGeral([])
    } finally {
      setCarregando(false)
      setUltimaAtualizacao(Date.now())
    }
  }, [filtro, mesFiltro])

  useEffect(() => {
    if (!mesFiltro) {
        const hoje = new Date();
        setMesFiltro(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
    }
    fetchData()
  }, [filtro, mesFiltro, fetchData])

  return {
    caixaRealGeral,
    caixaPrevistoGeral,
    entradasHoje,
    saidasHoje,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    ultimaAtualizacao,
    getTituloPrevisao: () => {
      if (filtro === 'tudo') return 'TUDO'
      if (filtro === '30dias') {
        const hoje = getDataAtualBrasil()
        const ontem = calcularDataNDias(hoje, 0)
        const fim30Dias = calcularDataNDias(ontem, 29)
        return `30 Dias: ${formatarDataParaExibicao(ontem)} a ${formatarDataParaExibicao(fim30Dias)}`
      }
      if (filtro === 'mes' && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        return `Mês: ${mes}/${ano}`
      }
      return 'Período'
    }
  }
}
