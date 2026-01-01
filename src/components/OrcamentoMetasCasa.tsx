
// src/components/OrcamentoMetasCasa.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getMesAtualParaInput } from '@/lib/dateUtils';

// Definir a interface para o objeto de centro de custo
interface CentroDeCusto {
  id: string;
  nome: string;
  tipo: 'entrada' | 'saida';
}

export default function OrcamentoMetasCasa() {
  const [mesAno, setMesAno] = useState(getMesAtualParaInput());
  const [centrosDeCusto, setCentrosDeCusto] = useState<CentroDeCusto[]>([]);
  const [isLoadingCentros, setIsLoadingCentros] = useState(true);
  const [orcamentos, setOrcamentos] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Buscar centros de custo diretamente
  useEffect(() => {
    const fetchCentrosDeCusto = async () => {
      setIsLoadingCentros(true);
      const { data, error } = await supabase
        .from('centros_de_custo')
        .select('id, nome, tipo')
        .eq('contexto', 'casa');

      if (error) {
        console.error("Erro ao buscar centros de custo:", error);
        alert("Não foi possível carregar os centros de custo.");
      } else {
        setCentrosDeCusto(data as CentroDeCusto[]);
      }
      setIsLoadingCentros(false);
    };
    fetchCentrosDeCusto();
  }, []);

  const centrosDespesa = centrosDeCusto.filter(c => c.tipo === 'saida');
  const centrosReceita = centrosDeCusto.filter(c => c.tipo === 'entrada');

  const fetchOrcamentos = useCallback(async () => {
    setIsLoading(true);
    const [ano, mes] = mesAno.split('-').map(Number);

    const { data, error } = await supabase
      .from('orcamento_casa')
      .select('centro_custo_id, valor_orcado')
      .eq('ano', ano)
      .eq('mes', mes);

    if (error) {
      console.error('Erro ao buscar orçamentos:', error);
      alert('Erro ao carregar os dados de orçamento.');
    } else {
      const orcamentosMap = data.reduce((acc, item) => {
        acc[item.centro_custo_id] = item.valor_orcado;
        return acc;
      }, {} as Record<string, number>);
      setOrcamentos(orcamentosMap);
    }
    setIsLoading(false);
  }, [mesAno]);

  useEffect(() => {
    fetchOrcamentos();
  }, [fetchOrcamentos]);

  const handleValorChange = (centroCustoId: string, valor: string) => {
    const valorNumerico = parseFloat(valor) || 0;
    setOrcamentos(prev => ({ ...prev, [centroCustoId]: valorNumerico }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const [ano, mes] = mesAno.split('-').map(Number);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        alert('Usuário não autenticado.');
        setIsSaving(false);
        return;
    }

    const upsertData = Object.entries(orcamentos).map(([centro_custo_id, valor_orcado]) => ({
      user_id: user.id,
      centro_custo_id,
      ano,
      mes,
      valor_orcado,
    }));

    if (upsertData.length === 0) {
        alert("Nenhum dado para salvar.");
        setIsSaving(false);
        return;
    }

    const { error } = await supabase.from('orcamento_casa').upsert(upsertData, {
        onConflict: 'user_id,centro_custo_id,ano,mes',
    });

    if (error) {
      console.error('Erro ao salvar orçamentos:', error);
      alert('Ocorreu um erro ao salvar os dados.');
    } else {
      alert('Orçamento e metas salvos com sucesso!');
    }
    setIsSaving(false);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md space-y-6">
      <div className="flex items-center gap-4">
        <label htmlFor="mesAno" className="font-semibold text-sm">Mês e Ano:</label>
        <input
          type="month"
          id="mesAno"
          value={mesAno}
          onChange={(e) => setMesAno(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {(isLoading || isLoadingCentros) && <p className="text-center">Carregando...</p>}

      {!isLoading && !isLoadingCentros && (
        <>
          {/* Seção de Orçamento de Despesas */}
          <div className="space-y-3">
            <h3 className="font-bold text-lg text-gray-700 border-b pb-2">Orçamento Mensal (Despesas)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {centrosDespesa.map(centro => (
                <div key={centro.id} className="flex items-center gap-2">
                  <label htmlFor={`orcamento-${centro.id}`} className="w-1/2 truncate text-sm">
                    {centro.nome}
                  </label>
                  <input
                    type="number"
                    id={`orcamento-${centro.id}`}
                    value={orcamentos[centro.id] || ''}
                    onChange={(e) => handleValorChange(centro.id, e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Seção de Metas de Receitas */}
          <div className="space-y-3">
            <h3 className="font-bold text-lg text-gray-700 border-b pb-2">Metas (Receitas)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {centrosReceita.map(centro => (
                <div key={centro.id} className="flex items-center gap-2">
                  <label htmlFor={`meta-${centro.id}`} className="w-1/2 truncate text-sm">
                    {centro.nome}
                  </label>
                  <input
                    type="number"
                    id={`meta-${centro.id}`}
                    value={orcamentos[centro.id] || ''}
                    onChange={(e) => handleValorChange(centro.id, e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
