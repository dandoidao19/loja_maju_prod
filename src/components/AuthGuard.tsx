
'use client'

import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, ReactNode } from 'react'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkSession = async () => {
      // A resposta pode não ter 'data' ou 'session', então checamos com segurança
      const { data, error } = await supabase.auth.getSession();
      const session = data?.session;

      if (error) {
        console.error("Erro ao buscar sessão:", error);
        router.push('/login'); // Em caso de erro, redireciona para o login
        return;
      }

      if (!session && pathname !== '/login') {
        router.push('/login');
      } else {
        setLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && pathname !== '/login') {
        router.push('/login');
      }
      else if (event === 'SIGNED_IN' && pathname === '/login') {
        router.push('/');
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg font-semibold text-gray-700">Carregando Sistema...</div>
      </div>
    );
  }

  return <>{children}</>;
}
