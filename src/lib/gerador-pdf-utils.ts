/**
 * Utilitário para geração de PDFs no formato Ordem de Compra
 * Utiliza jsPDF para criar documentos PDF no frontend
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface LogoConfig {
  logoEmpresa?: string // Base64 ou URL
  logoCliente?: string // Base64 ou URL
  nomeEmpresa: string
  nomeSistema: string
}

interface ParcelaPDF {
  numero: number
  data: string
  valor: number
  status: string
}

interface ItemPDF {
  codigo?: string
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

// Interface para dados de relatório financeiro (parcelas)
interface DadosRelatorioFinanceiro {
  tipo: 'financeiro'
  transacoes: TransacaoFinanceira[]
  filtrosAplicados?: string[]
  totalGeral: number
}

interface TransacaoFinanceira {
  vencimento: string
  transacao: number
  clienteFornecedor: string
  valor: number
  parcela: string // Ex: "1/3"
  tipo: 'VENDA' | 'COMPRA'
  status: string
}

// Interface para dados de relatório de vendas (resumido)
interface DadosRelatorioVendas {
  tipo: 'vendas_resumido'
  vendas: VendaResumida[]
  filtrosAplicados?: string[]
  totalGeral: number
}

interface VendaResumida {
  data: string
  transacao: number
  cliente: string
  valorTotal: number
  parcelas: number
  status: string
}

// Interface para dados de relatório de compras (resumido)
interface DadosRelatorioCompras {
  tipo: 'compras_resumido'
  compras: CompraResumida[]
  filtrosAplicados?: string[]
  totalGeral: number
}

interface CompraResumida {
  data: string
  transacao: number
  fornecedor: string
  valorTotal: number
  parcelas: number
  status: string
}

// Interface para dados de PDF detalhado (com produtos)
interface DadosPDFDetalhado {
  tipo: 'compra_detalhada' | 'venda_detalhada'
  numero: number
  data: string
  clienteFornecedor: string
  itens: ItemPDF[]
  total: number
  quantidadeParcelas?: number
  parcelas?: ParcelaPDF[]
  observacoes?: string
}

interface DadosPDF {
  tipo: 'compra' | 'venda' | 'estoque'
  numero?: number
  data: string
  clienteFornecedor?: string
  itens: ItemPDF[]
  total: number
  parcelas?: ParcelaPDF[]
  observacoes?: string
  filtrosAplicados?: string[]
  quantidadeParcelas?: number // Quantidade de parcelas
}

type DadosRelatorio = DadosRelatorioFinanceiro | DadosRelatorioVendas | DadosRelatorioCompras

export class GeradorPDF {
  private doc: jsPDF
  private logoConfig: LogoConfig
  private margemEsquerda = 15
  private margemDireita = 15
  private larguraPagina = 210 // A4
  private alturaPagina = 297 // A4
  private yAtual = 20

  constructor(logoConfig: LogoConfig) {
    this.doc = new jsPDF('p', 'mm', 'a4')
    this.logoConfig = logoConfig
  }

  private adicionarCabecalho() {
    const { nomeEmpresa, nomeSistema } = this.logoConfig
    
    const yLogo = 10
    
    if (this.logoConfig.logoEmpresa) {
      try {
        this.doc.addImage(this.logoConfig.logoEmpresa, 'PNG', this.margemEsquerda, yLogo, 30, 15)
      } catch (error) {
        console.error('Erro ao adicionar logo da empresa:', error)
      }
    }
    
    this.doc.setFontSize(18)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(nomeSistema, this.larguraPagina / 2, yLogo + 8, { align: 'center' })
    
    if (this.logoConfig.logoCliente) {
      try {
        this.doc.addImage(
          this.logoConfig.logoCliente, 
          'PNG', 
          this.larguraPagina - this.margemDireita - 30, 
          yLogo, 
          30, 
          15
        )
      } catch (error) {
        console.error('Erro ao adicionar logo do cliente:', error)
      }
    }
    
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(nomeEmpresa, this.larguraPagina / 2, yLogo + 13, { align: 'center' })
    
    this.yAtual = yLogo + 18
    this.doc.setDrawColor(200, 200, 200)
    this.doc.line(this.margemEsquerda, this.yAtual, this.larguraPagina - this.margemDireita, this.yAtual)
    this.yAtual += 5
  }

  private adicionarTitulo(titulo: string) {
    this.doc.setFontSize(16)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(titulo, this.margemEsquerda, this.yAtual)
    this.yAtual += 8
  }

  private adicionarInformacoesFiltros(filtrosAplicados?: string[]) {
    if (filtrosAplicados && filtrosAplicados.length > 0) {
      this.doc.setFontSize(10)
      this.doc.setFont('helvetica', 'normal')
      
      this.doc.text('Filtros Aplicados:', this.margemEsquerda, this.yAtual)
      this.yAtual += 5
      
      filtrosAplicados.forEach(filtro => {
        this.doc.text(`• ${filtro}`, this.margemEsquerda + 5, this.yAtual)
        this.yAtual += 5
      })
      
      this.yAtual += 3
    }
  }

  private formatarDataPDF(dataISO: string): string {
    try {
      if (!dataISO) return ""
      const data = new Date(dataISO + 'T12:00:00')
      return data.toLocaleDateString('pt-BR')
    } catch {
      return dataISO
    }
  }

  private formatarValor(valor: number): string {
    return `R$ ${valor.toFixed(2)}`
  }

  // MÉTODO PARA GERAR RELATÓRIO FINANCEIRO (PARCELAS) - COLORIDO
  public gerarRelatorioFinanceiro(dados: DadosRelatorioFinanceiro): void {
    this.doc = new jsPDF()
    this.adicionarCabecalho()
    this.adicionarTitulo('RELATÓRIO FINANCEIRO')
    this.adicionarInformacoesFiltros(dados.filtrosAplicados)
    
    // Adicionar informações do relatório
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Total de transações: ${dados.transacoes.length}`, this.margemEsquerda, this.yAtual)
    this.yAtual += 5
    
    // Tabela de transações financeiras - COLORIDA
    const colunas = ['Vencimento', 'Transação', 'Cliente/Fornecedor', 'Valor', 'Parcela', 'Tipo', 'Status']
    
    const linhas = dados.transacoes.map(trans => [
      this.formatarDataPDF(trans.vencimento),
      `#${trans.transacao}`,
      trans.clienteFornecedor.substring(0, 30), // Limitar tamanho
      this.formatarValor(trans.valor),
      trans.parcela,
      trans.tipo,
      trans.status.charAt(0).toUpperCase() + trans.status.slice(1)
    ])
    
    autoTable(this.doc as any, {
      startY: this.yAtual,
      head: [colunas],
      body: linhas,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [34, 139, 34], // Verde para cabeçalho
        textColor: 255,
        fontStyle: 'bold',
      },
      bodyStyles: {
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240] // Cinza claro para linhas alternadas
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 50 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 25 },
      },
      margin: { left: this.margemEsquerda, right: this.margemDireita },
      didParseCell: (data: any) => {
        // Colorir tipo VENDA/COMPRA
        if (data.column.index === 5) {
          if (data.cell.text[0] === 'VENDA') {
            data.cell.styles.fillColor = [144, 238, 144] // Verde claro para VENDA
          } else if (data.cell.text[0] === 'COMPRA') {
            data.cell.styles.fillColor = [255, 182, 193] // Vermelho claro para COMPRA
          }
        }
        // Colorir status
        if (data.column.index === 6) {
          if (data.cell.text[0] === 'Pago' || data.cell.text[0] === 'pago') {
            data.cell.styles.fillColor = [34, 139, 34] // Verde para pago
            data.cell.styles.textColor = 255
          } else if (data.cell.text[0] === 'Pendente' || data.cell.text[0] === 'pendente') {
            data.cell.styles.fillColor = [255, 255, 0] // Amarelo para pendente
          }
        }
      }
    })
    
    this.yAtual = (this.doc as any).lastAutoTable.finalY + 10
    
    // Total geral
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    const textoTotal = `TOTAL GERAL: ${this.formatarValor(dados.totalGeral)}`
    const larguraTexto = this.doc.getTextWidth(textoTotal)
    this.doc.text(
      textoTotal, 
      this.larguraPagina - this.margemDireita - larguraTexto, 
      this.yAtual
    )
    
    this.adicionarRodape()
  }

  // MÉTODO PARA GERAR RELATÓRIO DE VENDAS (RESUMIDO) - COLORIDO
  public gerarRelatorioVendas(dados: DadosRelatorioVendas): void {
    this.doc = new jsPDF()
    this.adicionarCabecalho()
    this.adicionarTitulo('RELATÓRIO DE VENDAS')
    this.adicionarInformacoesFiltros(dados.filtrosAplicados)
    
    // Adicionar informações do relatório
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Total de vendas: ${dados.vendas.length}`, this.margemEsquerda, this.yAtual)
    this.yAtual += 5
    
    // Tabela de vendas resumidas - COLORIDA
    const colunas = ['Data', 'Transação', 'Cliente', 'Valor Total', 'Parcelas', 'Status']
    
    const linhas = dados.vendas.map(venda => [
      this.formatarDataPDF(venda.data),
      `#${venda.transacao}`,
      venda.cliente.substring(0, 30), // Limitar tamanho
      this.formatarValor(venda.valorTotal),
      `${venda.parcelas}x`,
      venda.status.charAt(0).toUpperCase() + venda.status.slice(1)
    ])
    
    autoTable(this.doc as any, {
      startY: this.yAtual,
      head: [colunas],
      body: linhas,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [34, 139, 34], // Verde para cabeçalho
        textColor: 255,
        fontStyle: 'bold',
      },
      bodyStyles: {
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240] // Cinza claro para linhas alternadas
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 60 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
      },
      margin: { left: this.margemEsquerda, right: this.margemDireita },
      didParseCell: (data: any) => {
        // Colorir coluna de valor total
        if (data.column.index === 3) {
          data.cell.styles.fillColor = [144, 238, 144] // Verde claro para valores positivos
          data.cell.styles.fontStyle = 'bold'
        }
        // Colorir status
        if (data.column.index === 5) {
          if (data.cell.text[0] === 'Pago' || data.cell.text[0] === 'pago') {
            data.cell.styles.fillColor = [34, 139, 34] // Verde para pago
            data.cell.styles.textColor = 255
          } else if (data.cell.text[0] === 'Pendente' || data.cell.text[0] === 'pendente') {
            data.cell.styles.fillColor = [255, 255, 0] // Amarelo para pendente
          }
        }
      }
    })
    
    this.yAtual = (this.doc as any).lastAutoTable.finalY + 10
    
    // Total geral
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    const textoTotal = `TOTAL GERAL: ${this.formatarValor(dados.totalGeral)}`
    const larguraTexto = this.doc.getTextWidth(textoTotal)
    this.doc.text(
      textoTotal, 
      this.larguraPagina - this.margemDireita - larguraTexto, 
      this.yAtual
    )
    
    this.adicionarRodape()
  }

  // MÉTODO PARA GERAR RELATÓRIO DE COMPRAS (RESUMIDO) - COLORIDO
  public gerarRelatorioCompras(dados: DadosRelatorioCompras): void {
    this.doc = new jsPDF()
    this.adicionarCabecalho()
    this.adicionarTitulo('RELATÓRIO DE COMPRAS')
    this.adicionarInformacoesFiltros(dados.filtrosAplicados)
    
    // Adicionar informações do relatório
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Total de compras: ${dados.compras.length}`, this.margemEsquerda, this.yAtual)
    this.yAtual += 5
    
    // Tabela de compras resumidas - COLORIDA
    const colunas = ['Data', 'Transação', 'Fornecedor', 'Valor Total', 'Parcelas', 'Status']
    
    const linhas = dados.compras.map(compra => [
      this.formatarDataPDF(compra.data),
      `#${compra.transacao}`,
      compra.fornecedor.substring(0, 30), // Limitar tamanho
      this.formatarValor(compra.valorTotal),
      `${compra.parcelas}x`,
      compra.status.charAt(0).toUpperCase() + compra.status.slice(1)
    ])
    
    autoTable(this.doc as any, {
      startY: this.yAtual,
      head: [colunas],
      body: linhas,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [34, 139, 34], // Verde para cabeçalho
        textColor: 255,
        fontStyle: 'bold',
      },
      bodyStyles: {
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240] // Cinza claro para linhas alternadas
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 60 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
      },
      margin: { left: this.margemEsquerda, right: this.margemDireita },
      didParseCell: (data: any) => {
        // Colorir coluna de valor total
        if (data.column.index === 3) {
          data.cell.styles.fillColor = [255, 182, 193] // Vermelho claro para valores negativos (compras)
          data.cell.styles.fontStyle = 'bold'
        }
        // Colorir status
        if (data.column.index === 5) {
          if (data.cell.text[0] === 'Pago' || data.cell.text[0] === 'pago') {
            data.cell.styles.fillColor = [34, 139, 34] // Verde para pago
            data.cell.styles.textColor = 255
          } else if (data.cell.text[0] === 'Pendente' || data.cell.text[0] === 'pendente') {
            data.cell.styles.fillColor = [255, 255, 0] // Amarelo para pendente
          }
        }
      }
    })
    
    this.yAtual = (this.doc as any).lastAutoTable.finalY + 10
    
    // Total geral
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    const textoTotal = `TOTAL GERAL: ${this.formatarValor(dados.totalGeral)}`
    const larguraTexto = this.doc.getTextWidth(textoTotal)
    this.doc.text(
      textoTotal, 
      this.larguraPagina - this.margemDireita - larguraTexto, 
      this.yAtual
    )
    
    this.adicionarRodape()
  }

  // NOVO MÉTODO: GERAR PDF DETALHADO DE COMPRA/VENDA (COM PRODUTOS)
  public gerarPDFDetalhadoTransacao(dados: DadosPDFDetalhado): void {
    this.doc = new jsPDF()
    this.adicionarCabecalho()
    
    const titulo = dados.tipo === 'compra_detalhada' 
      ? `ORDEM DE COMPRA #${dados.numero}` 
      : `ORDEM DE VENDA #${dados.numero}`
    
    this.adicionarTitulo(titulo)
    
    // Informações básicas
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    
    const labelClienteFornecedor = dados.tipo === 'compra_detalhada' ? 'Fornecedor' : 'Cliente'
    
    this.doc.text(`${labelClienteFornecedor}: ${dados.clienteFornecedor}`, this.margemEsquerda, this.yAtual)
    this.yAtual += 5
    this.doc.text(`Data: ${this.formatarDataPDF(dados.data)}`, this.margemEsquerda, this.yAtual)
    this.yAtual += 5
    
    if (dados.quantidadeParcelas) {
      this.doc.text(`Parcelas: ${dados.quantidadeParcelas}`, this.margemEsquerda, this.yAtual)
      this.yAtual += 5
    }
    
    this.yAtual += 3
    
    // Tabela de produtos - COLORIDA
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('PRODUTOS', this.margemEsquerda, this.yAtual)
    this.yAtual += 7
    
    const colunasProdutos = ['Código', 'Descrição', 'Quantidade', 'Valor Unitário', 'Valor Total']
    
    const linhasProdutos = dados.itens.map(item => [
      item.codigo || '-',
      item.descricao.substring(0, 40), // Limitar tamanho
      item.quantidade.toString(),
      this.formatarValor(item.valorUnitario),
      this.formatarValor(item.valorTotal)
    ])
    
    autoTable(this.doc as any, {
      startY: this.yAtual,
      head: [colunasProdutos],
      body: linhasProdutos,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: dados.tipo === 'compra_detalhada' ? [255, 140, 0] : [34, 139, 34], // Laranja para compra, verde para venda
        textColor: 255,
        fontStyle: 'bold',
      },
      bodyStyles: {
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245] // Cinza muito claro para linhas alternadas
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 70 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
      },
      margin: { left: this.margemEsquerda, right: this.margemDireita },
      didParseCell: (data: any) => {
        // Colorir última coluna (Valor Total)
        if (data.column.index === 4) {
          data.cell.styles.fillColor = dados.tipo === 'compra_detalhada' 
            ? [255, 200, 200] // Vermelho claro para compra
            : [200, 255, 200] // Verde claro para venda
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })
    
    this.yAtual = (this.doc as any).lastAutoTable.finalY + 10
    
    // Total
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    const textoTotal = `TOTAL: ${this.formatarValor(dados.total)}`
    const larguraTexto = this.doc.getTextWidth(textoTotal)
    this.doc.text(
      textoTotal, 
      this.larguraPagina - this.margemDireita - larguraTexto, 
      this.yAtual
    )
    
    this.yAtual += 10
    
    // Tabela de parcelas (se houver)
    if (dados.parcelas && dados.parcelas.length > 0) {
      this.doc.setFontSize(11)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('PARCELAMENTO', this.margemEsquerda, this.yAtual)
      this.yAtual += 7
      
      const colunasParcelas = ['Parcela', 'Vencimento', 'Valor', 'Status']
      
      const linhasParcelas = dados.parcelas.map(parcela => [
        `${parcela.numero}ª`,
        this.formatarDataPDF(parcela.data),
        this.formatarValor(parcela.valor),
        parcela.status.charAt(0).toUpperCase() + parcela.status.slice(1)
      ])
      
      autoTable(this.doc as any, {
        startY: this.yAtual,
        head: [colunasParcelas],
        body: linhasParcelas,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [70, 130, 180], // Azul para cabeçalho de parcelas
          textColor: 255,
          fontStyle: 'bold',
        },
        bodyStyles: {
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
        },
        margin: { left: this.margemEsquerda, right: this.margemDireita },
        didParseCell: (data: any) => {
          // Colorir status das parcelas
          if (data.column.index === 3) {
            if (data.cell.text[0] === 'Pago' || data.cell.text[0] === 'pago') {
              data.cell.styles.fillColor = [34, 139, 34] // Verde para pago
              data.cell.styles.textColor = 255
            } else if (data.cell.text[0] === 'Pendente' || data.cell.text[0] === 'pendente') {
              data.cell.styles.fillColor = [255, 255, 0] // Amarelo para pendente
            }
          }
        }
      })
      
      this.yAtual = (this.doc as any).lastAutoTable.finalY + 10
    }
    
    // Observações
    if (dados.observacoes && dados.observacoes.trim() !== '') {
      this.doc.setFontSize(9)
      this.doc.setFont('helvetica', 'italic')
      this.doc.text('Observações:', this.margemEsquerda, this.yAtual)
      this.yAtual += 4
      
      this.doc.setFontSize(8)
      this.doc.text(dados.observacoes, this.margemEsquerda, this.yAtual)
      this.yAtual += 6
    }
    
    this.adicionarRodape()
  }

  // MÉTODO ORIGINAL (MANTIDO PARA COMPATIBILIDADE)
  private adicionarInformacoes(dados: DadosPDF) {
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    
    const linhas: string[] = []
    
    if (dados.numero) {
      linhas.push(`Número: #${dados.numero}`)
    }
    
    linhas.push(`Data: ${this.formatarDataPDF(dados.data)}`)
    
    if (dados.clienteFornecedor) {
      const label = dados.tipo === 'compra' ? 'Fornecedor' : 'Cliente'
      linhas.push(`${label}: ${dados.clienteFornecedor}`)
    }
    
    if (dados.quantidadeParcelas) {
      linhas.push(`Parcelas: ${dados.quantidadeParcelas}`)
    }
    
    if (dados.filtrosAplicados && dados.filtrosAplicados.length > 0) {
      linhas.push(`Filtros: ${dados.filtrosAplicados.join(', ')}`)
    }
    
    linhas.forEach(linha => {
      this.doc.text(linha, this.margemEsquerda, this.yAtual)
      this.yAtual += 5
    })
    
    this.yAtual += 3
  }

  private adicionarResumoTransacao(dados: DadosPDF) {
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('RESUMO DA TRANSAÇÃO', this.margemEsquerda, this.yAtual)
    this.yAtual += 7
    
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'normal')
    
    const resumoLinhas = [
      `Valor Total: R$ ${dados.total.toFixed(2)}`,
      `Quantidade de Itens: ${dados.itens.length}`,
      dados.quantidadeParcelas ? `Parcelas: ${dados.quantidadeParcelas}` : ''
    ].filter(Boolean)
    
    resumoLinhas.forEach(linha => {
      this.doc.text(linha, this.margemEsquerda, this.yAtual)
      this.yAtual += 5
    })
    
    this.yAtual += 3
  }

  private adicionarTabelaParcelas(parcelas: ParcelaPDF[]) {
    if (!parcelas || parcelas.length === 0) return
    
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Parcelamento:', this.margemEsquerda, this.yAtual)
    this.yAtual += 5
    
    const colunas = ['Parcela', 'Vencimento', 'Valor', 'Status']
    
    const linhas = parcelas.map(parcela => [
      `${parcela.numero}ª`,
      this.formatarDataPDF(parcela.data),
      `R$ ${parcela.valor.toFixed(2)}`,
      parcela.status.charAt(0).toUpperCase() + parcela.status.slice(1)
    ])
    
    autoTable(this.doc as any, {
      startY: this.yAtual,
      head: [colunas],
      body: linhas,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [80, 80, 80],
        textColor: 255,
        fontStyle: 'bold',
      },
      bodyStyles: {
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
      },
      margin: { left: this.margemEsquerda, right: this.margemDireita },
    })
    
    this.yAtual = (this.doc as any).lastAutoTable.finalY + 10
  }

  private adicionarTotais(dados: DadosPDF) {
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    
    const textoTotal = `VALOR TOTAL: R$ ${dados.total.toFixed(2)}`
    const larguraTexto = this.doc.getTextWidth(textoTotal)
    
    this.doc.text(
      textoTotal, 
      this.larguraPagina - this.margemDireita - larguraTexto, 
      this.yAtual
    )
    
    this.yAtual += 8
  }

  private adicionarObservacoes(dados: DadosPDF) {
    if (dados.observacoes && dados.observacoes.trim() !== '') {
      this.doc.setFontSize(9)
      this.doc.setFont('helvetica', 'italic')
      this.doc.text('Observações:', this.margemEsquerda, this.yAtual)
      this.yAtual += 4
      
      this.doc.setFontSize(8)
      this.doc.text(dados.observacoes, this.margemEsquerda, this.yAtual)
      this.yAtual += 6
    }
  }

  private adicionarRodape() {
    const yRodape = this.alturaPagina - 15
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'italic')
    this.doc.setTextColor(128, 128, 128)
    
    const dataGeracao = new Date().toLocaleString('pt-BR')
    this.doc.text(
      `Documento gerado em ${dataGeracao}`, 
      this.larguraPagina / 2, 
      yRodape, 
      { align: 'center' }
    )
    
    this.doc.setTextColor(0, 0, 0)
  }

  public gerarOrdemCompra(dados: DadosPDF): void {
    this.adicionarCabecalho()
    
    const titulo = dados.tipo === 'compra' 
      ? 'ORDEM DE COMPRA' 
      : dados.tipo === 'venda' 
        ? 'ORDEM DE VENDA' 
        : 'RELATÓRIO DE ESTOQUE'
    
    this.adicionarTitulo(titulo)
    this.adicionarInformacoes(dados)
    this.adicionarResumoTransacao(dados)
    
    if (dados.parcelas && dados.parcelas.length > 0) {
      this.adicionarTabelaParcelas(dados.parcelas)
    }
    
    this.adicionarTotais(dados)
    this.adicionarObservacoes(dados)
    this.adicionarRodape()
  }

  public salvar(nomeArquivo: string): void {
    this.doc.save(nomeArquivo)
  }

  public obterBlob(): Blob {
    return this.doc.output('blob')
  }

  public obterBase64(): string {
    return this.doc.output('dataurlstring')
  }
}

export async function imagemParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function obterConfigLogos(): LogoConfig {
  const logoEmpresa = localStorage.getItem('logo_empresa') || undefined
  const logoCliente = localStorage.getItem('logo_cliente') || undefined
  const nomeEmpresa = localStorage.getItem('nome_empresa') || 'Empresa Desenvolvedora'
  const nomeSistema = 'LUCIUS'
  
  return {
    logoEmpresa,
    logoCliente,
    nomeEmpresa,
    nomeSistema,
  }
}

export function salvarConfigLogos(config: Partial<LogoConfig>): void {
  if (config.logoEmpresa) {
    localStorage.setItem('logo_empresa', config.logoEmpresa)
  }
  if (config.logoCliente) {
    localStorage.setItem('logo_cliente', config.logoCliente)
  }
  if (config.nomeEmpresa) {
    localStorage.setItem('nome_empresa', config.nomeEmpresa)
  }
}