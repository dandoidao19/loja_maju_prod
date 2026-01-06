'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil, prepararDataParaInsert } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'

interface ItemVenda {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
  estoque_atual?: number
  minimizado?: boolean
  isNovoCadastro?: boolean
}

interface FormularioVendaProps {
  onVendaAdicionada: () => void
}

// Função corrigida para garantir intervalo correto
const getDataNDias = (dataBase: string, dias: number) => {
  const data = new Date(dataBase + 'T12:00:00')
  data.setDate(data.getDate() + dias)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const addMonths = (dateString: string, months: number): string => {
  const [ano, mes, dia] = dateString.split('-').map(Number)
  const date = new Date(ano, mes - 1 + months, dia)

  if (date.getDate() !== dia) {
    date.setDate(0)
  }

  const novoAno = date.getFullYear()
  const novoMes = String(date.getMonth() + 1).padStart(2, '0')
  const novoDia = String(date.getDate()).padStart(2, '0')

  return `${novoAno}-${novoMes}-${novoDia}`
}

export default function FormularioVenda({ onVendaAdicionada }: FormularioVendaProps) {
  const [dataVenda, setDataVenda] = useState(getDataAtualBrasil())
  const [cliente, setCliente] = useState('')
  const [itens, setItens] = useState<ItemVenda[]>([
    {
      id: Date.now().toString(),
      produto_id: null,
      descricao: '',
      quantidade: 1,
      categoria: '',
      preco_custo: 0,
      preco_venda: 0,
      estoque_atual: 0,
      minimizado: false,
      isNovoCadastro: false,
    },
  ])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [prazoParcelas, setPrazoParcelas] = useState('mensal')
  const [statusPagamento, setStatusPagamento] = useState('pendente')
  const [dataVencimento, setDataVencimento] = useState(getDataAtualBrasil())
  
  const [resetSeletorKey, setResetSeletorKey] = useState(Date.now())

  useEffect(() => {
    carregarCategorias()
  }, [])

  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_estoque')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setCategorias(data || [])
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  const calcularTotal = () => {
    return itens.reduce((total, item) => total + item.quantidade * item.preco_venda, 0)
  }

  const adicionarNovoItem = () => {
    setItens((prev) => {
      const novosItens = prev.map((item, idx) => 
        idx === prev.length - 1 ? { ...item, minimizado: true } : item
      )
      
      return [
        ...novosItens,
        {
          id: Date.now().toString(),
          produto_id: null,
          descricao: '',
          quantidade: 1,
          categoria: '',
          preco_custo: 0,
          preco_venda: 0,
          estoque_atual: 0,
          minimizado: false,
          isNovoCadastro: false,
        },
      ]
    })
    
    setResetSeletorKey(Date.now())
  }

  const removerItem = (idItem: string) => {
    if (itens.length > 1) {
      setItens(itens.filter((item) => item.id !== idItem))
    } else {
      alert('Você deve ter pelo menos um item')
    }
    setErro('')
  }

  const atualizarItem = (idItem: string, campo: string, valor: any) => {
    setItens(
      itens.map((item) =>
        item.id === idItem ? { ...item, [campo]: valor } : item
      )
    )
  }

  const toggleNovoCadastro = (idItem: string) => {
    setItens(
      itens.map((item) =>
        item.id === idItem
          ? {
              ...item,
              isNovoCadastro: !item.isNovoCadastro,
              produto_id: null,
              descricao: '',
              categoria: !item.isNovoCadastro ? categorias[0]?.nome || '' : '',
              preco_custo: 0,
              preco_venda: 0,
              estoque_atual: 0,
            }
          : item
      )
    )
    setResetSeletorKey(Date.now())
  }

  const selecionarProduto = (produto: any, idItem: string) => {
    setItens((prevItens) =>
      prevItens.map((item) =>
        item.id === idItem
          ? {
              ...item,
              produto_id: produto.id,
              descricao: produto.descricao || '',
              categoria: produto.categoria || '',
              preco_custo: produto.preco_custo || 0,
              preco_venda: produto.preco_venda || 0,
              estoque_atual: produto.quantidade || 0,
            }
          : item
      )
    )
  }

  const criarTransacoesParceladas = async (
    compraId: string,
    total: number,
    cliente: string,
    dataVencimento: string,
    quantidadeParcelas: number,
    prazoParcelas: string,
    numeroTransacaoVenda: number
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    console.log('📅 Data de vencimento recebida:', dataVencimento)
    console.log('💰 Valor total:', total)
    console.log('📊 Quantidade de parcelas:', quantidadeParcelas)

    const valorParcela = total / quantidadeParcelas
    const transacoes = []

    for (let i = 1; i <= quantidadeParcelas; i++) {
      let dataParcela = dataVencimento
      
      console.log(`📅 Calculando parcela ${i}/${quantidadeParcelas}`)
      console.log(`📅 Data base: ${dataVencimento}`)
      
      if (i > 1) {
        if (prazoParcelas === 'diaria') {
          dataParcela = getDataNDias(dataVencimento, i - 1)
          console.log(`📅 Parcela ${i} (diária): ${dataParcela}`)
        } else if (prazoParcelas === 'semanal') {
          dataParcela = getDataNDias(dataVencimento, (i - 1) * 7)
          console.log(`📅 Parcela ${i} (semanal): ${dataParcela}`)
        } else if (prazoParcelas === 'mensal') {
          dataParcela = addMonths(dataVencimento, i - 1)
          console.log(`📅 Parcela ${i} (mensal): ${dataParcela}`)
        }
      }

      const dataParcelaFormatada = prepararDataParaInsert(dataParcela)
      console.log(`📅 Parcela ${i} formatada: ${dataParcelaFormatada}`)

      let statusParcela = 'pendente'
      if (statusPagamento === 'pago') {
        statusParcela = 'pago'
      } else if (statusPagamento === 'parcial' && i === 1) {
        statusParcela = 'pago'
      }

      // CORREÇÃO: Gerar número único usando timestamp para evitar conflitos
      const timestamp = Date.now()
      const numeroTransacao = parseInt(`${timestamp.toString().slice(-6)}${i}`.padStart(6, '0'))
      
      console.log(`🔢 Número da transação gerado: ${numeroTransacao}`)

      // CORREÇÃO: Descrição SEM número da transação
      const descricao = `Venda ${cliente} (${i}/${quantidadeParcelas})`

      transacoes.push({
        user_id: user.id,
        numero_transacao: numeroTransacao,
        descricao: descricao,
        total: valorParcela,
        tipo: 'entrada',
        data: dataParcelaFormatada,
        status_pagamento: statusParcela
      })
    }

    console.log('📊 Transações a serem criadas:', transacoes)

    // CORREÇÃO: Verificar se há conflito antes de tentar inserir
    try {
      // Primeiro, verificar se algum número já existe
      const numerosTransacoes = transacoes.map(t => t.numero_transacao)
      const { data: transacoesExistentes, error: erroBusca } = await supabase
        .from('transacoes_loja')
        .select('numero_transacao')
        .in('numero_transacao', numerosTransacoes)
      
      if (erroBusca) {
        console.error('Erro ao verificar transações existentes:', erroBusca)
      }
      
      if (transacoesExistentes && transacoesExistentes.length > 0) {
        console.warn('⚠️ Conflito detectado! Números existentes:', transacoesExistentes)
        // Regenerar números únicos
        transacoes.forEach((transacao, index) => {
          const novoNumero = Date.now() + Math.floor(Math.random() * 1000) + index
          transacao.numero_transacao = novoNumero
        })
        console.log('🔄 Números regenerados:', transacoes.map(t => t.numero_transacao))
      }

      // Limpar transações desta venda específica
      const { data: transacoesParaLimpar } = await supabase
        .from('transacoes_loja')
        .select('id')
        .ilike('descricao', `Venda ${cliente}%`)
        .eq('tipo', 'entrada')

      if (transacoesParaLimpar && transacoesParaLimpar.length > 0) {
        console.log(`🗑️ Encontradas ${transacoesParaLimpar.length} transações antigas para limpar`)
        const { error: deleteError } = await supabase
          .from('transacoes_loja')
          .delete()
          .ilike('descricao', `Venda ${cliente}%`)
          .eq('tipo', 'entrada')

        if (deleteError) {
          console.error('Erro ao limpar transações desta venda:', deleteError)
        }
      }

      // Inserir as novas transações
      const { error } = await supabase
        .from('transacoes_loja')
        .insert(transacoes)

      if (error) {
        console.error('Erro ao criar transações parceladas:', error)
        throw error
      }
      
      console.log('✅ Transações criadas com sucesso')
    } catch (error) {
      console.error('❌ Erro no processo de criação de transações:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (!cliente.trim()) {
        throw new Error('Cliente é obrigatório')
      }

      for (const item of itens) {
        if (!item.descricao.trim()) {
          throw new Error('Todos os itens devem ter descrição')
        }
        if (item.quantidade <= 0) {
          throw new Error('Quantidade deve ser maior que 0')
        }
        if (item.preco_venda <= 0) {
          throw new Error('Preço de venda deve ser maior que 0')
        }
        if (item.isNovoCadastro && item.preco_custo <= 0) {
          throw new Error('Preço de custo deve ser maior que 0 para novos produtos')
        }
      }

      const { data: numeroTransacao, error: erroNumero } = await supabase
        .rpc('obter_proximo_numero_transacao')
      
      if (erroNumero) {
        console.error('Erro ao obter número de transação:', erroNumero)
        throw new Error('Erro ao gerar número da venda')
      }

      const dataVendaPrepara = prepararDataParaInsert(dataVenda)
      const dataVencimentoPrepara = prepararDataParaInsert(dataVencimento)

      console.log('📋 Dados da venda:')
      console.log('📅 Data da venda:', dataVendaPrepara)
      console.log('📅 Data de vencimento:', dataVencimentoPrepara)
      console.log('💰 Total:', calcularTotal())
      console.log('📊 Parcelas:', quantidadeParcelas)
      console.log('📅 Prazo:', prazoParcelas)

      const dadosVenda: any = {
        numero_transacao: numeroTransacao,
        data_venda: dataVendaPrepara,
        cliente,
        total: calcularTotal(),
        quantidade_itens: itens.length,
        forma_pagamento: 'dinheiro',
        status_pagamento: statusPagamento,
        quantidade_parcelas: quantidadeParcelas,
        prazoparcelas: prazoParcelas,
      }

      const { data: vendaData, error: erroVenda } = await supabase
        .from('vendas')
        .insert(dadosVenda)
        .select()
        .single()

      if (erroVenda) {
        if (erroVenda.message.includes('data_vencimento') || erroVenda.code === '42703') {
          const { data: vendaData2, error: erroVenda2 } = await supabase
            .from('vendas')
            .insert({
              numero_transacao: numeroTransacao,
              data_venda: dataVendaPrepara,
              cliente,
              total: calcularTotal(),
              quantidade_itens: itens.length,
              forma_pagamento: 'dinheiro',
              status_pagamento: statusPagamento,
              quantidade_parcelas: quantidadeParcelas,
              prazoparcelas: prazoParcelas,
            })
            .select()
            .single()

          if (erroVenda2) {
            throw erroVenda2
          }
          
          console.log('🔄 Criando transações parceladas...')
          await criarTransacoesParceladas(
            vendaData2.id,
            calcularTotal(),
            cliente,
            dataVencimentoPrepara,
            quantidadeParcelas,
            prazoParcelas,
            numeroTransacao
          )

          for (const item of itens) {
            let produtoId = item.produto_id

            if (!produtoId) {
              const { data: novoProduto, error: erroNovoProduto } = await supabase
                .from('produtos')
                .insert({
                  codigo: `${item.categoria.substring(0, 1).toUpperCase()}${Math.floor(Math.random() * 10000)}`,
                  descricao: item.descricao,
                  quantidade: -item.quantidade,
                  preco_custo: item.preco_custo,
                  valor_repasse: item.preco_custo * 1.3,
                  preco_venda: item.preco_venda,
                  categoria: item.categoria,
                  data_ultima_compra: dataVendaPrepara,
                })
                .select()
                .single()

              if (erroNovoProduto) {
                throw erroNovoProduto
              }
              produtoId = novoProduto.id
            } else {
              const { data: produtoAtual } = await supabase
                .from('produtos')
                .select('quantidade')
                .eq('id', produtoId)
                .single()

              if (produtoAtual) {
                const { error: erroUpdate } = await supabase
                  .from('produtos')
                  .update({
                    quantidade: produtoAtual.quantidade - item.quantidade,
                  })
                  .eq('id', produtoId)

                if (erroUpdate) {
                  throw erroUpdate
                }
              }
            }

            const { error: erroItem } = await supabase
              .from('itens_venda')
              .insert({
                venda_id: vendaData2.id,
                produto_id: produtoId,
                descricao: item.descricao,
                quantidade: item.quantidade,
                preco_venda: item.preco_venda,
              })

            if (erroItem) {
              throw erroItem
            }

            await supabase
              .from('movimentacoes_estoque')
              .insert({
                produto_id: produtoId,
                tipo: 'saida',
                quantidade: item.quantidade,
                observacao: `Venda para ${cliente} em ${dataVendaPrepara}`,
                data: new Date().toISOString(),
              })
          }

          setDataVenda(getDataAtualBrasil())
          setCliente('')
          setItens([
            {
              id: Date.now().toString(),
              produto_id: null,
              descricao: '',
              quantidade: 1,
              categoria: categorias[0]?.nome || '',
              preco_custo: 0,
              preco_venda: 0,
              estoque_atual: 0,
              minimizado: false,
              isNovoCadastro: false,
            },
          ])
          setQuantidadeParcelas(1)
          setPrazoParcelas('mensal')
          setStatusPagamento('pendente')
          setDataVencimento(getDataAtualBrasil())

          onVendaAdicionada()
          setLoading(false)
          return
        } else {
          throw erroVenda
        }
      }

      console.log('🔄 Criando transações parceladas...')
      await criarTransacoesParceladas(
        vendaData.id,
        calcularTotal(),
        cliente,
        dataVencimentoPrepara,
        quantidadeParcelas,
        prazoParcelas,
        numeroTransacao
      )

      for (const item of itens) {
        let produtoId = item.produto_id

        if (!produtoId) {
          const { data: novoProduto, error: erroNovoProduto } = await supabase
            .from('produtos')
            .insert({
              codigo: `${item.categoria.substring(0, 1).toUpperCase()}${Math.floor(Math.random() * 10000)}`,
              descricao: item.descricao,
              quantidade: -item.quantidade,
              preco_custo: item.preco_custo,
              valor_repasse: item.preco_custo * 1.3,
              preco_venda: item.preco_venda,
              categoria: item.categoria,
              data_ultima_compra: dataVendaPrepara,
            })
            .select()
            .single()

          if (erroNovoProduto) {
            throw erroNovoProduto
          }
          produtoId = novoProduto.id
        } else {
          const { data: produtoAtual } = await supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', produtoId)
            .single()

          if (produtoAtual) {
            const { error: erroUpdate } = await supabase
              .from('produtos')
              .update({
                quantidade: produtoAtual.quantidade - item.quantidade,
              })
              .eq('id', produtoId)

            if (erroUpdate) {
              throw erroUpdate
            }
          }
        }

        const { error: erroItem } = await supabase
          .from('itens_venda')
          .insert({
            venda_id: vendaData.id,
            produto_id: produtoId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            preco_venda: item.preco_venda,
          })

        if (erroItem) {
          throw erroItem
        }

        await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: produtoId,
            tipo: 'saida',
            quantidade: item.quantidade,
            observacao: `Venda para ${cliente} em ${dataVendaPrepara}`,
            data: new Date().toISOString(),
          })
      }

      setDataVenda(getDataAtualBrasil())
      setCliente('')
      setItens([
        {
          id: Date.now().toString(),
          produto_id: null,
          descricao: '',
          quantidade: 1,
          categoria: categorias[0]?.nome || '',
          preco_custo: 0,
          preco_venda: 0,
          estoque_atual: 0,
          minimizado: false,
          isNovoCadastro: false,
        },
      ])
      setQuantidadeParcelas(1)
      setPrazoParcelas('mensal')
      setStatusPagamento('pendente')
      setDataVencimento(getDataAtualBrasil())
      setResetSeletorKey(Date.now())

      console.log('✅ Venda registrada com sucesso!')
      onVendaAdicionada()
    } catch (err) {
      console.error('❌ Erro completo:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao registrar venda')
    } finally {
      setLoading(false)
    }
  }

  const itemAtivo = itens[itens.length - 1]

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Nova Venda</h2>

      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Data e Cliente */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Data da Venda
            </label>
            <input
              type="date"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              required
            />
          </div>
        </div>

        {/* Itens Minimizados */}
        {itens.filter((i) => i.minimizado).length > 0 && (
          <div className="border-t pt-2">
            <h3 className="font-semibold text-gray-700 mb-1 text-xs">
              Itens Adicionados ({itens.filter((i) => i.minimizado).length})
            </h3>
            <div className="space-y-1">
              {itens
                .filter((i) => i.minimizado)
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 p-1 rounded border border-gray-200 flex justify-between items-center"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-xs">{item.descricao}</p>
                      <p className="text-xs text-gray-600">
                        {item.quantidade}x R$ {item.preco_venda.toFixed(2)} = R${' '}
                        {(item.quantidade * item.preco_venda).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerItem(item.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Item Ativo (em edição) */}
        {itemAtivo && (
          <div className="border-t pt-2 bg-green-50 p-2 rounded border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 text-xs">
                Item {itens.length} (Em Preenchimento)
              </h3>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemAtivo.isNovoCadastro || false}
                  onChange={() => toggleNovoCadastro(itemAtivo.id)}
                  className="w-3 h-3 rounded border-gray-300"
                />
                <span className="text-xs font-medium text-gray-700">Novo Cadastro</span>
              </label>
            </div>

            <div className="space-y-2">
              {!itemAtivo.isNovoCadastro ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Produto (Busca e Seleção)
                  </label>
                  <SeletorProduto
                    key={`seletor-venda-${resetSeletorKey}-${itemAtivo.id}`}
                    onSelecionarProduto={(produto) => selecionarProduto(produto, itemAtivo.id)}
                    onNovoItem={() => {}}
                    placeholder="Buscar ou criar..."
                    descricaoPreenchida=""
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Descrição do Produto *
                  </label>
                  <input
                    type="text"
                    value={itemAtivo.descricao}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'descricao', e.target.value)}
                    placeholder="Nome do novo produto"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Categoria *
                </label>
                {!itemAtivo.isNovoCadastro ? (
                  <input
                    type="text"
                    value={itemAtivo.categoria}
                    disabled
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-700"
                  />
                ) : (
                  <select
                    value={itemAtivo.categoria}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'categoria', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nome}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  value={itemAtivo.quantidade}
                  onChange={(e) =>
                    atualizarItem(itemAtivo.id, 'quantidade', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  required
                />
              </div>

              {itemAtivo.isNovoCadastro && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Preço de Custo *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemAtivo.preco_custo}
                    onChange={(e) =>
                      atualizarItem(itemAtivo.id, 'preco_custo', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                    min="0.01"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Preço de custo do produto para registro no estoque
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Preço de Venda *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemAtivo.preco_venda}
                  onChange={(e) =>
                    atualizarItem(itemAtivo.id, 'preco_venda', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  required
                />
              </div>

              <div className="border-t pt-2 mt-2">
                <h4 className="font-semibold text-gray-800 mb-2 text-xs">Informações de Pagamento</h4>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Data de Vencimento *
                    </label>
                    <input
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Parcelas
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prazo
                    </label>
                    <select
                      value={prazoParcelas}
                      onChange={(e) => setPrazoParcelas(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={statusPagamento}
                      onChange={(e) => setStatusPagamento(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="parcial">Parcial</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={adicionarNovoItem}
                className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white py-1 rounded font-medium text-xs transition-colors"
              >
                + Adicionar Outro Item
              </button>
            </div>
          </div>
        )}

        <div className="bg-gray-50 p-2 rounded border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-800">Total:</span>
            <span className="text-xl font-bold text-green-600">
              R$ {calcularTotal().toFixed(2)}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-1.5 rounded font-semibold text-xs transition-colors"
        >
          {loading ? 'Registrando...' : 'Registrar Venda'}
        </button>
      </form>
    </div>
  )
}