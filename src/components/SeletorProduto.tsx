'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  preco_custo: number
  preco_venda: number
  categoria: string
}

interface SeletorProdutoProps {
  onSelecionarProduto: (produto: Produto) => void
  onNovoItem?: () => void
  placeholder?: string
  descricaoPreenchida?: string
  // CORREÇÃO: Removido key daqui (não é prop válida)
}

export default function SeletorProduto({
  onSelecionarProduto,
  onNovoItem,
  placeholder = 'Buscar ou criar...',
  descricaoPreenchida = '',
}: SeletorProdutoProps) {
  const [busca, setBusca] = useState(descricaoPreenchida)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setBusca(descricaoPreenchida)
  }, [descricaoPreenchida])

  useEffect(() => {
    if (busca.length > 2) {
      buscarProdutos(busca)
    } else {
      setProdutos([])
    }
  }, [busca])

  const buscarProdutos = async (termo: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .or(`descricao.ilike.%${termo}%,codigo.ilike.%${termo}%`)
        .limit(10)

      if (error) throw error
      setProdutos(data || [])
      setMostrarSugestoes(true)
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelecionarProduto = (produto: Produto) => {
    console.log('✅ Produto selecionado no SeletorProduto:', produto.descricao)
    onSelecionarProduto(produto)
    setBusca(produto.descricao)
    setMostrarSugestoes(false)
  }

  return (
    <div className="relative">
      <div className="flex gap-1">
        <div className="flex-1 relative">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={() => busca.length > 2 && setMostrarSugestoes(true)}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            // CORREÇÃO: key não deve ser usada aqui
          />

          {mostrarSugestoes && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-2 text-gray-600 text-xs">Buscando...</div>
              ) : produtos.length > 0 ? (
                <div className="divide-y">
                  {produtos.map((produto) => (
                    <button
                      key={produto.id}
                      type="button"
                      onClick={() => handleSelecionarProduto(produto)}
                      className="w-full text-left px-2 py-1 hover:bg-blue-50 transition-colors text-xs"
                    >
                      <div className="font-medium text-gray-800 truncate">{produto.descricao}</div>
                      <div className="text-[10px] text-gray-600">
                        {produto.codigo} • Est: {produto.quantidade} • R$ {produto.preco_venda.toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : busca.length > 2 ? (
                <div className="p-2 text-gray-600 text-xs">Nenhum produto encontrado</div>
              ) : null}
            </div>
          )}
        </div>

        {onNovoItem && (
          <button
            type="button"
            onClick={onNovoItem}
            className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap"
          >
            + Novo
          </button>
        )}
      </div>
    </div>
  )
}