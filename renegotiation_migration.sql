-- ### SCRIPT DE MIGRAÇÃO PARA RENEGOCIAÇÃO DE PARCELAS ###
--
-- INSTRUÇÕES:
-- 1. Copie o conteúdo deste arquivo.
-- 2. Navegue até o "SQL Editor" no seu painel do Supabase.
-- 3. Cole o script e execute-o.
-- 4. ANTES DE EXECUTAR: Substitua a palavra '[NOME_DO_SEU_ENUM_AQUI]' pelo nome real do tipo de dado da sua coluna 'status_pagamento'.
--    - Se você não sabe o nome, pode encontrá-lo na definição da tabela 'transacoes_loja' no Supabase.
--    - Se o tipo não for um ENUM, este script precisará de ajuste.

-- Adiciona o novo status 'negociada' ao tipo de status de pagamento existente
-- Substitua [NOME_DO_SEU_ENUM_AQUI] pelo nome correto do seu tipo ENUM
ALTER TYPE public."[NOME_DO_SEU_ENUM_AQUI]" ADD VALUE 'negociada';

-- Adiciona uma nova coluna à tabela de transações da loja para rastrear as renegociações
-- Esta coluna irá armazenar um ID único para cada grupo de parcelas renegociadas.
ALTER TABLE public.transacoes_loja
ADD COLUMN renegociacao_id UUID;
