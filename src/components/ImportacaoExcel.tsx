// components/ImportacaoExcel.tsx - VERSÃO FINAL COM TRATAMENTO DE ERROS
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { prepararDataParaInsert } from '@/lib/dateUtils'
import readXlsxFile from 'read-excel-file'
import { 
  validarArquivo, 
  ResultadoValidacao, 
  LancamentoValidado,
  salvarRelatorioErros 
} from '@/lib/ValidadorImportacao'
import ModalValidacaoErros from './ModalValidacaoErros'

interface ImportacaoExcelProps {
  onImportacaoConcluida: () => void
}

// Cache para centros de custo (evita múltiplas consultas)
const centrosCache = new Map()

export default function ImportacaoExcel({ onImportacaoConcluida }: ImportacaoExcelProps) {
  const [loading, setLoading] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [statusAtual, setStatusAtual] = useState('')
  
  // Estados para validação
  const [etapaValidacao, setEtapaValidacao] = useState<'upload' | 'validando' | 'resultado' | 'importando'>('upload')
  const [resultadoValidacao, setResultadoValidacao] = useState<ResultadoValidacao | null>(null)
  const [lancamentosValidados, setLancamentosValidados] = useState<LancamentoValidado[]>([])

  // Função para converter data do Excel
  const converterDataExcel = (excelDate: any): string => {
    // Se já for string no formato YYYY-MM-DD
    if (typeof excelDate === 'string') {
      const excelDateStr = excelDate.trim()
      
      // Formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(excelDateStr)) {
        return excelDateStr
      }
      
      // Formato DD/MM/YYYY
      const ddmmyyyyMatch = excelDateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (ddmmyyyyMatch) {
        const dia = ddmmyyyyMatch[1]
        const mes = ddmmyyyyMatch[2]
        const ano = ddmmyyyyMatch[3]
        
        // Validar se a data é válida
        const dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia))
        if (dataObj.getDate() === parseInt(dia) && 
            dataObj.getMonth() === parseInt(mes) - 1 && 
            dataObj.getFullYear() === parseInt(ano)) {
          return `${ano}-${mes}-${dia}`
        }
        throw new Error(`Data inválida: ${excelDate}`)
      }
      
      // Tentar converter com Date (outros formatos)
      const dateObj = new Date(excelDateStr)
      if (!isNaN(dateObj.getTime())) {
        const ano = dateObj.getFullYear()
        const mes = String(dateObj.getMonth() + 1).padStart(2, '0')
        const dia = String(dateObj.getDate()).padStart(2, '0')
        return `${ano}-${mes}-${dia}`
      }
    }
    
    // Se for número (serial do Excel)
    if (typeof excelDate === 'number') {
      // Excel usa 1 = 01/01/1900
      const baseDate = new Date(1900, 0, 1)
      // Ajuste para o bug do Excel (29/02/1900 não existe)
      const excelBugAdjustment = excelDate > 60 ? 1 : 0
      
      const date = new Date(baseDate.getTime() + (excelDate - excelBugAdjustment) * 24 * 60 * 60 * 1000)
      
      const ano = date.getFullYear()
      const mes = String(date.getMonth() + 1).padStart(2, '0')
      const dia = String(date.getDate()).padStart(2, '0')
      return `${ano}-${mes}-${dia}`
    }
    
    // Se for objeto Date
    if (excelDate instanceof Date) {
      const ano = excelDate.getFullYear()
      const mes = String(excelDate.getMonth() + 1).padStart(2, '0')
      const dia = String(excelDate.getDate()).padStart(2, '0')
      return `${ano}-${mes}-${dia}`
    }
    
    throw new Error(`Formato de data não suportado: ${excelDate}`)
  }

  // Buscar ID do centro de custo COM CACHE
  const buscarCentroCustoId = async (nomeCentroCusto: string) => {
    const nomeNormalizado = nomeCentroCusto.toUpperCase().trim()
    
    // Verificar cache primeiro
    if (centrosCache.has(nomeNormalizado)) {
      return centrosCache.get(nomeNormalizado)
    }

    try {
      const { data, error } = await supabase
        .from('centros_de_custo')
        .select('id')
        .ilike('nome', nomeNormalizado)
        .eq('contexto', 'casa')
        .single()

      if (error || !data) {
        // Se não encontrou, criar um centro de custo padrão
        const centroPadrao = await criarCentroCustoPadrao(nomeNormalizado)
        if (centroPadrao) {
          centrosCache.set(nomeNormalizado, centroPadrao.id)
          return centroPadrao.id
        }
        return null
      }
      
      // Adicionar ao cache
      centrosCache.set(nomeNormalizado, data.id)
      return data.id

    } catch (error) {
      console.warn(`Erro ao buscar centro de custo ${nomeNormalizado}:`, error)
      return null
    }
  }

  // Criar centro de custo automaticamente se não existir
  const criarCentroCustoPadrao = async (nome: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Determinar tipo baseado no nome
      const tipo = nome.includes('SALARIO') || nome.includes('SALÁRIO') ? 'RECEITA' : 'DESPESA'
      
      const { data, error } = await supabase
        .from('centros_de_custo')
        .insert({
          nome: nome,
          contexto: 'casa',
          tipo: tipo,
          categoria: 'OUTROS',
          recorrencia: 'VARIAVEL',
          user_id: user.id
        })
        .select()
        .single()

      if (error) {
        console.warn('Erro ao criar centro de custo:', error)
        return null
      }

      console.log(`✅ Centro de custo criado: ${nome}`)
      return data

    } catch (error) {
      console.warn('Erro ao criar centro de custo:', error)
      return null
    }
  }

  // Mapeamento inteligente de centros de custo
  const mapearCentroCusto = (centroCusto: string): string => {
    const centroUpper = centroCusto.toUpperCase().trim()
    
    const mapeamentos: { [key: string]: string } = {
      'GASTOS TRANSPORTES': 'TRANSPORTE',
      'UNHA MARA': 'LAZER',
      'TRANSPORTE': 'TRANSPORTE',
      'COMBUSTIVEL': 'TRANSPORTE',
      'GASOLINA': 'TRANSPORTE',
      'UBER': 'TRANSPORTE',
      'TAXI': 'TRANSPORTE',
      'ALIMENTACAO': 'ALIMENTACAO',
      'SUPERMERCADO': 'ALIMENTACAO',
      'RESTAURANTE': 'ALIMENTACAO',
      'LANCHE': 'ALIMENTACAO',
      'MORADIA': 'MORADIA',
      'ALUGUEL': 'MORADIA',
      'CONDOMINIO': 'MORADIA',
      'ENERGIA': 'UTILIDADES',
      'AGUA': 'UTILIDADES',
      'INTERNET': 'UTILIDADES',
      'TELEFONE': 'UTILIDADES',
      'SAUDE': 'SAUDE',
      'MEDICO': 'SAUDE',
      'FARMACIA': 'SAUDE',
      'PLANO DE SAUDE': 'SAUDE',
      'LAZER': 'LAZER',
      'CINEMA': 'LAZER',
      'ACADEMIA': 'LAZER',
      'SALARIO': 'SALARIO',
      'SALÁRIO': 'SALARIO'
    }

    // Buscar mapeamento exato ou parcial
    for (const [key, value] of Object.entries(mapeamentos)) {
      if (centroUpper.includes(key) || key.includes(centroUpper)) {
        return value
      }
    }

    return centroUpper // Retorna o original se não encontrar mapeamento
  }

  // NOVA FUNÇÃO: Detectar separador CSV
  const detectarSeparadorCSV = (text: string): string => {
    const primeiraLinha = text.split('\n')[0]
    
    // Contar ocorrências de cada separador possível
    const contadores = {
      ',': (primeiraLinha.match(/,/g) || []).length,
      ';': (primeiraLinha.match(/;/g) || []).length,
      '\t': (primeiraLinha.match(/\t/g) || []).length,
      '|': (primeiraLinha.match(/\|/g) || []).length
    }
    
    // Retornar o separador mais comum
    let maxCount = 0
    let separador = ','
    
    for (const [sep, count] of Object.entries(contadores)) {
      if (count > maxCount) {
        maxCount = count
        separador = sep
      }
    }
    
    console.log(`Separador detectado: "${separador}" (${maxCount} ocorrências)`)
    return separador
  }

  // NOVA FUNÇÃO: Processar CSV manualmente
  const processarCSV = async (text: string): Promise<any[][]> => {
    const lines = text.split('\n').filter(line => line.trim())
    const rows: any[][] = []
    
    // Detectar separador automaticamente
    const separador = detectarSeparadorCSV(text)
    
    for (const line of lines) {
      // Processar linha CSV (considerando separador e aspas)
      const cells: any[] = []
      let currentCell = ''
      let insideQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        
        if (char === '"') {
          insideQuotes = !insideQuotes
        } else if (char === separador && !insideQuotes) {
          cells.push(currentCell.trim())
          currentCell = ''
        } else {
          currentCell += char
        }
      }
      
      // Adicionar última célula
      cells.push(currentCell.trim())
      rows.push(cells)
    }
    
    return rows
  }

  // FUNÇÃO MELHORADA: Validar arquivo Excel com tratamento de erros
  const validarExcel = async (file: File) => {
    setEtapaValidacao('validando')
    setStatusAtual('📊 Lendo arquivo...')
    setProgresso(10)
    
    try {
      let rows: any[][] = []
      
      // Detectar tipo de arquivo
      const fileName = file.name.toLowerCase()
      const isCSV = fileName.endsWith('.csv')
      const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
      
      if (!isCSV && !isXLSX) {
        throw new Error('Formato de arquivo não suportado. Use .xlsx, .xls ou .csv')
      }
      
      // Processar arquivo baseado no tipo
      if (isCSV) {
        setStatusAtual('📄 Processando arquivo CSV...')
        const text = await file.text()
        rows = await processarCSV(text)
      } else {
        setStatusAtual('📊 Processando arquivo Excel...')
        try {
          rows = await readXlsxFile(file)
        } catch (xlsxError: any) {
          // Se falhar com read-excel-file, tentar como CSV
          console.warn('Erro ao ler como XLSX, tentando como CSV:', xlsxError)
          setStatusAtual('📄 Tentando processar como CSV...')
          const text = await file.text()
          rows = await processarCSV(text)
        }
      }
      
      if (!rows || rows.length < 2) {
        throw new Error('Arquivo vazio ou com apenas cabeçalho')
      }

      setStatusAtual('🔍 Detectando colunas...')
      setProgresso(20)

      // Detectar mapeamento de colunas automaticamente
      const cabecalhos = rows[0].map((h: any) => 
        h?.toString().trim().toUpperCase().replace(/^"|"$/g, '') || ''
      )

      // Mapear colunas de forma flexível
      const mapeamento: any = {}
      const colunasEsperadas = [
        { key: 'DATA', aliases: ['DATA', 'DATE', 'DT', 'DIA'] },
        { key: 'DESCRICAO', aliases: ['DESCRICAO', 'DESCRIÇÃO', 'DESC', 'NOME', 'OBS'] },
        { key: 'VALOR', aliases: ['VALOR', 'VALUE', 'VL', 'PREÇO', 'PRECO'] },
        { key: 'TIPO', aliases: ['TIPO', 'TYPE', 'CATEGORIA', 'CAT'] },
        { key: 'STATUS', aliases: ['STATUS', 'SITUACAO', 'SITUAÇÃO'] },
        { key: 'CENTRO_CUSTO', aliases: ['CENTRO_CUSTO', 'CENTRO DE CUSTO', 'CENTRO', 'CATEGORIA', 'CAT'] }
      ]
      
      colunasEsperadas.forEach(({ key, aliases }) => {
        const cabecalhoEncontrado = cabecalhos.find((h: string) => {
          const headerStr = h.toString().toUpperCase()
          return aliases.some(alias => headerStr.includes(alias) || alias.includes(headerStr))
        })
        if (cabecalhoEncontrado) {
          mapeamento[key] = cabecalhos.indexOf(cabecalhoEncontrado)
        }
      })

      // Verificar colunas faltantes
      const colunasFaltantes = colunasEsperadas
        .filter(({ key }) => mapeamento[key] === undefined)
        .map(({ key }) => key)

      if (colunasFaltantes.length > 0) {
        throw new Error(`Colunas não encontradas: ${colunasFaltantes.join(', ')}.\n\nCabeçalhos encontrados: ${cabecalhos.join(', ')}`)
      }

      setStatusAtual('✅ Validando dados...')
      setProgresso(40)

      // VALIDAR ARQUIVO
      const { lancamentos, resultado } = validarArquivo(rows, mapeamento)

      setProgresso(80)
      setStatusAtual('📋 Validação concluída!')

      // Salvar resultados
      setResultadoValidacao(resultado)
      setLancamentosValidados(lancamentos)
      setEtapaValidacao('resultado')
      setProgresso(100)

    } catch (error: any) {
      console.error('Erro na validação:', error)
      
      // Mensagem de erro mais amigável
      let mensagemErro = error.message || 'Erro desconhecido'
      
      if (mensagemErro.includes('invalid zip data')) {
        mensagemErro = `Erro ao ler arquivo Excel. Possíveis causas:
        
1. O arquivo pode estar corrompido
2. Tente salvar o arquivo novamente como .xlsx
3. Ou salve como .csv e tente importar

Dica: Abra o arquivo no Excel e use "Salvar Como" → "Pasta de Trabalho do Excel (.xlsx)"`
      }
      
      alert('❌ Erro na validação:\n\n' + mensagemErro)
      resetarEstado()
    } finally {
      setLoading(false)
    }
  }

  // FUNÇÃO: Processar importação após validação bem-sucedida
  const processarImportacao = async () => {
    if (!resultadoValidacao || !resultadoValidacao.valido) {
      alert('❌ Não é possível importar: dados inválidos!')
      return
    }

    setEtapaValidacao('importando')
    setStatusAtual('🔄 Processando lançamentos...')
    setProgresso(0)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      const lancamentosParaInserir = []
      const totalLancamentos = lancamentosValidados.length

      // Processar cada lançamento validado
      for (let i = 0; i < lancamentosValidados.length; i++) {
        const lanc = lancamentosValidados[i]
        
        // Atualizar progresso
        const progressoAtual = Math.round((i / totalLancamentos) * 80)
        setProgresso(progressoAtual)
        setStatusAtual(`🔄 Processando lançamento ${i + 1} de ${totalLancamentos}...`)

        // Converter data
        let dataFormatada: string
        try {
          dataFormatada = converterDataExcel(lanc.data)
        } catch (error) {
          throw new Error(`Linha ${lanc.linha}: Erro ao converter data: ${lanc.data}`)
        }

        // Mapear e buscar centro de custo
        const centroCustoMapeado = mapearCentroCusto(lanc.centroCusto)
        const centroCustoId = await buscarCentroCustoId(centroCustoMapeado)

        if (!centroCustoId) {
          throw new Error(`Linha ${lanc.linha}: Não foi possível determinar ou criar Centro de Custo para "${lanc.centroCusto}"`)
        }

        // Preparar lançamento para inserção
        lancamentosParaInserir.push({
          descricao: lanc.descricao.toUpperCase(),
          valor: lanc.valor,
          tipo: lanc.tipo,
          centro_custo_id: centroCustoId,
          data_lancamento: dataFormatada, // ✅ CORRIGIDO: sempre preenche com a data
          data_prevista: dataFormatada,
          status: lanc.status,
          caixa_id: '69bebc06-f495-4fed-b0b1-beafb50c017b', // ID Fixo
          origem: 'financeiro',
          parcelamento: null,
          recorrencia: null,
          user_id: user.id
        })
      }

      setStatusAtual('💾 Inserindo no banco de dados...')
      setProgresso(85)

      // Inserir todos os lançamentos de uma vez
      const { error: errorInsert } = await supabase
        .from('lancamentos_financeiros')
        .insert(lancamentosParaInserir)

      if (errorInsert) throw errorInsert

      setStatusAtual('🎉 Importação concluída com sucesso!')
      setProgresso(100)
      
      setTimeout(() => {
        alert(`✅ Importação concluída! ${lancamentosParaInserir.length} lançamentos inseridos.`)
        resetarEstado()
        setModalAberto(false)
        onImportacaoConcluida()
      }, 500)

    } catch (error: any) {
      console.error('Erro na importação:', error)
      alert('❌ Erro na importação: ' + error.message)
      setEtapaValidacao('resultado')
    } finally {
      setLoading(false)
    }
  }

  // FUNÇÃO: Baixar relatório de erros
  const baixarRelatorioErros = (formato: 'txt' | 'html') => {
    if (!resultadoValidacao) return

    const blob = salvarRelatorioErros(resultadoValidacao, formato)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `relatorio_validacao_${new Date().getTime()}.${formato}`)
    link.click()
    URL.revokeObjectURL(url)
  }

  // FUNÇÃO: Resetar estado
  const resetarEstado = () => {
    setEtapaValidacao('upload')
    setResultadoValidacao(null)
    setLancamentosValidados([])
    setProgresso(0)
    setStatusAtual('')
    setLoading(false)
  }

  // FUNÇÃO: Tentar novamente
  const tentarNovamente = () => {
    resetarEstado()
  }

  // Handler de upload de arquivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLoading(true)
      validarExcel(file)
    }
  }

  // Baixar modelo
  const baixarModelo = () => {
    const csvContent = "DATA,DESCRICAO,VALOR,TIPO,STATUS,CENTRO_CUSTO\n2023-10-01,Salário Mensal,3000.00,ENTRADA,PAGO,SALARIO\n2023-10-05,Conta de Luz,150.50,SAIDA,PREVISTO,ENERGIA"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'modelo_importacao_financeira.csv')
    link.click()
    URL.revokeObjectURL(url)
  }

  // Fechar modal de validação e prosseguir com importação
  const handleFecharModalValidacao = () => {
    if (resultadoValidacao?.valido) {
      // Se validação passou, prosseguir com importação
      processarImportacao()
    } else {
      // Se validação falhou, resetar
      resetarEstado()
    }
  }

  return (
    <>
      {/* Botão para abrir modal (se estiver no ModuloCasa) */}
      {window.location.pathname.includes('configuracoes') ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Importação de Lançamentos (Excel/CSV)</h2>
          <div className="space-y-4">
            {/* Barra de Progresso */}
            {loading && etapaValidacao !== 'resultado' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{statusAtual}</span>
                  <span>{progresso}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progresso}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">📋 Formato da Planilha:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>DATA:</strong> Qualquer formato de data (DD/MM/YYYY, YYYY-MM-DD, ou serial do Excel)</li>
                <li>• <strong>DESCRICAO:</strong> Texto livre (mínimo 3 caracteres)</li>
                <li>• <strong>VALOR:</strong> Número positivo (1500.00 ou 1.500,00)</li>
                <li>• <strong>TIPO:</strong> ENTRADA ou SAIDA</li>
                <li>• <strong>STATUS:</strong> PAGO ou PREVISTO</li>
                <li>• <strong>CENTRO_CUSTO:</strong> Nome do centro de custo</li>
              </ul>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800 mb-2">✅ Funcionalidades:</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Validação prévia de todos os dados</li>
                <li>• Suporte para Excel (.xlsx, .xls) e CSV (.csv)</li>
                <li>• Relatórios detalhados de erros</li>
                <li>• Importação segura (tudo ou nada)</li>
              </ul>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={baixarModelo}
                className="flex-1 bg-gray-500 text-white py-2 px-3 rounded hover:bg-gray-600 text-sm"
                disabled={loading}
              >
                📥 Baixar Modelo
              </button>
              
              <label className="flex-1 bg-blue-500 text-white py-2 px-3 rounded hover:bg-blue-600 text-sm text-center cursor-pointer">
                {loading && etapaValidacao !== 'resultado' ? '📤 Processando...' : '📤 Selecionar Arquivo'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setModalAberto(true)}
          className="px-3 py-1 rounded text-sm bg-purple-500 text-white hover:bg-purple-600"
        >
          Importar Excel
        </button>
      )}

      {/* Modal (se estiver no ModuloCasa) */}
      {modalAberto && !window.location.pathname.includes('configuracoes') && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Importar Lançamentos (Excel/CSV)</h3>
            <div className="space-y-4">
              {/* Barra de Progresso */}
              {loading && etapaValidacao !== 'resultado' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{statusAtual}</span>
                    <span>{progresso}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progresso}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">📋 Formato da Planilha:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>DATA:</strong> Qualquer formato de data</li>
                  <li>• <strong>DESCRICAO:</strong> Texto livre</li>
                  <li>• <strong>VALOR:</strong> Número (1500.00 ou 1.500,00)</li>
                  <li>• <strong>TIPO:</strong> ENTRADA ou SAIDA</li>
                  <li>• <strong>STATUS:</strong> PAGO ou PREVISTO</li>
                  <li>• <strong>CENTRO_CUSTO:</strong> Nome do centro de custo</li>
                </ul>
              </div>

              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <p className="text-xs text-green-700">
                  ✅ <strong>Validação automática:</strong> O sistema verificará todos os dados antes de importar.
                </p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={baixarModelo}
                  className="flex-1 bg-gray-500 text-white py-2 px-3 rounded hover:bg-gray-600 text-sm"
                  disabled={loading}
                >
                  📥 Baixar Modelo
                </button>
                
                <label className="flex-1 bg-blue-500 text-white py-2 px-3 rounded hover:bg-blue-600 text-sm text-center cursor-pointer">
                  {loading && etapaValidacao !== 'resultado' ? '📤 Processando...' : '📤 Selecionar Arquivo'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              </div>

              <button
                onClick={() => {
                  resetarEstado()
                  setModalAberto(false)
                }}
                className="w-full bg-gray-300 text-gray-700 py-2 px-3 rounded hover:bg-gray-400 text-sm"
                disabled={loading && etapaValidacao !== 'resultado'}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resultado de Validação */}
      {etapaValidacao === 'resultado' && resultadoValidacao && (
        <ModalValidacaoErros
          resultado={resultadoValidacao}
          onFechar={handleFecharModalValidacao}
          onTentarNovamente={tentarNovamente}
          onBaixarRelatorio={baixarRelatorioErros}
        />
      )}
    </>
  )
}
