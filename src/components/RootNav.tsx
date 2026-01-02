
'use client';

import { supabase } from '@/lib/supabase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CabecalhoSistema from './CabecalhoSistema';

export default function RootNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session && pathname !== '/') {
        router.push('/');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session && pathname !== '/') {
            router.push('/');
        } else {
            setUser(session?.user ?? null);
        }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Não mostrar navegação na página de login
  if (pathname === '/') {
    return <CabecalhoSistema />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const menuItems = [
    { id: 'dashboard', label: '📊 Dashboard', href: '/dashboard' },
    { id: 'casa', label: '🏠 Casa', href: '/dashboard/casa' },
    { id: 'loja', label: '🏪 Loja', href: '/dashboard/loja' },
    { id: 'configuracoes', label: '⚙️ Configurações', href: '/dashboard/configuracoes' }
  ];

  const getActiveId = () => {
    // A correspondência mais específica vence
    if (pathname === '/dashboard/loja') return 'loja';
    if (pathname === '/dashboard/casa') return 'casa';
    if (pathname === '/dashboard/configuracoes') return 'configuracoes';
    if (pathname === '/dashboard') return 'dashboard';
    return '';
  }
  const activeId = getActiveId();

  return (
    <>
      <CabecalhoSistema />
      <div className="container mx-auto p-4">
        <header className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-600">
              Bem-vindo, <span className="font-semibold">{user?.email}</span>
            </p>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
            Sair
          </button>
        </header>
        <nav className="bg-white rounded-lg shadow-md p-2 mb-4">
          <div className="flex space-x-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                  activeId === item.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
