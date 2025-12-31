'use client'

import { useState, useMemo, useEffect } from 'react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { getDataAtualBrasil, formatarDataParaExibicao, buildCumulativeSeries } from '@/lib/dateUtils'
import { useCaixaCasaData } from '@/hooks/useCaixaCasaData'

export default function VisualizacaoCaixaCasa({ titulo }: { titulo?: string }) {
  const { dados } = useDadosFinanceiros()
  const { data: caixaData, isLoading, error } = useCaixaCasaData()

  const [caixaReal, setCaixaReal] = useState(0)
  const [entradasHoje, setEntradasHoje] = useState(0)
  const [saidasHoje, setSaidasHoje] = useState(0)
  const [mostrandoMes, setMostrandoMes] = useState(true)
  const [mesFiltro, setMesFiltro] = useState('')

  useEffect(() => {
    setCaixaReal(dados.caixaRealCasa || 0)
    // A lógica para calcular entradas/saídas de hoje pode ser movida para o hook também
  }, [dados.caixaRealCasa])

  const caixaPrevisto = useMemo(() => {
    if (!caixaData) return []
    return buildCumulativeSeries(caixaData)
  }, [caixaData])

  if (error) return <div>Erro ao carregar dados do caixa.</div>

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1">
        <h2 className="font-semibold text-gray-800 text-sm">{titulo || 'Caixa Casa'}</h2>
        {/* Real-time cash section */}
        <div className={`rounded p-1.5 ${caixaReal < 0 ? 'bg-red-500' : 'bg-blue-50'}`}>
            <p className={`text-xs ${caixaReal < 0 ? 'text-red-100' : 'text-gray-600'}`}>Caixa Real:</p>
            <p className={`text-2xl font-bold ${caixaReal < 0 ? 'text-white' : 'text-blue-600'}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(caixaReal)}</p>
        </div>
        {/* Predicted cash section */}
        <div>
            <h3 className="font-semibold text-gray-700 text-xs">Previsão</h3>
            {isLoading ? (
                <p className="text-xs text-gray-500 text-center py-2">Carregando...</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th className="text-right">Acumulado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {caixaPrevisto.slice(0, 10).map((dia, idx) => ( // Show first 10 days for brevity
                                <tr key={idx}>
                                    <td>{dia.data_formatada}</td>
                                    <td className={`text-right font-bold ${dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dia.saldo_acumulado)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  )
}
