'use client'

import React from 'react'
import { Lancamento } from '@/types'
import { formatarDataParaExibicao } from '@/lib/dateUtils'

interface TabelaLancamentosCasaProps {
  lancamentos: Lancamento[]
  onEdit: (lancamento: Lancamento) => void
  onDelete: (lancamento: Lancamento) => void
  onPay: (lancamento: Lancamento) => void
  titulo: string
  mostrarTodos: boolean
  setMostrarTodos: (mostrar: boolean) => void
  isLoading: boolean
}

export default function TabelaLancamentosCasa({
  lancamentos, onEdit, onDelete, onPay, titulo, mostrarTodos, setMostrarTodos, isLoading
}: TabelaLancamentosCasaProps) {

  if (isLoading) {
    return <p className="text-xs text-gray-500 text-center py-4">⏳ Carregando lançamentos...</p>
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xs font-semibold text-gray-800">{titulo}</h2>
        <button
          onClick={() => setMostrarTodos(!mostrarTodos)}
          className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
            mostrarTodos ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {mostrarTodos ? '11 DIAS' : 'VER TUDO'}
        </button>
      </div>

      {lancamentos.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">📭 Nenhum lançamento encontrado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th>Data</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Descrição</th>
                <th>CDC</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((lancamento) => (
                <tr key={lancamento.id} className="border-b hover:bg-gray-50">
                  <td>{formatarDataParaExibicao(lancamento.data_prevista || lancamento.data_lancamento)}</td>
                  <td>{lancamento.status === 'realizado' ? 'Pago' : 'Previsto'}</td>
                  <td className={lancamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                    {lancamento.tipo === 'entrada' ? '+' : '-'} R$ {lancamento.valor.toFixed(2)}
                  </td>
                  <td>{lancamento.descricao}</td>
                  <td>{lancamento.centros_de_custo?.nome || '-'}</td>
                  <td>
                    <button onClick={() => onEdit(lancamento)}>✏️</button>
                    {lancamento.status === 'previsto' && <button onClick={() => onPay(lancamento)}>💰</button>}
                    <button onClick={() => onDelete(lancamento)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
