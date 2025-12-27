# 💰 Sistema Financeiro - Loja Maju

Sistema completo de gestão financeira desenvolvido com Next.js, TypeScript e Supabase. Gerencia lançamentos financeiros, estoque, vendas e compras para ambientes domésticos e comerciais.

---

## 🚀 Tecnologias

-   **Framework**: Next.js 16.1.1 (App Router)
-   **Linguagem**: TypeScript
-   **Banco de Dados**: Supabase (PostgreSQL)
-   **Estilização**: Tailwind CSS v4
-   **Estado Global**: React Query (@tanstack/react-query)
-   **Bibliotecas**: jsPDF, date-fns, read-excel-file

---

## 📁 Estrutura do Projeto

```
src/
├── app/                    # Rotas do Next.js
│   ├── dashboard/          # Página principal do sistema
│   ├── layout.tsx          # Layout global
│   └── page.tsx            # Página de login
├── components/             # Componentes React (36 componentes)
├── context/                # Context API para dados financeiros
├── lib/                    # Utilitários e configurações
│   ├── supabase.ts         # Cliente do Supabase
│   ├── envUtils.ts         # Controle de ambiente
│   └── ...
└── types/                  # Definições TypeScript
```

---

## ⚙️ Instalação

### Pré-requisitos

-   Node.js 18+ instalado
-   Conta no Supabase
-   Git (para versionamento)

### Passos

1.  **Clone o repositório**:

    ```bash
    git clone https://github.com/seu-usuario/seu-repositorio.git
    cd seu-repositorio
    ```

2.  **Instale as dependências**:

    ```bash
    npm install
    ```

3.  **Configure as variáveis de ambiente**:

    Copie o arquivo `.env.example` para `.env.local` e preencha com suas credenciais do Supabase:

    ```bash
    cp .env.example .env.local
    ```

    Edite o arquivo `.env.local`:

    ```
    NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
    NEXT_PUBLIC_ENABLE_DEV_FEATURES=true
    ```

4.  **Execute o SQL no Supabase**:

    Acesse o SQL Editor do seu projeto no Supabase e execute o conteúdo do arquivo `EXECUTAR_NO_SUPABASE.sql`.

5.  **Inicie o servidor de desenvolvimento**:

    ```bash
    npm run dev
    ```

    Acesse `http://localhost:3000` no seu navegador.

---

## 🌍 Ambientes

Este projeto suporta dois ambientes distintos:

### Desenvolvimento (`npm run dev`)

-   Variável `NEXT_PUBLIC_ENABLE_DEV_FEATURES=true`
-   Exibe a aba **Dashboard** com o componente `ResumoCaixas`
-   Exibe o menu **Condicional** no Módulo Loja
-   Ideal para testar novas funcionalidades

### Produção (Deploy na Vercel)

-   Variável `NEXT_PUBLIC_ENABLE_DEV_FEATURES=false`
-   Oculta a aba **Dashboard** e o componente `ResumoCaixas`
-   Oculta o menu **Condicional**
-   Versão limpa e otimizada para o usuário final

---

## 🚀 Deploy

Para fazer o deploy na Vercel, siga o guia completo em `GUIA_PRODUCAO.md`.

**Resumo**:

1.  Envie o código para o GitHub
2.  Conecte o repositório na Vercel
3.  Configure as variáveis de ambiente na Vercel
4.  Faça o deploy

---

## 📚 Documentação

-   **GUIA_PRODUCAO.md**: Guia passo a passo para colocar o sistema em produção
-   **ALTERACOES_REALIZADAS.md**: Resumo de todas as correções e melhorias aplicadas
-   **EXECUTAR_NO_SUPABASE.sql**: Script SQL para criar as tabelas no banco de dados

---

## 🔒 Segurança

-   Nunca commite arquivos `.env*` no Git (eles estão no `.gitignore`)
-   Configure as variáveis de ambiente diretamente na Vercel para produção
-   O projeto usa headers de segurança HTTP (X-Frame-Options, CSP, etc.)

---

## 🛠️ Scripts Disponíveis

```bash
npm run dev       # Inicia o servidor de desenvolvimento
npm run build     # Cria o build de produção
npm run start     # Inicia o servidor de produção
npm run lint      # Executa o ESLint
```

---

## 📄 Licença

Este projeto é privado e de uso exclusivo.

---

**Desenvolvido com ❤️ por Manus AI**
