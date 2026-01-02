
// src/hooks/useCaixaUnificado.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getDataAtualBrasil } from '@/lib/dateUtils';

// CONSTANTE: ID do Caixa Casa
const CAIXA_ID_CASA = '69bebc06-f495-4fed-b0b1-beafb50c017b';

// Interface para representar uma transação unificada
interface TransacaoUnificada {
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  origem: 'casa' | 'loja';
}

// Interface para o resultado diário calculado
export interface SaldoDiario {
  data: string;
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

// Interface para os filtros do hook
interface CaixaUnificadoFiltros {
  dataInicio?: string | null;
  dataFim?: string | null;
  enabled?: boolean; // Para controlar a execução da query
}

// Hook principal para buscar e processar os dados, agora com filtros
export const useCaixaUnificado = ({ dataInicio, dataFim, enabled = true }: CaixaUnificadoFiltros) => {

  // Define o período padrão caso nenhum filtro seja passado
  const hoje = getDataAtualBrasil();
  const dataFimPadrao = new Date(hoje);
  dataFimPadrao.setDate(dataFimPadrao.getDate() + 30);
  const dataFimPadraoStr = dataFimPadrao.toISOString().split('T')[0];

  const finalDataInicio = dataInicio || hoje;
  const finalDataFim = dataFim || dataFimPadraoStr;

  return useQuery({
    // A queryKey agora inclui os filtros para que o React Query armazene em cache diferentes períodos
    queryKey: ['caixaUnificado', finalDataInicio, finalDataFim],
    queryFn: async (): Promise<SaldoDiario[]> => {

      // 1. Construir consultas com filtros de data
      let queryLancamentos = supabase
        .from('lancamentos_financeiros')
        .select('data_lancamento, descricao, valor, tipo')
        .eq('status', 'realizado')
        .eq('caixa_id', CAIXA_ID_CASA)
        .gte('data_lancamento', finalDataInicio)
        .lte('data_lancamento', finalDataFim);

      let queryVendas = supabase
        .from('vendas')
        .select('data_pagamento, cliente, total')
        .eq('status_pagamento', 'pago')
        .gte('data_pagamento', finalDataInicio)
        .lte('data_pagamento', finalDataFim);

      let queryCompras = supabase
        .from('compras')
        .select('data_pagamento, fornecedor, total')
        .eq('status_pagamento', 'pago')
        .gte('data_pagamento', finalDataInicio)
        .lte('data_pagamento', finalDataFim);

      // 2. Executar as consultas em paralelo
      const [
        { data: lancamentosCasa, error: errorLancamentos },
        { data: vendas, error: errorVendas },
        { data: compras, error: errorCompras }
      ] = await Promise.all([
        queryLancamentos,
        queryVendas,
        queryCompras
      ]);

      if (errorLancamentos) throw new Error(`Erro ao buscar lançamentos da casa: ${errorLancamentos.message}`);
      if (errorVendas) throw new Error(`Erro ao buscar vendas: ${errorVendas.message}`);
      if (errorCompras) throw new Error(`Erro ao buscar compras: ${errorCompras.message}`);

      // 3. Mapear e unificar as transações
      const transacoes: TransacaoUnificada[] = [
        ...(lancamentosCasa || []).map(t => ({ data: t.data_lancamento, descricao: t.descricao, valor: t.valor, tipo: t.tipo, origem: 'casa' })),
        ...(vendas || []).map(t => ({ data: t.data_pagamento, descricao: `Venda para ${t.cliente}`, valor: t.total, tipo: 'entrada', origem: 'loja' })),
        ...(compras || []).map(t => ({ data: t.data_pagamento, descricao: `Compra de ${t.fornecedor}`, valor: t.total, tipo: 'saida', origem: 'loja' }))
      ];

      if (transacoes.length === 0) {
        return [];
      }

      // 4. Agrupar transações por dia
      const transacoesPorDia = transacoes.reduce((acc, t) => {
        const data = t.data.split('T')[0];
        if (!acc[data]) {
          acc[data] = { entradas: 0, saidas: 0 };
        }
        if (t.tipo === 'entrada') {
          acc[data].entradas += t.valor;
        } else {
          acc[data].saidas += t.valor;
        }
        return acc;
      }, {} as Record<string, { entradas: number, saidas: number }>);

      // 5. Calcular o saldo acumulado (lógica simplificada para o período)
      // Nota: O saldo acumulado será relativo ao início do período filtrado.
      // Para um saldo acumulado "real", precisaríamos buscar o saldo inicial.
      // Por simplicidade e performance, calcularemos o acumulado dentro da janela.
      let saldoAcumulado = 0;
      const resultadoFinal: SaldoDiario[] = Object.keys(transacoesPorDia)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()) // Ordenar do MAIS ANTIGO para o mais recente
        .map(data => {
          const { entradas, saidas } = transacoesPorDia[data];
          saldoAcumulado += entradas - saidas;
          return { data, entradas, saidas, saldoAcumulado };
        });

      // Retornar os resultados ordenados do mais recente para o mais antigo para exibição
      return resultadoFinal.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    },
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
    enabled: enabled, // Controla se a query deve ser executada
  });
};
