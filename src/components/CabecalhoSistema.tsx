'use client'

import { useState, useEffect } from 'react'
import { obterConfigLogos } from '@/lib/gerador-pdf-utils'

export default function CabecalhoSistema() {
  const [logoEmpresa, setLogoEmpresa] = useState<string | undefined>()
  const [logoCliente, setLogoCliente] = useState<string | undefined>()
  const [nomeEmpresa, setNomeEmpresa] = useState('')

  useEffect(() => {
    const config = obterConfigLogos()
    setLogoEmpresa(config.logoEmpresa)
    setLogoCliente(config.logoCliente)
    setNomeEmpresa(config.nomeEmpresa)
  }, [])

  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-4 px-4 shadow-lg border-b-2 border-blue-600">
      <div className="container mx-auto flex items-center justify-center gap-8">
        {/* Logo Empresa (Esquerda) */}
        {logoEmpresa && (
          <div className="flex-shrink-0">
            <img 
              src={logoEmpresa} 
              alt="Logo Empresa" 
              className="h-12 object-contain"
            />
          </div>
        )}

        {/* Nome do Sistema (Centro) */}
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-widest bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            LUCIUS
          </h1>
          <p className="text-xs text-blue-300 font-semibold mt-1">v1.0 • Sistema de Controle Financeiro</p>
          {nomeEmpresa && (
            <p className="text-xs text-gray-400 mt-0.5">{nomeEmpresa}</p>
          )}
        </div>

        {/* Logo Cliente (Direita) */}
        {logoCliente && (
          <div className="flex-shrink-0">
            <img 
              src={logoCliente} 
              alt="Logo Cliente" 
              className="h-12 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
