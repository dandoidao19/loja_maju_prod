'use client'

import { useCaixaUniversal } from '@/hooks/useCaixaUniversal'
import { formatarDataParaExibicao, getDataAtualBrasil } from '@/lib/dateUtils'
import { useState } from 'react'

export default function CaixaGeral() {
  const {
    caixaRealGeral,
    caixaRealLoja,
    caixaRealCasa,
    caixaPrevistoGeral,
    entradasHoje,
    saidasHoje,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    ultimaAtualizacao,
    getTituloPrevisao
  } = useCaixaUniversal()

  const handleMudarParaMes = () => setFiltro('mes')
  const handleVoltar30Dias = () => setFiltro('30dias')
  const handleMostrarHistorico = () => setFiltro('tudo')

  const handleMesFiltroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMesFiltro(e.target.value)
  }

  const caixaTituloStyle: React.CSSProperties = { fontSize: '11px', marginBottom: 2, whiteSpace: 'nowrap' }
  const caixaValorStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, lineHeight: '1.05', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const caixaSubContainerStyle: React.CSSProperties = { fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: 8, alignItems: 'center' }
  const periodoLinhaStyle: React.CSSProperties = { fontSize: '11px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 4, marginBottom: 4, paddingLeft: 4 }
  const botoesContainerStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  const formatarMoedaCompacta = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor)

  const renderBotoesModo = () => {
    if (filtro === '30dias') {
      return (
        <div style={botoesContainerStyle}>
          <button onClick={handleMudarParaMes} disabled={carregando} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs font-medium">Ver Mês</button>
          <button onClick={handleMostrarHistorico} disabled={carregando} className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-medium">TUDO</button>
        </div>
      )
    }
    if (filtro === 'mes') {
      return (
        <div style={botoesContainerStyle}>
          <input type="month" value={mesFiltro} onChange={handleMesFiltroChange} disabled={carregando} className="px-1.5 py-0.5 text-xs border border-gray-300 rounded" />
          <button onClick={handleVoltar30Dias} disabled={carregando} className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs font-medium">30 Dias</button>
          <button onClick={handleMostrarHistorico} disabled={carregando} className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-medium">TUDO</button>
        </div>
      )
    }
    if (filtro === 'tudo') {
      return <button onClick={handleVoltar30Dias} disabled={carregando} className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs font-medium">Voltar</button>
    }
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1" style={{ minWidth: 0 }}>
      <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>Caixa Geral</h2>

      <div className={`rounded p-1.5 ${caixaRealGeral < 0 ? 'bg-red-500' : 'bg-blue-50 border border-blue-200'}`} style={{ minWidth: 0 }}>
        <div>
          <div style={{...caixaTituloStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}} className={`${caixaRealGeral < 0 ? 'text-red-100' : 'text-gray-600'}`}>
            <span>Caixa Real:</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
              <span className={caixaRealLoja >= 0 ? 'text-green-700' : 'text-red-700'}>L: {formatarMoeda(caixaRealLoja)}</span>
              <span className="mx-2">|</span>
              <span className={caixaRealCasa >= 0 ? 'text-green-700' : 'text-red-700'}>C: {formatarMoeda(caixaRealCasa)}</span>
            </span>
          </div>
          <p style={caixaValorStyle} className={`${caixaRealGeral < 0 ? 'text-white' : 'text-blue-600'}`}>{formatarMoeda(caixaRealGeral)}</p>
          <div style={caixaSubContainerStyle} className="mt-0.5">
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span className="text-green-600">↑ {formatarMoedaCompacta(entradasHoje)}</span>
              <span className="text-red-600">↓ {formatarMoedaCompacta(saidasHoje)}</span>
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
        ) : caixaPrevistoGeral.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="text-[10px] text-gray-500 mb-1">
              Mostrando {caixaPrevistoGeral.length} dias
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
                {caixaPrevistoGeral.map((dia, idx) => (
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
            <p className="text-gray-500 text-xs">Nenhuma transação encontrada</p>
          </div>
        )}
      </div>
    </div>
  )
}
