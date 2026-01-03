
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext';
import { formatarDataParaExibicaoSimples } from '@/lib/dateUtils';

// Tipos... (Estes podem ser movidos para um arquivo de tipos dedicado mais tarde)
interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  data_lancamento: string;
  data_prevista: string;
  status: 'pendente' | 'realizado';
}

interface DiaCaixa {
  data: string;
  data_formatada: string;
  receitas: number;
  despesas: number;
  saldo_diario: number;
  saldo_acumulado: number;
}

const fetchTodosLancamentos = async (contexto: 'casa' | 'loja'): Promise<Lancamento[]> => {
  const query = supabase.from(`lancamentos_${contexto}`).select('*');
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Lancamento[];
};

export const useCaixaPrevisto = (contexto: 'casa' | 'loja', dataInicio: string, dataFim: string) => {
  const { data: todosLancamentos = [], isLoading, error } = useQuery<Lancamento[]>({
    queryKey: ['todosLancamentos', contexto],
    queryFn: () => fetchTodosLancamentos(contexto),
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });

  const calcularCaixa = (lancamentos: Lancamento[], inicio: string, fim: string): DiaCaixa[] => {
    if (!lancamentos || lancamentos.length === 0) {
      return [];
    }

    // 1. Calcular o saldo inicial com base em todas as transações *realizadas* antes da data de início.
    const saldoInicial = lancamentos
      .filter(l => l.status === 'realizado' && (l.data_lancamento || l.data_prevista) < inicio)
      .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

    // 2. Filtrar lançamentos que estão dentro do período de visualização.
    const lancamentosNoPeriodo = lancamentos.filter(l => {
      const data = l.data_prevista || l.data_lancamento;
      return data >= inicio && data <= fim;
    });

    const caixaDiario: Map<string, { receitas: number; despesas: number }> = new Map();

    lancamentosNoPeriodo.forEach(l => {
      const data = l.data_prevista || l.data_lancamento;
      const dia = caixaDiario.get(data) || { receitas: 0, despesas: 0 };
      if (l.tipo === 'entrada') {
        dia.receitas += l.valor;
      } else {
        dia.despesas += l.valor;
      }
      caixaDiario.set(data, dia);
    });

    const resultado: DiaCaixa[] = [];
    let saldoAcumulado = saldoInicial;

    const dataCorrente = new Date(`${inicio}T12:00:00Z`);
    const dataFinal = new Date(`${fim}T12:00:00Z`);

    while (dataCorrente <= dataFinal) {
      const dataISO = dataCorrente.toISOString().split('T')[0];
      const dia = caixaDiario.get(dataISO) || { receitas: 0, despesas: 0 };

      saldoAcumulado += dia.receitas - dia.despesas;

      resultado.push({
        data: dataISO,
        data_formatada: formatarDataParaExibicaoSimples(dataISO),
        receitas: dia.receitas,
        despesas: dia.despesas,
        saldo_diario: dia.receitas - dia.despesas,
        saldo_acumulado: saldoAcumulado,
      });

      dataCorrente.setDate(dataCorrente.getDate() + 1);
    }

    return resultado;
  };

  const caixaPrevisto = calcularCaixa(todosLancamentos, dataInicio, dataFim);

  return {
    caixaPrevisto,
    isLoading,
    error,
  };
};
