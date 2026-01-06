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
  const [carregando, setCarregando] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0)

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const data = new Date(dataBase)
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }, [])

  const fetchAll = useCallback(async (table: string, select: string) => {
    let allData: any[] = []
    let offset = 0
    const limit = 1000

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .range(offset, offset + limit - 1)

      if (error) throw error
      if (data) allData = allData.concat(data)
      if (!data || data.length < limit) break
      offset += limit
    }
    return allData
  }, [])

  const fetchData = useCallback(async () => {
    setCarregando(true)
    const hoje = getDataAtualBrasil()

    try {
      // 1. Calcular Caixa Real Geral (Histórico)
      const [transacoesLojaPagas, lancamentosCasaRealizados] = await Promise.all([
        supabase.from('transacoes_loja').select('tipo, total, valor_pago').eq('status_pagamento', 'pago'),
        supabase.from('lancamentos_financeiros').select('tipo, valor').eq('status', 'realizado')
      ])

      if (transacoesLojaPagas.error) throw transacoesLojaPagas.error
      if (lancamentosCasaRealizados.error) throw lancamentosCasaRealizados.error

      let real = 0
      transacoesLojaPagas.data?.forEach(t => {
        const valor = t.valor_pago ?? t.total
        real += t.tipo === 'entrada' ? valor : -valor
      })
      lancamentosCasaRealizados.data?.forEach(l => {
        real += l.tipo === 'entrada' ? l.valor : -l.valor
      })
      setCaixaRealGeral(real)

      // 2. Calcular Entradas e Saídas de Hoje
      const [transacoesHoje, lancamentosHoje] = await Promise.all([
        supabase.from('transacoes_loja').select('tipo, total, valor_pago').eq('status_pagamento', 'pago').eq('data_pagamento', hoje),
        supabase.from('lancamentos_financeiros').select('tipo, valor').eq('status', 'realizado').eq('data_lancamento', hoje)
      ])

      if (transacoesHoje.error) throw transacoesHoje.error
      if (lancamentosHoje.error) throw lancamentosHoje.error

      let entradas = 0
      let saidas = 0
      transacoesHoje.data?.forEach(t => {
        const valor = t.valor_pago ?? t.total
        if (t.tipo === 'entrada') entradas += valor
        else saidas += valor
      })
      lancamentosHoje.data?.forEach(l => {
        if (l.tipo === 'entrada') entradas += l.valor
        else saidas += l.valor
      })
      setEntradasHoje(entradas)
      setSaidasHoje(saidas)

      // 3. Calcular Caixa Previsto (Fluxo de Caixa)
      const [transacoesLoja, lancamentosCasa] = await Promise.all([
        fetchAll('transacoes_loja', 'tipo, total, valor_pago, data, status_pagamento'),
        fetchAll('lancamentos_financeiros', 'tipo, valor, data_prevista, data_lancamento, status')
      ])

      const allEntries: { data: string; receita: number; despesa: number }[] = []
      transacoesLoja.forEach((t: any) => {
        const valor = t.valor_pago ?? t.total
        allEntries.push({
          data: t.data,
          receita: t.tipo === 'entrada' ? valor : 0,
          despesa: t.tipo === 'saida' ? valor : 0
        })
      })
      lancamentosCasa.forEach((l: any) => {
        const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista
        allEntries.push({
          data: data,
          receita: l.tipo === 'entrada' ? l.valor : 0,
          despesa: l.tipo === 'saida' ? l.valor : 0
        })
      })

      const groupedByDate = allEntries.reduce((acc, curr) => {
        if (!curr.data) return acc;
        const date = curr.data.split('T')[0];
        if (!acc[date]) {
          acc[date] = { receitas: 0, despesas: 0 };
        }
        acc[date].receitas += curr.receita;
        acc[date].despesas += curr.despesa;
        return acc;
      }, {} as Record<string, { receitas: number; despesas: number }>);

      const startDate = filtro === 'mes'
        ? `${mesFiltro}-01`
        : filtro === 'tudo'
        ? Object.keys(groupedByDate).sort()[0] || hoje
        : calcularDataNDias(hoje, -1)

      const endDate = filtro === 'mes'
        ? new Date(Number(mesFiltro.split('-')[0]), Number(mesFiltro.split('-')[1]), 0).toISOString().split('T')[0]
        : filtro === 'tudo'
        ? Object.keys(groupedByDate).sort().pop() || hoje
        : calcularDataNDias(startDate, 30)

      const dates = [];
      let currentDate = new Date(startDate);
      const finalDate = new Date(endDate);
      while (currentDate <= finalDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      let saldoAcumulado = real
      const series = dates.map(date => {
        const { receitas, despesas } = groupedByDate[date] || { receitas: 0, despesas: 0 };
        saldoAcumulado += receitas - despesas;
        return {
          data: date,
          data_formatada: formatarDataParaExibicao(date),
          receitas,
          despesas,
          saldo_acumulado: saldoAcumulado,
        };
      });

      setCaixaPrevistoGeral(series);

    } catch (error) {
      console.error("Erro ao buscar dados do caixa universal:", error)
    } finally {
      setCarregando(false)
      setUltimaAtualizacao(Date.now())
    }
  }, [filtro, mesFiltro, calcularDataNDias, fetchAll])

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
        const ontem = calcularDataNDias(hoje, -1)
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
