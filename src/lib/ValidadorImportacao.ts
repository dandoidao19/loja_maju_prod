// lib/ValidadorImportacao.ts
/**
 * Sistema de Validação de Importação de Lançamentos Financeiros
 * 
 * Este módulo valida todos os dados do arquivo Excel ANTES de inserir no banco.
 * Gera um log detalhado de erros para correção.
 */

export interface ErroValidacao {
  linha: number
  campo: string
  valor: any
  mensagem: string
  tipo: 'erro' | 'aviso'
}

export interface ResultadoValidacao {
  valido: boolean
  erros: ErroValidacao[]
  avisos: ErroValidacao[]
  totalLinhas: number
  linhasValidas: number
  linhasInvalidas: number
}

export interface LancamentoValidado {
  linha: number
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  data: string
  status: 'realizado' | 'previsto'
  centroCusto: string
  centroCustoId?: string
  dadosOriginais: any
}

// Valores permitidos
const TIPOS_PERMITIDOS = ['ENTRADA', 'SAIDA', 'RECEITA', 'DESPESA']
const STATUS_PERMITIDOS = ['PAGO', 'PREVISTO', 'REALIZADO', 'PENDENTE']

/**
 * Converte string DD/MM/YYYY para Date
 */
function converterDDMMYYYY(dataStr: string): Date | null {
  const match = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  
  const dia = parseInt(match[1], 10)
  const mes = parseInt(match[2], 10) - 1 // Mês em JS é 0-11
  const ano = parseInt(match[3], 10)
  
  const data = new Date(ano, mes, dia)
  
  // Verificar se a data é válida (ex: 31/02/2023 seria inválida)
  if (data.getDate() !== dia || data.getMonth() !== mes || data.getFullYear() !== ano) {
    return null
  }
  
  return data
}

/**
 * Valida o formato de uma data
 */
export function validarFormatoData(data: any): boolean {
  if (!data) return false
  
  // Se for número (serial do Excel)
  if (typeof data === 'number') {
    return data > 0 && data < 100000 // Range razoável para datas Excel
  }
  
  // Se for string
  if (typeof data === 'string') {
    const dataStr = data.trim()
    
    // Formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      const dateObj = new Date(dataStr + 'T00:00:00')
      return !isNaN(dateObj.getTime())
    }
    
    // Formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
      const dateObj = converterDDMMYYYY(dataStr)
      return dateObj !== null && !isNaN(dateObj.getTime())
    }
    
    // Tentar converter para Date (outros formatos)
    const dateObj = new Date(dataStr)
    return !isNaN(dateObj.getTime())
  }
  
  // Se for objeto Date
  if (data instanceof Date) {
    return !isNaN(data.getTime())
  }
  
  return false
}

/**
 * Valida se a data está dentro de um range razoável
 */
export function validarRangeData(dataStr: string): boolean {
  try {
    const data = new Date(dataStr)
    const anoAtual = new Date().getFullYear()
    const ano = data.getFullYear()
    
    // Aceita datas de 10 anos atrás até 5 anos no futuro
    return ano >= (anoAtual - 10) && ano <= (anoAtual + 5)
  } catch {
    return false
  }
}

/**
 * Valida formato de valor numérico
 */
export function validarValor(valor: any): { valido: boolean; valorNumerico?: number } {
  if (valor === null || valor === undefined || valor === '') {
    return { valido: false }
  }
  
  // Se já for número
  if (typeof valor === 'number') {
    if (isNaN(valor) || valor <= 0) {
      return { valido: false }
    }
    return { valido: true, valorNumerico: valor }
  }
  
  // Se for string, tentar converter
  if (typeof valor === 'string') {
    const valorLimpo = valor
      .replace(/[^\d,.-]/g, '') // Remove tudo exceto dígitos, vírgula, ponto e menos
      .replace(/\./g, '') // Remove pontos (separador de milhar)
      .replace(',', '.') // Converte vírgula para ponto
    
    const valorNumerico = parseFloat(valorLimpo)
    
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      return { valido: false }
    }
    
    return { valido: true, valorNumerico }
  }
  
  return { valido: false }
}

/**
 * Valida tipo de lançamento
 */
export function validarTipo(tipo: any): { valido: boolean; tipoNormalizado?: 'entrada' | 'saida' } {
  if (!tipo) return { valido: false }
  
  const tipoStr = tipo.toString().toUpperCase().trim()
  
  if (tipoStr.includes('ENTRADA') || tipoStr.includes('RECEITA')) {
    return { valido: true, tipoNormalizado: 'entrada' }
  }
  
  if (tipoStr.includes('SAIDA') || tipoStr.includes('DESPESA')) {
    return { valido: true, tipoNormalizado: 'saida' }
  }
  
  return { valido: false }
}

