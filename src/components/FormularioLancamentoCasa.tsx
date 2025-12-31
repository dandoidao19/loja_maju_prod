'use client'

import React from 'react'
import { FormLancamento, CentroCusto } from '@/types'

interface FormularioLancamentoCasaProps {
  form: FormLancamento
  setForm: React.Dispatch<React.SetStateAction<FormLancamento>>
  centrosCustoFiltrados: CentroCusto[]
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isEditing: boolean
  isLoading: boolean
  abaLancamentos: 'padrao' | 'recorrente'
  setAbaLancamentos: React.Dispatch<React.SetStateAction<'padrao' | 'recorrente'>>
}

export default function FormularioLancamentoCasa({
  form, setForm, centrosCustoFiltrados, onSubmit, onCancel, isEditing, isLoading, abaLancamentos, setAbaLancamentos
}: FormularioLancamentoCasaProps) {

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-2 border-t border-gray-200">
      <div className="flex space-x-2 mb-2 border-b border-gray-200">
        <button
          onClick={() => setAbaLancamentos('padrao')}
          className={`px-3 py-1 font-medium text-xs border-b-2 transition-colors ${
            abaLancamentos === 'padrao' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'
          }`}
        >
          À Vista / Parcelado
        </button>
        <button
          onClick={() => setAbaLancamentos('recorrente')}
          className={`px-3 py-1 font-medium text-xs border-b-2 transition-colors ${
            abaLancamentos === 'recorrente' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'
          }`}
        >
          Recorrente
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-1.5">
        <div className="grid grid-cols-2 gap-2">
          <input name="descricao" value={form.descricao} onChange={handleInputChange} placeholder="Descrição" className="input-class" />
          <input name="valor" type="number" value={form.valor} onChange={handleInputChange} placeholder="Valor" className="input-class" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <select name="tipo" value={form.tipo} onChange={handleInputChange} className="input-class">
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
          <select name="status" value={form.status} onChange={handleInputChange} className="input-class">
            <option value="pago">Pago</option>
            <option value="previsto">Previsto</option>
          </select>
          <select name="centroCustoId" value={form.centroCustoId} onChange={handleInputChange} className="input-class">
            <option value="">Centro de Custo...</option>
            {centrosCustoFiltrados.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input name="data" type="date" value={form.data} onChange={handleInputChange} className="input-class" />
        </div>
        {/* Conditional rendering for installments or recurring */}
        <div className="flex space-x-2 pt-1">
          {isEditing && <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>}
          <button type="submit" disabled={isLoading} className="btn-primary flex-1">
            {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  )
}
