'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback, useRef } from 'react'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

export default function CaixaCasaDetalhado({
  titulo,
  onToggleTudo
}: {
  titulo?: string
  onToggleTudo?: (mostrarTudo: boolean) => void
}) {
  const { dados } = useDadosFinanceiros()

  const [caixaReal, setCaixaReal] = useState(0)
  const [entradasHoje, setEntradasHoje] = useState<number>(0)
  const [saidasHoje, setSaidasHoje] = useState<number>(0)
  const [caixaPrevisto, setCaixaPrevisto] = useState<DiaCaixa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [mostrando10Dias, setMostrando10Dias] = useState(true)
  const [mostrandoMes, setMostrandoMes] = useState(false)
  const [mostrandoHistorico, setMostrandoHistorico] = useState(false)
  const [mesFiltro, setMesFiltro] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0)

  const carregandoRef = useRef(false)
  const lastLoadRef = useRef(0)

  const fetchAll = useCallback(async (fromTable: string, selectFields = '*', orderColumn = 'id') => {
    const pageSize = 1000
    let offset = 0
    const all: any[] = []
    while (true) {
      const from = offset
      const to = offset + pageSize - 1
      const { data, error } = await supabase.from(fromTable).select(selectFields).order(orderColumn, { ascending: true }).range(from, to)
      if (error) throw error
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < pageSize) break
      offset += pageSize
    }
    return all
  }, [])

  const normalizeDate = useCallback((d?: string) => {
    if (!d) return ''
    if (d.includes('T')) return d.split('T')[0]
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toISOString().slice(0, 10)
  }, [])

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })
    const [ano, mes, dia] = dataBase.split('-').map(Number)
    const data = new Date(ano, mes - 1, dia + dias)
    return formatter.format(data)
  }, [])

  const gerarIntervaloDatas = useCallback((inicio: string, fim: string) => {
    const lista: string[] = []
    const atual = new Date(inicio + 'T00:00:00')
    const fimDate = new Date(fim + 'T00:00:00')
    while (atual <= fimDate) {
      lista.push(atual.toISOString().slice(0, 10))
      atual.setDate(atual.getDate() + 1)
    }
    return lista
  }, [])

  const buildCumulativeSeries = useCallback((entriesRaw: Array<any>, desiredEnd?: string) => {
    if (!entriesRaw || entriesRaw.length === 0) return { series: [] as DiaCaixa[], minDate: '', maxDate: '' }

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
    if (uniqueEntries.length === 0) return { series: [] as DiaCaixa[], minDate: '', maxDate: '' }

    const datas = uniqueEntries.map(e => e.data).filter(Boolean)
    const minDate = datas.reduce((a, b) => (a < b ? a : b))
    const maxDateEntries = datas.reduce((a, b) => (a > b ? a : b))
    const maxDate = desiredEnd && desiredEnd > maxDateEntries ? desiredEnd : maxDateEntries

    const agrup: Record<string, { receitas: number, despesas: number }> = {}
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
      saldoAtual += (valores.receitas - valores.despesas)
      series.push({
        data,
        data_formatada: formatarDataParaExibicao(data),
        receitas: valores.receitas,
        despesas: valores.despesas,
        saldo_acumulado: saldoAtual
      })
    })

    return { series, minDate, maxDate }
  }, [normalizeDate, gerarIntervaloDatas])

  useEffect(() => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    setMesFiltro(`${ano}-${mes}`)
  }, [])

  useEffect(() => {
    if (dados.caixaRealCasa !== undefined && dados.caixaRealCasa !== caixaReal) {
      setCaixaReal(dados.caixaRealCasa)
    }
  }, [dados.caixaRealCasa, caixaReal])

  const calcularHoje = useCallback(async () => {
    try {
      const hoje = getDataAtualBrasil()
      const { data: lancamentosHoje, error } = await supabase
        .from('lancamentos_financeiros')
        .select('valor, tipo')
        .eq('status', 'realizado')
        .eq('data_lancamento', hoje)
        .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')

      if (error) throw error

      let entradas = 0
      let saidas = 0

      if (Array.isArray(lancamentosHoje)) {
        lancamentosHoje.forEach(item => {
          const v = Number(item.valor) || 0
          if (item.tipo === 'entrada') entradas += v
          else saidas += v
        })
      }

      setEntradasHoje(entradas)
      setSaidasHoje(saidas)

    } catch (error) {
      console.error('Erro ao calcular hoje:', error)
    }
  }, [])

  const carregarCaixaPrevisto = useCallback(async () => {
    const now = Date.now()
    if (now - lastLoadRef.current < 700) {
      return
    }
    lastLoadRef.current = now

    if (carregandoRef.current) {
      return
    }

    const shouldShowSpinner = caixaPrevisto.length === 0

    carregandoRef.current = true
    setCarregando(shouldShowSpinner)

    try {
      const hoje = getDataAtualBrasil()
      let novoResultado: DiaCaixa[] = []
      let displayStart = ''
      let displayEnd = ''

      if (mostrandoHistorico) {
        const realizados = await fetchAll('lancamentos_financeiros', 'id, valor, tipo, data_lancamento, status', 'data_lancamento');
        const previstos = await fetchAll('lancamentos_financeiros', 'id, valor, tipo, data_prevista, status', 'data_prevista');
        const allEntries: any[] = [];
        (Array.isArray(realizados) ? realizados : []).forEach((r: any) => {
          const d = normalizeDate(r.data_lancamento)
          if (!d) return
          allEntries.push({ id: r.id ?? null, data: d, tipo: r.tipo, valor: Number(r.valor) || 0 })
        });
        (Array.isArray(previstos) ? previstos : []).forEach((p: any) => {
          const d = normalizeDate(p.data_prevista)
          if (!d) return
          allEntries.push({ id: p.id ?? null, data: d, tipo: p.tipo, valor: Number(p.valor) || 0 })
        });
        if (allEntries.length > 0) {
          const { series } = buildCumulativeSeries(allEntries)
          novoResultado = series.filter((s: DiaCaixa) => s.data >= hoje)
        } else {
          novoResultado = []
        }
      } else if (mostrandoMes && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        displayStart = `${ano}-${mes}-01`
        const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
        displayEnd = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`

        const { data: lancamentosRealizados } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo, data_lancamento, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .eq('status', 'realizado')
          .order('data_lancamento', { ascending: true })

        const { data: lancamentosPrevistos } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo, data_prevista, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .eq('status', 'previsto')
          .order('data_prevista', { ascending: true })

        const todosLancamentos = [
          ...(Array.isArray(lancamentosRealizados) ? lancamentosRealizados : []).map((l: any) => ({ ...l, data: l.data_lancamento, status: 'realizado' })),
          ...(Array.isArray(lancamentosPrevistos) ? lancamentosPrevistos : []).map((l: any) => ({ ...l, data: l.data_prevista, status: 'previsto' }))
        ];

        todosLancamentos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

        let saldoAcumulado = 0
        const dataDiaAnterior = calcularDataNDias(displayStart, -1)
        ;(Array.isArray(lancamentosRealizados) ? lancamentosRealizados : []).forEach((lanc: any) => {
          if (lanc.data_lancamento <= dataDiaAnterior) {
            if (lanc.tipo === 'entrada') saldoAcumulado += Number(lanc.valor) || 0
            else saldoAcumulado -= Number(lanc.valor) || 0
          }
        })

        const dadosAgrupados: Record<string, { receitas: number, despesas: number }> = {}
        const lancamentosFiltrados = todosLancamentos.filter((lanc: any) => lanc.data >= displayStart && lanc.data <= displayEnd)
        lancamentosFiltrados.forEach((lanc: any) => {
          const data = lanc.data.includes('T') ? lanc.data.split('T')[0] : lanc.data
          if (!dadosAgrupados[data]) dadosAgrupados[data] = { receitas: 0, despesas: 0 }
          if (lanc.tipo === 'entrada') dadosAgrupados[data].receitas += Number(lanc.valor) || 0
          else dadosAgrupados[data].despesas += Number(lanc.valor) || 0
        })

        const datasOrdenadas = Object.keys(dadosAgrupados).sort()
        let saldoAtual = saldoAcumulado
        novoResultado = datasOrdenadas.map(data => {
          const valores = dadosAgrupados[data]
          const saldoDia = valores.receitas - valores.despesas
          saldoAtual += saldoDia
          return {
            data,
            data_formatada: formatarDataParaExibicao(data),
            receitas: valores.receitas,
            despesas: valores.despesas,
            saldo_acumulado: saldoAtual
          } as DiaCaixa
        })
      } else {
        const inicioStr = getDataAtualBrasil()
        const fim10DiasStr = calcularDataNDias(inicioStr, 9)

        const { data: lancamentosRealizados } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo, data_lancamento, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .eq('status', 'realizado')
          .order('data_lancamento', { ascending: true })

        const { data: lancamentosPrevistos } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo, data_prevista, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .eq('status', 'previsto')
          .order('data_prevista', { ascending: true })

        const todosLancamentos = [
          ...(Array.isArray(lancamentosRealizados) ? lancamentosRealizados : []).map((l: any) => ({ ...l, data: l.data_lancamento, status: 'realizado' })),
          ...(Array.isArray(lancamentosPrevistos) ? lancamentosPrevistos : []).map((l: any) => ({ ...l, data: l.data_prevista, status: 'previsto' }))
        ];

        todosLancamentos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

        let saldoAcumulado = 0
        const dataOntem = calcularDataNDias(inicioStr, -1)
        ;(Array.isArray(lancamentosRealizados) ? lancamentosRealizados : []).forEach((lanc: any) => {
          if (lanc.data_lancamento <= dataOntem) {
            if (lanc.tipo === 'entrada') saldoAcumulado += Number(lanc.valor) || 0
            else saldoAcumulado -= Number(lanc.valor) || 0
          }
        })

        const lancamentosFiltrados = todosLancamentos.filter((lanc: any) => lanc.data >= inicioStr && lanc.data <= fim10DiasStr)
        const dadosAgrupados: Record<string, { receitas: number, despesas: number }> = {}
        lancamentosFiltrados.forEach((lanc: any) => {
          const data = lanc.data.includes('T') ? lanc.data.split('T')[0] : lanc.data
          if (!dadosAgrupados[data]) dadosAgrupados[data] = { receitas: 0, despesas: 0 }
          if (lanc.tipo === 'entrada') dadosAgrupados[data].receitas += Number(lanc.valor) || 0
          else dadosAgrupados[data].despesas += Number(lanc.valor) || 0
        })

        const datasOrdenadas = Object.keys(dadosAgrupados).sort()
        let saldoAtual = saldoAcumulado
        novoResultado = datasOrdenadas.map(data => {
          const valores = dadosAgrupados[data]
          const saldoDia = valores.receitas - valores.despesas
          saldoAtual += saldoDia
          return {
            data,
            data_formatada: formatarDataParaExibicao(data),
            receitas: valores.receitas,
            despesas: valores.despesas,
            saldo_acumulado: saldoAtual
          } as DiaCaixa
        })
      }

      setCaixaPrevisto(novoResultado)
      setUltimaAtualizacao(Date.now())
    } catch (error) {
      console.error('Erro ao carregar caixa previsto:', error)
    } finally {
      setCarregando(false)
      carregandoRef.current = false
    }
  }, [mostrando10Dias, mostrandoMes, mostrandoHistorico, mesFiltro, calcularDataNDias, fetchAll, normalizeDate, caixaPrevisto])

  useEffect(() => {
    calcularHoje()
    carregarCaixaPrevisto()
  }, [mostrando10Dias, mostrandoMes, mostrandoHistorico, mesFiltro, carregarCaixaPrevisto, calcularHoje])

  useEffect(() => {
    if (dados.ultimaAtualizacao > ultimaAtualizacao) {
      calcularHoje()
      carregarCaixaPrevisto()
    }
  }, [dados.ultimaAtualizacao, calcularHoje, carregarCaixaPrevisto, ultimaAtualizacao])

  const handleMudarParaMes = () => {
    setMostrando10Dias(false)
    setMostrandoMes(true)
    setMostrandoHistorico(false)
    onToggleTudo?.(false)
  }

  const handleVoltar10Dias = () => {
    setMostrando10Dias(true)
    setMostrandoMes(false)
    setMostrandoHistorico(false)
    onToggleTudo?.(false)
  }

  const handleMostrarHistorico = () => {
    setMostrandoHistorico(true)
    setMostrando10Dias(false)
    setMostrandoMes(false)
    onToggleTudo?.(true)
  }

  const handleMesFiltroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMesFiltro(e.target.value)
    onToggleTudo?.(false)
  }

  const caixaTituloStyle: React.CSSProperties = { fontSize: '11px', marginBottom: 2, whiteSpace: 'nowrap' }
  const caixaValorStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, lineHeight: '1.05', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const caixaSubContainerStyle: React.CSSProperties = { fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: 8, alignItems: 'center' }
  const periodoLinhaStyle: React.CSSProperties = { fontSize: '11px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 4, marginBottom: 4, paddingLeft: 4 }
  const botoesContainerStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  const formatarMoedaCompacta = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor)

  const getTituloPrevisao = () => {
    if (mostrandoHistorico) return 'TUDO'
    if (mostrandoMes && mesFiltro) {
      const [ano, mes] = mesFiltro.split('-')
      return `Mês: ${mes}/${ano}`
    }
    const hoje = getDataAtualBrasil()
    const fim10Dias = calcularDataNDias(hoje, 9)
    return `10 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim10Dias)}`
  }

  const renderBotoesModo = () => {
    return !mostrandoMes ? (
      <div style={botoesContainerStyle}>
        <button onClick={() => { setMostrandoMes(true); setMostrandoHistorico(false); onToggleTudo?.(false) }} disabled={carregando} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs font-medium">Ver Mês</button>
        <button onClick={() => { setMostrando10Dias(true); setMostrandoMes(false); setMostrandoHistorico(false); onToggleTudo?.(false) }} disabled={carregando} className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs font-medium">10 Dias</button>
        <button onClick={handleMostrarHistorico} disabled={carregando} className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-medium">TUDO</button>
      </div>
    ) : (
      <div style={botoesContainerStyle}>
        <input type="month" value={mesFiltro} onChange={handleMesFiltroChange} disabled={carregando} className="px-1.5 py-0.5 text-xs border border-gray-300 rounded" />
        <button onClick={handleVoltar10Dias} disabled={carregando} className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs font-medium">10 Dias</button>
        <button onClick={handleMostrarHistorico} disabled={carregando} className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-medium">TUDO</button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1" style={{ minWidth: 0 }}>
      <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>{titulo || 'Caixa'}</h2>

      <div className={`rounded p-1.5 ${caixaReal < 0 ? 'bg-red-500' : 'bg-blue-50 border border-blue-200'}`} style={{ minWidth: 0 }}>
        <div>
          <p style={caixaTituloStyle} className={`${caixaReal < 0 ? 'text-red-100' : 'text-gray-600'}`}>Caixa Real:</p>
          <p style={caixaValorStyle} className={`${caixaReal < 0 ? 'text-white' : 'text-blue-600'}`}>{formatarMoeda(caixaReal)}</p>

          <div style={caixaSubContainerStyle} className="mt-0.5">
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span className="text-green-600">↑ {formatarMoedaCompacta(Number(entradasHoje) || 0)}</span>
              <span className="text-red-600">↓ {formatarMoedaCompacta(Number(saidasHoje) || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <div style={{ minWidth: 0 }}></div>
          <div style={botoesContainerStyle}>{renderBotoesModo()}</div>
        </div>

        <div style={periodoLinhaStyle} title={getTituloPrevisao()}>{getTituloPrevisao()}</div>

        {carregando ? (
          <p className="text-gray-500 text-center py-2" style={{ fontSize: '12px' }}>Carregando...</p>
        ) : caixaPrevisto.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="text-[10px] text-gray-500 mb-1">
              Mostrando {caixaPrevisto.length} dias
              <span className="ml-2 text-blue-500">✓ {new Date(ultimaAtualizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Data</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Receitas</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Despesas</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {caixaPrevisto.map((dia, idx) => (
                  <tr key={`${dia.data}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-1 py-0.5 text-gray-700 whitespace-nowrap">{dia.data_formatada}</td>
                    <td className="px-1 py-0.5 text-right text-green-600 font-medium">{formatarMoedaCompacta(dia.receitas)}</td>
                    <td className="px-1 py-0.5 text-right text-red-600 font-medium">{formatarMoedaCompacta(dia.despesas)}</td>
                    <td className={`px-1 py-0.5 text-right font-bold ${dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatarMoedaCompacta(dia.saldo_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-gray-500 text-xs">
              {mostrandoMes ? `Nenhuma transação encontrada para ${mesFiltro}` : 'Nenhuma transação nos próximos 10 dias'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