/**
 * Valida status do lançamento
 */
export function validarStatus(status: any): { valido: boolean; statusNormalizado?: 'realizado' | 'previsto' } {
  if (!status) return { valido: false }
  
  const statusStr = status.toString().toUpperCase().trim()
  
  if (statusStr.includes('PAGO') || statusStr.includes('REALIZADO')) {
    return { valido: true, statusNormalizado: 'realizado' }
  }
  
  if (statusStr.includes('PREVISTO') || statusStr.includes('PENDENTE')) {
    return { valido: true, statusNormalizado: 'previsto' }
  }
  
  return { valido: false }
}

/**
 * Valida descrição
 */
export function validarDescricao(descricao: any): boolean {
  if (!descricao) return false
  
  const descStr = descricao.toString().trim()
  
  // Descrição deve ter pelo menos 3 caracteres
  if (descStr.length < 3) return false
  
  // Descrição não pode ter mais de 255 caracteres
  if (descStr.length > 255) return false
  
  return true
}

/**
 * Valida centro de custo
 */
export function validarCentroCusto(centroCusto: any): boolean {
  if (!centroCusto) return false
  
  const centroStr = centroCusto.toString().trim()
  
  // Centro de custo deve ter pelo menos 2 caracteres
  if (centroStr.length < 2) return false
  
  // Centro de custo não pode ter mais de 100 caracteres
  if (centroStr.length > 100) return false
  
  return true
}

/**
 * Valida uma linha completa do Excel
 */
export function validarLinha(
  linha: any[],
  numeroLinha: number,
  mapeamento: any
): { lancamento?: LancamentoValidado; erros: ErroValidacao[] } {
  const erros: ErroValidacao[] = []
  
  // Extrair dados
  const rawData = linha[mapeamento.DATA]
  const rawDescricao = linha[mapeamento.DESCRICAO]
  const rawValor = linha[mapeamento.VALOR]
  const rawTipo = linha[mapeamento.TIPO]
  const rawStatus = linha[mapeamento.STATUS]
  const rawCentroCusto = linha[mapeamento.CENTRO_CUSTO]
  
  // Validar DATA
  if (!validarFormatoData(rawData)) {
    erros.push({
      linha: numeroLinha,
      campo: 'DATA',
      valor: rawData,
      mensagem: 'Data em formato inválido ou vazia',
      tipo: 'erro'
    })
  }
  
  // Validar DESCRICAO
  if (!validarDescricao(rawDescricao)) {
    erros.push({
      linha: numeroLinha,
      campo: 'DESCRICAO',
      valor: rawDescricao,
      mensagem: 'Descrição inválida (mínimo 3 caracteres, máximo 255)',
      tipo: 'erro'
    })
  }
  
  // Validar VALOR
  const resultadoValor = validarValor(rawValor)
  if (!resultadoValor.valido) {
    erros.push({
      linha: numeroLinha,
      campo: 'VALOR',
      valor: rawValor,
      mensagem: 'Valor inválido (deve ser número positivo)',
      tipo: 'erro'
    })
  }
  
  // Validar TIPO
  const resultadoTipo = validarTipo(rawTipo)
  if (!resultadoTipo.valido) {
    erros.push({
      linha: numeroLinha,
      campo: 'TIPO',
      valor: rawTipo,
      mensagem: 'Tipo inválido (deve ser ENTRADA ou SAIDA)',
      tipo: 'erro'
    })
  }
  
  // Validar STATUS
  const resultadoStatus = validarStatus(rawStatus)
  if (!resultadoStatus.valido) {
    erros.push({
      linha: numeroLinha,
      campo: 'STATUS',
      valor: rawStatus,
      mensagem: 'Status inválido (deve ser PAGO ou PREVISTO)',
      tipo: 'erro'
    })
  }
  
  // Validar CENTRO_CUSTO
  if (!validarCentroCusto(rawCentroCusto)) {
    erros.push({
      linha: numeroLinha,
      campo: 'CENTRO_CUSTO',
      valor: rawCentroCusto,
      mensagem: 'Centro de custo inválido (mínimo 2 caracteres)',
      tipo: 'erro'
    })
  }
  
  // Se houver erros, retornar
  if (erros.length > 0) {
    return { erros }
  }
  
  // Se passou todas as validações, criar objeto de lançamento validado
  const lancamento: LancamentoValidado = {
    linha: numeroLinha,
    descricao: rawDescricao.toString().trim(),
    valor: resultadoValor.valorNumerico!,
    tipo: resultadoTipo.tipoNormalizado!,
    data: rawData, // Será convertido depois
    status: resultadoStatus.statusNormalizado!,
    centroCusto: rawCentroCusto.toString().trim(),
    dadosOriginais: {
      data: rawData,
      descricao: rawDescricao,
      valor: rawValor,
      tipo: rawTipo,
      status: rawStatus,
      centroCusto: rawCentroCusto
    }
  }
  
  return { lancamento, erros: [] }
}

