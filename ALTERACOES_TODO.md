# Alterações Solicitadas - Loja Maju

## 1. ModuloCasa - Reorganizar Layout
- [ ] Menu de lançamentos minimizado no topo (abre horizontalmente)
- [ ] Caixa Previsão + Caixa Real à esquerda (espelhado do ResumoCaixas)
- [ ] Lista de transações à direita
- [ ] Ambos na mesma altura

## 2. Tela Inicial Loja - Nova Visualização
- [ ] Layout similar ao ModuloCasa (sem menu de lançamentos)
- [ ] Mesclar compras e vendas em uma única lista
- [ ] Mostrar apenas informações financeiras

## 3. Formulário Compras - Adicionar Exclusão
- [x] Adicionar botão para excluir transações (BotaoExcluirCompra.tsx criado)

## 4. Formulário Vendas - PRIORIDADE
- [x] Corrigir bug de lançamentos (melhor tratamento de erros)
- [x] Corrigir cadastro de produtos (validações adicionadas)
- [x] Adicionar exclusão de transações (BotaoExcluirVenda.tsx criado)

## 5. Sistema Condicional/Consignação - NOVO
- [x] Criar tabela no banco de dados (SQL pronto em EXECUTAR_NO_SUPABASE.sql)
- [x] Lançar itens recebidos (fornecedor → estoque)
- [x] Lançar itens enviados (cliente → estoque)
- [x] Resolver transações (devolver ou efetivar)
- [x] Devolução: impacta apenas estoque
- [x] Efetivação: impacta apenas financeiro
- [x] Interface de gerenciamento (ModuloCondicional.tsx completo)
