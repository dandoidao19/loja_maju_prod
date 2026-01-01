
// src/components/OrcamentoMetasLoja.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getMesAtualParaInput } from '@/lib/dateUtils';

export default function OrcamentoMetasLoja() {
  const [mesAno, setMesAno] = useState(getMesAtualParaInput());
  const [valorMaximoEstoque, setValorMaximoEstoque] = useState<number | ''>('');
  const [metaLucroMes, setMetaLucroMes] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrcamentoLoja = useCallback(async () => {
    setIsLoading(true);
    const [ano, mes] = mesAno.split('-').map(Number);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        setIsLoading(false);
        return;
    }

    const { data, error } = await supabase
      .from('orcamento_loja')
      .select('valor_maximo_estoque, meta_lucro_mes')
      .eq('user_id', user.id)
      .eq('ano', ano)
      .eq('mes', mes)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erro ao buscar orçamento da loja:', error);
      alert('Erro ao carregar os dados de orçamento da loja.');
    } else {
      setValorMaximoEstoque(data?.valor_maximo_estoque || '');
      setMetaLucroMes(data?.meta_lucro_mes || '');
    }
    setIsLoading(false);
  }, [mesAno]);

  useEffect(() => {
    fetchOrcamentoLoja();
  }, [fetchOrcamentoLoja]);

  const handleSave = async () => {
    setIsSaving(true);
    const [ano, mes] = mesAno.split('-').map(Number);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert('Usuário não autenticado.');
      setIsSaving(false);
      return;
    }

    const upsertData = {
      user_id: user.id,
      ano,
      mes,
      valor_maximo_estoque: valorMaximoEstoque || null,
      meta_lucro_mes: metaLucroMes || null,
    };

    const { error } = await supabase.from('orcamento_loja').upsert(upsertData, {
      onConflict: 'user_id,ano,mes',
    });

    if (error) {
      console.error('Erro ao salvar orçamento da loja:', error);
      alert('Ocorreu um erro ao salvar os dados.');
    } else {
      alert('Orçamento e metas da loja salvos com sucesso!');
    }
    setIsSaving(false);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md space-y-6">
      <div className="flex items-center gap-4">
        <label htmlFor="mesAnoLoja" className="font-semibold text-sm">Mês e Ano:</label>
        <input
          type="month"
          id="mesAnoLoja"
          value={mesAno}
          onChange={(e) => setMesAno(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {isLoading && <p className="text-center">Carregando...</p>}

      {!isLoading && (
        <>
          <div className="space-y-4">
            {/* Orçamento Estoque */}
            <div>
              <h3 className="font-bold text-lg text-gray-700 mb-2">Orçamento Estoque</h3>
              <div className="flex items-center gap-2 max-w-sm">
                <label htmlFor="valorMaximoEstoque" className="w-1/2 text-sm">
                  Valor Máximo em Estoque:
                </label>
                <input
                  type="number"
                  id="valorMaximoEstoque"
                  value={valorMaximoEstoque}
                  onChange={(e) => setValorMaximoEstoque(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="R$ 0,00"
                  className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Metas */}
            <div>
              <h3 className="font-bold text-lg text-gray-700 mb-2">Metas</h3>
              <div className="flex items-center gap-2 max-w-sm">
                <label htmlFor="metaLucroMes" className="w-1/2 text-sm">
                  Meta de Lucro Mês:
                </label>
                <input
                  type="number"
                  id="metaLucroMes"
                  value={metaLucroMes}
                  onChange={(e) => setMetaLucroMes(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="R$ 0,00"
                  className="w-1/2 px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
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
