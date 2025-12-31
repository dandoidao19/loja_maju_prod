
// src/components/ModuloCasa.tsx
'use client';

import { useState } from 'react';
import CaixaCasa from './CaixaCasa';
import FiltrosLancamentos from './FiltrosLancamentos';
import TabelaLancamentosCasa from './TabelaLancamentosCasa';
import FormularioLancamento from './FormularioLancamento'; // Assuming this is the new name for the form

export default function ModuloCasa() {
  const [filtros, setFiltros] = useState({});
  const [formularioAberto, setFormularioAberto] = useState(false);

  return (
    <div className="space-y-4">
      <FiltrosLancamentos setFiltros={setFiltros} />

      <div className="bg-white rounded-lg shadow-md overflow-hidden p-4">
        <button
          onClick={() => setFormularioAberto(!formularioAberto)}
          className="w-full text-left font-semibold text-gray-800 focus:outline-none"
        >
          {formularioAberto ? '▲ Fechar Novo Lançamento' : '▼ Abrir Novo Lançamento'}
        </button>
        {formularioAberto && (
          <div className="mt-4">
            <FormularioLancamento />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <CaixaCasa />
        </div>
        <div className="lg:col-span-2">
          <TabelaLancamentosCasa filtros={filtros} />
        </div>
      </div>
    </div>
  );
}
