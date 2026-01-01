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

export default function VisualizacaoCaixaDetalhada({ contexto, titulo }: { contexto: 'casa' | 'loja', titulo?: string }) {
  const { dados } = useDadosFinanceiros()

  const [caixaReal, setCaixaReal] = useState(0)
  const [entradasHoje, setEntradasHoje] = useState(0)
  const [saidasHoje, setSaidasHoje] = useState(0)
  const [caixaPrevisto, setCaixaPrevisto] = useState<DiaCaixa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [mostrando30Dias, setMostrando30Dias] = useState(contexto === 'loja')
  const [mostrandoMes, setMostrandoMes] = useState(contexto === 'casa')
  const [mesFiltro, setMesFiltro] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0)

  const carregandoRef = useRef(false)

  // Normalize date strings to 'YYYY-MM-DD' reliably
  const normalizeDate = useCallback((d?: string) => {
    if (!d) return ''
    if (d.includes('T')) return d.split('T')[0]
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toISOString().slice(0, 10)
  }, [])

  // ✅ FUNÇÃO AUXILIAR: Calcular data N dias à frente
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

  // Helper para gerar lista de datas entre start e end (inclusive) no formato YYYY-MM-DD
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

  // Construir mapa diário a partir de lançamentos/transações (unificados) e gerar série cumulativa
  // -> Deduplicação por id (se existir) ou por chave composta como fallback
  const buildCumulativeSeries = useCallback((entradasRaw: Array<any>, isLoja = false, desiredEnd?: string) => {
    // entradasRaw: [{ id?, data: 'YYYY-MM-DD', tipo: 'entrada'|'saida', valor: number }, ...]
    if (!entradasRaw || entradasRaw.length === 0) return { series: [] as DiaCaixa[], minDate: '', maxDate: '' }

    // 0) Normalizar entradas e remover duplicados por id quando disponível
    const uniqueMap = new Map<string, any>()
    entradasRaw.forEach((r: any) => {
      const data = normalizeDate(r.data)
      if (!data) return
      const tipo = r.tipo || ''
      const valor = Number(r.valor ?? r.total ?? 0) || 0
      // use id if present, else fallback para chave composta
      const idKey = r.id ?? r.uuid ?? null
      const key = idKey ? String(idKey) : `${data}|${tipo}|${valor}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { id: idKey, data, tipo, valor, original: r })
      } else {
        // se já existe a mesma chave, ignoramos a duplicata exata
      }
    })

    const uniqueEntries = Array.from(uniqueMap.values())

    if (uniqueEntries.length === 0) return { series: [], minDate: '', maxDate: '' }

    // 1) Obter min/max data dos registros (usar uniqueEntries)
    const datas = uniqueEntries.map((e: any) => e.data).filter(Boolean)
    if (datas.length === 0) return { series: [], minDate: '', maxDate: '' }

    const minDate = datas.reduce((a, b) => (a < b ? a : b))
    const maxDateEntries = datas.reduce((a, b) => (a > b ? a : b))
    const maxDate = desiredEnd && desiredEnd > maxDateEntries ? desiredEnd : maxDateEntries

    // 2) Agrupar por dia receitas/despesas
    const agrup: Record<string, { receitas: number, despesas: number }> = {}
    uniqueEntries.forEach((r: any) => {
      const d = r.data
      if (!agrup[d]) agrup[d] = { receitas: 0, despesas: 0 }
      const valor = Number(r.valor) || 0
      if (r.tipo === 'entrada') agrup[d].receitas += valor
      else agrup[d].despesas += valor
    })

    // 3) Gerar intervalo completo do minDate até maxDate e calcular acumulado contínuo
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

    // DEBUG: log resumo (pequeno) para ajudar a identificar datas com valores inesperados
    // (se quiser, comente essa linha depois de verificar)
    console.log(`buildCumulativeSeries -> uniqueEntries: ${uniqueEntries.length}, days: ${series.length}, min: ${minDate}, max: ${maxDate}`)

    return { series, minDate, maxDate }
  }, [normalizeDate, gerarIntervaloDatas])

  // ✅ INICIALIZAR com mês atual
  useEffect(() => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const mesAtual = `${ano}-${mes}`

    setMesFiltro(mesAtual)

    console.log(`🎯 ${contexto} - Inicializado, modo: ${mostrando30Dias ? '30 DIAS' : 'MÊS'}`)
  }, [contexto, mostrando30Dias])

  // ✅ ATUALIZAR CAIXA REAL do contexto (mantém apenas exibição)
  useEffect(() => {
    const caixaContexto = contexto === 'casa'
      ? dados.caixaRealCasa
      : dados.caixaRealLoja

    if (caixaContexto !== undefined && caixaContexto !== caixaReal) {
      console.log(`💰 ${contexto} - Atualizando caixa real do contexto: R$ ${caixaContexto.toFixed(2)}`)
      setCaixaReal(caixaContexto)
    }
  }, [dados.caixaRealCasa, dados.caixaRealLoja, contexto, caixaReal])

  // ✅ FUNÇÃO para calcular entradas e saídas de HOJE
  const calcularHoje = useCallback(async () => {
    try {
      const hoje = getDataAtualBrasil()

      if (contexto === 'casa') {
        const { data: lancamentosHoje, error } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo')
          .eq('status', 'realizado')
          .eq('data_lancamento', hoje)
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')

        if (error) throw error

        let entradas = 0
        let saidas = 0

        if (lancamentosHoje) {
          lancamentosHoje.forEach(item => {
            if (item.tipo === 'entrada') {
              entradas += item.valor
            } else {
              saidas += item.valor
            }
          })
        }

        setEntradasHoje(entradas)
        setSaidasHoje(saidas)

      } else {
        const { data: transacoesHoje, error } = await supabase
          .from('transacoes_loja')
          .select('tipo, total, valor_pago, status_pagamento')
          .eq('status_pagamento', 'pago')
          .eq('data', hoje)

        if (error) throw error

        let entradas = 0
        let saidas = 0

        if (transacoesHoje) {
          transacoesHoje.forEach(item => {
            const valor = item.valor_pago !== null ? item.valor_pago : item.total
            if (item.tipo === 'entrada') {
              entradas += valor
            } else {
              saidas += valor
            }
          })
        }

        setEntradasHoje(entradas)
        setSaidasHoje(saidas)
      }

    } catch (error) {
      console.error(`❌ ${contexto} - Erro ao calcular hoje:`, error)
    }
  }, [contexto])

  // ✅ FUNÇÃO para carregar caixa previsto com cálculo contínuo desde a PRIMEIRA DATA que tem lançamentos no sistema
  const carregarCaixaPrevisto = useCallback(async () => {
    if (carregandoRef.current) {
      console.log(`⏭️ ${contexto} - Já está carregando, ignorando...`)
      return
    }

    carregandoRef.current = true
    setCarregando(true)

    try {
      console.log(`📊 ${contexto} - Carregando caixa previsto (cálculo contínuo desde primeiro lançamento)...`)

      if (contexto === 'casa') {
        // Buscar realizados (histórico) e previstos (futuro) — selecionando também o id para dedupe segura
        const { data: realizadosRaw, error: errRealizados } = await supabase
          .from('lancamentos_financeiros')
          .select('id, valor, tipo, data_lancamento, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .order('data_lancamento', { ascending: true })

        if (errRealizados) {
          console.error('❌ Erro ao buscar realizados:', errRealizados)
          return
        }

        const { data: previstosRaw, error: errPrevistos } = await supabase
          .from('lancamentos_financeiros')
          .select('id, valor, tipo, data_prevista, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .order('data_prevista', { ascending: true })

        if (errPrevistos) {
          console.error('❌ Erro ao buscar previstos:', errPrevistos)
          return
        }

        const realizados = realizadosRaw || []
        const previstos = previstosRaw || []

        // Unificar em um formato simples: { id?, data, tipo, valor }
        const allEntries: Array<any> = []
        realizados.forEach((r: any) => {
          const d = normalizeDate(r.data_lancamento)
          if (!d) return
          allEntries.push({ id: r.id ?? null, data: d, tipo: r.tipo, valor: Number(r.valor) || 0 })
        })
        previstos.forEach((p: any) => {
          const d = normalizeDate(p.data_prevista)
          if (!d) return
          allEntries.push({ id: p.id ?? null, data: d, tipo: p.tipo, valor: Number(p.valor) || 0 })
        })

        if (allEntries.length === 0) {
          setCaixaPrevisto([])
          console.log('ℹ️ CASA - Sem lançamentos no sistema.')
          return
        }

        // Determinar janela de exibição (mês ou 10 dias)
        const hoje = getDataAtualBrasil()
        let displayStart = ''
        let displayEnd = ''

        if (mostrandoMes && mesFiltro) {
          const [ano, mes] = mesFiltro.split('-')
          displayStart = `${ano}-${mes}-01`
          const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
          displayEnd = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
        } else {
          displayStart = hoje
          displayEnd = calcularDataNDias(hoje, 9)
        }

        // Build cumulative series starting from the FIRST date that exists in the system (min date in allEntries)
        const desiredEnd = displayEnd
        const { series } = buildCumulativeSeries(allEntries, false, desiredEnd)

        // Agora cortar somente o período de exibição (displayStart..displayEnd)
        const resultado = series.filter(s => s.data >= displayStart && s.data <= displayEnd)
        setCaixaPrevisto(resultado)
        console.log(`✅ CASA - Cálculo contínuo aplicado. Total dias no período: ${resultado.length}`)

      } else {
        // LOJA: buscar todas as transacoes (pagas) e utilizar valor_pago quando existir. selecionar id para dedupe
        const { data: transacoesRaw, error: errTrans } = await supabase
          .from('transacoes_loja')
          .select('id, tipo, total, valor_pago, status_pagamento, data')
          .order('data', { ascending: true })

        if (errTrans) {
          console.error('❌ Erro ao buscar transações da loja:', errTrans)
          return
        }

        const transacoes = transacoesRaw || []

        if (transacoes.length === 0) {
          setCaixaPrevisto([])
          console.log('ℹ️ LOJA - Sem transações no sistema.')
          return
        }

        // Unificar em formato { id?, data, tipo, valor }
        const allEntries: Array<any> = transacoes.map((t: any) => ({
          id: t.id ?? null,
          data: normalizeDate(t.data),
          tipo: t.tipo,
          valor: Number(t.valor_pago !== null && t.valor_pago !== undefined ? t.valor_pago : t.total) || 0
        })).filter((t: any) => t.data)

        // Determinar janela de exibição (30 dias a partir de ontem ou mês)
        const hoje = getDataAtualBrasil()
        let displayStart = ''
        let displayEnd = ''

        if (mostrando30Dias) {
          const ontem = calcularDataNDias(hoje, -1)
          displayStart = ontem
          displayEnd = calcularDataNDias(ontem, 29)
        } else if (mesFiltro) {
          const [ano, mes] = mesFiltro.split('-')
          displayStart = `${ano}-${mes}-01`
          const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
          displayEnd = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
        } else {
          const ontem = calcularDataNDias(hoje, -1)
          displayStart = ontem
          displayEnd = calcularDataNDias(ontem, 29)
        }

        // Build cumulative series starting from first date in system and extend until displayEnd
        const desiredEnd = displayEnd
        const { series } = buildCumulativeSeries(allEntries, true, desiredEnd)

        // Filtrar somente o período de exibição
        const resultado = series.filter(s => s.data >= displayStart && s.data <= displayEnd)
        setCaixaPrevisto(resultado)
        console.log(`✅ LOJA - Cálculo contínuo aplicado. Total dias no período: ${resultado.length}`)
      }

      setUltimaAtualizacao(Date.now())

    } catch (error) {
      console.error(`❌ ${contexto} - Erro ao carregar caixa previsto:`, error)
    } finally {
      setCarregando(false)
      carregandoRef.current = false
    }
  }, [contexto, mostrando30Dias, mostrandoMes, mesFiltro, calcularDataNDias, normalizeDate, gerarIntervaloDatas, buildCumulativeSeries])

  // ✅ EFEITO: Carregar quando mudar modo ou mês
  useEffect(() => {
    console.log(`🔄 ${contexto} - Modo alterado: ${mostrando30Dias ? '30 DIAS' : mostrandoMes ? 'MÊS' : 'OUTRO'}, mês: ${mesFiltro}`)
    calcularHoje()
    carregarCaixaPrevisto()
  }, [mostrando30Dias, mostrandoMes, mesFiltro, contexto, carregarCaixaPrevisto, calcularHoje])

  // ✅ EFEITO: Atualizar quando houver mudança nos dados
  useEffect(() => {
    if (dados.ultimaAtualizacao > ultimaAtualizacao) {
      console.log(`🔄 ${contexto} - Dados atualizados no contexto, recalculando...`)
      calcularHoje()
      carregarCaixaPrevisto()
    }
  }, [dados.ultimaAtualizacao, contexto, calcularHoje, carregarCaixaPrevisto, ultimaAtualizacao])

  const handleMudarParaMes = () => {
    setMostrando30Dias(false)
    setMostrandoMes(true)
  }

  const handleVoltar30Dias = () => {
    setMostrando30Dias(true)
    setMostrandoMes(false)
  }

  const handleMesFiltroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMesFiltro(e.target.value)
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarMoedaCompacta = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor)
  }

  const getTituloPrevisao = () => {
    if (contexto === 'casa') {
      if (mostrandoMes && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        return `Mês: ${mes}/${ano}`
      } else {
        const hoje = getDataAtualBrasil()
        const fim10Dias = calcularDataNDias(hoje, 9)
        return `10 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim10Dias)}`
      }
    } else {
      if (mostrando30Dias) {
        return `30 Dias`
      } else if (mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        return `Mês: ${mes}/${ano}`
      }
    }
    return 'Período'
  }

  const renderBotoesModo = () => {
    if (contexto === 'casa') {
      // CASA: 10 dias / mês
      return !mostrandoMes ? (
        <button
          onClick={() => setMostrandoMes(true)}
          disabled={carregando}
          className="px-1.5 py-0.5 bg-blue-500 text-white hover:bg-blue-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
        >
          Ver Mês
        </button>
      ) : (
        <>
          <input
            type="month"
            value={mesFiltro}
            onChange={handleMesFiltroChange}
            disabled={carregando}
            className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => setMostrandoMes(false)}
            disabled={carregando}
            className="px-1.5 py-0.5 bg-gray-500 text-white hover:bg-gray-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            10 Dias
          </button>
        </>
      )
    } else {
      // LOJA: 30 dias / mês
      return mostrando30Dias ? (
        <>
          <input
            type="month"
            value={mesFiltro}
            onChange={handleMesFiltroChange}
            disabled={carregando}
            className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleMudarParaMes}
            disabled={carregando}
            className="px-1.5 py-0.5 bg-blue-500 text-white hover:bg-blue-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            Ver Mês
          </button>
        </>
      ) : (
        <button
          onClick={handleVoltar30Dias}
          disabled={carregando}
          className="px-1.5 py-0.5 bg-gray-500 text-white hover:bg-gray-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
        >
          30 Dias
        </button>
      )
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1">
      <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>{titulo || 'Caixa'}</h2>

      {/* CAIXA REAL */}
      <div className={`rounded p-1.5 ${
        caixaReal < 0 ? 'bg-red-500' : 'bg-blue-50 border border-blue-200'
      }`}>
        <div>
          <p className={`mb-0.5 ${caixaReal < 0 ? 'text-red-100' : 'text-gray-600'}`} style={{ fontSize: '12px' }}>
            Caixa Real:
          </p>
          <p className={`text-2xl font-bold ${caixaReal < 0 ? 'text-white' : 'text-blue-600'}`}>
            {formatarMoeda(caixaReal)}
          </p>

          {/* ENTRADAS E SAÍDAS DE HOJE */}
          <div className="mt-0.5 flex justify-between text-[11px] font-medium">
            <span className="text-green-600">
              ↑ {formatarMoedaCompacta(entradasHoje)}
            </span>
            <span className="text-red-600">
              ↓ {formatarMoedaCompacta(saidasHoje)}
            </span>
          </div>
        </div>
      </div>

      {/* CAIXA PREVISTO */}
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold text-gray-700" style={{ fontSize: '12px' }}>
            {getTituloPrevisao()}
          </h3>
          <div className="flex gap-0.5">
            {renderBotoesModo()}
          </div>
        </div>

        {carregando ? (
          <p className="text-gray-500 text-center py-2" style={{ fontSize: '12px' }}>
            Carregando {mostrando30Dias ? '30 dias' : mostrandoMes ? 'mês' : 'período'}...
          </p>
        ) : caixaPrevisto.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="text-[10px] text-gray-500 mb-1">
              Mostrando {caixaPrevisto.length} dias
              <span className="ml-2 text-blue-500">
                ✓ {new Date(ultimaAtualizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
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
                    <td className="px-1 py-0.5 text-gray-700 whitespace-nowrap">
                      {dia.data_formatada}
                    </td>
                    <td className="px-1 py-0.5 text-right text-green-600 font-medium">
                      {formatarMoedaCompacta(dia.receitas)}
                    </td>
                    <td className="px-1 py-0.5 text-right text-red-600 font-medium">
                      {formatarMoedaCompacta(dia.despesas)}
                    </td>
                    <td className={`px-1 py-0.5 text-right font-bold ${
                      dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {formatarMoedaCompacta(dia.saldo_acumulado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-gray-500 text-xs">
              {contexto === 'casa'
                ? (mostrandoMes
                    ? `Nenhuma transação encontrada para ${mesFiltro}`
                    : 'Nenhuma transação nos próximos 10 dias')
                : (mostrando30Dias
                    ? 'Nenhuma transação nos próximos 30 dias'
                    : `Nenhuma transação encontrada para ${mesFiltro}`)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}