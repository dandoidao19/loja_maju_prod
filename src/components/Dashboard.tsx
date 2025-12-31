'use client'

import React from 'react'

// Componente de placeholder para o futuro Controle Orçamentário
const ControleOrcamentarioPlaceholder = () => (
  <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-gray-300">
    <h3 className="text-lg font-semibold text-gray-800 mb-4">Controle Orçamentário</h3>
    <div className="text-center text-gray-500">
      <p>Em breve...</p>
      <p className="text-sm">Esta área será dedicada ao acompanhamento de metas e orçamentos por categoria.</p>
    </div>
  </div>
);

// Componente principal do Dashboard
export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-sm text-gray-600">Sua visão financeira unificada.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna da Esquerda: Caixa Universal */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Caixa Universal</h3>
          <div className="text-center text-gray-500">
             <p>Carregando dados...</p>
          </div>
        </div>

        {/* Coluna da Direita: Controle Orçamentário */}
        <div>
          <ControleOrcamentarioPlaceholder />
        </div>
      </div>
    </div>
  )
}