/**
 * Valida todas as linhas do arquivo
 */
export function validarArquivo(
  rows: any[][],
  mapeamento: any
): { lancamentos: LancamentoValidado[]; resultado: ResultadoValidacao } {
  const erros: ErroValidacao[] = []
  const avisos: ErroValidacao[] = []
  const lancamentos: LancamentoValidado[] = []
  
  let linhasValidas = 0
  let linhasInvalidas = 0
  
  // Processar cada linha (pulando cabeçalho)
  for (let i = 1; i < rows.length; i++) {
    const linha = rows[i]
    
    // Pular linhas completamente vazias
    if (!linha || linha.length === 0 || linha.every(cell => !cell)) {
      continue
    }
    
    const { lancamento, erros: errosLinha } = validarLinha(linha, i + 1, mapeamento)
    
    if (errosLinha.length > 0) {
      erros.push(...errosLinha)
      linhasInvalidas++
    } else if (lancamento) {
      lancamentos.push(lancamento)
      linhasValidas++
    }
  }
  
  const resultado: ResultadoValidacao = {
    valido: erros.length === 0,
    erros,
    avisos,
    totalLinhas: rows.length - 1, // Excluindo cabeçalho
    linhasValidas,
    linhasInvalidas
  }
  
  return { lancamentos, resultado }
}

/**
 * Gera relatório de erros em formato texto
 */
export function gerarRelatorioErros(resultado: ResultadoValidacao): string {
  let relatorio = '═══════════════════════════════════════════════════════════\n'
  relatorio += '          RELATÓRIO DE VALIDAÇÃO DE IMPORTAÇÃO\n'
  relatorio += '═══════════════════════════════════════════════════════════\n\n'
  
  relatorio += `📊 RESUMO:\n`
  relatorio += `   Total de linhas: ${resultado.totalLinhas}\n`
  relatorio += `   ✅ Linhas válidas: ${resultado.linhasValidas}\n`
  relatorio += `   ❌ Linhas inválidas: ${resultado.linhasInvalidas}\n`
  relatorio += `   🚨 Total de erros: ${resultado.erros.length}\n`
  relatorio += `   ⚠️  Total de avisos: ${resultado.avisos.length}\n\n`
  
  if (resultado.valido) {
    relatorio += '✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!\n'
    relatorio += '   Todos os dados estão corretos e prontos para importação.\n\n'
  } else {
    relatorio += '❌ VALIDAÇÃO FALHOU!\n'
    relatorio += '   Corrija os erros abaixo antes de tentar importar novamente.\n\n'
  }
  
  if (resultado.erros.length > 0) {
    relatorio += '═══════════════════════════════════════════════════════════\n'
    relatorio += '                    ERROS ENCONTRADOS\n'
    relatorio += '═══════════════════════════════════════════════════════════\n\n'
    
    // Agrupar erros por linha
    const errosPorLinha = new Map<number, ErroValidacao[]>()
    resultado.erros.forEach(erro => {
      if (!errosPorLinha.has(erro.linha)) {
        errosPorLinha.set(erro.linha, [])
      }
      errosPorLinha.get(erro.linha)!.push(erro)
    })
    
    // Listar erros por linha
    Array.from(errosPorLinha.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([linha, errosLinha]) => {
        relatorio += `📍 LINHA ${linha}:\n`
        errosLinha.forEach(erro => {
          relatorio += `   ❌ ${erro.campo}: ${erro.mensagem}\n`
          relatorio += `      Valor recebido: "${erro.valor}"\n`
        })
        relatorio += '\n'
      })
  }
  
  if (resultado.avisos.length > 0) {
    relatorio += '═══════════════════════════════════════════════════════════\n'
    relatorio += '                    AVISOS\n'
    relatorio += '═══════════════════════════════════════════════════════════\n\n'
    
    resultado.avisos.forEach(aviso => {
      relatorio += `⚠️  LINHA ${aviso.linha} - ${aviso.campo}: ${aviso.mensagem}\n`
    })
    relatorio += '\n'
  }
  
  relatorio += '═══════════════════════════════════════════════════════════\n'
  relatorio += `Relatório gerado em: ${new Date().toLocaleString('pt-BR')}\n`
  relatorio += '═══════════════════════════════════════════════════════════\n'
  
  return relatorio
}

/**
 * Gera relatório de erros em formato HTML
 */
