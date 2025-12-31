
// src/components/FiltrosLancamentos.tsx
'use client';

import { useState } from 'react';

interface FiltrosLancamentosProps {
  setFiltros: (filtros: any) => void;
}

export default function FiltrosLancamentos({ setFiltros }: FiltrosLancamentosProps) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [descricao, setDescricao] = useState('');

  const handleApplyFilters = () => {
    setFiltros({ dataInicio, dataFim, descricao });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
      <h2 className="text-lg font-semibold">Filtros</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="p-2 border rounded"
        />
      </div>
      <button
        onClick={handleApplyFilters}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Aplicar Filtros
      </button>
    </div>
  );
}
