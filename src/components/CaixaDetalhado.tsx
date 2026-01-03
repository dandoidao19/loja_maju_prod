// components/CaixaDetalhado.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useCaixaUniversal } from '@/hooks/useCaixaUniversal'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

interface Props {
  contexto: 'casa' | 'loja'
  titulo?: string
  onToggleTudo?: (mostrarTudo: boolean) => void
}

export default function CaixaDetalhado({
  contexto,
  titulo,
  onToggleTudo
}: Props) {
  const {
    caixaReal,
    entradasHoje,
    saidasHoje,
    caixaPrevisto,
    carregando,
    calcularHoje,
    carregarCaixaPrevisto,
    ultimaAtualizacao
  } = useCaixaUniversal(contexto)

  const [modo, setModo] = useState(contexto === 'loja' ? '30dias' : '10dias')
  const [mesFiltro, setMesFiltro] = useState('')

  useEffect(() => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    setMesFiltro(`${ano}-${mes}`)
  }, [])

  useEffect(() => {
    calcularHoje()
    carregarCaixaPrevisto(modo as any, mesFiltro)
  }, [modo, mesFiltro, carregarCaixaPrevisto, calcularHoje])

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  const formatarMoedaCompacta = (valor: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor)

  // Renderiza os botões de controle de visualização
  const renderBotoesModo = () => {
    // ... Lógica para renderizar botões baseada no contexto
    return <div>Botoes</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1">
      <h2 className="font-semibold text-gray-800 text-sm">{titulo || 'Caixa'}</h2>

      {/* Caixa Real */}
      <div
        className={`rounded p-1.5 ${
          caixaReal < 0 ? 'bg-red-500' : 'bg-blue-50 border border-blue-200'
        }`}
      >
        <p
          className={`${
            caixaReal < 0 ? 'text-red-100' : 'text-gray-600'
          }`}
        >
          Caixa Real:
        </p>
        <p
          className={`text-lg font-bold ${
            caixaReal < 0 ? 'text-white' : 'text-blue-600'
          }`}
        >
          {formatarMoeda(caixaReal)}
        </p>
        <div className="mt-0.5 flex gap-2 items-center">
          <span className="text-green-600">
            ↑ {formatarMoedaCompacta(entradasHoje)}
          </span>
          <span className="text-red-600">
            ↓ {formatarMoedaCompacta(saidasHoje)}
          </span>
        </div>
      </div>

      {/* Caixa Previsto */}
      <div className="space-y-1">
        {renderBotoesModo()}
        {carregando ? (
          <p>Carregando...</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th>Data</th>
                <th>Receitas</th>
                <th>Despesas</th>
                <th>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {caixaPrevisto.map((dia, idx) => (
                <tr key={`${dia.data}-${idx}`}>
                  <td>{dia.data_formatada}</td>
                  <td>{formatarMoedaCompacta(dia.receitas)}</td>
                  <td>{formatarMoedaCompacta(dia.despesas)}</td>
                  <td>{formatarMoedaCompacta(dia.saldo_acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
