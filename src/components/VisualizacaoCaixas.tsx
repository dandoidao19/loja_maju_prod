'use client'

import { formatarDataParaExibicao } from '@/lib/dateUtils'

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

interface VisualizacaoCaixasProps {
  titulo: string
  caixaReal: number
  resumoHoje: ResumoDia
  caixaPrevisto: DiaCaixa[]
  cor?: 'blue' | 'green'
}

export default function VisualizacaoCaixas({
  titulo,
  caixaReal,
  resumoHoje,
  caixaPrevisto,
  cor = 'blue'
}: VisualizacaoCaixasProps) {
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

  const corConfig = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      header: 'bg-blue-100',
      gradient: 'from-blue-500 to-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      header: 'bg-green-100',
      gradient: 'from-green-500 to-green-600'
    }
  }

  const config = corConfig[cor]

  return (
    <div className="space-y-3">
      {/* Título */}
      <h3 className={`text-lg font-bold ${config.text}`}>{titulo}</h3>

      {/* Caixa Real - Melhorado */}
      <div className={`${config.bg} border-2 ${config.border} rounded-xl p-4 shadow-sm`}>
        <h4 className={`text-xs font-semibold ${config.text} mb-3 uppercase tracking-wide`}>💰 Caixa Real</h4>
        <p className={`text-3xl font-bold ${config.text} mb-3`}>
          {formatarMoeda(caixaReal)}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white rounded p-2 border border-gray-200">
            <p className="text-gray-600 font-medium">Entradas Hoje</p>
            <p className="text-lg font-bold text-green-600 mt-1">{formatarMoedaCompacta(resumoHoje.entradas)}</p>
          </div>
          <div className="bg-white rounded p-2 border border-gray-200">
            <p className="text-gray-600 font-medium">Saídas Hoje</p>
            <p className="text-lg font-bold text-red-600 mt-1">{formatarMoedaCompacta(resumoHoje.saidas)}</p>
          </div>
        </div>
      </div>

      {/* Caixa Previsto */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
        <h4 className={`text-xs font-semibold ${config.text} mb-3 uppercase tracking-wide`}>📊 Caixa Previsto</h4>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className={`${config.header} sticky top-0`}>
              <tr>
                <th className="p-2 text-left font-semibold text-gray-700">Data</th>
                <th className="p-2 text-right font-semibold text-gray-700">Receitas</th>
                <th className="p-2 text-right font-semibold text-gray-700">Despesas</th>
                <th className="p-2 text-right font-semibold text-gray-700">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {caixaPrevisto.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-gray-500">
                    📭 Sem dados de caixa previsto
                  </td>
                </tr>
              ) : (
                caixaPrevisto.map((dia) => (
                  <tr key={dia.data} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-2 text-gray-700 font-medium">{formatarDataTabela(dia.data)}</td>
                    <td className="p-2 text-right text-green-600 font-semibold">
                      +{formatarMoedaCompacta(dia.receitas)}
                    </td>
                    <td className="p-2 text-right text-red-600 font-semibold">
                      -{formatarMoedaCompacta(dia.despesas)}
                    </td>
                    <td className={`p-2 text-right font-bold ${dia.saldo_acumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatarMoedaCompacta(dia.saldo_acumulado)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
