-- ### SCRIPT DE MIGRAÇÃO PARA RENEGOCIAÇÃO DE PARCELAS ###
--
-- INSTRUÇÕES:
-- 1. Copie o conteúdo deste arquivo.
-- 2. Navegue até o "SQL Editor" no seu painel do Supabase.
-- 3. Cole o script e execute-o.

-- Adiciona uma nova coluna à tabela de transações da loja para rastrear as renegociações
-- Esta coluna irá armazenar um ID único para cada grupo de parcelas renegociadas.
ALTER TABLE public.transacoes_loja
ADD COLUMN renegociacao_id UUID;
