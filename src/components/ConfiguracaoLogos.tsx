'use client'

import { useState, useEffect } from 'react'
import { imagemParaBase64, obterConfigLogos, salvarConfigLogos } from '@/lib/gerador-pdf-utils'

export default function ConfiguracaoLogos() {
  const [logoEmpresa, setLogoEmpresa] = useState<string | undefined>()
  const [logoCliente, setLogoCliente] = useState<string | undefined>()
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [previewEmpresa, setPreviewEmpresa] = useState<string | undefined>()
  const [previewCliente, setPreviewCliente] = useState<string | undefined>()

  useEffect(() => {
    const config = obterConfigLogos()
    setLogoEmpresa(config.logoEmpresa)
    setLogoCliente(config.logoCliente)
    setNomeEmpresa(config.nomeEmpresa)
    setPreviewEmpresa(config.logoEmpresa)
    setPreviewCliente(config.logoCliente)
  }, [])

  const handleLogoEmpresaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const base64 = await imagemParaBase64(file)
        setLogoEmpresa(base64)
        setPreviewEmpresa(base64)
      } catch (error) {
        console.error('Erro ao processar imagem:', error)
        alert('Erro ao processar imagem da empresa')
      }
    }
  }

  const handleLogoClienteChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const base64 = await imagemParaBase64(file)
        setLogoCliente(base64)
        setPreviewCliente(base64)
      } catch (error) {
        console.error('Erro ao processar imagem:', error)
        alert('Erro ao processar imagem do cliente')
      }
    }
  }

  const handleSalvar = () => {
    salvarConfigLogos({
      logoEmpresa,
      logoCliente,
      nomeEmpresa,
    })
    alert('✅ Configurações de logos salvas com sucesso!')
  }

  const handleRemoverLogoEmpresa = () => {
    setLogoEmpresa(undefined)
    setPreviewEmpresa(undefined)
    localStorage.removeItem('logo_empresa')
  }

  const handleRemoverLogoCliente = () => {
    setLogoCliente(undefined)
    setPreviewCliente(undefined)
    localStorage.removeItem('logo_cliente')
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Configuração de Logomarcas</h2>
        <p className="text-xs text-gray-600 mb-4">
          Configure as logomarcas que aparecerão nos PDFs gerados pelo sistema LUCIUS.
        </p>

        <div className="space-y-4">
          {/* Logo da Empresa Desenvolvedora */}
          <div className="border border-gray-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Logo da Empresa Desenvolvedora
            </label>
            
            {previewEmpresa && (
              <div className="mb-3 flex items-center gap-3">
                <img 
                  src={previewEmpresa} 
                  alt="Preview Logo Empresa" 
                  className="h-16 object-contain border border-gray-300 rounded p-1"
                />
                <button
                  onClick={handleRemoverLogoEmpresa}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  Remover
                </button>
              </div>
            )}
            
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleLogoEmpresaChange}
              className="block w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Recomendado: PNG ou JPG, tamanho máximo 2MB
            </p>
          </div>

          {/* Nome da Empresa */}
          <div className="border border-gray-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Nome da Empresa Desenvolvedora
            </label>
            <input
              type="text"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Digite o nome da empresa"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Logo do Cliente */}
          <div className="border border-gray-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Logo do Cliente
            </label>
            
            {previewCliente && (
              <div className="mb-3 flex items-center gap-3">
                <img 
                  src={previewCliente} 
                  alt="Preview Logo Cliente" 
                  className="h-16 object-contain border border-gray-300 rounded p-1"
                />
                <button
                  onClick={handleRemoverLogoCliente}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  Remover
                </button>
              </div>
            )}
            
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleLogoClienteChange}
              className="block w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Recomendado: PNG ou JPG, tamanho máximo 2MB
            </p>
          </div>

          {/* Botão Salvar */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSalvar}
              className="px-4 py-2 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600"
            >
              💾 Salvar Configurações
            </button>
          </div>
        </div>
      </div>

      {/* Preview do Cabeçalho do PDF */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-xs font-semibold text-gray-800 mb-3">Preview do Cabeçalho do PDF</h3>
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="w-24 h-12 flex items-center justify-center border border-gray-300 bg-white rounded">
              {previewEmpresa ? (
                <img src={previewEmpresa} alt="Logo Empresa" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[8px] text-gray-400">Logo Empresa</span>
              )}
            </div>
            
            <div className="text-center">
              <div className="text-sm font-bold text-gray-800">LUCIUS</div>
              <div className="text-[10px] text-gray-600">{nomeEmpresa || 'Empresa Desenvolvedora'}</div>
            </div>
            
            <div className="w-24 h-12 flex items-center justify-center border border-gray-300 bg-white rounded">
              {previewCliente ? (
                <img src={previewCliente} alt="Logo Cliente" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[8px] text-gray-400">Logo Cliente</span>
              )}
            </div>
          </div>
          <div className="border-t border-gray-300 pt-2">
            <p className="text-[10px] text-gray-500 text-center">
              Este é o cabeçalho que aparecerá nos PDFs gerados
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
