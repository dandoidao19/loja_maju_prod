// app/dashboard/page.tsx - VERSÃO COM CONTROLE DE AMBIENTE
'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { DadosFinanceirosProvider } from '@/context/DadosFinanceirosContext'
import { isDevFeaturesEnabled } from '@/lib/envUtils'

const ResumoCaixas = dynamic(() => import('@/components/ResumoCaixas'), { ssr: false })
const CasaModulo = dynamic(() => import('@/components/CasaModulo'), { ssr: false })
const ModuloConfiguracoes = dynamic(() => import('@/components/ModuloConfiguracoes'), { ssr: false })
const LojaModulo = dynamic(() => import('@/components/LojaModulo'), { ssr: false })

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('dashboard') // Inicia em 'dashboard' por padrão
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
      } else {
        setUser(session.user)
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-lg font-semibold text-gray-700">⏳ Carregando...</div>
      </div>
    )
  }

  // Define itens do menu
  const menuItems = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊', color: 'blue' },
    { id: 'casa', label: '🏠 Casa', icon: '🏠', color: 'green' },
    { id: 'loja', label: '🏪 Loja', icon: '🏪', color: 'purple' },
    { id: 'configuracoes', label: '⚙️ Configurações', icon: '⚙️', color: 'gray' }
  ]

  const getButtonStyle = (id: string, color: string) => {
    const isActive = activeSection === id
    const colors: Record<string, { active: string; inactive: string }> = {
      blue: {
        active: 'bg-blue-600 text-white shadow-lg shadow-blue-500/50',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
      },
      green: {
        active: 'bg-green-600 text-white shadow-lg shadow-green-500/50',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-green-300'
      },
      purple: {
        active: 'bg-purple-600 text-white shadow-lg shadow-purple-500/50',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
      },
      gray: {
        active: 'bg-gray-600 text-white shadow-lg shadow-gray-500/50',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
      }
    }
    return isActive ? colors[color].active : colors[color].inactive
  }

  const getTitleBySection = () => {
    switch (activeSection) {
      case 'dashboard':
        return '📊 Dashboard Principal'
      case 'casa':
        return '🏠 Módulo Casa'
      case 'loja':
        return '🏪 Módulo Loja'
      case 'configuracoes':
        return '⚙️ Configurações'
      default:
        return '🏠 Módulo Casa'
    }
  }

  return (
    <DadosFinanceirosProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="container mx-auto px-3 py-2">
          {/* Header com Usuário e Logout - COMPACTADO */}
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-800">
                {getTitleBySection()}
              </h1>
              <p className="text-xs text-gray-600 mt-0.5">
                Bem-vindo, <span className="font-semibold text-gray-800">{user?.email}</span>
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors shadow-md text-xs"
            >
              🚪 Sair
            </button>
          </div>

          {/* Menu de Navegação com Ícones - COMPACTADO */}
          <div className="bg-white rounded-lg shadow-md p-1 mb-2 border border-gray-100">
            <div className="flex flex-wrap gap-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-xs ${getButtonStyle(item.id, item.color)}`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label.split(' ')[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo Dinâmico */}
          {isDevFeaturesEnabled() && activeSection === 'dashboard' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <ResumoCaixas />
              </div>
              <div className="col-span-2">
                {/* Espaço para futuros componentes */}
              </div>
            </div>
          )}

          {activeSection === 'casa' && (
            <div>
              <CasaModulo />
            </div>
          )}

          {activeSection === 'loja' && (
            <div>
              <LojaModulo />
            </div>
          )}

          {activeSection === 'configuracoes' && (
            <div>
              <ModuloConfiguracoes />
            </div>
          )}
        </div>
      </div>
    </DadosFinanceirosProvider>
  )
}