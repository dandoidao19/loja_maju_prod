
// src/hooks/useCaixaUniversal.ts
import { useMemo } from 'react';
import { useCaixaPrevisto } from './useCaixaPrevisto';
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext';

interface DiaCaixa {
    data: string;
    data_formatada: string;
    receitas: number;
    despesas: number;
    saldo_acumulado: number;
}

interface CaixaUniversalFiltros {
  dataInicio: string;
  dataFim: string;
}

export const useCaixaUniversal = (filtros: CaixaUniversalFiltros) => {
  const { dados: dadosFinanceiros } = useDadosFinanceiros();

  const filtrosCasa = { ...filtros, contexto: 'casa' as const };
  const filtrosLoja = { ...filtros, contexto: 'loja' as const };

  const { data: caixaCasa, isLoading: isLoadingCasa } = useCaixaPrevisto(filtrosCasa);
  const { data: caixaLoja, isLoading: isLoadingLoja } = useCaixaPrevisto(filtrosLoja);

  const dadosProcessados = useMemo(() => {
    const caixaRealUniversal = (dadosFinanceiros.caixaRealCasa || 0) + (dadosFinanceiros.caixaRealLoja || 0);
    const entradasHojeUniversal = (dadosFinanceiros.entradasHojeCasa || 0) + (dadosFinanceiros.entradasHojeLoja || 0);
    const saidasHojeUniversal = (dadosFinanceiros.saidasHojeCasa || 0) + (dadosFinanceiros.saidasHojeLoja || 0);

    if (!caixaCasa || !caixaLoja) {
      return { caixaRealUniversal, entradasHojeUniversal, saidasHojeUniversal, caixaPrevisto: [], isLoading: true };
    }

    const combinado: Record<string, { receitas: number, despesas: number }> = {};

    caixaCasa.forEach(dia => {
      if (!combinado[dia.data]) combinado[dia.data] = { receitas: 0, despesas: 0 };
      combinado[dia.data].receitas += dia.receitas;
      combinado[dia.data].despesas += dia.despesas;
    });

    caixaLoja.forEach(dia => {
      if (!combinado[dia.data]) combinado[dia.data] = { receitas: 0, despesas: 0 };
      combinado[dia.data].receitas += dia.receitas;
      combinado[dia.data].despesas += dia.despesas;
    });

    // Encontrar o saldo acumulado combinado do dia anterior ao início do período
    const diaAnterior = new Date(`${filtros.dataInicio}T12:00:00Z`);
    diaAnterior.setDate(diaAnterior.getDate() - 1);
    const diaAnteriorStr = diaAnterior.toISOString().split('T')[0];

    const saldoAnteriorCasa = caixaCasa.find(d => d.data === diaAnteriorStr)?.saldo_acumulado || 0;
    const saldoAnteriorLoja = caixaLoja.find(d => d.data === diaAnteriorStr)?.saldo_acumulado || 0;
    let acumuladoAnteriorUniversal = saldoAnteriorCasa + saldoAnteriorLoja;

    const caixaPrevisto: DiaCaixa[] = Object.keys(combinado)
      .filter(data => data >= filtros.dataInicio && data <= filtros.dataFim)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map(data => {
        const { receitas, despesas } = combinado[data];
        const saldo_acumulado = acumuladoAnteriorUniversal + receitas - despesas;
        acumuladoAnteriorUniversal = saldo_acumulado; // Atualiza para o próximo dia

        return {
          data,
          data_formatada: new Date(data + 'T12:00:00Z').toLocaleDateString('pt-BR'),
          receitas,
          despesas,
          saldo_acumulado,
        };
      });

    return { caixaRealUniversal, entradasHojeUniversal, saidasHojeUniversal, caixaPrevisto, isLoading: false };
  }, [caixaCasa, caixaLoja, dadosFinanceiros, filtros.dataInicio, filtros.dataFim]);

  return { ...dadosProcessados, isLoading: isLoadingCasa || isLoadingLoja || dadosProcessados.isLoading };
};
