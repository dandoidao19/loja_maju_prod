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

  // ✅ INICIALIZAR com mês atual
  useEffect(() => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const mesAtual = `${ano}-${mes}`
    
    setMesFiltro(mesAtual)
    
    console.log(`🎯 ${contexto} - Inicializado, modo: ${mostrando30Dias ? '30 DIAS' : 'MÊS'}`)
  }, [contexto, mostrando30Dias])

  // ✅ ATUALIZAR CAIXA REAL do contexto
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

  // ✅ CORREÇÃO DEFINITIVA: Função para calcular caixa previsto CORRETAMENTE - CÁLCULO CONTÍNUO
  const carregarCaixaPrevisto = useCallback(async () => {
    if (carregandoRef.current) {
      console.log(`⏭️ ${contexto} - Já está carregando, ignorando...`)
      return
    }
    
    carregandoRef.current = true
    setCarregando(true)
    
    try {
      console.log(`📊 ${contexto} - Carregando caixa previsto...`)
      
      if (contexto === 'casa') {
        // ✅ CASA: CÁLCULO CONTÍNUO desde a primeira transação até a última previsão
        
        // 1. Buscar TODOS os lançamentos REALIZADOS (histórico completo)
        const { data: lancamentosRealizados, error: errorRealizados } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo, data_lancamento, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .eq('status', 'realizado')
          .order('data_lancamento', { ascending: true })
        
        if (errorRealizados) {
          console.error(`❌ Erro ao buscar lançamentos realizados:`, errorRealizados)
          return
        }
        
        // 2. Buscar TODOS os lançamentos PREVISTOS (futuro)
        const { data: lancamentosPrevistos, error: errorPrevistos } = await supabase
          .from('lancamentos_financeiros')
          .select('valor, tipo, data_prevista, status')
          .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
          .eq('status', 'previsto')
          .order('data_prevista', { ascending: true })
        
        if (errorPrevistos) {
          console.error(`❌ Erro ao buscar lançamentos previstos:`, errorPrevistos)
          return
        }
        
        // 3. Juntar todos os lançamentos
        const todosLancamentos = [
          ...(lancamentosRealizados || []).map((l: any) => ({
            ...l,
            data: l.data_lancamento,
            status: 'realizado'
          })),
          ...(lancamentosPrevistos || []).map((l: any) => ({
            ...l,
            data: l.data_prevista,
            status: 'previsto'
          }))
        ]
        
        // 4. Ordenar por data
        todosLancamentos.sort((a, b) => {
          return new Date(a.data).getTime() - new Date(b.data).getTime()
        })
        
        console.log(`🏠 CASA - Total lançamentos: ${todosLancamentos.length} (${lancamentosRealizados?.length || 0} realizados + ${lancamentosPrevistos?.length || 0} previstos)`)
        
        // 5. Filtrar por período se necessário
        let lancamentosFiltrados = todosLancamentos
        
        if (mostrandoMes && mesFiltro) {
          const [ano, mes] = mesFiltro.split('-')
          const dataInicio = `${ano}-${mes}-01`
          const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
          const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
          
          console.log(`📅 CASA - Filtrando mês: ${dataInicio} até ${dataFim}`)
          
          lancamentosFiltrados = todosLancamentos.filter(lanc => {
            const dataLanc = lanc.data
            return dataLanc >= dataInicio && dataLanc <= dataFim
          })
          
          // Para cálculo correto do mês, precisamos do saldo acumulado até o dia anterior
          let saldoAcumulado = 0
          const dataDiaAnterior = calcularDataNDias(dataInicio, -1)
          
          if (lancamentosRealizados) {
            lancamentosRealizados.forEach((lanc: any) => {
              if (lanc.data_lancamento <= dataDiaAnterior) {
                if (lanc.tipo === 'entrada') {
                  saldoAcumulado += lanc.valor
                } else {
                  saldoAcumulado -= lanc.valor
                }
              }
            })
          }
          
          console.log(`💰 CASA - Saldo acumulado até ${dataDiaAnterior}: R$ ${saldoAcumulado.toFixed(2)}`)
          
          // 6. Calcular dias agrupados
          const dadosAgrupados: Record<string, { receitas: number, despesas: number }> = {}
          
          lancamentosFiltrados.forEach(lanc => {
            const data = lanc.data.includes('T') ? lanc.data.split('T')[0] : lanc.data
            
            if (!dadosAgrupados[data]) {
              dadosAgrupados[data] = { receitas: 0, despesas: 0 }
            }
            
            if (lanc.tipo === 'entrada') {
              dadosAgrupados[data].receitas += lanc.valor
            } else {
              dadosAgrupados[data].despesas += lanc.valor
            }
          })
          
          // 7. Ordenar datas e calcular acumulado
          const datasOrdenadas = Object.keys(dadosAgrupados).sort()
          const caixaPrevistoTemp: DiaCaixa[] = []
          
          let saldoAtual = saldoAcumulado
          
          datasOrdenadas.forEach(data => {
            const valores = dadosAgrupados[data]
            const saldoDia = valores.receitas - valores.despesas
            saldoAtual += saldoDia
            
            caixaPrevistoTemp.push({
              data,
              data_formatada: formatarDataParaExibicao(data),
              receitas: valores.receitas,
              despesas: valores.despesas,
              saldo_acumulado: saldoAtual
            })
          })
          
          setCaixaPrevisto(caixaPrevistoTemp)
          
        } else {
          // ✅ MODO 10 DIAS: Mostrar do dia atual até +9 dias
          const hoje = getDataAtualBrasil()
          const inicioStr = hoje
          const fim10DiasStr = calcularDataNDias(hoje, 9)
          
          console.log(`📅 CASA - Período 10 dias: ${inicioStr} até ${fim10DiasStr}`)
          
          // Filtrar lançamentos dos próximos 10 dias
          lancamentosFiltrados = todosLancamentos.filter(lanc => {
            const dataLanc = lanc.data
            return dataLanc >= inicioStr && dataLanc <= fim10DiasStr
          })
          
          // Calcular saldo acumulado até ontem
          let saldoAcumulado = 0
          const dataOntem = calcularDataNDias(hoje, -1)
          
          if (lancamentosRealizados) {
            lancamentosRealizados.forEach((lanc: any) => {
              if (lanc.data_lancamento <= dataOntem) {
                if (lanc.tipo === 'entrada') {
                  saldoAcumulado += lanc.valor
                } else {
                  saldoAcumulado -= lanc.valor
                }
              }
            })
          }
          
          console.log(`💰 CASA - Saldo acumulado até ${dataOntem}: R$ ${saldoAcumulado.toFixed(2)}`)
          
          // Calcular dias agrupados
          const dadosAgrupados: Record<string, { receitas: number, despesas: number }> = {}
          
          lancamentosFiltrados.forEach(lanc => {
            const data = lanc.data.includes('T') ? lanc.data.split('T')[0] : lanc.data
            
            if (!dadosAgrupados[data]) {
              dadosAgrupados[data] = { receitas: 0, despesas: 0 }
            }
            
            if (lanc.tipo === 'entrada') {
              dadosAgrupados[data].receitas += lanc.valor
            } else {
              dadosAgrupados[data].despesas += lanc.valor
            }
          })
          
          // Ordenar datas e calcular acumulado
          const datasOrdenadas = Object.keys(dadosAgrupados).sort()
          const caixaPrevistoTemp: DiaCaixa[] = []
          
          let saldoAtual = saldoAcumulado
          
          datasOrdenadas.forEach(data => {
            const valores = dadosAgrupados[data]
            const saldoDia = valores.receitas - valores.despesas
            saldoAtual += saldoDia
            
            caixaPrevistoTemp.push({
              data,
              data_formatada: formatarDataParaExibicao(data),
              receitas: valores.receitas,
              despesas: valores.despesas,
              saldo_acumulado: saldoAtual
            })
          })
          
          setCaixaPrevisto(caixaPrevistoTemp)
        }
        
        console.log(`✅ CASA - Cálculo completo: ${caixaPrevisto.length} dias`)
        
      } else {
        // ✅ LOJA: Mantém a lógica anterior (30 dias a partir de ontem)
        const hoje = getDataAtualBrasil()
        let dadosFiltrados: any[] = []
        let saldoAcumulado = 0
        
        if (mostrando30Dias) {
          // MODO 30 DIAS - A partir de ONTEM
          const dataOntem = calcularDataNDias(hoje, -1)
          const inicio30Dias = dataOntem
          const fim30Dias = calcularDataNDias(dataOntem, 29)
          
          console.log(`📅 LOJA - Período 30 dias: ${inicio30Dias} até ${fim30Dias}`)
          
          // Calcular saldo acumulado até 1 dia antes do início
          const dataAntesInicio = calcularDataNDias(inicio30Dias, -1)
          
          const { data: transacoesAnteriores, error } = await supabase
            .from('transacoes_loja')
            .select('tipo, total, valor_pago, status_pagamento')
            .eq('status_pagamento', 'pago')
            .lte('data', dataAntesInicio)
          
          if (error) throw error
          
          if (transacoesAnteriores) {
            transacoesAnteriores.forEach(item => {
              const valor = item.valor_pago !== null ? item.valor_pago : item.total
              if (item.tipo === 'entrada') {
                saldoAcumulado += valor
              } else {
                saldoAcumulado -= valor
              }
            })
          }
          
          // Transações dos 30 dias
          const { data: transacoes30Dias, error: error30Dias } = await supabase
            .from('transacoes_loja')
            .select('*')
            .gte('data', inicio30Dias)
            .lte('data', fim30Dias)
            .order('data', { ascending: true })
          
          if (error30Dias) throw error30Dias
          dadosFiltrados = transacoes30Dias || []
          
        } else if (mesFiltro) {
          // MODO MÊS
          const [ano, mes] = mesFiltro.split('-')
          const dataInicio = `${ano}-${mes}-01`
          const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
          const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
          
          console.log(`📅 LOJA - Período mês: ${dataInicio} até ${dataFim}`)
          
          const dataDiaAnterior = calcularDataNDias(dataInicio, -1)
          
          const { data: transacoesAnteriores, error } = await supabase
            .from('transacoes_loja')
            .select('tipo, total, valor_pago, status_pagamento')
            .eq('status_pagamento', 'pago')
            .lte('data', dataDiaAnterior)
          
          if (error) throw error
          
          if (transacoesAnteriores) {
            transacoesAnteriores.forEach(item => {
              const valor = item.valor_pago !== null ? item.valor_pago : item.total
              if (item.tipo === 'entrada') {
                saldoAcumulado += valor
              } else {
                saldoAcumulado -= valor
              }
            })
          }
          
          // Transações do mês
          const { data: transacoesMes, error: errorMes } = await supabase
            .from('transacoes_loja')
            .select('*')
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .order('data', { ascending: true })
          
          if (errorMes) throw errorMes
          dadosFiltrados = transacoesMes || []
        }
        
        console.log(`📈 LOJA - ${dadosFiltrados.length} registros para cálculo`)
        console.log(`💰 LOJA - Saldo acumulado inicial: R$ ${saldoAcumulado.toFixed(2)}`)
        
        // Calcular dados agrupados por dia
        const dadosAgrupados: Record<string, { receitas: number, despesas: number }> = {}
        
        dadosFiltrados.forEach(item => {
          const data = item.data.includes('T') ? item.data.split('T')[0] : item.data
          
          if (!dadosAgrupados[data]) {
            dadosAgrupados[data] = { receitas: 0, despesas: 0 }
          }
          
          const valor = item.total
          
          if (item.tipo === 'entrada') {
            dadosAgrupados[data].receitas += valor
          } else {
            dadosAgrupados[data].despesas += valor
          }
        })
        
        // Ordenar datas e calcular acumulado
        const datasOrdenadas = Object.keys(dadosAgrupados).sort()
        const caixaPrevistoTemp: DiaCaixa[] = []
        
        let saldoAtual = saldoAcumulado
        
        datasOrdenadas.forEach(data => {
          const valores = dadosAgrupados[data]
          const saldoDia = valores.receitas - valores.despesas
          saldoAtual += saldoDia
          
          caixaPrevistoTemp.push({
            data,
            data_formatada: formatarDataParaExibicao(data),
            receitas: valores.receitas,
            despesas: valores.despesas,
            saldo_acumulado: saldoAtual
          })
        })
        
        setCaixaPrevisto(caixaPrevistoTemp)
      }
      
      setUltimaAtualizacao(Date.now())
      
    } catch (error) {
      console.error(`❌ ${contexto} - Erro ao carregar caixa previsto:`, error)
    } finally {
      setCarregando(false)
      carregandoRef.current = false
    }
  }, [contexto, mostrando30Dias, mostrandoMes, mesFiltro, calcularDataNDias])

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
        const hoje = getDataAtualBrasil()
        const ontem = calcularDataNDias(hoje, -1)
        const fim30Dias = calcularDataNDias(ontem, 29)
        return `30 Dias: ${formatarDataParaExibicao(ontem)} a ${formatarDataParaExibicao(fim30Dias)}`
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