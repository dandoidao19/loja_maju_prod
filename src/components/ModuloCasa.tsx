
'use client'

// Importações principais
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext';
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils';

// Componentes da UI
import VisualizacaoCaixaDetalhada from './VisualizacaoCaixaDetalhada';
import FiltrosCasa from './FiltrosCasa';
import ModalPagarAvancado from './ModalPagarAvancado';
import { GeradorPDFLancamentos } from '@/lib/gerador-pdf-lancamentos';

// Tipos... (mantidos como no arquivo original)
interface CentroCusto {
  id: string;
  nome: string;
}
interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_lancamento: string;
  data_prevista: string;
  centro_custo_id: string;
  status: string;
  parcelamento?: any;
  recorrencia?: any;
  centros_de_custo?: { nome: string };
}
// ...outros tipos


export default function ModuloCasa() {
  const { dados } = useDadosFinanceiros();
  const { todosLancamentosCasa, centrosCustoCasa, isLoading } = dados;

  // Estados de filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [filtroCDC, setFiltroCDC] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [mostrarTodos, setMostrarTodos] = useState(false);

  // Estados de UI e formulário
  const [formularioAberto, setFormularioAberto] = useState(false);
  // ... outros estados de UI mantidos

  const lancamentosFiltrados = useMemo(() => {
    // Agora é seguro acessar, pois o componente espera o isLoading
    let resultado = [...(todosLancamentosCasa || [])];

    // Lógica de filtragem mantida...
    if (filtroDataInicio) {
      resultado = resultado.filter(lanc => (lanc.data_prevista || lanc.data_lancamento) >= filtroDataInicio);
    }
    if (filtroDataFim) {
      resultado = resultado.filter(lanc => (lanc.data_prevista || lanc.data_lancamento) <= filtroDataFim);
    }
    // ... resto da lógica de filtro

    return resultado;
  }, [todosLancamentosCasa, filtroDataInicio, filtroDataFim, filtroMes, filtroDescricao, filtroCDC, filtroStatus, mostrarTodos]);

  // Se os dados ainda estão carregando, exibe uma mensagem de loading
  if (isLoading) {
    return (
      <div className="text-center p-8">
        <p className="text-lg font-semibold text-gray-700">Carregando dados da casa...</p>
      </div>
    );
  }

  // O resto do seu componente JSX aqui...
  // O return principal com toda a UI, que agora só é renderizado
  // quando isLoading é false.
  return (
    <div className="space-y-1">
        {/* FiltrosCasa e outros componentes aqui */}
        <FiltrosCasa
            filtroDataInicio={filtroDataInicio}
            setFiltroDataInicio={setFiltroDataInicio}
            filtroDataFim={filtroDataFim}
            setFiltroDataFim={setFiltroDataFim}
            filtroMes={filtroMes}
            setFiltroMes={setFiltroMes}
            filtroDescricao={filtroDescricao}
            setFiltroDescricao={setFiltroDescricao}
            filtroCDC={filtroCDC}
            setFiltroCDC={setFiltroCDC}
            filtroStatus={filtroStatus}
            setFiltroStatus={setFiltroStatus}
            centrosCusto={centrosCustoCasa}
            onLimpar={() => { /* Limpar filtros */ }}
            onGerarPDF={() => { /* Gerar PDF */ }}
        />

        <div className="grid grid-cols-3 gap-1">
            <div className="col-span-1">
                <VisualizacaoCaixaDetalhada contexto="casa" titulo="CAIXA CASA" />
            </div>

            <div className="col-span-2">
                <div className="bg-white rounded-lg shadow-md p-1">
                    {/* Cabeçalho da tabela */}
                    <div className="flex justify-between items-center mb-1">
                        <h2 className="text-xs font-semibold text-gray-800">Lançamentos</h2>
                        {/* ... botões ... */}
                    </div>

                    {/* Tabela de Lançamentos */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed text-xs">
                            <thead>
                                <tr>
                                    <th className="w-1/12 px-1 py-1 text-left">Data</th>
                                    <th className="w-1/12 px-1 py-1 text-left">Status</th>
                                    <th className="w-2/12 px-1 py-1 text-right">Valor</th>
                                    <th className="w-4/12 px-1 py-1 text-left">Descrição</th>
                                    <th className="w-2/12 px-1 py-1 text-left">CDC</th>
                                    <th className="w-2/12 px-1 py-1 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lancamentosFiltrados.map((lancamento) => (
                                    <tr key={lancamento.id} className="border-b hover:bg-gray-50">
                                        <td>{formatarDataParaExibicao(lancamento.data_prevista || lancamento.data_lancamento)}</td>
                                        <td>{lancamento.status}</td>
                                        <td className={`text-right ${lancamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                                            {lancamento.valor.toFixed(2)}
                                        </td>
                                        <td>{lancamento.descricao}</td>
                                        <td>{lancamento.centros_de_custo?.nome || '-'}</td>
                                        <td>{/* Ações */}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {lancamentosFiltrados.length === 0 && (
                        <p className="text-xs text-gray-500 text-center py-2">Nenhum lançamento encontrado</p>
                    )}
                </div>
            </div>
        </div>

        {/* Modais aqui */}
    </div>
  );
}
