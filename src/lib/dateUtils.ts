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

  // console.log("getDataAtualBrasil():", {
  //   resultado: dataFormatada
  // });

  return dataFormatada;
}

/**
 * Prepara data para INSERT garantindo que o formato final seja YYYY-MM-DD.
 * Se vier string YYYY-MM-DD, mantém. Se vier Date ou outras strings, converte para o formato.
 * 
 * O Supabase/PostgreSQL deve receber a data no formato YYYY-MM-DD para colunas DATE.
 */
export function prepararDataParaInsert(dataInput: string | Date): string {
  // console.log("prepararDataParaInsert INPUT:", dataInput);

  if (!dataInput) {
    const hoje = getDataAtualBrasil();
    // console.log("OUTPUT (vazio → hoje):", hoje);
    return hoje;
  }

  // Já no formato correto YYYY-MM-DD
  if (typeof dataInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dataInput)) {
    // console.log("OUTPUT (já formatada):", dataInput);
    return dataInput;
  }

  let dataObj: Date;

  if (typeof dataInput === "string") {
    // CORREÇÃO CRÍTICA: Para evitar que new Date('YYYY-MM-DD') seja interpretado como UTC meia-noite,
    // o que causaria um deslocamento de -1 dia no Brasil (UTC-3), adicionamos um "T00:00:00"
    // para forçar a interpretação como data local.
    // No entanto, como a entrada deve ser YYYY-MM-DD, vamos apenas criar a data e usar o Intl.
    dataObj = new Date(dataInput);
    if (isNaN(dataObj.getTime())) {
      throw new Error(`Data inválida: ${dataInput}`);
    }
  } else {
    dataObj = dataInput;
  }

  // Se a entrada for um objeto Date, precisamos garantir que a data YYYY-MM-DD
  // seja a data no fuso horário do Brasil, e não a data UTC ou local do servidor.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  const resultado = formatter.format(dataObj);
  
  // console.log("OUTPUT final:", resultado);

  return resultado;
}

/**
 * Formata uma data ISO (YYYY-MM-DD ou ISO completa) para visualização no formato brasileiro DD/MM/YYYY.
 * Conversão feita com timezone real do Brasil.
 */
export function formatarDataParaExibicao(dataISO: string): string {
  try {
    if (!dataISO) return "";

    // CORREÇÃO CRÍTICA: Se a data for YYYY-MM-DD (como vem do Supabase DATE),
    // new Date() a trata como UTC meia-noite, o que desloca a data em -1 dia no Brasil.
    // Para corrigir, adicionamos um offset de tempo para que new Date() a trate como local.
    let dataParaConversao = dataISO;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
        // Adiciona um horário que garanta que a data seja interpretada corretamente no fuso do Brasil.
        // Ex: '2023-12-29T12:00:00'
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
    
    const resultado = formatter.format(data);
    
    return resultado;
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
