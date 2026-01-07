'use client'

import { useState } from 'react'
import LojaPaginaFinanceiro from './LojaPaginaFinanceiro'
import LojaPaginaEstoque from './LojaPaginaEstoque'
import LojaPaginaCompras from './LojaPaginaCompras'
import LojaPaginaVendas from './LojaPaginaVendas'
import ModuloCondicional from './ModuloCondicional'
import { isDevFeaturesEnabled } from '@/lib/envUtils'

type AbaLoja = 'financeiro' | 'estoque' | 'vendas' | 'compras' | 'condicional'

export default function LojaModulo() {
  const [abaAtiva, setAbaAtiva] = useState<AbaLoja>('financeiro')
  const devFeaturesEnabled = isDevFeaturesEnabled()

  // Define as abas base (sempre visíveis)
  const abasBase: { id: AbaLoja; titulo: string; icone: string }[] = [
    { id: 'financeiro', titulo: 'Financeiro', icone: '💳' },
    { id: 'estoque', titulo: 'Estoque', icone: '📦' },
    { id: 'vendas', titulo: 'Vendas', icone: '💰' },
    { id: 'compras', titulo: 'Compras', icone: '📥' },
  ]

  // Adiciona aba Condicional apenas em desenvolvimento
  const abas = devFeaturesEnabled 
    ? [...abasBase, { id: 'condicional' as AbaLoja, titulo: 'Condicional', icone: '⚙️' }]
    : abasBase

  const renderizarConteudo = () => {
    switch (abaAtiva) {
      case 'financeiro':
        return <LojaPaginaFinanceiro />
      case 'estoque':
        return <LojaPaginaEstoque />
      case 'vendas':
        return <LojaPaginaVendas />
      case 'compras':
        return <LojaPaginaCompras />
      case 'condicional':
        // Renderiza apenas se recursos de dev estiverem habilitados
        return devFeaturesEnabled ? <ModuloCondicional /> : null
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Menu Horizontal */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <nav className="flex flex-wrap gap-0">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex-1 min-w-max px-6 py-4 font-medium transition-all border-b-2 ${
                abaAtiva === aba.id
                  ? 'bg-blue-50 text-blue-600 border-blue-500'
                  : 'bg-white text-gray-700 border-transparent hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{aba.icone}</span>
              {aba.titulo}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {renderizarConteudo()}
    </div>
  )
}
