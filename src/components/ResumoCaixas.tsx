'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { getDataAtualBrasil, getMesAtualParaInput, prepararDataParaInsert, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
interface LancamentoFinanceiro {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  status: string
  centro_custo_id: string
}

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

interface ResumoDia {
  entradas: number
  saidas: number
}

export default function ResumoCaixas() {
  const { dados } = useDadosFinanceiros()
  const [caixaRealCasa, setCaixaRealCasa] = useState(0)
  const [caixaRealLoja, setCaixaRealLoja] = useState(0)
  const [resumoHojeCasa, setResumoHojeCasa] = useState<ResumoDia>({ entradas: 0, saidas: 0 })
  const [resumoHojeLoja, setResumoHojeLoja] = useState<ResumoDia>({ entradas: 0, saidas: 0 })
  const [caixaPrevistoCasa, setCaixaPrevistoCasa] = useState<DiaCaixa[]>([])
  const [caixaPrevistoLoja, setCaixaPrevistoLoja] = useState<DiaCaixa[]>([])
  const [mesFiltro, setMesFiltro] = useState(getMesAtualParaInput())
  const [carregando, setCarregando] = useState(false)

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarMoedaCompacta = (valor: number) => {
    if (valor === 0) return 'R$ 0'

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor)
  }

  const formatarDataTabela = (dataISO: string) => {
    try {
      const dataFormatada = formatarDataParaExibicao(dataISO)

      let dataParaConversao = dataISO;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
          dataParaConversao = `${dataISO}T12:00:00`;
      }
      const data = new Date(dataParaConversao)

      const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')

      return `${diaSemana} - ${dataFormatada}`
    } catch {
      return dataISO
    }
  }

  const buscarDadosContexto = useCallback(async (contexto: 'casa' | 'loja') => {
    try {
      const hoje = getDataAtualBrasil()
      console.log(`📅 ${contexto} - Data HOJE (Brasil):`, hoje)

      const [ano, mes] = mesFiltro.split('-')
      const primeiroDia = `${ano}-${mes}-01`

      const ultimoDiaDate = new Date(parseInt(ano), parseInt(mes), 0)
      const ultimoDiaFormatado = prepararDataParaInsert(ultimoDiaDate)

      console.log(`📅 ${contexto} - Período:`, { primeiroDia, ultimoDiaFormatado })

      const { data: centros } = await supabase
        .from('centros_de_custo')
        .select('id')
        .eq('contexto', contexto)

      if (!centros || centros.length === 0) {
        return {
          caixaReal: 0,
          previsoesHoje: { entradas: 0, saidas: 0 },
          caixaPrevisto: []
        }
      }

      const centroIds = centros.map(c => c.id)

      const { data: lancamentosMes } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        .gte('data_prevista', primeiroDia)
        .lte('data_prevista', ultimoDiaFormatado)
        .in('centro_custo_id', centroIds)
        .order('data_prevista', { ascending: true })

      console.log(`📊 ${contexto} - Total lançamentos:`, lancamentosMes?.length || 0)

      let caixaReal = 0
      let entradasHoje = 0
      let saidasHoje = 0
      const lancamentosPorData: Record<string, LancamentoFinanceiro[]> = {}

      if (lancamentosMes) {
        lancamentosMes.forEach(lanc => {
          const dataPrevista = lanc.data_prevista || lanc.data_lancamento
          const dataLancamento = dataPrevista.includes('T')
            ? dataPrevista.split('T')[0]
            : dataPrevista

          if (!lancamentosPorData[dataLancamento]) {
            lancamentosPorData[dataLancamento] = []
          }
          lancamentosPorData[dataLancamento].push(lanc)

          if (dataLancamento === hoje) {
            console.log(`✅ ${contexto} - Lançamento HOJE:`, lanc.descricao, lanc.valor, lanc.tipo)
            if (lanc.tipo === 'entrada') {
              entradasHoje += lanc.valor
            } else {
              saidasHoje += lanc.valor
            }
          }
        })
      }

      const { data: lancamentosRealizados } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        .eq('status', 'realizado')
        .lte('data_lancamento', hoje)
        .in('centro_custo_id', centroIds)

      if (lancamentosRealizados) {
        lancamentosRealizados.forEach(lanc => {
          if (lanc.tipo === 'entrada') {
            caixaReal += lanc.valor
          } else {
            caixaReal -= lanc.valor
          }
        })
      }

      console.log(`💰 ${contexto} - Resultados:`, {
        caixaReal,
        entradasHoje,
        saidasHoje,
        lancamentosRealizados: lancamentosRealizados?.length || 0
      })

      const caixaPrevisto: DiaCaixa[] = []
      const datasUnicas = Object.keys(lancamentosPorData).sort()
      let saldoAcumulado = 0

      datasUnicas.forEach(data => {
        const lancamentosDia = lancamentosPorData[data]

        let receitas = 0
        let despesas = 0

        lancamentosDia.forEach(lanc => {
          if (lanc.tipo === 'entrada') {
            receitas += lanc.valor
          } else {
            despesas += lanc.valor
          }
        })

        const saldoDia = receitas - despesas
        saldoAcumulado += saldoDia

        caixaPrevisto.push({
          data,
          data_formatada: formatarDataTabela(data),
          receitas,
          despesas,
          saldo_acumulado: saldoAcumulado
        })
      })

      return {
        caixaReal,
        previsoesHoje: { entradas: entradasHoje, saidas: saidasHoje },
        caixaPrevisto
      }

    } catch (error) {
      console.error(`❌ Erro ao buscar dados ${contexto}:`, error)
      return {
        caixaReal: 0,
        previsoesHoje: { entradas: 0, saidas: 0 },
        caixaPrevisto: []
      }
    }
  }, [mesFiltro])

  const carregarDados = async () => {
    setCarregando(true)

    try {
      const [dadosCasa, dadosLoja] = await Promise.all([
        buscarDadosContexto('casa'),
        buscarDadosContexto('loja')
      ])

      setCaixaRealCasa(dadosCasa.caixaReal)
      setCaixaRealLoja(dadosLoja.caixaReal)
      setResumoHojeCasa(dadosCasa.previsoesHoje)
      setResumoHojeLoja(dadosLoja.previsoesHoje)
      setCaixaPrevistoCasa(dadosCasa.caixaPrevisto)
      setCaixaPrevistoLoja(dadosLoja.caixaPrevisto)

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [mesFiltro, buscarDadosContexto])

  // CORREÇÃO: Sincronizar com cache global quando há mudanças
  useEffect(() => {
    console.log('🔄 Atualizando ResumoCaixas - ultimaAtualizacao:', dados.ultimaAtualizacao)
    carregarDados()
  }, [dados.ultimaAtualizacao])

  // Sincronizar caixa real com cache global
  useEffect(() => {
    setCaixaRealCasa(dados.caixaRealCasa)
    setCaixaRealLoja(dados.caixaRealLoja)
  }, [dados.caixaRealCasa, dados.caixaRealLoja])

  const CaixaRealFormatado = ({ valor, tema }: { valor: number, tema: 'casa' | 'loja' }) => {
    const isNegativo = valor < 0

    if (isNegativo) {
      return (
        <div className="inline-block px-3 py-1 rounded-md border-2 border-red-500 bg-red-500">
          <div className="text-lg font-bold text-white">
            {formatarMoeda(valor)}
          </div>
        </div>
      )
    }

    const corTexto = tema === 'casa' ? 'text-blue-600' : 'text-pink-600'
    return (
      <div className={`text-lg font-bold ${corTexto}`}>
        {formatarMoeda(valor)}
      </div>
    )
  }

  const dataExibicao = formatarDataParaExibicao(getDataAtualBrasil())

  return (
    <div className="space-y-4">
      {/* Filtro por mês */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">RESUMO DE CAIXAS</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Filtrar por mês:</span>
            <input
              type="month"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            />
            {carregando && (
              <div className="text-sm text-gray-500">Carregando...</div>
            )}
          </div>
        </div>
      </div>

      {/* Caixa Casa e Caixa Loja lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* CAIXA CASA */}
        <div className="bg-white rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="p-3 border-b">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <h3 className="text-lg font-semibold text-gray-800">CAIXA CASA</h3>
            </div>
          </div>

          {/* Caixa Real Casa */}
          <div className="p-2 border-b">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-medium text-gray-700">Caixa Real</h4>
              <span className="text-xs text-gray-500">{dataExibicao}</span>
            </div>

            <div className="py-1 flex justify-center">
              <CaixaRealFormatado valor={caixaRealCasa} tema="casa" />
            </div>

            {/* Previsões para HOJE */}
            <div className="mt-1 pt-1 border-t border-gray-100">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Entradas Hoje:</span>
                <span className="text-green-600 font-medium">{formatarMoeda(resumoHojeCasa.entradas)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Saídas Hoje:</span>
                <span className="text-red-600 font-medium">{formatarMoeda(resumoHojeCasa.saidas)}</span>
              </div>
            </div>
          </div>

          {/* Caixa Previsto Casa */}
          <div className="p-3">
            <h4 className="text-sm font-semibold mb-2 text-gray-700">Previsão do Mês ({mesFiltro})</h4>
            <div className="h-64 overflow-y-auto">
              <table className="min-w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                    <th className="px-2 py-1 text-right font-medium text-gray-700">Receitas</th>
                    <th className="px-2 py-1 text-right font-medium text-gray-700">Despesas</th>
                    <th className="px-2 py-1 text-right font-medium text-gray-700">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {caixaPrevistoCasa.map((dia) => (
                    <tr key={dia.data} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-1 text-gray-700 whitespace-nowrap">{dia.data_formatada}</td>
                      <td className="px-2 py-1 text-right text-green-600">{formatarMoedaCompacta(dia.receitas)}</td>
                      <td className="px-2 py-1 text-right text-red-600">{formatarMoedaCompacta(dia.despesas)}</td>
                      <td className={`px-2 py-1 text-right font-medium ${dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatarMoedaCompacta(dia.saldo_acumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CAIXA LOJA */}
        <div className="bg-white rounded-lg shadow-md border-l-4 border-pink-500">
          <div className="p-3 border-b">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-pink-500"></div>
              <h3 className="text-lg font-semibold text-gray-800">CAIXA LOJA</h3>
            </div>
          </div>

          {/* Caixa Real Loja */}
          <div className="p-2 border-b">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-medium text-gray-700">Caixa Real</h4>
              <span className="text-xs text-gray-500">{dataExibicao}</span>
            </div>

            <div className="py-1 flex justify-center">
              <CaixaRealFormatado valor={caixaRealLoja} tema="loja" />
            </div>

            {/* Previsões para HOJE */}
            <div className="mt-1 pt-1 border-t border-gray-100">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Entradas Hoje:</span>
                <span className="text-green-600 font-medium">{formatarMoeda(resumoHojeLoja.entradas)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Saídas Hoje:</span>
                <span className="text-red-600 font-medium">{formatarMoeda(resumoHojeLoja.saidas)}</span>
              </div>
            </div>
          </div>

          {/* Caixa Previsto Loja */}
          <div className="p-3">
            <h4 className="text-sm font-semibold mb-2 text-gray-700">Previsão do Mês ({mesFiltro})</h4>
            <div className="h-64 overflow-y-auto">
              <table className="min-w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                    <th className="px-2 py-1 text-right font-medium text-gray-700">Receitas</th>
                    <th className="px-2 py-1 text-right font-medium text-gray-700">Despesas</th>
                    <th className="px-2 py-1 text-right font-medium text-gray-700">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {caixaPrevistoLoja.map((dia) => (
                    <tr key={dia.data} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-1 text-gray-700 whitespace-nowrap">{dia.data_formatada}</td>
                      <td className="px-2 py-1 text-right text-green-600">{formatarMoedaCompacta(dia.receitas)}</td>
                      <td className="px-2 py-1 text-right text-red-600">{formatarMoedaCompacta(dia.despesas)}</td>
                      <td className={`px-2 py-1 text-right font-medium ${dia.saldo_acumulado >= 0 ? 'text-pink-600' : 'text-red-600'}`}>
                        {formatarMoedaCompacta(dia.saldo_acumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
