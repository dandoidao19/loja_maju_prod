
'use client';

import { useState } from 'react';
import CaixaUnificado from '@/components/CaixaUnificado';
import ModuloCasa from '@/components/ModuloCasa';
import TelaInicialLoja from '@/components/TelaInicialLoja';

type Tab = 'dashboard' | 'casa' | 'loja' | 'configuracoes';

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <CaixaUnificado />;
      case 'casa':
        return <ModuloCasa />;
      case 'loja':
        return <TelaInicialLoja />;
      case 'configuracoes':
        return <p>Em desenvolvimento...</p>;
      default:
        return <CaixaUnificado />;
    }
  };

  const getButtonClass = (tab: Tab) => {
    return activeTab === tab
      ? 'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
      : 'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none';
  };

  return (
    <div>
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex space-x-2" aria-label="Tabs">
          <button onClick={() => setActiveTab('dashboard')} className={getButtonClass('dashboard')}>
            Caixa Universal
          </button>
          <button onClick={() => setActiveTab('casa')} className={getButtonClass('casa')}>
            Casa
          </button>
          <button onClick={() => setActiveTab('loja')} className={getButtonClass('loja')}>
            Loja
          </button>
          <button onClick={() => setActiveTab('configuracoes')} className={getButtonClass('configuracoes')}>
            Configurações
          </button>
        </nav>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
}
