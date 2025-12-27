# 📚 GUIA DE INSTALAÇÃO - Loja Maju (Alterações)

## ✅ O que foi feito

### 1. **Sistema de Condicional/Consignação** (NOVO)
- ✅ Criado componente completo `ModuloCondicional.tsx`
- ✅ Permite lançar itens recebidos de fornecedores
- ✅ Permite lançar itens enviados para clientes
- ✅ Sistema de resolução (devolver ou efetivar)
- ✅ Devolução impacta apenas estoque
- ✅ Efetivação impacta financeiro

### 2. **Componente de Visualização de Caixas** (NOVO)
- ✅ Criado `VisualizacaoCaixas.tsx` reutilizável
- ✅ Mostra Caixa Real + Caixa Previsto
- ✅ Usado no ModuloCasa e TelaInicialLoja

### 3. **Botões de Exclusão**
- ✅ Criado `BotaoExcluirVenda.tsx`
- ✅ Criado `BotaoExcluirCompra.tsx`
- ✅ Revertem estoque automaticamente
- ✅ Confirmação em duas etapas

### 4. **Correções no FormularioVenda**
- ✅ Melhor tratamento de erros
- ✅ Validação de número de transação
- ✅ Logs mais detalhados

---

## 🚀 PASSO A PASSO PARA INSTALAR

### **PASSO 1: Executar SQL no Supabase**

1. Acesse seu projeto no Supabase: https://supabase.com
2. Faça login e selecione o projeto "Loja Maju"
3. No menu lateral, clique em **"SQL Editor"**
4. Clique em **"New query"**
5. Abra o arquivo `EXECUTAR_NO_SUPABASE.sql` (está na raiz do projeto)
6. Copie TODO o conteúdo e cole no editor SQL
7. Clique em **"Run"** (ou pressione Ctrl+Enter)
8. Aguarde a mensagem de sucesso ✅

**O que isso faz:**
- Cria a tabela `transacoes_condicionais`
- Cria a tabela `itens_condicionais`
- Cria índices para melhor performance
- Configura triggers automáticos

---

### **PASSO 2: Substituir arquivos do projeto**

1. **Extraia o projeto corrigido** que vou te enviar
2. **Substitua** sua pasta atual pelos arquivos extraídos
3. **IMPORTANTE:** Mantenha seu arquivo `.env.local` (não substitua!)

---

### **PASSO 3: Instalar dependências**

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

---

### **PASSO 4: Limpar cache e iniciar**

```bash
# Limpar cache do Next.js
rm -rf .next

# Iniciar o servidor
npm run dev
```

---

### **PASSO 5: Adicionar o Módulo Condicional no Menu**

Você precisa adicionar o link para o novo módulo no seu sistema de navegação.

**Onde adicionar:**
- Se você tem um menu principal, adicione um item chamado "Condicional" ou "Consignação"
- O componente é: `<ModuloCondicional />`
- Importe: `import ModuloCondicional from '@/components/ModuloCondicional'`

**Exemplo de rota (se usar Next.js App Router):**

Crie o arquivo `src/app/condicional/page.tsx`:

\`\`\`tsx
import ModuloCondicional from '@/components/ModuloCondicional'

export default function PaginaCondicional() {
  return <ModuloCondicional />
}
\`\`\`

---

### **PASSO 6: Adicionar botões de exclusão nas listas**

#### **Na ListaVendas.tsx:**

1. Importe o componente:
\`\`\`tsx
import BotaoExcluirVenda from './BotaoExcluirVenda'
\`\`\`

2. Adicione na coluna de ações de cada venda:
\`\`\`tsx
<BotaoExcluirVenda
  vendaId={venda.id}
  numeroTransacao={venda.numero_transacao}
  onExcluido={() => carregarVendas()}
/>
\`\`\`

#### **Na ListaCompras.tsx:**

1. Importe o componente:
\`\`\`tsx
import BotaoExcluirCompra from './BotaoExcluirCompra'
\`\`\`

2. Adicione na coluna de ações de cada compra:
\`\`\`tsx
<BotaoExcluirCompra
  compraId={compra.id}
  numeroTransacao={compra.numero_transacao}
  onExcluido={() => carregarCompras()}
/>
\`\`\`

---

## 📋 CHECKLIST DE VALIDAÇÃO

Depois de instalar, teste:

- [ ] SQL executado com sucesso no Supabase
- [ ] Projeto inicia sem erros (`npm run dev`)
- [ ] FormularioVenda registra vendas corretamente
- [ ] FormularioVenda cadastra novos produtos
- [ ] Botão de exclusão aparece nas vendas
- [ ] Botão de exclusão aparece nas compras
- [ ] Exclusão reverte estoque corretamente
- [ ] Módulo Condicional acessível no menu
- [ ] Condicional registra transações
- [ ] Resolução de condicional funciona

---

## 🆘 PROBLEMAS COMUNS

### **Erro: "relation transacoes_condicionais does not exist"**
**Solução:** Você não executou o SQL no Supabase. Volte ao PASSO 1.

### **Erro: "Failed to fetch dynamically imported module"**
**Solução:** Limpe o cache:
\`\`\`bash
rm -rf .next
npm run dev
\`\`\`

### **Botões de exclusão não aparecem**
**Solução:** Você não adicionou os componentes nas listas. Volte ao PASSO 6.

### **Módulo Condicional não aparece no menu**
**Solução:** Você não adicionou a rota. Volte ao PASSO 5.

---

## 📞 SUPORTE

Se tiver dúvidas ou problemas:
1. Verifique o console do navegador (F12)
2. Verifique os logs do terminal
3. Revise este guia novamente
4. Me envie o erro completo

---

**Data de criação:** 06/12/2024  
**Versão:** 2.0  
**Autor:** Manus AI
