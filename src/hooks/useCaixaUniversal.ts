// hooks/useCaixaUniversal.ts - VERSÃO COM DEBUG
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

type Filtro = '30dias' | 'mes' | 'tudo'

export function useCaixaUniversal() {
  const [caixaRealGeral, setCaixaRealGeral] = useState(0)
  const [caixaRealLoja, setCaixaRealLoja] = useState(0)
  const [caixaRealCasa, setCaixaRealCasa] = useState(0)
  const [caixaPrevistoGeral, setCaixaPrevistoGeral] = useState<DiaCaixa[]>([])
  const [entradasHoje, setEntradasHoje] = useState(0)
  const [saidasHoje, setSaidasHoje] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0)

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00`)
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }, [])

  const fetchAll = useCallback(async (fromTable: string, selectFields = '*', filters: { column: string, value: any }[] = [], orderColumn = 'id') => {
    const pageSize = 1000;
    let offset = 0;
    const all: any[] = [];
    
    console.log(`[DEBUG] Buscando tabela: ${fromTable}`);
    
    while (true) {
        let query = supabase.from(fromTable).select(selectFields);
        filters.forEach(filter => {
            query = query.eq(filter.column, filter.value);
        });
        query = query.order(orderColumn, { ascending: true }).range(offset, offset + pageSize - 1);

        const { data, error } = await query;
        
        if (error) {
          console.error(`[DEBUG] Erro na tabela ${fromTable}:`, error);
          throw error;
        }
        
        if (!data || data.length === 0) {
          console.log(`[DEBUG] Tabela ${fromTable}: 0 registros`);
          break;
        }
        
        console.log(`[DEBUG] Tabela ${fromTable}: ${data.length} registros (página)`);
        all.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
    }
    
    console.log(`[DEBUG] Total ${fromTable}: ${all.length} registros`);
    return all;
  }, []);

  const fetchData = useCallback(async () => {
    console.log('[DEBUG] Iniciando fetchData...');
    setCarregando(true);
    const hoje = getDataAtualBrasil();
    const ontem = calcularDataNDias(hoje, -1);
    
    console.log('[DEBUG] Data hoje:', hoje, 'Ontem:', ontem);

    try {
        // 1. Buscar todas as transações de ambos os contextos
        console.log('[DEBUG] Buscando transações...');
        const [transacoesLoja, lancamentosCasa] = await Promise.all([
            fetchAll('transacoes_loja', 'tipo, total, valor_pago, data, data_pagamento, status_pagamento', [], 'data'),
            fetchAll('lancamentos_financeiros', 'tipo, valor, data_prevista, data_lancamento, status', [], 'data_prevista')
        ]);

        console.log('[DEBUG] Resultados:', {
          transacoesLoja: transacoesLoja.length,
          lancamentosCasa: lancamentosCasa.length
        });

        // 2. Calcular o Caixa Real Geral (valor total, independente de data)
        const realLoja = transacoesLoja
            .filter(t => t.status_pagamento === 'pago')
            .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);

        const realCasa = lancamentosCasa
            .filter(l => l.status === 'realizado')
            .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

        console.log('[DEBUG] Valores calculados:', { realLoja, realCasa });

        setCaixaRealLoja(realLoja);
        setCaixaRealCasa(realCasa);
        setCaixaRealGeral(realLoja + realCasa);

        // 3. Calcular o saldo inicial para a projeção (tudo que foi pago/realizado ATÉ ONTEM)
        const saldoAteOntemLoja = transacoesLoja
            .filter(t => t.status_pagamento === 'pago' && t.data_pagamento && t.data_pagamento <= ontem)
            .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);

        const saldoAteOntemCasa = lancamentosCasa
            .filter(l => l.status === 'realizado' && l.data_lancamento && l.data_lancamento <= ontem)
            .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

        const saldoInicialProjecao = saldoAteOntemLoja + saldoAteOntemCasa;
        
        console.log('[DEBUG] Saldo inicial projeção:', saldoInicialProjecao);

        // 4. Unificar TODAS as movimentações a partir de HOJE para o fluxo de caixa
        const allEntries: { data: string; valor: number }[] = [];
        transacoesLoja.forEach(t => {
            const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data;
            if (!data || data < hoje) return;
            const valor = t.valor_pago ?? t.total;
            allEntries.push({ data: data.split('T')[0], valor: t.tipo === 'entrada' ? valor : -valor });
        });
        lancamentosCasa.forEach(l => {
            const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista;
            if (!data || data < hoje) return;
            allEntries.push({ data: data.split('T')[0], valor: l.tipo === 'entrada' ? l.valor : -l.valor });
        });

        console.log('[DEBUG] All entries:', allEntries.length);

        // 5. Agrupar por data
        const groupedByDate = allEntries.reduce((acc, curr) => {
            if (!acc[curr.data]) {
                acc[curr.data] = { receitas: 0, despesas: 0 };
            }
            if (curr.valor > 0) acc[curr.data].receitas += curr.valor;
            else acc[curr.data].despesas += Math.abs(curr.valor);
            return acc;
        }, {} as Record<string, { receitas: number; despesas: number }>);

        console.log('[DEBUG] Grouped by date:', Object.keys(groupedByDate).length);

        // 6. Calcular Entradas e Saídas de Hoje
        const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 };
        setEntradasHoje(hojeData.receitas);
        setSaidasHoje(hojeData.despesas);

        // 7. Construir a série de Caixa Previsto
        const sortedDates = Object.keys(groupedByDate).sort();
        const maxDate = sortedDates[sortedDates.length - 1] || calcularDataNDias(hoje, 30);

        console.log('[DEBUG] Sorted dates:', sortedDates, 'Max date:', maxDate);

        const series: DiaCaixa[] = [];
        let saldoAcumulado = saldoInicialProjecao;

        const currentDate = new Date(`${hoje}T12:00:00`);
        const finalDate = new Date(`${maxDate}T12:00:00`);

        while (currentDate <= finalDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const { receitas, despesas } = groupedByDate[dateStr] || { receitas: 0, despesas: 0 };
            saldoAcumulado += receitas - despesas;
            series.push({
                data: dateStr,
                data_formatada: formatarDataParaExibicao(dateStr),
                receitas,
                despesas,
                saldo_acumulado: saldoAcumulado,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log('[DEBUG] Series criadas:', series.length);

        let displaySeries = series;
        if (filtro === '30dias') {
            const dataLimite = calcularDataNDias(hoje, 29);
            displaySeries = series.filter(dia => dia.data <= dataLimite);
        }

        console.log('[DEBUG] Display series:', displaySeries.length);
        console.log('[DEBUG] Primeiros 3 itens:', displaySeries.slice(0, 3));

        setCaixaPrevistoGeral(displaySeries);

    } catch (error) {
        console.error("[DEBUG] Erro ao buscar dados do caixa universal:", error);
    } finally {
        console.log('[DEBUG] FetchData finalizado');
        setCarregando(false);
        setUltimaAtualizacao(Date.now());
    }
  }, [filtro, mesFiltro, calcularDataNDias]);

  useEffect(() => {
    if (!mesFiltro) {
        const hoje = new Date();
        setMesFiltro(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
    }
    fetchData();
  }, [filtro, mesFiltro, fetchData]);

  return {
    caixaRealGeral,
    caixaRealLoja,
    caixaRealCasa,
    caixaPrevistoGeral,
    entradasHoje,
    saidasHoje,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    ultimaAtualizacao,
    getTituloPrevisao: () => {
      if (filtro === 'tudo') return 'Histórico e Futuro'
      if (filtro === '30dias') {
        const hoje = getDataAtualBrasil()
        const fim30Dias = calcularDataNDias(hoje, 29)
        return `Próximos 30 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim30Dias)}`
      }
      if (filtro === 'mes' && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        return `Mês: ${mes}/${ano}`
      }
      return 'Período'
    }
  }
}