// lib/dateUtils.ts — VERSÃO CORRETA, COERENTE E À PROVA DE ERROS

/**
 * Retorna a data atual no Brasil (America/Sao_Paulo) no formato YYYY-MM-DD.
 * Não usa getDate local. Não depende do fuso do servidor.
 */
export function getDataAtualBrasil(): string {
  // Usando Intl.DateTimeFormat para garantir a data correta no fuso horário de São Paulo
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  // O formato 'en-CA' retorna YYYY-MM-DD, que é o formato ISO 8601
  const dataFormatada = formatter.format(new Date());

  return dataFormatada;
}

/**
 * Prepara data para INSERT garantindo que o formato final seja YYYY-MM-DD.
 */
export function prepararDataParaInsert(dataInput: string | Date): string {
  if (!dataInput) {
    return getDataAtualBrasil();
  }

  if (typeof dataInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dataInput)) {
    return dataInput;
  }

  let dataObj = new Date(dataInput);
  if (isNaN(dataObj.getTime())) {
    throw new Error(`Data inválida: ${dataInput}`);
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  return formatter.format(dataObj);
}

/**
 * Formata uma data ISO (YYYY-MM-DD ou ISO completa) para visualização no formato brasileiro DD/MM/YYYY.
 */
export function formatarDataParaExibicao(dataISO: string): string {
  try {
    if (!dataISO) return "";

    let dataParaConversao = dataISO;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
        dataParaConversao = `${dataISO}T12:00:00`;
    }
    
    const data = new Date(dataParaConversao);
    if (isNaN(data.getTime())) return dataISO;

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo'
    });
    
    return formatter.format(data);
  } catch {
    return dataISO;
  }
}

/**
 * Retorna ano-mês (YYYY-MM) do mês atual no Brasil.
 */
export function getMesAtualParaInput(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  const [ano, mes] = formatter.format(new Date()).split('-');
  
  return `${ano}-${mes}`;
}

export const normalizeDate = (d?: string) => {
    if (!d) return ''
    if (d.includes('T')) return d.split('T')[0]
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toISOString().slice(0, 10)
};

export const gerarIntervaloDatas = (inicio: string, fim: string) => {
    const lista: string[] = []
    let atual = new Date(inicio + 'T00:00:00')
    const fimDate = new Date(fim + 'T00:00:00')
    while (atual <= fimDate) {
      lista.push(atual.toISOString().slice(0, 10))
      atual.setDate(atual.getDate() + 1)
    }
    return lista
};

export const buildCumulativeSeries = (entradasRaw: Array<any>) => {
    if (!entradasRaw || entradasRaw.length === 0) return [];

    const uniqueMap = new Map<string, any>()
    entradasRaw.forEach((r: any) => {
      const data = normalizeDate(r.data)
      if (!data) return
      const tipo = r.tipo || ''
      const valor = Number(r.valor ?? r.total ?? 0) || 0
      const idKey = r.id ?? r.uuid ?? null
      const key = idKey ? String(idKey) : `${data}|${tipo}|${valor}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { id: idKey, data, tipo, valor, original: r })
      }
    })

    const uniqueEntries = Array.from(uniqueMap.values())
    if (uniqueEntries.length === 0) return []

    const datas = uniqueEntries.map((e: any) => e.data).filter(Boolean)
    if (datas.length === 0) return []

    const minDate = datas.reduce((a, b) => (a < b ? a : b))
    const maxDate = datas.reduce((a, b) => (a > b ? a : b))

    const agrup: Record<string, { receitas: number, despesas: number }> = {}
    uniqueEntries.forEach((r: any) => {
      const d = r.data
      if (!agrup[d]) agrup[d] = { receitas: 0, despesas: 0 }
      const valor = Number(r.valor) || 0
      if (r.tipo === 'entrada') agrup[d].receitas += valor
      else agrup[d].despesas += valor
    })

    const listaDatas = gerarIntervaloDatas(minDate, maxDate)
    const series: any[] = []
    let saldoAtual = 0

    listaDatas.forEach(data => {
      const valores = agrup[data] || { receitas: 0, despesas: 0 }
      saldoAtual += (valores.receitas - valores.despesas)
      series.push({
        data,
        data_formatada: formatarDataParaExibicao(data),
        receitas: valores.receitas,
        despesas: valores.despesas,
        saldo_acumulado: saldoAtual
      })
    })

    return series;
};
