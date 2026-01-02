
'use client'

import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, ReactNode } from 'react'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Inicia a verificação imediatamente
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && pathname !== '/login') {
        router.push('/login');
      } else {
        setLoading(false);
      }
    };

    checkInitialSession();

    // Ouve as mudanças no estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // Se o usuário fez logout e não está na página de login, redireciona
      if (event === 'SIGNED_OUT' && pathname !== '/login') {
        router.push('/login');
      }
      // Se o usuário fez login e estava na página de login, redireciona para a home (loja)
      else if (event === 'SIGNED_IN' && pathname === '/login') {
        router.push('/');
      }

      // Atualiza o estado de loading
      setLoading(false);
    });

    // Limpa o listener quando o componente é desmontado
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

  // Se o usuário não está logado, só permite o acesso à página de login (/login)
  // Esta verificação extra previne o flash do conteúdo protegido
  if (pathname !== '/login') {
      const { data: { session } } = supabase.auth.getSession();
      if (!session) {
          // Renderiza a tela de loading enquanto redireciona
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-lg font-semibold text-gray-700">Redirecionando para o login...</div>
            </div>
          )
      }
  }

  return <>{children}</>;
}
