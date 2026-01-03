
'use client'

import { useMemo, useState } from 'react';
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext';
import { formatarDataParaExibicao, getDataAtualBrasil } from '@/lib/dateUtils';
import VisualizacaoCaixaDetalhada from './VisualizacaoCaixaDetalhada';
import FiltrosLoja from './FiltrosLoja'; // Importação do novo componente de filtros
// Outras importações...
import { GeradorPDFLancamentos } from '@/lib/gerador-pdf-lancamentos';

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
    centros_de_custo?: { nome: string }; // Adicionado para exibição do nome
}


export default function TelaInicialLoja() {
    const { dados } = useDadosFinanceiros();
    const { todosLancamentosLoja, centrosCustoLoja, isLoading } = dados; // Adiciona isLoading

    // Estados para os filtros
    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');
    const [filtroMes, setFiltroMes] = useState('');
    const [filtroDescricao, setFiltroDescricao] = useState('');
    const [filtroCDC, setFiltroCDC] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [mostrarTodos, setMostrarTodos] = useState(false);

    // ... (outros estados para modais e formulários permanecem os mesmos)

    const lancamentosFiltrados = useMemo(() => {
        // Proteção contra dados indefinidos durante o carregamento
        let resultado = [...(todosLancamentosLoja || [])];

        // Lógica de filtragem... (a mesma lógica de antes)
        if (filtroDataInicio) {
            resultado = resultado.filter(lanc => (lanc.data_prevista || lanc.data_lancamento) >= filtroDataInicio);
        }
        if (filtroDataFim) {
            resultado = resultado.filter(lanc => (lanc.data_prevista || lanc.data_lancamento) <= filtroDataFim);
        }
        // ... (resto da lógica de filtros)

        return resultado;
    }, [todosLancamentosLoja, filtroDataInicio, filtroDataFim, filtroMes, filtroDescricao, filtroCDC, filtroStatus, mostrarTodos]);

    // Lógica para gerar PDF (permanece a mesma)
    const handleGerarPDF = () => {
        if (!todosLancamentosLoja) return;
        const gerador = new GeradorPDFLancamentos(lancamentosFiltrados, centrosCustoLoja);
        gerador.gerar();
    };


    // Exibe um estado de carregamento enquanto os dados não estiverem prontos
    if (isLoading) {
        return (
            <div className="text-center p-8">
                <p className="text-lg font-semibold text-gray-700">Carregando dados da loja...</p>
            </div>
        );
    }

    // O JSX do componente só é renderizado após o carregamento
    return (
        <div className="space-y-1">
            <FiltrosLoja
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
                centrosCusto={centrosCustoLoja}
                onLimpar={() => { /* Limpar filtros */ }}
                onGerarPDF={handleGerarPDF}
            />

            <div className="grid grid-cols-3 gap-1">
                <div className="col-span-1">
                    <VisualizacaoCaixaDetalhada contexto="loja" titulo="CAIXA LOJA" />
                </div>
                <div className="col-span-2">
                    <div className="bg-white rounded-lg shadow-md p-1">
                        <div className="flex justify-between items-center mb-1">
                            <h2 className="text-xs font-semibold text-gray-800">Lançamentos</h2>
                            {/* Botões */}
                        </div>

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
                            <p className="text-xs text-gray-500 text-center py-2">Nenhum lançamento encontrado para os filtros selecionados.</p>
                        )}
                    </div>
                </div>
            </div>
            {/* Modais aqui */}
        </div>
    );
}
