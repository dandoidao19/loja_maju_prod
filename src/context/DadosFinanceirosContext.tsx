
'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getDataAtualBrasil } from '@/lib/dateUtils';

// Interfaces
interface DadosFinanceiros {
  caixaRealCasa: number;
  caixaRealLoja: number;
  entradasHojeCasa: number;
  saidasHojeCasa: number;
  entradasHojeLoja: number;
  saidasHojeLoja: number;
  ultimaAtualizacao: number;
}

interface DadosFinanceirosContextProps {
  dados: DadosFinanceiros;
  atualizarCaixaReal: (contexto: 'casa' | 'loja') => void;
}

// Context
const DadosFinanceirosContext = createContext<DadosFinanceirosContextProps | undefined>(undefined);

// Provider
export function DadosFinanceirosProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<DadosFinanceiros>({
    caixaRealCasa: 0,
    caixaRealLoja: 0,
    entradasHojeCasa: 0,
    saidasHojeCasa: 0,
    entradasHojeLoja: 0,
    saidasHojeLoja: 0,
    ultimaAtualizacao: 0,
  });
  const [loading, setLoading] = useState(true);

  const calcularCaixaReal = useCallback(async (contexto: 'casa' | 'loja') => {
    const hoje = getDataAtualBrasil();
    let saldo = 0;

    if (contexto === 'casa') {
      const { data, error } = await supabase
        .from('lancamentos_financeiros')
        .select('valor, tipo')
        .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
        .lte('data_lancamento', hoje); // Todas as transações até hoje
      if (error) throw error;
      saldo = data.reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    } else { // loja
      const { data, error } = await supabase
        .from('transacoes_loja')
        .select('tipo, total, valor_pago')
        .lte('data', hoje); // Todas as transações até hoje
      if (error) throw error;
      saldo = data.reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);
    }
    return saldo;
  }, []);

  const calcularHoje = useCallback(async (contexto: 'casa' | 'loja') => {
    const hoje = getDataAtualBrasil();
    let entradas = 0;
    let saidas = 0;

    if (contexto === 'casa') {
        const { data, error } = await supabase
            .from('lancamentos_financeiros')
            .select('valor, tipo')
            .eq('caixa_id', '69bebc06-f495-4fed-b0b1-beafb50c017b')
            .eq('data_lancamento', hoje);
        if (error) throw error;
        data.forEach(t => t.tipo === 'entrada' ? entradas += t.valor : saidas += t.valor);
    } else { // loja
        const { data, error } = await supabase
            .from('transacoes_loja')
            .select('tipo, total, valor_pago')
            .eq('data', hoje);
        if (error) throw error;
        data.forEach(t => {
            const valor = t.valor_pago ?? t.total;
            t.tipo === 'entrada' ? entradas += valor : saidas += valor;
        });
    }
    return { entradas, saidas };
  }, []);

  const carregarDadosIniciais = useCallback(async () => {
    try {
      setLoading(true);
      const [
        caixaCasa,
        caixaLoja,
        hojeCasa,
        hojeLoja
      ] = await Promise.all([
        calcularCaixaReal('casa'),
        calcularCaixaReal('loja'),
        calcularHoje('casa'),
        calcularHoje('loja')
      ]);

      setDados({
        caixaRealCasa: caixaCasa || 0,
        caixaRealLoja: caixaLoja || 0,
        entradasHojeCasa: hojeCasa.entradas || 0,
        saidasHojeCasa: hojeCasa.saidas || 0,
        entradasHojeLoja: hojeLoja.entradas || 0,
        saidasHojeLoja: hojeLoja.saidas || 0,
        ultimaAtualizacao: Date.now(),
      });
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
    } finally {
      setLoading(false);
    }
  }, [calcularCaixaReal, calcularHoje]);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  const atualizarCaixaReal = useCallback(async (contexto: 'casa' | 'loja') => {
    try {
        const [novoCaixa, novosValoresHoje] = await Promise.all([
            calcularCaixaReal(contexto),
            calcularHoje(contexto)
        ]);
        
        setDados(prev => ({
            ...prev,
            ...(contexto === 'casa' ? {
                caixaRealCasa: novoCaixa,
                entradasHojeCasa: novosValoresHoje.entradas,
                saidasHojeCasa: novosValoresHoje.saidas
            } : {
                caixaRealLoja: novoCaixa,
                entradasHojeLoja: novosValoresHoje.entradas,
                saidasHojeLoja: novosValoresHoje.saidas
            }),
            ultimaAtualizacao: Date.now(),
        }));
    } catch (error) {
        console.error(`Erro ao atualizar caixa ${contexto}:`, error);
    }
  }, [calcularCaixaReal, calcularHoje]);

  const value = { dados, atualizarCaixaReal };

  return (
    <DadosFinanceirosContext.Provider value={value}>
      {children}
    </DadosFinanceirosContext.Provider>
  );
}

// Hook
export function useDadosFinanceiros() {
  const context = useContext(DadosFinanceirosContext);
  if (context === undefined) {
    throw new Error('useDadosFinanceiros deve ser usado dentro de um DadosFinanceirosProvider');
  }
  return context;
}
