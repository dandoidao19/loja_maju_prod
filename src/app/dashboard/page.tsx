
// app/dashboard/page.tsx
'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DadosFinanceirosProvider } from '@/context/DadosFinanceirosContext';

import CaixaUnificado from '@/components/CaixaUnificado';
import ModuloCasa from '@/components/ModuloCasa';
import ModuloConfiguracoes from '@/components/ModuloConfiguracoes';
import ModuloLoja from '@/components/ModuloLoja';

// Criar uma única instância do QueryClient
const queryClient = new QueryClient();

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard'); // Padrão para a nova aba
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg font-semibold text-gray-700">Carregando...</div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: '📊 Dashboard', color: 'blue' },
    { id: 'casa', label: '🏠 Casa', color: 'green' },
    { id: 'loja', label: '🏪 Loja', color: 'purple' },
    { id: 'configuracoes', label: '⚙️ Configurações', color: 'gray' }
  ];

  const getButtonStyle = (id: string, color: string) => {
    const isActive = activeSection === id;
    const colors: Record<string, { active: string; inactive: string }> = {
      blue: { active: 'bg-blue-600 text-white', inactive: 'bg-white text-gray-700 hover:bg-gray-100' },
      green: { active: 'bg-green-600 text-white', inactive: 'bg-white text-gray-700 hover:bg-gray-100' },
      purple: { active: 'bg-purple-600 text-white', inactive: 'bg-white text-gray-700 hover:bg-gray-100' },
      gray: { active: 'bg-gray-600 text-white', inactive: 'bg-white text-gray-700 hover:bg-gray-100' }
    };
    return isActive ? colors[color].active : colors[color].inactive;
  };

  const getTitleBySection = () => {
    return menuItems.find(item => item.id === activeSection)?.label || 'Dashboard';
  };

  return (
    <QueryClientProvider client={queryClient}>
      <DadosFinanceirosProvider>
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto p-4">
            <header className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{getTitleBySection()}</h1>
                <p className="text-sm text-gray-600">
                  Bem-vindo, <span className="font-semibold">{user?.email}</span>
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Sair
              </button>
            </header>

            <nav className="bg-white rounded-lg shadow-md p-2 mb-4">
              <div className="flex space-x-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${getButtonStyle(item.id, item.color)}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

            <main>
              {activeSection === 'dashboard' && (
                // Alterado para um layout que permite ao CaixaUnificado se expandir
                // e se comportar como os outros módulos principais.
                <div>
                  <CaixaUnificado />
                </div>
              )}
              {activeSection === 'casa' && <ModuloCasa />}
              {activeSection === 'loja' && <ModuloLoja />}
              {activeSection === 'configuracoes' && <ModuloConfiguracoes />}
            </main>
          </div>
        </div>
      </DadosFinanceirosProvider>
    </QueryClientProvider>
  );
}
