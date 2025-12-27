'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import readXlsxFile from 'read-excel-file'

interface ImportacaoExcelLojaProps {
  onImportacaoConcluida: () => void
}

export default function ImportacaoExcelLoja({ onImportacaoConcluida }: ImportacaoExcelLojaProps) {
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [statusAtual, setStatusAtual] = useState('')
  const [tipoImportacao, setTipoImportacao] = useState<'transacoes' | 'estoque'>('transacoes')
  const [resultado, setResultado] = useState<{sucesso: number, erros: number, mensagens: string[]} | null>(null)

  // Converter data do Excel
  const converterDataExcel = (excelDate: any): string => {
    if (typeof excelDate === 'string') {
      const excelDateStr = excelDate.trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(excelDateStr)) return excelDateStr
      
      const ddmmyyyyMatch = excelDateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (ddmmyyyyMatch) {
        return `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`
      }
    }
    
    if (typeof excelDate === 'number') {
      const baseDate = new Date(1900, 0, 1)
      const excelBugAdjustment = excelDate > 60 ? 1 : 0
      const date = new Date(baseDate.getTime() + (excelDate - excelBugAdjustment) * 24 * 60 * 60 * 1000)
      const ano = date.getFullYear()
      const mes = String(date.getMonth() + 1).padStart(2, '0')
      const dia = String(date.getDate()).padStart(2, '0')
      return `${ano}-${mes}-${dia}`
    }
    
    if (excelDate instanceof Date) {
      const ano = excelDate.getFullYear()
      const mes = String(excelDate.getMonth() + 1).padStart(2, '0')
      const dia = String(excelDate.getDate()).padStart(2, '0')
      return `${ano}-${mes}-${dia}`
    }
    
    throw new Error(`Formato de data não suportado: ${excelDate}`)
  }

  // Importar Transações Financeiras da Loja
  const importarTransacoes = async (file: File) => {
    try {
      setStatusAtual('📊 Lendo arquivo de transações...')
      setProgresso(10)
      
      const rows = await readXlsxFile(file)
      
      if (!rows || rows.length < 2) {
        throw new Error('Arquivo vazio ou sem dados')
      }
      
      setStatusAtual('✅ Validando transações...')
      setProgresso(30)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')
      
      const transacoes = []
      const erros = []
      
      // Pular cabeçalho (linha 0)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        
        try {
          // Formato esperado: Data | Descrição | Valor | Tipo | Status
          const data = row[0] ? converterDataExcel(row[0]) : null
          const descricao = row[1] ? String(row[1]).trim() : null
          const valor = row[2] ? parseFloat(String(row[2]).replace(',', '.')) : null
          const tipo = row[3] ? String(row[3]).toLowerCase().trim() : 'entrada'
          const status = row[4] ? String(row[4]).toLowerCase().trim() : 'previsto'
          
          if (!data || !descricao || !valor) {
            erros.push(`Linha ${i + 1}: Dados incompletos`)
            continue
          }
          
          if (tipo !== 'entrada' && tipo !== 'saida') {
            erros.push(`Linha ${i + 1}: Tipo deve ser 'entrada' ou 'saida'`)
            continue
          }
          
          if (status !== 'previsto' && status !== 'realizado') {
            erros.push(`Linha ${i + 1}: Status deve ser 'previsto' ou 'realizado'`)
            continue
          }
          
          transacoes.push({
            user_id: user.id,
            numero_transacao: Math.floor(Math.random() * 1000000),
            descricao,
            total: valor,
            tipo,
            data,
            status_pagamento: status === 'realizado' ? 'pago' : 'pendente'
          })
          
        } catch (error: any) {
          erros.push(`Linha ${i + 1}: ${error.message}`)
        }
      }
      
      setStatusAtual(`💾 Salvando ${transacoes.length} transações...`)
      setProgresso(70)
      
      if (transacoes.length > 0) {
        const { error } = await supabase
          .from('transacoes_loja')
          .insert(transacoes)
        
        if (error) throw error
      }
      
      setProgresso(100)
      setResultado({
        sucesso: transacoes.length,
        erros: erros.length,
        mensagens: erros
      })
      
      if (transacoes.length > 0) {
        onImportacaoConcluida()
      }
      
    } catch (error: any) {
      console.error('Erro na importação:', error)
      setResultado({
        sucesso: 0,
        erros: 1,
        mensagens: [error.message]
      })
    }
  }

  // Importar Itens de Estoque
  const importarEstoque = async (file: File) => {
    try {
      setStatusAtual('📊 Lendo arquivo de estoque...')
      setProgresso(10)
      
      const rows = await readXlsxFile(file)
      
      if (!rows || rows.length < 2) {
        throw new Error('Arquivo vazio ou sem dados')
      }
      
      setStatusAtual('✅ Validando produtos...')
      setProgresso(30)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')
      
      const produtos = []
      const erros = []
      
      // Pular cabeçalho (linha 0)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        
        try {
          // Formato esperado: Código | Descrição | Quantidade | Preço Custo | Preço Venda | Categoria
          const codigo = row[0] ? String(row[0]).trim() : null
          const descricao = row[1] ? String(row[1]).trim() : null
          const quantidade = row[2] ? parseInt(String(row[2])) : 0
          const precoCusto = row[3] ? parseFloat(String(row[3]).replace(',', '.')) : 0
          const precoVenda = row[4] ? parseFloat(String(row[4]).replace(',', '.')) : 0
          const categoria = row[5] ? String(row[5]).trim() : 'GERAL'
          
          if (!codigo || !descricao) {
            erros.push(`Linha ${i + 1}: Código e descrição são obrigatórios`)
            continue
          }
          
          produtos.push({
            user_id: user.id,
            codigo,
            descricao,
            quantidade,
            preco_custo: precoCusto,
            preco_venda: precoVenda,
            valor_repasse: 0,
            categoria,
            data_ultima_compra: new Date().toISOString().split('T')[0],
            status_item: 'resolvido'
          })
          
        } catch (error: any) {
          erros.push(`Linha ${i + 1}: ${error.message}`)
        }
      }
      
      setStatusAtual(`💾 Salvando ${produtos.length} produtos...`)
      setProgresso(70)
      
      if (produtos.length > 0) {
        const { error } = await supabase
          .from('produtos')
          .insert(produtos)
        
        if (error) throw error
      }
      
      setProgresso(100)
      setResultado({
        sucesso: produtos.length,
        erros: erros.length,
        mensagens: erros
      })
      
      if (produtos.length > 0) {
        onImportacaoConcluida()
      }
      
    } catch (error: any) {
      console.error('Erro na importação:', error)
      setResultado({
        sucesso: 0,
        erros: 1,
        mensagens: [error.message]
      })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setLoading(true)
    setResultado(null)
    setProgresso(0)
    
    try {
      if (tipoImportacao === 'transacoes') {
        await importarTransacoes(file)
      } else {
        await importarEstoque(file)
      }
    } finally {
      setLoading(false)
      e.target.value = '' // Limpar input
    }
  }

  const baixarTemplateTransacoes = () => {
    const csv = `Data;Descrição;Valor;Tipo;Status
15/01/2025;Venda Cliente A;500.00;entrada;previsto
20/01/2025;Compra Fornecedor B;300.00;saida;realizado
01/02/2025;Venda Cliente C;800.00;entrada;previsto`
    
    // Adicionar BOM UTF-8 para Excel reconhecer acentuação
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_transacoes_loja.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const baixarTemplateEstoque = () => {
    const csv = `Código;Descrição;Quantidade;Preço Custo;Preço Venda;Categoria
R1;CALÇA PRETA;10;200.00;400.00;ROUPAS
R2;BLUSA ROSA;5;150.00;300.00;ROUPAS
R3;MEIA LISTRADA;20;0.00;80.00;ROUPAS`
    
    // Adicionar BOM UTF-8 para Excel reconhecer acentuação
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_estoque_loja.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
      <h2 className="text-sm font-bold text-gray-800">📥 Importação de Dados da Loja</h2>
      
      {/* Seletor de Tipo */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Tipo de Importação
        </label>
        <div className="flex gap-4">
          <label className="flex items-center text-xs">
            <input
              type="radio"
              value="transacoes"
              checked={tipoImportacao === 'transacoes'}
              onChange={(e) => setTipoImportacao(e.target.value as 'transacoes')}
              className="mr-2"
              disabled={loading}
            />
            Transações Financeiras
          </label>
          <label className="flex items-center text-xs">
            <input
              type="radio"
              value="estoque"
              checked={tipoImportacao === 'estoque'}
              onChange={(e) => setTipoImportacao(e.target.value as 'estoque')}
              className="mr-2"
              disabled={loading}
            />
            Itens de Estoque
          </label>
        </div>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3">
        <h3 className="text-xs font-semibold text-blue-800 mb-2">
          📋 Formato do Arquivo
        </h3>
        {tipoImportacao === 'transacoes' ? (
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Colunas necessárias:</strong></p>
            <ul className="list-disc list-inside ml-2">
              <li>Data (formato: DD/MM/AAAA ou AAAA-MM-DD)</li>
              <li>Descrição</li>
              <li>Valor (número decimal)</li>
              <li>Tipo (entrada ou saida)</li>
              <li>Status (previsto ou realizado)</li>
            </ul>
          </div>
        ) : (
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Colunas necessárias:</strong></p>
            <ul className="list-disc list-inside ml-2">
              <li>Código (texto único)</li>
              <li>Descrição</li>
              <li>Quantidade (número inteiro)</li>
              <li>Preço Custo (número decimal)</li>
              <li>Preço Venda (número decimal)</li>
              <li>Categoria</li>
            </ul>
          </div>
        )}
      </div>

      {/* Botões de Template */}
      <div className="flex gap-2">
        <button
          onClick={tipoImportacao === 'transacoes' ? baixarTemplateTransacoes : baixarTemplateEstoque}
          className="px-3 py-1.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
          disabled={loading}
        >
          📥 Baixar Template
        </button>
      </div>

      {/* Upload */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Selecionar Arquivo (.xlsx, .xls, .csv)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          disabled={loading}
          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {/* Progresso */}
      {loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{statusAtual}</span>
            <span>{progresso}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className={`p-3 rounded ${resultado.erros > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <h3 className="text-xs font-semibold mb-2">
            {resultado.erros > 0 ? '⚠️ Importação Concluída com Avisos' : '✅ Importação Concluída'}
          </h3>
          <div className="text-xs space-y-1">
            <p>✅ Registros importados: <strong>{resultado.sucesso}</strong></p>
            {resultado.erros > 0 && (
              <>
                <p>⚠️ Erros encontrados: <strong>{resultado.erros}</strong></p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">Ver erros</summary>
                  <ul className="list-disc list-inside ml-2 mt-1 max-h-40 overflow-y-auto">
                    {resultado.mensagens.map((msg, idx) => (
                      <li key={idx} className="text-red-600">{msg}</li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
