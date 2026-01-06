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

  const fetchData = useCallback(async () => {
    setCarregando(true);
    const hoje = getDataAtualBrasil();
    const dataInicialFixa = '2025-09-30';

    try {
      // 1. Buscar todas as transações de ambos os contextos
      const [transacoesLojaRes, lancamentosCasaRes] = await Promise.all([
        supabase.from('transacoes_loja').select('tipo, total, valor_pago, data, data_pagamento, status_pagamento'),
        supabase.from('lancamentos_financeiros').select('tipo, valor, data_prevista, data_lancamento, status')
      ]);

      if (transacoesLojaRes.error) throw transacoesLojaRes.error;
      if (lancamentosCasaRes.error) throw lancamentosCasaRes.error;

      const transacoesLoja = transacoesLojaRes.data || [];
      const lancamentosCasa = lancamentosCasaRes.data || [];

      // 2. Calcular o Caixa Real Geral (Soma simples e correta)
      let realLoja = 0;
      transacoesLoja.forEach(t => {
        if (t.status_pagamento === 'pago') {
          const valor = t.valor_pago ?? t.total;
          realLoja += t.tipo === 'entrada' ? valor : -valor;
        }
      });
      let realCasa = 0;
      lancamentosCasa.forEach(l => {
        if (l.status === 'realizado') {
          realCasa += l.tipo === 'entrada' ? l.valor : -l.valor;
        }
      });
      setCaixaRealGeral(realLoja + realCasa);

      // 3. Unificar TODAS as movimentações para o fluxo de caixa
      const allEntries: { data: string; valor: number }[] = [];
      transacoesLoja.forEach(t => {
        const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data;
        if (!data) return;
        const valor = t.valor_pago ?? t.total;
        allEntries.push({ data: data.split('T')[0], valor: t.tipo === 'entrada' ? valor : -valor });
      });
      lancamentosCasa.forEach(l => {
        const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista;
        if (!data) return;
        allEntries.push({ data: data.split('T')[0], valor: l.tipo === 'entrada' ? l.valor : -l.valor });
      });

      // 4. Agrupar por data
      const groupedByDate = allEntries.reduce((acc, curr) => {
        if (!acc[curr.data]) {
          acc[curr.data] = { receitas: 0, despesas: 0 };
        }
        if (curr.valor > 0) acc[curr.data].receitas += curr.valor;
        else acc[curr.data].despesas += Math.abs(curr.valor);
        return acc;
      }, {} as Record<string, { receitas: number; despesas: number }>);

      // 5. Calcular Entradas e Saídas de Hoje (todos os status)
      const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 };
      setEntradasHoje(hojeData.receitas);
      setSaidasHoje(hojeData.despesas);

      // 6. Construir a série de Caixa Previsto a partir da data fixa
      const sortedDates = Object.keys(groupedByDate).sort();
      const lastDateStr = sortedDates[sortedDates.length - 1] || hoje;

      const series: DiaCaixa[] = [];
      let saldoAcumulado = 0; // O saldo começa em zero antes da data inicial.

      const currentDate = new Date(`${dataInicialFixa}T12:00:00`);
      const finalDate = new Date(`${lastDateStr}T12:00:00`);

      // Se a data final for anterior à data inicial, ajusta para mostrar pelo menos um período
      if (finalDate < currentDate) {
          finalDate.setDate(currentDate.getDate() + 30);
      }

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

      // 7. Filtrar a série para exibição (a partir de hoje)
      const displaySeries = series.filter(d => d.data >= hoje);
      setCaixaPrevistoGeral(displaySeries);

    } catch (error) {
      console.error("Erro ao buscar dados do caixa universal:", error);
    } finally {
      setCarregando(false);
      setUltimaAtualizacao(Date.now());
    }
  }, [filtro, mesFiltro]);

  useEffect(() => {
    if (!mesFiltro) {
        const hoje = new Date();
        setMesFiltro(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
    }
    fetchData();
  }, [filtro, mesFiltro, fetchData]);

  return {
    caixaRealGeral,
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
