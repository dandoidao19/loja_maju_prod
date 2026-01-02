
// src/hooks/useCaixaUniversal.ts
import { useMemo } from 'react';
import { useCaixaPrevisto } from './useCaixaPrevisto';
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext';
import { formatarDataParaExibicao } from '@/lib/dateUtils';

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

const gerarIntervaloDatas = (inicio: string, fim: string) => {
    const lista: string[] = [];
    let atual = new Date(inicio + 'T12:00:00Z');
    const fimDate = new Date(fim + 'T12:00:00Z');
    while (atual <= fimDate) {
      lista.push(atual.toISOString().slice(0, 10));
      atual.setDate(atual.getDate() + 1);
    }
    return lista;
};

export const useCaixaUniversal = (filtros: CaixaUniversalFiltros) => {
  const { dados: dadosFinanceiros } = useDadosFinanceiros();

  // Filtros amplos para buscar todos os dados necessários para o cálculo
  const filtrosGlobais = { dataInicio: '2020-01-01', dataFim: filtros.dataFim };
  const filtrosCasa = { ...filtrosGlobais, contexto: 'casa' as const };
  const filtrosLoja = { ...filtrosGlobais, contexto: 'loja' as const };

  const { data: caixaCasaCompleto, isLoading: isLoadingCasa } = useCaixaPrevisto(filtrosCasa);
  const { data: caixaLojaCompleto, isLoading: isLoadingLoja } = useCaixaPrevisto(filtrosLoja);

  const dadosProcessados = useMemo(() => {
    const caixaRealUniversal = (dadosFinanceiros.caixaRealCasa || 0) + (dadosFinanceiros.caixaRealLoja || 0);
    const entradasHojeUniversal = (dadosFinanceiros.entradasHojeCasa || 0) + (dadosFinanceiros.entradasHojeLoja || 0);
    const saidasHojeUniversal = (dadosFinanceiros.saidasHojeCasa || 0) + (dadosFinanceiros.saidasHojeLoja || 0);

    if (!caixaCasaCompleto || !caixaLojaCompleto) {
      return { caixaRealUniversal, entradasHojeUniversal, saidasHojeUniversal, caixaPrevisto: [], isLoading: true };
    }

    const mapaCasa = new Map(caixaCasaCompleto.map(d => [d.data, d]));
    const mapaLoja = new Map(caixaLojaCompleto.map(d => [d.data, d]));

    const primeiraDataCasa = caixaCasaCompleto[0]?.data;
    const primeiraDataLoja = caixaLojaCompleto[0]?.data;

    if (!primeiraDataCasa && !primeiraDataLoja) {
        return { caixaRealUniversal, entradasHojeUniversal, saidasHojeUniversal, caixaPrevisto: [], isLoading: false };
    }

    const dataInicioGlobal = [primeiraDataCasa, primeiraDataLoja].filter(Boolean).sort()[0];

    const todosOsDias = gerarIntervaloDatas(dataInicioGlobal, filtros.dataFim);

    const seriesCompletas: DiaCaixa[] = [];
    let saldoAcumuladoAnterior = 0;

    todosOsDias.forEach(data => {
        const diaCasa = mapaCasa.get(data);
        const diaLoja = mapaLoja.get(data);

        const receitas = (diaCasa?.receitas || 0) + (diaLoja?.receitas || 0);
        const despesas = (diaCasa?.despesas || 0) + (diaLoja?.despesas || 0);

        const saldo_acumulado = saldoAcumuladoAnterior + receitas - despesas;

        seriesCompletas.push({
            data,
            data_formatada: formatarDataParaExibicao(data),
            receitas,
            despesas,
            saldo_acumulado
        });

        saldoAcumuladoAnterior = saldo_acumulado;
    });

    const caixaPrevisto = seriesCompletas.filter(dia => dia.data >= filtros.dataInicio);

    return { caixaRealUniversal, entradasHojeUniversal, saidasHojeUniversal, caixaPrevisto, isLoading: false };
  }, [caixaCasaCompleto, caixaLojaCompleto, dadosFinanceiros, filtros.dataInicio, filtros.dataFim]);

  return { ...dadosProcessados, isLoading: isLoadingCasa || isLoadingLoja };
};
