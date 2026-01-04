'use client'

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Transacao {
  id: string;
  numero_transacao: number;
  descricao: string;
  valor: number;
}

interface RenegotiationDetails {
  p_original_transaction_ids: string[];
  p_juros: number;
  p_desconto: number;
  p_new_installments: number;
  p_start_date: string;
  p_observacao: string;
}

interface ModalRenegociacaoProps {
  isOpen: boolean;
  onClose: () => void;
  transacoesSelecionadas: Transacao[];
  onConfirm: (renegotiationDetails: RenegotiationDetails) => void;
}

export default function ModalRenegociacao({
  isOpen,
  onClose,
  transacoesSelecionadas,
  onConfirm,
}: ModalRenegociacaoProps) {
  const [juros, setJuros] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [newInstallments, setNewInstallments] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [observacao, setObservacao] = useState('');

  if (!isOpen) return null;

  const totalOriginal = transacoesSelecionadas.reduce((acc, t) => acc + t.valor, 0);
  const totalRenegociado = totalOriginal + juros - desconto;
  const valorParcela = newInstallments > 0 ? totalRenegociado / newInstallments : 0;

  const handleConfirm = async () => {
    const renegotiationDetails: RenegotiationDetails = {
      p_original_transaction_ids: transacoesSelecionadas.map(t => t.id),
      p_juros: juros,
      p_desconto: desconto,
      p_new_installments: newInstallments,
      p_start_date: startDate,
      p_observacao: observacao,
    };

    try {
      const { error } = await supabase.rpc('renegociar_parcelas', renegotiationDetails);
      if (error) throw error;
      onConfirm(renegotiationDetails);
    } catch (error) {
      console.error('Erro ao renegociar parcelas:', error);
      alert('Ocorreu um erro ao renegociar as parcelas.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-4">Assistente de Renegociação de Dívida</h2>

        <div className="mb-4">
          <h3 className="font-semibold mb-2">Resumo das Parcelas Originais:</h3>
          <ul>
            {transacoesSelecionadas.map(t => (
              <li key={t.id}>{`#${t.numero_transacao} ${t.descricao} - R$ ${t.valor.toFixed(2)}`}</li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <p>Valor Total Original: <span className="font-bold">R$ {totalOriginal.toFixed(2)}</span></p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label>Juros:</label>
            <input type="number" value={juros} onChange={e => setJuros(parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label>Desconto:</label>
            <input type="number" value={desconto} onChange={e => setDesconto(parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded" />
          </div>
        </div>

        <div className="mb-4">
            <p>Valor Final Renegociado: <span className="font-bold">R$ {totalRenegociado.toFixed(2)}</span></p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
                <label>Nº de Parcelas:</label>
                <input type="number" value={newInstallments} onChange={e => setNewInstallments(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded" />
            </div>
            <div>
                <label>Data da 1ª Parcela:</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded" />
            </div>
        </div>

        <div className="mb-4">
            <p>Resultado: {newInstallments} nova(s) parcela(s) de R$ {valorParcela.toFixed(2)}</p>
        </div>

        <div>
            <label>Observação:</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} className="w-full p-2 border rounded" />
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400">
            Cancelar
          </button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Confirmar Renegociação
          </button>
        </div>
      </div>
    </div>
  );
}
