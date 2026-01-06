// hooks/useCaixaUniversal.ts
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
  const [realLojaDebug, setRealLojaDebug] = useState(0); // Para depuração
  const [realCasaDebug, setRealCasaDebug] = useState(0); // Para depuração
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
    while (true) {
        let query = supabase.from(fromTable).select(selectFields);
        filters.forEach(filter => {
            query = query.eq(filter.column, filter.value);
        });
        query = query.order(orderColumn, { ascending: true }).range(offset, offset + pageSize - 1);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
    }
    return all;
  }, []);

  const fetchData = useCallback(async () => {
    setCarregando(true);
    const hoje = getDataAtualBrasil();
    const ontem = calcularDataNDias(hoje, -1);

    try {
        // 1. Buscar todas as transações de ambos os contextos
        const [transacoesLoja, lancamentosCasa] = await Promise.all([
            fetchAll('transacoes_loja', 'tipo, total, valor_pago, data, data_pagamento, status_pagamento', [], 'data'),
            fetchAll('lancamentos_financeiros', 'tipo, valor, data_prevista, data_lancamento, status', [{ column: 'caixa_id', value: '69bebc06-f495-4fed-b0b1-beafb50c017b' }], 'data_prevista')
        ]);

        console.log('--- DADOS BRUTOS CASA (useCaixaUniversal) ---', lancamentosCasa); // DEBUG

        // 2. Calcular o Caixa Real Geral (valor total, independente de data)
        const realLoja = transacoesLoja
            .filter(t => t.status_pagamento === 'pago')
            .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);

        const realCasa = lancamentosCasa
            .filter(l => l.status === 'realizado')
            .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

        setRealLojaDebug(realLoja);
        setRealCasaDebug(realCasa);
        setCaixaRealGeral(realLoja + realCasa);

        // 3. Calcular o saldo inicial para a projeção (tudo que foi pago/realizado ATÉ ONTEM)
        const saldoAteOntemLoja = transacoesLoja
            .filter(t => t.status_pagamento === 'pago' && t.data_pagamento && t.data_pagamento <= ontem)
            .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);

        const saldoAteOntemCasa = lancamentosCasa
            .filter(l => l.status === 'realizado' && l.data_lancamento && l.data_lancamento <= ontem)
            .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

        const saldoInicialProjecao = saldoAteOntemLoja + saldoAteOntemCasa;

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

        // 5. Agrupar por data
        const groupedByDate = allEntries.reduce((acc, curr) => {
            if (!acc[curr.data]) {
                acc[curr.data] = { receitas: 0, despesas: 0 };
            }
            if (curr.valor > 0) acc[curr.data].receitas += curr.valor;
            else acc[curr.data].despesas += Math.abs(curr.valor);
            return acc;
        }, {} as Record<string, { receitas: number; despesas: number }>);

        // 6. Calcular Entradas e Saídas de Hoje
        const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 };
        setEntradasHoje(hojeData.receitas);
        setSaidasHoje(hojeData.despesas);

        // 7. Construir a série de Caixa Previsto
        const sortedDates = Object.keys(groupedByDate).sort();
        const maxDate = sortedDates[sortedDates.length - 1] || calcularDataNDias(hoje, 30);

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

        setCaixaPrevistoGeral(series);

    } catch (error) {
        console.error("Erro ao buscar dados do caixa universal:", error);
    } finally {
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
    realLojaDebug,
    realCasaDebug,
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
