'use client'

import { useCaixaUniversal } from '@/hooks/useCaixaUniversal'
import { formatarDataParaExibicao, getDataAtualBrasil } from '@/lib/dateUtils'
import { useState } from 'react'

export default function CaixaGeral() {
  const [mesFiltro, setMesFiltro] = useState(getDataAtualBrasil().substring(0, 7))
  const {
    series,
    categories,
    saldoInicial,
    entradas,
    saidas,
    saldoFinal,
    loading,
  } = useCaixaUniversal(mesFiltro)

  const handleMesFiltroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMesFiltro(e.target.value)
  }

  const caixaTituloStyle: React.CSSProperties = { fontSize: '11px', marginBottom: 2, whiteSpace: 'nowrap' }
  const caixaValorStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, lineHeight: '1.05', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const caixaSubContainerStyle: React.CSSProperties = { fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: 8, alignItems: 'center' }
  const botoesContainerStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1" style={{ minWidth: 0 }}>
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>Caixa Geral</h2>
        <div style={botoesContainerStyle}>
          <input type="month" value={mesFiltro} onChange={handleMesFiltroChange} disabled={loading} className="px-1.5 py-0.5 text-xs border border-gray-300 rounded" />
        </div>
      </div>

      <div className={`rounded p-1.5 ${saldoFinal < 0 ? 'bg-red-500' : 'bg-blue-50 border border-blue-200'}`} style={{ minWidth: 0 }}>
        <div>
          <p style={caixaTituloStyle} className={`${saldoFinal < 0 ? 'text-red-100' : 'text-gray-600'}`}>Saldo Final:</p>
          <p style={caixaValorStyle} className={`${saldoFinal < 0 ? 'text-white' : 'text-blue-600'}`}>{formatarMoeda(saldoFinal)}</p>
          <div style={caixaSubContainerStyle} className="mt-0.5">
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span className="text-green-600">↑ {formatarMoeda(entradas)}</span>
              <span className="text-red-600">↓ {formatarMoeda(saidas)}</span>
            </div>
          </div>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-center py-2" style={{ fontSize: '12px' }}>Carregando...</p>}

    </div>
  )
}