export function gerarRelatorioErrosHTML(resultado: ResultadoValidacao): string {
  let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Validação de Importação</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #007bff;
      padding-bottom: 10px;
    }
    .resumo {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .resumo-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #dee2e6;
    }
    .resumo-item:last-child {
      border-bottom: none;
    }
    .status-sucesso {
      background: #d4edda;
      color: #155724;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #28a745;
      margin: 20px 0;
    }
    .status-erro {
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #dc3545;
      margin: 20px 0;
    }
    .erro-grupo {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .erro-item {
      margin: 10px 0;
      padding: 10px;
      background: white;
      border-radius: 4px;
    }
    .erro-campo {
      font-weight: bold;
      color: #dc3545;
    }
    .erro-valor {
      font-family: monospace;
      background: #f8f9fa;
      padding: 2px 6px;
      border-radius: 3px;
      color: #495057;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .badge-success {
      background: #28a745;
      color: white;
    }
    .badge-danger {
      background: #dc3545;
      color: white;
    }
    .badge-warning {
      background: #ffc107;
      color: #212529;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      color: #6c757d;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Relatório de Validação de Importação</h1>
    
    <div class="resumo">
      <h2>Resumo</h2>
      <div class="resumo-item">
        <span>Total de linhas:</span>
        <span><strong>${resultado.totalLinhas}</strong></span>
      </div>
      <div class="resumo-item">
        <span>✅ Linhas válidas:</span>
        <span><span class="badge badge-success">${resultado.linhasValidas}</span></span>
      </div>
      <div class="resumo-item">
        <span>❌ Linhas inválidas:</span>
        <span><span class="badge badge-danger">${resultado.linhasInvalidas}</span></span>
      </div>
      <div class="resumo-item">
        <span>🚨 Total de erros:</span>
        <span><span class="badge badge-danger">${resultado.erros.length}</span></span>
      </div>
      <div class="resumo-item">
        <span>⚠️ Total de avisos:</span>
        <span><span class="badge badge-warning">${resultado.avisos.length}</span></span>
      </div>
    </div>
`
  
  if (resultado.valido) {
    html += `
    <div class="status-sucesso">
      <h3>✅ Validação Concluída com Sucesso!</h3>
      <p>Todos os dados estão corretos e prontos para importação.</p>
    </div>
`
  } else {
    html += `
    <div class="status-erro">
      <h3>❌ Validação Falhou!</h3>
      <p>Corrija os erros listados abaixo antes de tentar importar novamente.</p>
    </div>
`
  }
  
  if (resultado.erros.length > 0) {
    html += `
    <h2>Erros Encontrados</h2>
`
    
    // Agrupar erros por linha
    const errosPorLinha = new Map<number, ErroValidacao[]>()
    resultado.erros.forEach(erro => {
      if (!errosPorLinha.has(erro.linha)) {
        errosPorLinha.set(erro.linha, [])
      }
      errosPorLinha.get(erro.linha)!.push(erro)
    })
    
    // Listar erros por linha
    Array.from(errosPorLinha.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([linha, errosLinha]) => {
        html += `
    <div class="erro-grupo">
      <h3>📍 Linha ${linha}</h3>
`
        errosLinha.forEach(erro => {
          html += `
      <div class="erro-item">
        <div><span class="erro-campo">${erro.campo}:</span> ${erro.mensagem}</div>
        <div style="margin-top: 5px;">Valor recebido: <span class="erro-valor">${erro.valor}</span></div>
      </div>
`
        })
        html += `
    </div>
`
      })
  }
  
  if (resultado.avisos.length > 0) {
    html += `
    <h2>Avisos</h2>
`
    resultado.avisos.forEach(aviso => {
      html += `
    <div class="erro-item">
      <div>⚠️ <strong>Linha ${aviso.linha} - ${aviso.campo}:</strong> ${aviso.mensagem}</div>
    </div>
`
    })
  }
  
  html += `
    <div class="footer">
      Relatório gerado em: ${new Date().toLocaleString('pt-BR', { 
        dateStyle: 'full', 
        timeStyle: 'medium' 
      })}
    </div>
  </div>
</body>
</html>
`
  
  return html
}

/**
 * Salva relatório de erros em arquivo
 */
export function salvarRelatorioErros(resultado: ResultadoValidacao, formato: 'txt' | 'html' = 'txt'): Blob {
  const conteudo = formato === 'html' 
    ? gerarRelatorioErrosHTML(resultado)
    : gerarRelatorioErros(resultado)
  
  const mimeType = formato === 'html' ? 'text/html' : 'text/plain'
  return new Blob([conteudo], { type: `${mimeType};charset=utf-8;` })
}
