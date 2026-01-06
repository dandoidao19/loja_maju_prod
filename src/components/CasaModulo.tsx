'use client'

import { supabase } from '@/lib/supabase'
import ModalPagarAvancado from './ModalPagarAvancado'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'
import CaixaCasaDetalhado from './CaixaCasaDetalhado'
import FiltrosCasa from './FiltrosCasa'
import { GeradorPDFLancamentos } from '@/lib/gerador-pdf-lancamentos'

interface CentroCusto {
  id: string
  nome: string
  contexto: string
  tipo: string
  categoria: string
  recorrencia: string
}

interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  data_prevista: string
  centro_custo_id: string
  status: string
  parcelamento?: any
  recorrencia?: any
  caixa_id?: string
  origem?: string
  centros_de_custo?: {
    nome: string
  }
}

interface FormLancamento {
  descricao: string
  valor: string
  tipo: string
  centroCustoId: string
  data: string
  status: string
  parcelas: number
  prazoParcelas: string
  recorrenciaTipo: string
  recorrenciaQtd: number
  recorrenciaPrazo: string
  recorrenciaDia: string
}

// CONSTANTE: ID do Caixa Casa
const CAIXA_ID_CASA = '69bebc06-f495-4fed-b0b1-beafb50c017b'

// ✅ CORREÇÃO: Função auxiliar para calcular a data de ontem
const getOntemBrasil = () => {
  const hoje = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  const hojeFormatado = formatter.format(hoje);
  const [anoHoje, mesHoje, diaHoje] = hojeFormatado.split('-').map(Number);
  
  // Criar data de ontem
  const dataOntem = new Date(anoHoje, mesHoje - 1, diaHoje - 1);
  return formatter.format(dataOntem);
}

// ✅ Função auxiliar para calcular a data N dias à frente
const getDataNDias = (dataBase: string, dias: number) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  const [ano, mes, dia] = dataBase.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia + dias);
  return formatter.format(data);
}

// Função auxiliar para adicionar meses a uma data
const addMonths = (dateString: string, months: number): string => {
  const [ano, mes, dia] = dateString.split('-').map(Number);
  const date = new Date(ano, mes - 1 + months, dia);
  
  if (date.getDate() !== dia) {
    date.setDate(0);
  }

  const novoAno = date.getFullYear();
  const novoMes = String(date.getMonth() + 1).padStart(2, '0');
  const novoDia = String(date.getDate()).padStart(2, '0');
  
  return `${novoAno}-${novoMes}-${novoDia}`;
}

// Função para calcular data baseada no prazo
const calcularDataPorPrazo = (dataBase: string, prazo: string): string => {
  switch (prazo) {
    case 'diaria':
      return getDataNDias(dataBase, 2);
    case 'semanal':
      return getDataNDias(dataBase, 8);
    case '10dias':
      return getDataNDias(dataBase, 11);
    case 'quinzenal':
      return getDataNDias(dataBase, 16);
    case '20dias':
      return getDataNDias(dataBase, 21);
    case 'mensal':
      return addMonths(dataBase, 1);
    default:
      return dataBase;
  }
}

// Função para validar se todos os campos estão preenchidos
const validarFormulario = (form: FormLancamento): boolean => {
  if (!form.descricao.trim()) {
    alert('❌ Descrição é obrigatória');
    return false;
  }
  if (!form.valor || parseFloat(form.valor) <= 0) {
    alert('❌ Valor é obrigatório e deve ser maior que zero');
    return false;
  }
  if (!form.tipo) {
    alert('❌ Tipo é obrigatório');
    return false;
  }
  if (!form.centroCustoId) {
    alert('❌ Centro de Custo é obrigatório');
    return false;
  }
  if (!form.data) {
    alert('❌ Data é obrigatória');
    return false;
  }
  if (!form.status) {
    alert('❌ Status é obrigatório');
    return false;
  }
  return true;
}

