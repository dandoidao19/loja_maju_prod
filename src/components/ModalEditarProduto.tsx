'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  preco_custo: number
  valor_repasse: number
  preco_venda: number
  data_ultima_compra: string
}

interface ModalEditarProdutoProps {
  produto: Produto | null
  onClose: () => void
  onSave: () => void
}

export default function ModalEditarProduto({ produto, onClose, onSave }: ModalEditarProdutoProps) {
  const [formData, setFormData] = useState({
    codigo: '',
    descricao: '',
    quantidade: '',
    preco_custo: '',
    valor_repasse: '',
    preco_venda: '',
    data_ultima_compra: new Date().toISOString().split('T')[0],
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (produto) {
      setFormData({
        codigo: produto.codigo,
        descricao: produto.descricao,
        quantidade: produto.quantidade.toString(),
        preco_custo: produto.preco_custo.toString(),
        valor_repasse: produto.valor_repasse.toString(),
        preco_venda: produto.preco_venda.toString(),
        data_ultima_compra: produto.data_ultima_compra,
      })
    } else {
      setFormData({
        codigo: '',
        descricao: '',
        quantidade: '',
        preco_custo: '',
        valor_repasse: '',
        preco_venda: '',
        data_ultima_compra: new Date().toISOString().split('T')[0],
      })
    }
    setErro('')
  }, [produto])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro('')

    try {
      // Validações básicas
      if (!formData.codigo.trim()) {
        throw new Error('Código é obrigatório')
      }
      if (!formData.descricao.trim()) {
        throw new Error('Descrição é obrigatória')
      }
      if (!formData.preco_venda) {
        throw new Error('Preço de venda é obrigatório')
      }

      const dados = {
        codigo: formData.codigo.trim(),
        descricao: formData.descricao.trim(),
        quantidade: parseInt(formData.quantidade) || 0,
        preco_custo: parseFloat(formData.preco_custo) || 0,
        valor_repasse: parseFloat(formData.valor_repasse) || 0,
        preco_venda: parseFloat(formData.preco_venda),
        data_ultima_compra: formData.data_ultima_compra,
      }

      if (produto) {
        // Atualizar produto existente
        const { error } = await supabase
          .from('produtos')
          .update(dados)
          .eq('id', produto.id)

        if (error) throw error
      } else {
        // Criar novo produto
        const { error } = await supabase
          .from('produtos')
          .insert([dados])

        if (error) throw error
      }

      onSave()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar produto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            {produto ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 p-2 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código *
              </label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: PROD001"
                required
              />
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                name="quantidade"
                value={formData.quantidade}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição *
            </label>
            <textarea
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descrição do produto"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Preço de Custo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço de Custo
              </label>
              <input
                type="number"
                name="preco_custo"
                value={formData.preco_custo}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* Valor de Repasse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor de Repasse
              </label>
              <input
                type="number"
                name="valor_repasse"
                value={formData.valor_repasse}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* Preço de Venda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço de Venda *
              </label>
              <input
                type="number"
                name="preco_venda"
                value={formData.preco_venda}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Data da Última Compra */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data da Última Compra
            </label>
            <input
              type="date"
              name="data_ultima_compra"
              value={formData.data_ultima_compra}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar Produto'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
