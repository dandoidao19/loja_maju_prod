
import { useCaixaPrevisto } from './useCaixaPrevisto';
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext';

interface Filtros {
  dataInicio: string;
  dataFim: string;
}

interface DiaCaixa {
    data: string;
    data_formatada: string;
    receitas: number;
    despesas: number;
    saldo_diario: number;
    saldo_acumulado: number;
}

export const useCaixaUniversal = (filtros: Filtros) => {
  const { dados } = useDadosFinanceiros();
  const { caixaRealCasa, caixaRealLoja, entradasHojeCasa, saidasHojeCasa, entradasHojeLoja, saidasHojeLoja } = dados;

  const { caixaPrevisto: caixaCasa, isLoading: isLoadingCasa } = useCaixaPrevisto('casa', filtros.dataInicio, filtros.dataFim);
  const { caixaPrevisto: caixaLoja, isLoading: isLoadingLoja } = useCaixaPrevisto('loja', filtros.dataInicio, filtros.dataFim);

  // Combina os caixas previstos
  const caixaPrevistoUniversal = (): DiaCaixa[] => {
    const combinado: Map<string, Partial<DiaCaixa>> = new Map();

    const processaCaixa = (caixa: DiaCaixa[]) => {
      caixa.forEach(dia => {
        const existente = combinado.get(dia.data) || {
          receitas: 0,
          despesas: 0,
          saldo_acumulado: 0,
        };
        combinado.set(dia.data, {
          ...dia,
          receitas: (existente.receitas || 0) + dia.receitas,
          despesas: (existente.despesas || 0) + dia.despesas,
          saldo_acumulado: (existente.saldo_acumulado || 0) + dia.saldo_acumulado,
        });
      });
    };

    processaCaixa(caixaCasa);
    processaCaixa(caixaLoja);

    return Array.from(combinado.values())
        .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime())
        .map(dia => ({
            ...dia,
            saldo_diario: (dia.receitas || 0) - (dia.despesas || 0),
        })) as DiaCaixa[];
  };

  const caixaPrevisto = caixaPrevistoUniversal();

  // Calcula os totais universais
  const caixaRealUniversal = (caixaRealCasa || 0) + (caixaRealLoja || 0);
  const entradasHojeUniversal = (entradasHojeCasa || 0) + (entradasHojeLoja || 0);
  const saidasHojeUniversal = (saidasHojeCasa || 0) + (saidasHojeLoja || 0);

  return {
    caixaRealUniversal,
    entradasHojeUniversal,
    saidasHojeUniversal,
    caixaPrevisto,
    isLoading: isLoadingCasa || isLoadingLoja,
  };
};
