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
    const data = new Date(`${dataBase}T12:00:00`)
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }, [])

  const fetchData = useCallback(async () => {
    setCarregando(true)
    const hoje = getDataAtualBrasil()
    const ontem = calcularDataNDias(hoje, -1)

    try {
      // 1. Buscar todas as transações da Loja e Lançamentos da Casa
      const [transacoesLojaRes, lancamentosCasaRes] = await Promise.all([
        supabase.from('transacoes_loja').select('tipo, total, valor_pago, data, data_pagamento, status_pagamento'),
        supabase.from('lancamentos_financeiros').select('tipo, valor, data_prevista, data_lancamento, status')
      ])

      if (transacoesLojaRes.error) throw transacoesLojaRes.error
      if (lancamentosCasaRes.error) throw lancamentosCasaRes.error

      const transacoesLoja = transacoesLojaRes.data || []
      const lancamentosCasa = lancamentosCasaRes.data || []

      // 2. Calcular o Caixa Real Geral (Soma histórica de tudo que foi pago/realizado)
      let realLoja = 0
      transacoesLoja.forEach(t => {
        if (t.status_pagamento === 'pago') {
          const valor = t.valor_pago ?? t.total
          realLoja += t.tipo === 'entrada' ? valor : -valor
        }
      })
      let realCasa = 0
      lancamentosCasa.forEach(l => {
        if (l.status === 'realizado') {
          realCasa += l.tipo === 'entrada' ? l.valor : -l.valor
        }
      })
      setCaixaRealGeral(realLoja + realCasa)

      // 3. Unificar todas as movimentações (realizadas e previstas) para o fluxo de caixa
      const allEntries: { data: string; valor: number; status: string }[] = []
      transacoesLoja.forEach(t => {
        const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data
        if (!data) return
        const valor = t.valor_pago ?? t.total
        allEntries.push({ data: data.split('T')[0], valor: t.tipo === 'entrada' ? valor : -valor, status: t.status_pagamento || 'pendente' })
      })
      lancamentosCasa.forEach(l => {
        const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista
        if (!data) return
        allEntries.push({ data: data.split('T')[0], valor: l.tipo === 'entrada' ? l.valor : -l.valor, status: l.status })
      })

      // 4. Agrupar movimentações por data
      const groupedByDate = allEntries.reduce((acc, curr) => {
        if (!acc[curr.data]) {
          acc[curr.data] = { receitas: 0, despesas: 0, receitas_realizadas: 0, despesas_realizadas: 0 }
        }
        if (curr.valor > 0) acc[curr.data].receitas += curr.valor
        else acc[curr.data].despesas += Math.abs(curr.valor)

        if (curr.status === 'pago' || curr.status === 'realizado') {
            if (curr.valor > 0) acc[curr.data].receitas_realizadas += curr.valor
            else acc[curr.data].despesas_realizadas += Math.abs(curr.valor)
        }
        return acc
      }, {} as Record<string, { receitas: number; despesas: number; receitas_realizadas: number; despesas_realizadas: number }>)

      // 5. Calcular o saldo inicial para o fluxo de caixa (tudo realizado/pago até ontem)
      const saldoInicial = Object.keys(groupedByDate)
        .filter(date => date <= ontem)
        .reduce((saldo, date) => {
          const { receitas_realizadas, despesas_realizadas } = groupedByDate[date]
          return saldo + receitas_realizadas - despesas_realizadas
        }, 0)

      // 6. Calcular Entradas e Saídas de Hoje (apenas o que foi realizado/pago)
      const hojeData = groupedByDate[hoje] || { receitas_realizadas: 0, despesas_realizadas: 0 }
      setEntradasHoje(hojeData.receitas_realizadas)
      setSaidasHoje(hojeData.despesas_realizadas)

      // 7. Construir a série de Caixa Previsto
      const sortedDates = Object.keys(groupedByDate).sort()
      let startDate = filtro === '30dias' ? hoje : `${mesFiltro}-01`
      if (filtro === 'tudo') startDate = sortedDates[0] || hoje

      const visibleEntries = sortedDates.filter(date => date >= startDate)

      let saldoAcumulado = saldoInicial
      const series = visibleEntries.map(date => {
        const { receitas, despesas } = groupedByDate[date]
        saldoAcumulado += receitas - despesas
        return {
          data: date,
          data_formatada: formatarDataParaExibicao(date),
          receitas,
          despesas,
          saldo_acumulado: saldoAcumulado,
        }
      })

      setCaixaPrevistoGeral(series);

    } catch (error) {
      console.error("Erro ao buscar dados do caixa universal:", error)
    } finally {
      setCarregando(false)
      setUltimaAtualizacao(Date.now())
    }
  }, [filtro, mesFiltro, calcularDataNDias])

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
      if (filtro === 'tudo') return 'Histórico e Futuro'
      if (filtro === '30dias') {
        const hoje = getDataAtualBrasil()
        const fim30Dias = calcularDataNDias(hoje, 29)
        return `Próximos 30 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim30Dias)}`
      }
      if (filtro === 'mes' && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        return `Mês: ${mes}/${ano}`
      }
      return 'Período'
    }
  }
}
