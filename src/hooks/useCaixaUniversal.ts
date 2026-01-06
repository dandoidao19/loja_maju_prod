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
      // 1. Buscar TODOS os dados relevantes de todos os tempos
      const [transacoesLojaRes, lancamentosCasaRes] = await Promise.all([
        supabase.from('transacoes_loja').select('tipo, total, valor_pago, data, data_pagamento, status_pagamento'),
        supabase.from('lancamentos_financeiros').select('tipo, valor, data_prevista, data_lancamento, status')
      ])

      if (transacoesLojaRes.error) throw transacoesLojaRes.error
      if (lancamentosCasaRes.error) throw lancamentosCasaRes.error

      const transacoesLoja = transacoesLojaRes.data || []
      const lancamentosCasa = lancamentosCasaRes.data || []

      // 2. Calcular o Caixa Real Geral (Saldo Histórico Correto)
      let real = 0
      transacoesLoja.forEach(t => {
        if (t.status_pagamento === 'pago') {
          const valor = t.valor_pago ?? t.total
          real += t.tipo === 'entrada' ? valor : -valor
        }
      })
      lancamentosCasa.forEach(l => {
        if (l.status === 'realizado') {
          real += l.tipo === 'entrada' ? l.valor : -l.valor
        }
      })
      setCaixaRealGeral(real)

      // 3. Unificar todas as transações (passadas e futuras) para o fluxo de caixa
      const allEntries: { data: string; valor: number }[] = []
      transacoesLoja.forEach(t => {
        const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data
        if (!data) return
        const valor = t.valor_pago ?? t.total
        allEntries.push({ data: data.split('T')[0], valor: t.tipo === 'entrada' ? valor : -valor })
      })
      lancamentosCasa.forEach(l => {
        const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista
        if (!data) return
        allEntries.push({ data: data.split('T')[0], valor: l.tipo === 'entrada' ? l.valor : -l.valor })
      })

      // 4. Agrupar por data
      const groupedByDate = allEntries.reduce((acc, curr) => {
        if (!acc[curr.data]) {
          acc[curr.data] = { receitas: 0, despesas: 0 }
        }
        if (curr.valor > 0) acc[curr.data].receitas += curr.valor
        else acc[curr.data].despesas += Math.abs(curr.valor)
        return acc
      }, {} as Record<string, { receitas: number; despesas: number }>)

      // 5. Calcular o saldo acumulado até ontem (ponto de partida para o previsto)
      const saldoAteOntem = Object.keys(groupedByDate)
        .filter(date => date <= ontem)
        .reduce((saldo, date) => {
          const { receitas, despesas } = groupedByDate[date]
          return saldo + receitas - despesas
        }, 0)

      // 6. Calcular Entradas e Saídas de Hoje
      const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 }
      setEntradasHoje(hojeData.receitas)
      setSaidasHoje(hojeData.despesas)

      // 7. Determinar o período de exibição do fluxo de caixa
      let startDateStr: string;
      let endDateStr: string;

      const sortedDates = Object.keys(groupedByDate).sort()
      const lastDateStr = sortedDates[sortedDates.length - 1] || hoje

      if (filtro === '30dias') {
        startDateStr = hoje
        endDateStr = calcularDataNDias(hoje, 29)
      } else if (filtro === 'mes' && mesFiltro) {
        startDateStr = `${mesFiltro}-01`
        endDateStr = new Date(Number(mesFiltro.split('-')[0]), Number(mesFiltro.split('-')[1]), 0).toISOString().split('T')[0]
      } else { // 'tudo'
        startDateStr = hoje
        endDateStr = lastDateStr > calcularDataNDias(hoje, 365) ? lastDateStr : calcularDataNDias(hoje, 365) // Mostra tudo, com pelo menos 1 ano pra frente
      }

      // 8. Construir a série de caixa previsto para o período
      const series: DiaCaixa[] = []
      let saldoAcumulado = saldoAteOntem
      const currentDate = new Date(`${startDateStr}T12:00:00`)
      const finalDate = new Date(`${endDateStr}T12:00:00`)

      while (currentDate <= finalDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const { receitas, despesas } = groupedByDate[dateStr] || { receitas: 0, despesas: 0 }
        saldoAcumulado += receitas - despesas

        // Adiciona à série apenas se houver movimentação ou se estiver dentro do range visível
        if(receitas > 0 || despesas > 0 || dateStr >= hoje) {
            series.push({
              data: dateStr,
              data_formatada: formatarDataParaExibicao(dateStr),
              receitas,
              despesas,
              saldo_acumulado: saldoAcumulado,
            })
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setCaixaPrevistoGeral(series)

    } catch (error) {
      console.error("Erro ao buscar dados do caixa universal:", error)
      setCaixaPrevistoGeral([])
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