export default function CasaModulo() {
  const { dados, recarregarLancamentos, atualizarCaixaReal, carregando: carregandoContexto } = useDadosFinanceiros()
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(false)
  const [carregandoInicial, setCarregandoInicial] = useState(true)
  
  // Estados de filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroCDC, setFiltroCDC] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  
  const [abaLancamentos, setAbaLancamentos] = useState<'padrao' | 'recorrente'>('padrao')
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  
  const [modalPagar, setModalPagar] = useState<{ 
    aberto: boolean; 
    lancamento: Lancamento | null;
    passo: 'confirmar_total' | 'valor_parcial' | 'nova_parcela' | 'nova_parcela_data';
    valorPago: number | null;
    novaDataVencimento: string;
  }>({
    aberto: false,
    lancamento: null,
    passo: 'confirmar_total',
    valorPago: null,
    novaDataVencimento: getDataAtualBrasil()
  })

  const [modalExcluir, setModalExcluir] = useState<{ aberto: boolean; lancamento: Lancamento | null }>({
    aberto: false,
    lancamento: null
  })
  const [editandoLancamento, setEditandoLancamento] = useState<Lancamento | null>(null)
  
  const [form, setForm] = useState<FormLancamento>({
    descricao: '',
    valor: '',
    tipo: 'saida',
    centroCustoId: '',
    data: getDataAtualBrasil(),
    status: 'previsto',
    parcelas: 1,
    prazoParcelas: 'mensal',
    recorrenciaTipo: 'nenhuma',
    recorrenciaQtd: 1,
    recorrenciaPrazo: 'mensal',
    recorrenciaDia: ''
  })

  // ✅ CORREÇÃO: Carregar lançamentos iniciais APENAS UMA VEZ
  useEffect(() => {
    const carregarDadosIniciais = async () => {
      console.log('📥 Carregando dados iniciais do módulo casa...')
      
      // Aguardar contexto carregar primeiro
      if (carregandoContexto) {
        console.log('⏳ Aguardando contexto carregar...')
        return
      }
      
      // Carregar lançamentos se ainda não foram carregados
      if (dados.todosLancamentosCasa.length === 0) {
        console.log('🔄 Carregando lançamentos do módulo casa...')
        await recarregarLancamentos('casa')
      }
      
      setCarregandoInicial(false)
      console.log('✅ Dados iniciais carregados')
    }
    
    carregarDadosIniciais()
  }, [carregandoContexto, dados.todosLancamentosCasa.length, recarregarLancamentos])

  // ✅ Carregar centros de custo do contexto
  useEffect(() => {
    if (dados.centrosCustoCasa.length > 0 && centrosCusto.length === 0) {
      console.log('✅ Carregando centros de custo do contexto')
      setCentrosCusto(dados.centrosCustoCasa)
    }
  }, [dados.centrosCustoCasa, centrosCusto.length])

  // ✅ Carregar user apenas uma vez
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    loadUser()
  }, [])

  const centrosCustoFiltrados = useMemo(() => {
    return centrosCusto.filter(centro => {
      if (form.tipo === 'entrada') {
        return centro.tipo === 'RECEITA'
      } else {
        return centro.tipo === 'DESPESA'
      }
    })
  }, [centrosCusto, form.tipo])

  const adicionarLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    if (!validarFormulario(form)) {
      return;
    }

    setLoading(true)

    const dataAtual = getDataAtualBrasil()
    const dataParaLancamento = form.status === 'pago' ? dataAtual : form.data

    const valorNumerico = parseFloat(form.valor)
    const descricaoMaiuscula = form.descricao.toUpperCase()

    try {
      if (abaLancamentos === 'padrao') {
        if (form.parcelas === 1) {
          const dadosLancamento = {
            user_id: user.id,
            descricao: descricaoMaiuscula,
            valor: valorNumerico,
            tipo: form.tipo,
            centro_custo_id: form.centroCustoId || null,
            data_lancamento: dataParaLancamento,
            data_prevista: form.data,
            status: form.status === 'pago' ? 'realizado' : 'previsto',
            caixa_id: CAIXA_ID_CASA,
            parcelamento: null,
            recorrencia: null
          }

          const { error } = await supabase
            .from('lancamentos_financeiros')
            .insert([dadosLancamento]) // ✅ CORREÇÃO: Colocar em array []
            .select()

          if (error) throw error
        } else {
          const valorParcela = valorNumerico / form.parcelas
          const lancamentosParcelados = []

          for (let i = 1; i <= form.parcelas; i++) {
            let dataParcela = form.data
            if (i > 1) {
              const dataAnterior = lancamentosParcelados[i - 2].data_prevista
              dataParcela = calcularDataPorPrazo(dataAnterior, form.prazoParcelas)
            }

            lancamentosParcelados.push({
              user_id: user.id,
              descricao: `${descricaoMaiuscula} (${i}/${form.parcelas})`,
              valor: valorParcela,
              tipo: form.tipo,
              centro_custo_id: form.centroCustoId || null,
              data_lancamento: dataParcela,
              data_prevista: dataParcela,
              status: 'previsto',
              caixa_id: CAIXA_ID_CASA,
              parcelamento: { atual: i, total: form.parcelas },
              recorrencia: null
            })
          }

          const { error } = await supabase
            .from('lancamentos_financeiros')
            .insert(lancamentosParcelados)
            .select()

          if (error) throw error
        }
      } else {
        const lancamentosRecorrentes = []

        for (let i = 1; i <= form.recorrenciaQtd; i++) {
          let dataLancamento = form.data
          if (i > 1) {
            const dataAnterior = lancamentosRecorrentes[i - 2].data_prevista
            dataLancamento = calcularDataPorPrazo(dataAnterior, form.recorrenciaPrazo)
          }

          lancamentosRecorrentes.push({
            user_id: user.id,
            descricao: `${descricaoMaiuscula} (${i}/${form.recorrenciaQtd})`,
            valor: valorNumerico,
            tipo: form.tipo,
            centro_custo_id: form.centroCustoId || null,
            data_lancamento: dataLancamento,
            data_prevista: dataLancamento,
            status: 'previsto',
            caixa_id: CAIXA_ID_CASA,
            parcelamento: null,
            recorrencia: { tipo: 'quantidade', qtd: form.recorrenciaQtd, prazo: form.recorrenciaPrazo }
          })
        }

        const { error } = await supabase
          .from('lancamentos_financeiros')
          .insert(lancamentosRecorrentes)
          .select()

        if (error) throw error
      }

      // Limpar formulário
      setForm({
        descricao: '',
        valor: '',
        tipo: 'saida',
        centroCustoId: '',
        data: getDataAtualBrasil(),
        status: 'previsto',
        parcelas: 1,
        prazoParcelas: 'mensal',
        recorrenciaTipo: 'nenhuma',
        recorrenciaQtd: 1,
        recorrenciaPrazo: 'mensal',
        recorrenciaDia: ''
      })
      
      // Recarregar apenas os dados necessários
      await recarregarLancamentos('casa')
      
      setFormularioAberto(false)
      alert('✅ Lançamento adicionado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao adicionar lançamento:', error)
      alert('❌ Erro ao adicionar lançamento: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const processarPagamento = async () => {
    const { lancamento, passo, valorPago } = modalPagar
    
    if (!lancamento || !user) return

    setLoading(true)

    try {
      const dataAtual = getDataAtualBrasil()
      const valorOriginal = lancamento.valor
      const valorPagoFinal = valorPago !== null ? valorPago : valorOriginal
      const valorRestante = valorOriginal - valorPagoFinal

      const parcelaAtual = lancamento.parcelamento?.atual || 1
      const totalParcelas = lancamento.parcelamento?.total || 1
      const descricaoOriginal = lancamento.descricao
      const descricaoBase = descricaoOriginal.replace(/\s*\(\d+\/\d+\)\s*$/, '')

      let novaDescricaoOriginal = descricaoOriginal
      let novoParcelamento = lancamento.parcelamento

      if (valorRestante > 0 && passo === 'nova_parcela_data') {
        novoParcelamento = { atual: parcelaAtual, total: totalParcelas + 1 }
        novaDescricaoOriginal = `${descricaoBase} (${parcelaAtual}/${totalParcelas + 1})`
      }

      const { error: errorUpdate } = await supabase
        .from('lancamentos_financeiros')
        .update([{ // ✅ CORREÇÃO: Colocar em array []
          status: 'realizado',
          valor: valorPagoFinal,
          data_lancamento: dataAtual,
          descricao: novaDescricaoOriginal,
          parcelamento: novoParcelamento
        }])
        .eq('id', lancamento.id)

      if (errorUpdate) throw errorUpdate

      if (valorRestante > 0 && modalPagar.passo === 'nova_parcela_data') {
        const novaDescricaoParcela = `${descricaoBase} (${totalParcelas + 1}/${totalParcelas + 1})`
        
        const dadosNovaParcela = {
          user_id: user.id,
          descricao: novaDescricaoParcela,
          valor: valorRestante,
          tipo: lancamento.tipo,
          centro_custo_id: lancamento.centro_custo_id,
          data_lancamento: modalPagar.novaDataVencimento,
          data_prevista: modalPagar.novaDataVencimento,
          status: 'previsto',
          caixa_id: lancamento.caixa_id || CAIXA_ID_CASA,
          origem: lancamento.origem,
          parcelamento: { atual: totalParcelas + 1, total: totalParcelas + 1 },
          recorrencia: lancamento.recorrencia
        }

        const { error: errorInsert } = await supabase
          .from('lancamentos_financeiros')
          .insert([dadosNovaParcela]) // ✅ CORREÇÃO: Colocar em array []
          .select()

        if (errorInsert) throw errorInsert
      }

      setModalPagar({ 
        aberto: false, 
        lancamento: null, 
        passo: 'confirmar_total', 
        valorPago: null, 
        novaDataVencimento: getDataAtualBrasil() 
      })

      alert('✅ Pagamento processado com sucesso!')
      
      // Recarregar apenas os dados necessários
      await recarregarLancamentos('casa')
    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error)
      alert('❌ Erro ao processar pagamento: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const excluirLancamento = async (lancamento: Lancamento) => {
    try {
      const { error } = await supabase
        .from('lancamentos_financeiros')
        .delete()
        .eq('id', lancamento.id)

      if (error) throw error

      setModalExcluir({ aberto: false, lancamento: null })
      
      alert('✅ Lançamento excluído com sucesso!')
      
      // Recarregar apenas os dados necessários
      await recarregarLancamentos('casa')
    } catch (error: any) {
      console.error('Erro ao excluir lançamento:', error)
      alert('❌ Erro ao excluir lançamento: ' + error.message)
    }
  }

  const iniciarEdicao = (lancamento: Lancamento) => {
    setEditandoLancamento(lancamento)
    
    const dataDoBanco = lancamento.data_lancamento
    const dataPrevistaDoBanco = lancamento.data_prevista || dataDoBanco 
    
    const dataFormatada = dataPrevistaDoBanco.includes('T') 
      ? dataPrevistaDoBanco.split('T')[0]
      : dataPrevistaDoBanco
    
    setForm({
      descricao: lancamento.descricao,
      valor: lancamento.valor.toString(),
      tipo: lancamento.tipo,
      centroCustoId: lancamento.centro_custo_id || '',
      data: dataFormatada,
      status: lancamento.status === 'realizado' ? 'pago' : 'previsto',
      parcelas: lancamento.parcelamento?.total || 1,
      prazoParcelas: lancamento.parcelamento ? 'mensal' : 'mensal',
      recorrenciaTipo: lancamento.recorrencia?.tipo || 'nenhuma',
      recorrenciaQtd: lancamento.recorrencia?.qtd || 1,
      recorrenciaPrazo: lancamento.recorrencia?.prazo || 'mensal',
      recorrenciaDia: lancamento.recorrencia?.dia || ''
    })
    
    setFormularioAberto(true)
  }

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editandoLancamento || !user) return

    if (!validarFormulario(form)) {
      return;
    }

    setLoading(true)

    const dataAtual = getDataAtualBrasil()
    const dataParaLancamento = form.status === 'pago' ? dataAtual : form.data

    const valorNumerico = parseFloat(form.valor)
    const descricaoMaiuscula = form.descricao.toUpperCase()

    try {
      const dadosLancamento = {
        descricao: descricaoMaiuscula,
        valor: valorNumerico,
        tipo: form.tipo,
        centro_custo_id: form.centroCustoId || null,
        data_lancamento: dataParaLancamento, 
        data_prevista: form.data,   
        status: form.status === 'pago' ? 'realizado' : 'previsto',
        caixa_id: CAIXA_ID_CASA,
        parcelamento: editandoLancamento.parcelamento,
        recorrencia: form.recorrenciaTipo !== 'nenhuma' ? {
          tipo: form.recorrenciaTipo,
          dia: form.recorrenciaDia || form.data.split('-')[2]
        } : null
      }

      const { error } = await supabase
        .from('lancamentos_financeiros')
        .update([dadosLancamento]) // ✅ CORREÇÃO: Colocar em array []
        .eq('id', editandoLancamento.id)

      if (error) throw error

      setEditandoLancamento(null)
      setForm({
        descricao: '',
        valor: '',
        tipo: 'saida',
        centroCustoId: '',
        data: getDataAtualBrasil(),
        status: 'previsto',
        parcelas: 1,
        prazoParcelas: 'mensal',
        recorrenciaTipo: 'nenhuma',
        recorrenciaQtd: 1,
        recorrenciaPrazo: 'mensal',
        recorrenciaDia: ''
      })
      
      setFormularioAberto(false)
      alert('✅ Lançamento editado com sucesso!')
      
      // Recarregar apenas os dados necessários
      await recarregarLancamentos('casa')
    } catch (error: any) {
      console.error('Erro ao salvar edição:', error)
      alert('❌ Erro ao salvar edição: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const cancelarEdicao = () => {
    setEditandoLancamento(null)
    setForm({
      descricao: '',
      valor: '',
      tipo: 'saida',
      centroCustoId: '',
      data: getDataAtualBrasil(),
      status: 'previsto',
      parcelas: 1,
      prazoParcelas: 'mensal',
      recorrenciaTipo: 'nenhuma',
      recorrenciaQtd: 1,
      recorrenciaPrazo: 'mensal',
      recorrenciaDia: ''
    })
    setFormularioAberto(false)
  }

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({...form, data: e.target.value})
  }

  // ✅ OTIMIZADO: Usar lançamentos do contexto diretamente
  const lancamentosFiltrados = useMemo(() => {
    if (carregandoInicial || dados.todosLancamentosCasa.length === 0) {
      console.log('⏳ Aguardando carregamento inicial...')
      return []
    }

    console.log('🔍 Aplicando filtros... Total lançamentos:', dados.todosLancamentosCasa.length)
    
    let resultado = [...dados.todosLancamentosCasa]

    // Ordenar por data crescente (do mais antigo para o mais novo)
    resultado.sort((a, b) => {
      const dataA = new Date(a.data_prevista || a.data_lancamento).getTime()
      const dataB = new Date(b.data_prevista || b.data_lancamento).getTime()
      return dataA - dataB
    })

    // Aplicar filtros
    if (filtroDataInicio) {
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento
        return dataLanc >= filtroDataInicio
      })
    }

    if (filtroDataFim) {
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento
        return dataLanc <= filtroDataFim
      })
    }

    if (filtroMes) {
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento
        return dataLanc.startsWith(filtroMes)
      })
    }

    if (filtroDescricao) {
      resultado = resultado.filter(lanc => 
        lanc.descricao.toLowerCase().includes(filtroDescricao.toLowerCase())
      )
    }

    if (filtroCDC) {
      resultado = resultado.filter(lanc => lanc.centro_custo_id === filtroCDC)
    }

    if (filtroStatus && filtroStatus !== 'todos') {
      resultado = resultado.filter(lanc => lanc.status === filtroStatus)
    }

    // ✅ CORREÇÃO: Aplicar filtro padrão de 11 dias apenas quando NÃO estiver em "VER TUDO"
    // e quando NÃO houver nenhum filtro ativo
    if (!mostrarTodos && 
        !filtroDataInicio && 
        !filtroDataFim && 
        !filtroMes && 
        !filtroDescricao && 
        !filtroCDC && 
        !filtroStatus) {
      
      const inicio = getOntemBrasil()
      const fim = getDataNDias(inicio, 10)
      
      console.log(`Filtro padrão 11 dias: ${inicio} até ${fim}`)
      
      resultado = resultado.filter(lanc => {
        const dataLanc = lanc.data_prevista || lanc.data_lancamento
        return dataLanc >= inicio && dataLanc <= fim
      })
    }

    console.log(`✅ Resultado final: ${resultado.length} lançamentos`)
    return resultado
  }, [dados.todosLancamentosCasa, filtroDataInicio, filtroDataFim, filtroMes, filtroDescricao, filtroCDC, filtroStatus, mostrarTodos, carregandoInicial])

  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroMes('')
    setFiltroDescricao('')
    setFiltroCDC('')
    setFiltroStatus('')
    setMostrarTodos(false)
  }
  
  const gerarPDF = () => {
    if (lancamentosFiltrados.length === 0) {
      alert('❌ Nenhum lançamento para gerar PDF com os filtros aplicados')
      return
    }
    const gerador = new GeradorPDFLancamentos()
    gerador.gerarPDFLancamentosCasa(lancamentosFiltrados, centrosCusto)
  }

  const ModalExcluir = () => {
    if (!modalExcluir.aberto || !modalExcluir.lancamento) return null

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
        <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-sm">
          <h3 className="text-sm font-semibold mb-3">Confirmar Exclusão</h3>
          <p className="text-xs text-gray-700 mb-3">
            Tem certeza que deseja excluir o lançamento "{modalExcluir.lancamento.descricao}"? Esta ação é irreversível.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setModalExcluir({ aberto: false, lancamento: null })}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => excluirLancamento(modalExcluir.lancamento!)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ✅ TÍTULO DINÂMICO DA TABELA
  const getTituloTabela = () => {
    if (mostrarTodos) return 'TODOS OS LANÇAMENTOS'
    if (filtroMes) return `Lançamentos de ${filtroMes}`
    if (filtroDataInicio || filtroDataFim) return 'Lançamentos Filtrados'
    
    const inicio = getOntemBrasil()
    const fim = getDataNDias(inicio, 10)
    return `Próximos 11 Dias (${formatarDataParaExibicao(inicio)} a ${formatarDataParaExibicao(fim)})`
  }

  const tituloTabela = getTituloTabela()

  return (
    <div className="space-y-1">
      
      {/* ✅ FILTROS CASA */}
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
        centrosCusto={centrosCusto}
        onLimpar={limparFiltros}
        onGerarPDF={gerarPDF}
      />

      <ModalPagarAvancado 
        modalPagar={modalPagar} 
        setModalPagar={setModalPagar} 
        processarPagamento={processarPagamento} 
      />
      <ModalExcluir />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => setFormularioAberto(!formularioAberto)}
          className="w-full px-2 py-1 flex justify-between items-center hover:bg-gray-50 transition-colors"
        >
          <span className="text-xs font-semibold text-gray-800">
            {editandoLancamento ? '✏️ Editar Lançamento' : '➕ Novo Lançamento'}
          </span>
          <span className="text-xs text-gray-600">{formularioAberto ? '▲' : '▼'}</span>
        </button>
        
        {formularioAberto && (
          <div className="p-2 border-t border-gray-200">
            <div className="flex space-x-2 mb-2 border-b border-gray-200">
              <button
                onClick={() => setAbaLancamentos('padrao')}
                className={`px-3 py-1 font-medium text-xs border-b-2 transition-colors ${
                  abaLancamentos === 'padrao'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                À Vista / Parcelado
              </button>
              <button
                onClick={() => setAbaLancamentos('recorrente')}
                className={`px-3 py-1 font-medium text-xs border-b-2 transition-colors ${
                  abaLancamentos === 'recorrente'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Recorrente
              </button>
            </div>

            <form onSubmit={editandoLancamento ? salvarEdicao : adicionarLancamento} className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Descrição *</label>
                  <input
                    type="text"
                    value={form.descricao}
                    onChange={(e) => setForm({...form, descricao: e.target.value})}
                    className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Descrição do lançamento"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) => setForm({...form, valor: e.target.value})}
                    className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Tipo *</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({...form, tipo: e.target.value})}
                    className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="saida">Saída</option>
                    <option value="entrada">Entrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Status *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({...form, status: e.target.value})}
                    className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="pago">Pago</option>
                    <option value="previsto">Previsto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Centro de Custo *</label>
                  <select
                    value={form.centroCustoId}
                    onChange={(e) => setForm({...form, centroCustoId: e.target.value})}
                    className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {centrosCustoFiltrados.map(centro => (
                      <option key={centro.id} value={centro.id}>{centro.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Data (Vencimento) *</label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={handleDataChange} 
                    className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {abaLancamentos === 'padrao' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      value={form.parcelas}
                      onChange={(e) => setForm({...form, parcelas: parseInt(e.target.value) || 1})}
                      className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {form.parcelas > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Prazo entre Parcelas</label>
                      <select
                        value={form.prazoParcelas}
                        onChange={(e) => setForm({...form, prazoParcelas: e.target.value})}
                        className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="10dias">10 Dias</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="20dias">20 Dias</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Quantidade de Vezes</label>
                    <input
                      type="number"
                      min="1"
                      value={form.recorrenciaQtd}
                      onChange={(e) => setForm({...form, recorrenciaQtd: parseInt(e.target.value) || 1})}
                      className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Prazo entre Lançamentos</label>
                    <select
                      value={form.recorrenciaPrazo}
                      onChange={(e) => setForm({...form, recorrenciaPrazo: e.target.value})}
                      className="block w-full px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="10dias">10 Dias</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="20dias">20 Dias</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex space-x-2 pt-1">
                {editandoLancamento && (
                  <button
                    type="button"
                    onClick={cancelarEdicao}
                    className="flex-1 bg-gray-500 text-white py-1 px-3 rounded-md hover:bg-gray-600 text-xs"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className={`${editandoLancamento ? 'flex-1' : 'w-full'} bg-blue-500 text-white py-1 px-3 rounded-md hover:bg-blue-600 disabled:opacity-50 text-xs`}
                >
                  {loading ? 'Salvando...' : editandoLancamento ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1">
        <div className="col-span-1">
          <CaixaCasaDetalhado titulo="CAIXA CASA" />
        </div>

        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow-md p-1">
            {/* ✅ CABEÇALHO COM BOTÃO "VER TUDO / 11 DIAS" */}
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xs font-semibold text-gray-800">{tituloTabela}</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setMostrarTodos(!mostrarTodos)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    mostrarTodos 
                      ? 'bg-blue-500 text-white hover:bg-blue-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {mostrarTodos ? '11 DIAS' : 'VER TUDO'}
                </button>
                {carregandoInicial && (
                  <span className="text-[10px] text-gray-500 px-2 py-0.5">Carregando...</span>
                )}
              </div>
            </div>

            {carregandoInicial ? (
              <p className="text-xs text-gray-500 text-center py-4">⏳ Carregando lançamentos...</p>
            ) : lancamentosFiltrados.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">📭 Nenhum lançamento encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-1/12 px-1 py-1 text-left font-medium text-gray-700 border-b text-xs">Data</th>
                      <th className="w-1/12 px-1 py-1 text-left font-medium text-gray-700 border-b text-xs">Status</th>
                      <th className="w-2/12 px-1 py-1 text-right font-medium text-gray-700 border-b text-xs">Valor</th>
                      <th className="w-4/12 px-1 py-1 text-left font-medium text-gray-700 border-b text-xs">Descrição</th>
                      <th className="w-2/12 px-1 py-1 text-left font-medium text-gray-700 border-b text-xs">CDC</th>
                      <th className="w-2/12 px-1 py-1 text-center font-medium text-gray-700 border-b text-xs">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentosFiltrados.map((lancamento) => (
                      <tr 
                        key={lancamento.id} 
                        className="border-b hover:bg-gray-50 transition-colors bg-white"
                      >
                        <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-700">
                          {formatarDataParaExibicao(lancamento.data_prevista || lancamento.data_lancamento)}
                        </td>
                        <td className="px-1 py-1">
                          {lancamento.status === 'realizado' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-bold text-white bg-green-600">
                              ✓ Pago
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                              Previsto
                            </span>
                          )}
                        </td>
                        <td className={`px-1 py-1 text-right font-medium whitespace-nowrap text-xs ${
                          lancamento.status === 'realizado' 
                            ? lancamento.tipo === 'entrada'
                              ? 'text-white font-bold bg-green-600'
                              : 'text-white font-bold bg-red-600'
                            : lancamento.tipo === 'entrada' 
                              ? 'text-green-600'
                              : 'text-red-600'
                        }`}>
                          {lancamento.tipo === 'entrada' ? '+' : '-'} R$ {lancamento.valor.toFixed(2)}
                        </td>
                        <td className="px-1 py-1 text-xs text-gray-700 truncate">
                          {lancamento.descricao}
                        </td>
                        <td className="px-1 py-1 text-xs text-gray-600 truncate">
                          {lancamento.centros_de_custo?.nome || '-'}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => iniciarEdicao(lancamento)}
                              className="text-blue-500 hover:text-blue-700 font-bold"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            {lancamento.status === 'previsto' && (
                              <button
                                onClick={() => setModalPagar({...modalPagar, aberto: true, lancamento})}
                                className="text-green-500 hover:text-green-700 font-bold"
                                title="Pagar"
                              >
                                💰
                              </button>
                            )}
                            <button
                              onClick={() => setModalExcluir({aberto: true, lancamento})}
                              className="text-red-500 hover:text-red-700 font-bold"
                              title="Excluir"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}