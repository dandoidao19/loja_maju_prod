// hooks/useCaixaPrevisto.ts
import { useCallback } from 'react'
import { formatarDataParaExibicao } from '@/lib/dateUtils'

export interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

export const useCaixaPrevisto = () => {
  const normalizeDate = useCallback((d?: string) => {
    if (!d) return ''
    if (d.includes('T')) return d.split('T')[0]
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? d : dt.toISOString().slice(0, 10)
  }, [])

  const gerarIntervaloDatas = useCallback((inicio: string, fim: string) => {
    const lista: string[] = []
    let atual = new Date(inicio + 'T00:00:00')
    const fimDate = new Date(fim + 'T00:00:00')
    while (atual <= fimDate) {
      lista.push(atual.toISOString().slice(0, 10))
      atual.setDate(atual.getDate() + 1)
    }
    return lista
  }, [])

  const buildCumulativeSeries = useCallback(
    (entriesRaw: Array<any>, desiredEnd?: string) => {
      if (!entriesRaw || entriesRaw.length === 0) {
        return { series: [] as DiaCaixa[], minDate: '', maxDate: '' }
      }

      const uniq = new Map<string, any>()
      entriesRaw.forEach((r: any) => {
        const data = normalizeDate(r.data)
        if (!data) return
        const tipo = r.tipo || ''
        const valor = Number(r.valor ?? r.total ?? 0) || 0
        const idKey = r.id ?? r.uuid ?? null
        const key = idKey ? String(idKey) : `${data}|${tipo}|${valor}`
        if (!uniq.has(key)) uniq.set(key, { id: idKey, data, tipo, valor })
      })

      const uniqueEntries = Array.from(uniq.values())
      if (uniqueEntries.length === 0) {
        return { series: [] as DiaCaixa[], minDate: '', maxDate: '' }
      }

      const datas = uniqueEntries.map(e => e.data).filter(Boolean)
      const minDate = datas.reduce((a, b) => (a < b ? a : b))
      const maxDateEntries = datas.reduce((a, b) => (a > b ? a : b))
      const maxDate =
        desiredEnd && desiredEnd > maxDateEntries ? desiredEnd : maxDateEntries

      const agrup: Record<string, { receitas: number; despesas: number }> = {}
      uniqueEntries.forEach((r: any) => {
        const d = r.data
        if (!agrup[d]) agrup[d] = { receitas: 0, despesas: 0 }
        if (r.tipo === 'entrada') agrup[d].receitas += Number(r.valor) || 0
        else agrup[d].despesas += Number(r.valor) || 0
      })

      const listaDatas = gerarIntervaloDatas(minDate, maxDate)
      const series: DiaCaixa[] = []
      let saldoAtual = 0
      listaDatas.forEach(data => {
        const valores = agrup[data] || { receitas: 0, despesas: 0 }
        saldoAtual += valores.receitas - valores.despesas
        series.push({
          data,
          data_formatada: formatarDataParaExibicao(data),
          receitas: valores.receitas,
          despesas: valores.despesas,
          saldo_acumulado: saldoAtual
        })
      })

      return { series, minDate, maxDate }
    },
    [normalizeDate, gerarIntervaloDatas]
  )

  return {
    buildCumulativeSeries
  }
}
