
'use client'

import { createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { getDataAtualBrasil } from '@/lib/dateUtils';

// --- Funções de Busca de Dados ---
const fetchLancamentos = async (contexto: 'casa' | 'loja') => {
  if (contexto === 'casa') {
    const { data, error } = await supabase.from('lancamentos_financeiros').select('*, centros_de_custo(nome)').eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b');
    if (error) throw new Error(error.message);
    return data || [];
  } else {
    const { data, error } = await supabase.from('transacoes_loja').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  }
};

const fetchCentrosCusto = async (contexto: 'casa' | 'loja') => {
    const { data, error } = await supabase.from('centros_de_custo').select('*').eq('contexto', contexto);
    if (error) throw new Error(error.message);
    return data || [];
};


// --- Interfaces ---
interface DadosFinanceiros {
  todosLancamentosCasa: any[];
  todosLancamentosLoja: any[];
  centrosCustoCasa: any[];
  centrosCustoLoja: any[];
  caixaRealCasa: number;
  caixaRealLoja: number;
  entradasHojeCasa: number;
  saidasHojeCasa: number;
  entradasHojeLoja: number;
  saidasHojeLoja: number;
  isLoading: boolean;
}

interface DadosFinanceirosContextProps {
  dados: DadosFinanceiros;
}

// --- Context ---
const DadosFinanceirosContext = createContext<DadosFinanceirosContextProps | undefined>(undefined);

// --- Provider ---
export function DadosFinanceirosProvider({ children }: { children: ReactNode }) {
  const hoje = getDataAtualBrasil();

  // Queries para buscar os dados
  const { data: lancamentosCasa = [], isLoading: loadingCasa } = useQuery({
      queryKey: ['lancamentosCasa'],
      queryFn: () => fetchLancamentos('casa')
  });
  const { data: lancamentosLoja = [], isLoading: loadingLoja } = useQuery({
      queryKey: ['lancamentosLoja'],
      queryFn: () => fetchLancamentos('loja')
  });
  const { data: centrosCustoCasa = [], isLoading: loadingCdcCasa } = useQuery({
      queryKey: ['centrosCustoCasa'],
      queryFn: () => fetchCentrosCusto('casa')
  });
   const { data: centrosCustoLoja = [], isLoading: loadingCdcLoja } = useQuery({
      queryKey: ['centrosCustoLoja'],
      queryFn: () => fetchCentrosCusto('loja')
  });

  // Cálculos derivados dos dados buscados
  const caixaRealCasa = lancamentosCasa.filter(l => l.data_lancamento <= hoje).reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
  const caixaRealLoja = lancamentosLoja.filter(l => l.data <= hoje).reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);

  const { entradasHojeCasa, saidasHojeCasa } = lancamentosCasa.filter(l => l.data_lancamento === hoje).reduce((acc, t) => {
      t.tipo === 'entrada' ? acc.entradasHojeCasa += t.valor : acc.saidasHojeCasa += t.valor;
      return acc;
  }, { entradasHojeCasa: 0, saidasHojeCasa: 0 });

  const { entradasHojeLoja, saidasHojeLoja } = lancamentosLoja.filter(l => l.data === hoje).reduce((acc, t) => {
      const valor = t.valor_pago ?? t.total;
      t.tipo === 'entrada' ? acc.entradasHojeLoja += valor : acc.saidasHojeLoja += valor;
      return acc;
  }, { entradasHojeLoja: 0, saidasHojeLoja: 0 });


  const value = {
    dados: {
      todosLancamentosCasa: lancamentosCasa,
      todosLancamentosLoja: lancamentosLoja,
      centrosCustoCasa: centrosCustoCasa,
      centrosCustoLoja: centrosCustoLoja,
      caixaRealCasa,
      caixaRealLoja,
      entradasHojeCasa,
      saidasHojeCasa,
      entradasHojeLoja,
      saidasHojeLoja,
      isLoading: loadingCasa || loadingLoja || loadingCdcCasa || loadingCdcLoja,
    }
  };

  return (
    <DadosFinanceirosContext.Provider value={value}>
      {children}
    </DadosFinanceirosContext.Provider>
  );
}

// --- Hook ---
export function useDadosFinanceiros() {
  const context = useContext(DadosFinanceirosContext);
  if (context === undefined) {
    throw new Error('useDadosFinanceiros deve ser usado dentro de um DadosFinanceirosProvider');
  }
  return context;
}
