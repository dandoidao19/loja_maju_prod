'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
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
  const [caixaPrevisto, setCaixaPrevisto] = useState<DiaCaixa[]>([])
  const [mesFiltro, setMesFiltro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrandoMes, setMostrandoMes] = useState(false)
  const [dadosProntos, setDadosProntos] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0) // ✅ NOVO: Controlar atualizações

  // Inicializar com mês atual
  useEffect(() => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    setMesFiltro(`${ano}-${mes}`)
  }, [contexto])

  // ✅ CORREÇÃO 1: Monitorar quando dados do contexto estão prontos E quando são atualizados
  useEffect(() => {
    console.log(`🔄 ${contexto} - Monitorando dados:`, {
      temDadosCasa: dados.todosLancamentosCasa.length,
      temDadosLoja: dados.todosLancamentosLoja.length,
      ultimaAtualizacaoContexto: dados.ultimaAtualizacao,
      nossaUltimaAtualizacao: ultimaAtualizacao
    })
    
    if (contexto === 'casa') {
      // Para CASA: verificar se temos lançamentos carregados ou se o contexto terminou de carregar
      const houveAtualizacao = dados.ultimaAtualizacao > ultimaAtualizacao
      
      if (!dadosProntos || houveAtualizacao) {
        console.log(`✅ ${contexto} - Processando dados do contexto...`)
        setDadosProntos(true)
        setUltimaAtualizacao(dados.ultimaAtualizacao)
        
        // Recarregar dados com o modo atual
        if (mostrandoMes) {
          carregarDados(true)
        } else {
          carregarDados(false)
        }
      }
    } else {
      // Para LOJA: sempre recarregar quando houver atualização
      const houveAtualizacao = dados.ultimaAtualizacao > ultimaAtualizacao
      
      if (houveAtualizacao || !dadosProntos) {
        console.log(`✅ ${contexto} - Recarregando dados (atualização detectada)`)
        setDadosProntos(true)
        setUltimaAtualizacao(dados.ultimaAtualizacao)
        
        if (mostrandoMes) {
          carregarDados(true)
        } else {
          carregarDados(false)
        }
      }
    }
  }, [
    dados.todosLancamentosCasa, 
    dados.todosLancamentosLoja, 
    dados.ultimaAtualizacao,
    contexto,
    dadosProntos,
    ultimaAtualizacao,
    mostrandoMes
  ])

  // Atualizar caixa real do contexto
  useEffect(() => {
    const caixaRealContexto = contexto === 'casa' 
      ? dados.caixaRealCasa 
      : dados.caixaRealLoja
    
    if (caixaRealContexto !== undefined) {
      setCaixaReal(caixaRealContexto)
    }
  }, [dados.caixaRealCasa, dados.caixaRealLoja, contexto])

  // Monitorar mudanças no mesFiltro quando estiver no modo mês
  useEffect(() => {
    if (mostrandoMes && mesFiltro && dadosProntos) {
      console.log(`🔄 ${contexto} - mesFiltro alterado: ${mesFiltro}`)
      carregarDados(true)
    }
  }, [mesFiltro, mostrandoMes, dadosProntos])

  // ✅ FUNÇÃO PRINCIPAL - Recarrega quando chamada
  const carregarDados = async (filtrarPorMes: boolean) => {
    // MELHORIA: Não travar se não houver lançamentos, apenas mostrar vazio
    if (contexto === 'casa' && dados.todosLancamentosCasa.length === 0) {
      console.log(`⏳ ${contexto} - Sem lançamentos no contexto, carregando vista vazia...`)
      setCaixaPrevisto([])
      setCarregando(false)
      return
    }
    
    try {
      setCarregando(true)
      
      const hoje = getDataAtualBrasil()
      console.log(`📊 ${contexto} - Recarregando: ${filtrarPorMes ? 'MÊS' : '10 DIAS'}`, {
        dataAtual: hoje,
        mesFiltro,
        mostrandoMes
      })
      
      let dadosFiltrados: any[] = []
      let saldoAcumulado = 0
      
      if (contexto === 'casa') {
        const lancamentosCasa = dados.todosLancamentosCasa || []
        
        if (filtrarPorMes && mesFiltro) {
          const [ano, mes] = mesFiltro.split('-')
          const mesNum = parseInt(mes)
          const anoNum = parseInt(ano)
          
          const dataInicio = `${ano}-${mes}-01`
          const ultimoDia = new Date(anoNum, mesNum, 0).getDate()
          const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
          
          console.log(`🎯 CASA - Período mês: ${dataInicio} até ${dataFim}`)
          
          // Cálculo do saldo acumulado até mês anterior
          let mesAnterior = mesNum - 1
          let anoAnterior = anoNum
          
          if (mesAnterior === 0) {
            mesAnterior = 12
            anoAnterior = anoNum - 1
          }
          
          const ultimoDiaMesAnterior = new Date(anoAnterior, mesAnterior, 0).getDate()
          const dataFimMesAnterior = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`
          
          console.log(`💰 CASA - Calculando acumulado até: ${dataFimMesAnterior}`)
          
          // Recalcular saldo acumulado
          lancamentosCasa.forEach(item => {
            const dataItem = item.data_lancamento
            const data = dataItem.includes('T') ? dataItem.split('T')[0] : dataItem
            
            if (data <= dataFimMesAnterior) {
              if (item.tipo === 'entrada') {
                saldoAcumulado += item.valor
              } else {
                saldoAcumulado -= item.valor
              }
            }
          })
          
          console.log(`💰 CASA - Novo saldo acumulado: R$ ${saldoAcumulado.toFixed(2)}`)
          
          // Filtrar lançamentos do mês atual
          dadosFiltrados = lancamentosCasa.filter((item: any) => {
            const dataItem = item.data_lancamento
            const data = dataItem.includes('T') ? dataItem.split('T')[0] : dataItem
            return data >= dataInicio && data <= dataFim
          })
          
        } else {
          // Modo 10 dias
          const ontem = new Date(hoje)
          ontem.setDate(ontem.getDate() - 1)
          const ontemStr = ontem.toISOString().split('T')[0]
          const fim10Dias = new Date(hoje)
          fim10Dias.setDate(fim10Dias.getDate() + 9)
          const fim10DiasStr = fim10Dias.toISOString().split('T')[0]
          
          console.log(`📅 CASA - Período 10 dias: ${ontemStr} até ${fim10DiasStr}`)
          
          // Recalcular saldo acumulado até ontem
          lancamentosCasa.forEach(item => {
            const dataItem = item.data_lancamento
            const data = dataItem.includes('T') ? dataItem.split('T')[0] : dataItem
            
            if (data < hoje) {
              if (item.tipo === 'entrada') {
                saldoAcumulado += item.valor
              } else {
                saldoAcumulado -= item.valor
              }
            }
          })
          
          console.log(`💰 CASA - Novo saldo até ontem: R$ ${saldoAcumulado.toFixed(2)}`)
          
          // Filtrar dados dos 10 dias
          dadosFiltrados = lancamentosCasa.filter((item: any) => {
            const dataItem = item.data_lancamento
            const data = dataItem.includes('T') ? dataItem.split('T')[0] : dataItem
            return data >= ontemStr && data <= fim10DiasStr
          })
        }
        
        console.log(`📈 CASA - ${dadosFiltrados.length} lançamentos filtrados`)
        
      } else {
        // LOJA
        if (filtrarPorMes && mesFiltro) {
          const [ano, mes] = mesFiltro.split('-')
          const mesNum = parseInt(mes)
          const anoNum = parseInt(ano)
          
          const dataInicio = `${ano}-${mes}-01`
          const ultimoDia = new Date(anoNum, mesNum, 0).getDate()
          const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
          
          console.log(`🎯 LOJA - Período mês: ${dataInicio} até ${dataFim}`)
          
          // Calcular saldo acumulado até mês anterior
          let mesAnterior = mesNum - 1
          let anoAnterior = anoNum
          
          if (mesAnterior === 0) {
            mesAnterior = 12
            anoAnterior = anoNum - 1
          }
          
          const ultimoDiaMesAnterior = new Date(anoAnterior, mesAnterior, 0).getDate()
          const dataFimMesAnterior = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`
          
          console.log(`💰 LOJA - Calculando acumulado até: ${dataFimMesAnterior}`)
          
          // Buscar TODAS as transações da loja até o mês anterior
          const { data: transacoesAteMesAnterior, error: error1 } = await supabase
            .from('transacoes_loja')
            .select('*')
            .lte('data', dataFimMesAnterior)
          
          if (error1) throw error1
          
          if (transacoesAteMesAnterior) {
            transacoesAteMesAnterior.forEach(item => {
              const data = item.data.includes('T') ? item.data.split('T')[0] : item.data
              
              if (data <= dataFimMesAnterior) {
                if (item.tipo === 'entrada') {
                  saldoAcumulado += item.total
                } else {
                  saldoAcumulado -= item.total
                }
              }
            })
          }
          
          console.log(`💰 LOJA - Novo saldo acumulado: R$ ${saldoAcumulado.toFixed(2)}`)
          
          // Buscar transações do mês atual
          const { data: transacoesMes, error: error2 } = await supabase
            .from('transacoes_loja')
            .select('*')
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .order('data', { ascending: true })
          
          if (error2) throw error2
          
          dadosFiltrados = transacoesMes || []
          
        } else {
          // Modo 10 dias para LOJA
          const ontem = new Date(hoje)
          ontem.setDate(ontem.getDate() - 1)
          const ontemStr = ontem.toISOString().split('T')[0]
          const fim10Dias = new Date(hoje)
          fim10Dias.setDate(fim10Dias.getDate() + 9)
          const fim10DiasStr = fim10Dias.toISOString().split('T')[0]
          
          console.log(`📅 LOJA - Período 10 dias: ${ontemStr} até ${fim10DiasStr}`)
          
          // Calcular saldo acumulado até ontem
          const { data: transacoesAteOntem, error: error1 } = await supabase
            .from('transacoes_loja')
            .select('*')
            .lt('data', hoje)
          
          if (error1) throw error1
          
          if (transacoesAteOntem) {
            transacoesAteOntem.forEach(item => {
              const data = item.data.includes('T') ? item.data.split('T')[0] : item.data
              
              if (data < hoje) {
                if (item.tipo === 'entrada') {
                  saldoAcumulado += item.total
                } else {
                  saldoAcumulado -= item.total
                }
              }
            })
          }
          
          console.log(`💰 LOJA - Novo saldo até ontem: R$ ${saldoAcumulado.toFixed(2)}`)
          
          // Buscar transações dos 10 dias
          const { data: transacoes10Dias, error: error2 } = await supabase
            .from('transacoes_loja')
            .select('*')
            .gte('data', ontemStr)
            .lte('data', fim10DiasStr)
            .order('data', { ascending: true })
          
          if (error2) throw error2
          
          dadosFiltrados = transacoes10Dias || []
        }
        
        console.log(`📈 LOJA - ${dadosFiltrados.length} transações filtradas`)
      }
      
      // ✅ CALCULAR NOVOS DADOS
      const dadosAgrupados: Record<string, { receitas: number, despesas: number }> = {}
      
      dadosFiltrados.forEach(item => {
        const dataItem = contexto === 'casa' ? item.data_lancamento : item.data
        const data = dataItem.includes('T') ? dataItem.split('T')[0] : dataItem
        
        if (!dadosAgrupados[data]) {
          dadosAgrupados[data] = { receitas: 0, despesas: 0 }
        }
        
        const valor = contexto === 'casa' ? item.valor : item.total
        
        if (item.tipo === 'entrada') {
          dadosAgrupados[data].receitas += valor
        } else {
          dadosAgrupados[data].despesas += valor
        }
      })
      
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
      
      console.log(`✅ ${contexto} - ATUALIZAÇÃO COMPLETA: ${caixaPrevistoTemp.length} dias`)
      console.log(`💰 ${contexto} - Saldo inicial: R$ ${saldoAcumulado.toFixed(2)}`)
      console.log(`💰 ${contexto} - Saldo final: R$ ${saldoAtual.toFixed(2)}`)
      
      setCaixaPrevisto(caixaPrevistoTemp)
      
    } catch (error) {
      console.error(`❌ ${contexto} - Erro ao atualizar:`, error)
    } finally {
      setCarregando(false)
    }
  }

  const handleMudarParaMes = () => {
    if (!dadosProntos) return
    
    console.log(`🎯 ${contexto} - VER MÊS`)
    setMostrandoMes(true)
    setTimeout(() => {
      carregarDados(true)
    }, 10)
  }

  const handleVoltar10Dias = () => {
    if (!dadosProntos) return
    
    console.log(`🎯 ${contexto} - VER 10 DIAS`)
    setMostrandoMes(false)
    setTimeout(() => {
      carregarDados(false)
    }, 10)
  }

  const handleMesFiltroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoMes = e.target.value
    console.log(`📅 ${contexto} - Mês alterado: ${novoMes}`)
    setMesFiltro(novoMes)
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
    if (mostrandoMes && mesFiltro) {
      const [ano, mes] = mesFiltro.split('-')
      return `Mês: ${mes}/${ano}`
    } else {
      const hoje = getDataAtualBrasil()
      const ontemDate = new Date(hoje)
      ontemDate.setDate(ontemDate.getDate() - 1)
      const fim10Dias = new Date(hoje)
      fim10Dias.setDate(fim10Dias.getDate() + 9)
      
      return `${formatarDataParaExibicao(ontemDate.toISOString().split('T')[0])} a ${formatarDataParaExibicao(fim10Dias.toISOString().split('T')[0])}`
    }
  }

  if (!dadosProntos && contexto === 'casa') {
    return (
      <div className="bg-white rounded-lg shadow-md p-1">
        <p className="text-gray-500 text-center" style={{ fontSize: '12px' }}>
          Aguardando dados...
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1">
      <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>{titulo || 'Caixa'}</h2>

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
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold text-gray-700" style={{ fontSize: '12px' }}>
            {getTituloPrevisao()}
          </h3>
          <div className="flex gap-0.5">
            {!mostrandoMes ? (
              <button
                onClick={handleMudarParaMes}
                disabled={carregando || !dadosProntos}
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
                  disabled={carregando || !dadosProntos}
                  className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleVoltar10Dias}
                  disabled={carregando || !dadosProntos}
                  className="px-1.5 py-0.5 bg-gray-500 text-white hover:bg-gray-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
                >
                  10 Dias
                </button>
              </>
            )}
          </div>
        </div>

        {carregando ? (
          <p className="text-gray-500 text-center py-2" style={{ fontSize: '12px' }}>
            Atualizando {mostrandoMes ? 'mês' : '10 dias'}...
          </p>
        ) : caixaPrevisto.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="text-[10px] text-gray-500 mb-1">
              Mostrando {caixaPrevisto.length} dias com transações
              <span className="ml-2 text-blue-500">✓ Atualizado</span>
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
                  <tr key={`${dia.data}-${idx}-${ultimaAtualizacao}`} className="border-b border-gray-200 hover:bg-gray-50">
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
              {mostrandoMes 
                ? `Nenhuma transação encontrada para ${mesFiltro}`
                : dadosProntos ? 'Nenhuma transação nos próximos 10 dias' : 'Carregando...'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}