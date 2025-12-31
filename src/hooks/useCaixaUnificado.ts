
// src/hooks/useCaixaUnificado.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// CONSTANTE: ID do Caixa Casa (importante para o filtro)
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

// Hook principal para buscar e processar os dados
export const useCaixaUnificado = () => {
  return useQuery({
    queryKey: ['caixaUnificado'],
    queryFn: async (): Promise<SaldoDiario[]> => {
      // 1. Buscar todas as transações (apenas as pagas/realizadas)
      // ✅ CORREÇÃO: Usar a tabela 'lancamentos_financeiros' e filtrar pelo caixa_id
      const { data: lancamentosCasa, error: errorLancamentos } = await supabase
        .from('lancamentos_financeiros')
        .select('data_lancamento, descricao, valor, tipo')
        .eq('status', 'realizado')
        .eq('caixa_id', CAIXA_ID_CASA);

      const { data: vendas, error: errorVendas } = await supabase
        .from('vendas')
        .select('data_venda, cliente, total')
        .eq('status_pagamento', 'pago');

      const { data: compras, error: errorCompras } = await supabase
        .from('compras')
        .select('data_compra, fornecedor, total')
        .eq('status_pagamento', 'pago');

      if (errorLancamentos) throw new Error(`Erro ao buscar lançamentos da casa: ${errorLancamentos.message}`);
      if (errorVendas) throw new Error(`Erro ao buscar vendas: ${errorVendas.message}`);
      if (errorCompras) throw new Error(`Erro ao buscar compras: ${errorCompras.message}`);

      // 2. Mapear e unificar todas as transações em um único formato
      const transacoes: TransacaoUnificada[] = [
        // ✅ CORREÇÃO: Ajustar o mapeamento para 'data_lancamento'
        ...(lancamentosCasa || []).map(t => ({ data: t.data_lancamento, descricao: t.descricao, valor: t.valor, tipo: t.tipo, origem: 'casa' })),
        ...(vendas || []).map(t => ({ data: t.data_venda, descricao: `Venda para ${t.cliente}`, valor: t.total, tipo: 'entrada', origem: 'loja' })),
        ...(compras || []).map(t => ({ data: t.data_compra, descricao: `Compra de ${t.fornecedor}`, valor: t.total, tipo: 'saida', origem: 'loja' }))
      ];

      if (transacoes.length === 0) {
        return [];
      }

      // 3. Calcular o saldo atual total somando todas as transações
      const saldoAtualTotal = transacoes.reduce((acc, t) => {
        return acc + (t.tipo === 'entrada' ? t.valor : -t.valor);
      }, 0);

      // 4. Agrupar transações por dia
      const transacoesPorDia = transacoes.reduce((acc, t) => {
        const data = t.data.split('T')[0]; // Ignorar a parte do tempo
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

      // 5. Calcular o saldo acumulado diário, trabalhando para trás a partir do saldo total
      let saldoAcumulado = saldoAtualTotal;
      const resultadoFinal: SaldoDiario[] = Object.keys(transacoesPorDia)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Ordenar os dias do MAIS RECENTE para o mais antigo
        .map(data => {
          const { entradas, saidas } = transacoesPorDia[data];
          const saldoDoDia = saldoAcumulado;
          // Para encontrar o saldo do dia anterior, subtraímos as transações do dia atual do saldo acumulado
          saldoAcumulado = saldoAcumulado - entradas + saidas;
          return { data, entradas, saidas, saldoAcumulado: saldoDoDia };
        });

      return resultadoFinal;
    },
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
  });
};
