// context/DadosFinanceirosContext.tsx
'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'

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
    contexto: string
  }
}

interface DadosCache {
  centrosCustoCasa: CentroCusto[]
  centrosCustoLoja: CentroCusto[]
  lancamentosCasa: Lancamento[]
  lancamentosLoja: Lancamento[]
  todosLancamentosCasa: Lancamento[]
  todosLancamentosLoja: Lancamento[]
  caixaRealCasa: number
  caixaRealLoja: number
  ultimaAtualizacao: number
}

interface DadosFinanceirosContextType {
  dados: DadosCache
  carregando: boolean
  recarregarDados: () => Promise<void>
  recarregarLancamentos: (contexto: 'casa' | 'loja', periodo?: { inicio: string; fim: string }) => Promise<void>
  atualizarCaixaReal: (contexto: 'casa' | 'loja') => Promise<void>
  limparCache: () => void
}

const DadosFinanceirosContext = createContext<DadosFinanceirosContextType | undefined>(undefined)

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

export function DadosFinanceirosProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<DadosCache>({
    centrosCustoCasa: [],
    centrosCustoLoja: [],
    lancamentosCasa: [],
    lancamentosLoja: [],
    todosLancamentosCasa: [],
    todosLancamentosLoja: [],
    caixaRealCasa: 0,
    caixaRealLoja: 0,
    ultimaAtualizacao: 0
  })
  const [carregando, setCarregando] = useState(false)

  // Função otimizada para buscar centros de custo
  const buscarCentrosCusto = useCallback(async (contexto: 'casa' | 'loja') => {
    const { data, error } = await supabase
      .from('centros_de_custo')
      .select('*')
      .eq('contexto', contexto)
      .order('nome')

    if (error) {
      console.error(`❌ Erro ao carregar centros de custo ${contexto}:`, error)
      return []
    }

    return data || []
  }, [])

  // ✅ CORREÇÃO: Função DEFINITIVA - Buscar TODOS os lançamentos com PAGINAÇÃO (até 3000 registros)
  const buscarLancamentos = useCallback(async (
    contexto: 'casa' | 'loja',
    periodo?: { inicio: string; fim: string }
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // ETAPA 1: Buscar IDs dos centros de custo do contexto
      const { data: centros, error: errorCentros } = await supabase
        .from('centros_de_custo')
        .select('id')
        .eq('contexto', contexto)

      if (errorCentros) {
        console.error(`❌ Erro ao buscar centros de custo ${contexto}:`, errorCentros)
      }

      // MELHORIA: Se não houver centros de custo, ainda assim tenta buscar lançamentos do usuário
      // para evitar que o sistema trave se o banco estiver vazio ou com estrutura diferente
      const centroIds = centros ? centros.map(c => c.id) : []
      
      // ETAPA 2: Buscar TODOS os lançamentos com PAGINAÇÃO
      const LIMITE_POR_PAGINA = 1000
      const LIMITE_TOTAL = 3000
      let todosLancamentos: any[] = []
      let pagina = 0
      let temMaisRegistros = true
      
      console.log(`📥 ${contexto} - Iniciando busca paginada de lançamentos...`)

      while (temMaisRegistros && todosLancamentos.length < LIMITE_TOTAL) {
        const inicio = pagina * LIMITE_POR_PAGINA
        
        let query = supabase
          .from('lancamentos_financeiros')
          .select(`
            *,
            centros_de_custo(nome)
          `)
          // .eq('user_id', user.id) - Removido para permitir modo colaborativo
          
        // Só aplica o filtro de centro_custo_id se houver IDs, senão busca todos do usuário
        if (centroIds.length > 0) {
          query = query.in('centro_custo_id', centroIds)
        }

        query = query
          .order('data_prevista', { ascending: false })
          .range(inicio, inicio + LIMITE_POR_PAGINA - 1)

        if (periodo) {
          query = query
            .gte('data_prevista', periodo.inicio)
            .lte('data_prevista', periodo.fim)
        }

        const { data, error, count } = await query

        if (error) {
          console.error(`❌ Erro ao carregar página ${pagina + 1} de lançamentos ${contexto}:`, error)
          break
        }

        if (data && data.length > 0) {
          todosLancamentos = [...todosLancamentos, ...data]
          console.log(`📄 ${contexto} - Página ${pagina + 1}: ${data.length} registros`)
          pagina++
          
          // Verificar se há mais registros
          if (data.length < LIMITE_POR_PAGINA) {
            temMaisRegistros = false
          }
        } else {
          temMaisRegistros = false
        }
      }

      console.log(`✅ ${contexto} - Total lançamentos carregados:`, todosLancamentos.length)
      if (todosLancamentos.length === 0) {
        console.warn(`⚠️ Nenhum lançamento encontrado para o contexto ${contexto}. Verifique se o usuário possui registros vinculados ao seu ID no Supabase.`)
      }
      return todosLancamentos

    } catch (error) {
      console.error(`❌ Erro ao buscar lançamentos ${contexto}:`, error)
      return []
    }
  }, [])

  // ✅ CORREÇÃO: Função DEFINITIVA para calcular caixa real (AGORA USA valor_pago)
  const calcularCaixaReal = useCallback(async (contexto: 'casa' | 'loja') => {
    try {
      const hoje = getDataAtualBrasil()
      
      if (contexto === 'loja') {
        // ✅ PARA CONTEXTO LOJA: Calcular baseado em transacoes_loja
        // AGORA usando valor_pago se existir, senão total
        const { data: transacoesRealizadas } = await supabase
          .from('transacoes_loja')
          .select('tipo, total, data, data_pagamento, status_pagamento, valor_pago, juros_descontos')
          .eq('status_pagamento', 'pago')
          
        let caixa = 0
        
        if (transacoesRealizadas) {
          transacoesRealizadas.forEach((trans: any) => {
            // ✅ USAR data_pagamento SE EXISTIR E FOR VÁLIDA, SENÃO USAR data
            const dataParaComparacao = trans.data_pagamento || trans.data
            
            // Verificar se a data de pagamento/vencimento é <= hoje
            if (new Date(dataParaComparacao) <= new Date(hoje)) {
              // ✅ USAR valor_pago SE EXISTIR, SENÃO USAR total
              const valorImpacto = trans.valor_pago !== null ? trans.valor_pago : trans.total
              
              if (trans.tipo === 'entrada') {
                caixa += valorImpacto
              } else {
                caixa -= valorImpacto
              }
            }
          })
        }
        
        console.log(`💰 Caixa real LOJA calculado (usando valor_pago): R$ ${caixa.toFixed(2)}`)
        return caixa
      } else {
        // ✅ PARA CONTEXTO CASA: Calcular baseado em lancamentos_financeiros
        
        // ETAPA 1: Buscar IDs dos centros de custo
        const { data: centros } = await supabase
          .from('centros_de_custo')
          .select('id')
          .eq('contexto', contexto)

        if (!centros || centros.length === 0) return 0

        // ETAPA 2: Buscar lançamentos realizados com paginação
        const centroIds = centros.map(c => c.id)
        const LIMITE_POR_PAGINA = 1000
        let caixa = 0
        let pagina = 0
        let temMaisRegistros = true
        
        while (temMaisRegistros) {
          const inicio = pagina * LIMITE_POR_PAGINA
          
          const { data: lancamentosRealizados, error } = await supabase
            .from('lancamentos_financeiros')
            .select('valor, tipo')
            .eq('status', 'realizado')
            .lte('data_lancamento', hoje)
            .in('centro_custo_id', centroIds)
            .range(inicio, inicio + LIMITE_POR_PAGINA - 1)

          if (error) {
            console.error(`❌ Erro ao calcular caixa página ${pagina + 1}:`, error)
            break
          }

          if (lancamentosRealizados && lancamentosRealizados.length > 0) {
            lancamentosRealizados.forEach((lanc: any) => {
              if (lanc.tipo === 'entrada') {
                caixa += lanc.valor
              } else {
                caixa -= lanc.valor
              }
            })
            pagina++
            
            if (lancamentosRealizados.length < LIMITE_POR_PAGINA) {
              temMaisRegistros = false
            }
          } else {
            temMaisRegistros = false
          }
        }

        console.log(`💰 Caixa real CASA calculado: R$ ${caixa.toFixed(2)}`)
        return caixa
      }
    } catch (error) {
      console.error(`❌ Erro ao calcular caixa real ${contexto}:`, error)
      return 0
    }
  }, [])

  // Recarregar TODOS os dados
  const recarregarDados = useCallback(async () => {
    setCarregando(true)
    console.log('🔄 Iniciando recarregamento de dados...')

    try {
      // Buscar centros de custo primeiro
      const [centrosCasa, centrosLoja] = await Promise.all([
        buscarCentrosCusto('casa'),
        buscarCentrosCusto('loja')
      ])

      console.log('✅ Centros de custo carregados:', {
        casa: centrosCasa.length,
        loja: centrosLoja.length
      })

      // Buscar lançamentos e caixa em paralelo
      const [
        lancamentosCasa,
        lancamentosLoja,
        caixaCasa,
        caixaLoja
      ] = await Promise.all([
        buscarLancamentos('casa'),
        buscarLancamentos('loja'),
        calcularCaixaReal('casa'),
        calcularCaixaReal('loja')
      ])

      setDados(prev => ({
        ...prev,
        centrosCustoCasa: centrosCasa,
        centrosCustoLoja: centrosLoja,
        lancamentosCasa: lancamentosCasa,
        lancamentosLoja: lancamentosLoja,
        todosLancamentosCasa: lancamentosCasa,
        todosLancamentosLoja: lancamentosLoja,
        caixaRealCasa: caixaCasa,
        caixaRealLoja: caixaLoja,
        ultimaAtualizacao: Date.now()
      }))

      console.log('✅ Dados recarregados com sucesso:', {
        centrosCasa: centrosCasa.length,
        centrosLoja: centrosLoja.length,
        lancamentosCasa: lancamentosCasa.length,
        lancamentosLoja: lancamentosLoja.length,
        caixaCasa,
        caixaLoja
      })

    } catch (error) {
      console.error('❌ Erro ao recarregar dados:', error)
    } finally {
      setCarregando(false)
    }
  }, [buscarCentrosCusto, buscarLancamentos, calcularCaixaReal])

  // Recarregar apenas lançamentos de um contexto específico
  const recarregarLancamentos = useCallback(async (
    contexto: 'casa' | 'loja',
    periodo?: { inicio: string; fim: string }
  ) => {
    try {
      console.log(`🔄 Recarregando lançamentos ${contexto}...`)
      
      const lancamentos = periodo 
        ? await buscarLancamentos(contexto, periodo)
        : await buscarLancamentos(contexto)
      
      const caixaAtualizada = await calcularCaixaReal(contexto)

      if (contexto === 'casa') {
        setDados(prev => ({
          ...prev,
          lancamentosCasa: lancamentos,
          todosLancamentosCasa: lancamentos,
          caixaRealCasa: caixaAtualizada,
          ultimaAtualizacao: Date.now()
        }))
        
        console.log(`✅ Lançamentos CASA recarregados: ${lancamentos.length} registros`)
      } else {
        setDados(prev => ({
          ...prev,
          lancamentosLoja: lancamentos,
          todosLancamentosLoja: lancamentos,
          caixaRealLoja: caixaAtualizada,
          ultimaAtualizacao: Date.now()
        }))
        
        console.log(`✅ Lançamentos LOJA recarregados: ${lancamentos.length} registros`)
      }

    } catch (error) {
      console.error(`❌ Erro ao recarregar lançamentos ${contexto}:`, error)
    }
  }, [buscarLancamentos, calcularCaixaReal])

  // Atualizar apenas caixa real
  const atualizarCaixaReal = useCallback(async (contexto: 'casa' | 'loja') => {
    console.log(`💰 Atualizando caixa real ${contexto}...`)
    
    const caixa = await calcularCaixaReal(contexto)
    
    if (contexto === 'casa') {
      setDados(prev => ({ 
        ...prev, 
        caixaRealCasa: caixa,
        ultimaAtualizacao: Date.now()
      }))
      console.log(`✅ Caixa real CASA atualizado: R$ ${caixa.toFixed(2)}`)
    } else {
      setDados(prev => ({ 
        ...prev, 
        caixaRealLoja: caixa,
        ultimaAtualizacao: Date.now()
      }))
      console.log(`✅ Caixa real LOJA atualizado: R$ ${caixa.toFixed(2)}`)
    }
  }, [calcularCaixaReal])

  // Limpar cache
  const limparCache = useCallback(() => {
    setDados({
      centrosCustoCasa: [],
      centrosCustoLoja: [],
      lancamentosCasa: [],
      lancamentosLoja: [],
      todosLancamentosCasa: [],
      todosLancamentosLoja: [],
      caixaRealCasa: 0,
      caixaRealLoja: 0,
      ultimaAtualizacao: 0
    })
    console.log('🧹 Cache limpo')
  }, [])

  // Carregar dados iniciais
  useEffect(() => {
    recarregarDados()
  }, [recarregarDados])

  return (
    <DadosFinanceirosContext.Provider
      value={{
        dados,
        carregando,
        recarregarDados,
        recarregarLancamentos,
        atualizarCaixaReal,
        limparCache
      }}
    >
      {children}
    </DadosFinanceirosContext.Provider>
  )
}

export function useDadosFinanceiros() {
  const context = useContext(DadosFinanceirosContext)
  if (context === undefined) {
    throw new Error('useDadosFinanceiros deve ser usado dentro de DadosFinanceirosProvider')
  }
  return context
}