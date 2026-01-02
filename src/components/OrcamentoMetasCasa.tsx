
'use client'

import { useState, useEffect } from 'react';
import { useOrcamento } from '@/hooks/useOrcamento';
import { useMetas } from '@/hooks/useMetas';

export default function OrcamentoMetasCasa() {
  const { data: orcamentoData, isLoading: isLoadingOrcamento, update: updateOrcamento, isUpdating: isUpdatingOrcamento } = useOrcamento('casa');
  const { data: metasData, isLoading: isLoadingMetas, update: updateMetas, isUpdating: isUpdatingMetas } = useMetas('casa');

  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);

  useEffect(() => {
    if (orcamentoData) setOrcamentos(orcamentoData);
  }, [orcamentoData]);

  useEffect(() => {
    if (metasData) setMetas(metasData);
  }, [metasData]);


  const handleOrcamentoChange = (index: number, campo: string, valor: any) => {
    const novosOrcamentos = [...orcamentos];
    novosOrcamentos[index] = { ...novosOrcamentos[index], [campo]: valor };
    setOrcamentos(novosOrcamentos);
  };

  const handleMetaChange = (index: number, campo: string, valor: any) => {
    const novasMetas = [...metas];
    novasMetas[index] = { ...novasMetas[index], [campo]: valor };
    setMetas(novasMetas);
  };

  const handleSalvarOrcamento = () => {
    const updates = orcamentos.map(o => ({
        id: o.id,
        categoria: o.categoria,
        valor_orcado: o.valor_orcado,
        contexto: 'casa'
    }));
    updateOrcamento(updates);
  };

  const handleSalvarMetas = () => {
    const updates = metas.map(m => ({
        id: m.id,
        descricao: m.descricao,
        valor_meta: m.valor_meta,
        contexto: 'casa'
    }));
    updateMetas(updates);
  };

  const isLoading = isLoadingOrcamento || isLoadingMetas;
  const isUpdating = isUpdatingOrcamento || isUpdatingMetas;

  return (
    <div className="space-y-6">
      {/* Seção de Orçamento */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Orçamento Mensal - Casa</h2>
        {isLoading ? (
            <p>Carregando orçamento...</p>
        ) : (
            <div className="space-y-2">
            {orcamentos.map((item, index) => (
                <div key={item.id} className="grid grid-cols-2 gap-4 items-center">
                <input
                    type="text"
                    value={item.categoria}
                    onChange={(e) => handleOrcamentoChange(index, 'categoria', e.target.value)}
                    className="p-2 border rounded"
                    placeholder="Nome da Categoria"
                />
                <input
                    type="number"
                    value={item.valor_orcado}
                    onChange={(e) => handleOrcamentoChange(index, 'valor_orcado', parseFloat(e.target.value))}
                    className="p-2 border rounded"
                    placeholder="Valor Orçado"
                />
                </div>
            ))}
            </div>
        )}
        <button onClick={handleSalvarOrcamento} disabled={isUpdating} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300">
          {isUpdating ? 'Salvando...' : 'Salvar Orçamento'}
        </button>
      </div>

      {/* Seção de Metas */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Metas Financeiras - Casa</h2>
        {isLoading ? (
            <p>Carregando metas...</p>
        ) : (
            <div className="space-y-2">
            {metas.map((item, index) => (
                <div key={item.id} className="grid grid-cols-2 gap-4 items-center">
                <input
                    type="text"
                    value={item.descricao}
                    onChange={(e) => handleMetaChange(index, 'descricao', e.target.value)}
                    className="p-2 border rounded"
                    placeholder="Descrição da Meta"
                />
                <input
                    type="number"
                    value={item.valor_meta}
                    onChange={(e) => handleMetaChange(index, 'valor_meta', parseFloat(e.target.value))}
                    className="p-2 border rounded"
                    placeholder="Valor da Meta"
                />
                </div>
            ))}
            </div>
        )}
        <button onClick={handleSalvarMetas} disabled={isUpdating} className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300">
          {isUpdating ? 'Salvando...' : 'Salvar Metas'}
        </button>
      </div>
    </div>
  );
}
