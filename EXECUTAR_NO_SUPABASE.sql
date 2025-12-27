-- ============================================
-- SQL PARA EXECUTAR NO SUPABASE
-- Sistema de Condicional/Consignação
-- ============================================

-- 1. Criar tabela de transações condicionais
CREATE TABLE IF NOT EXISTS transacoes_condicionais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_transacao INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('recebido', 'enviado')),
  origem VARCHAR(100) NOT NULL, -- Nome do fornecedor ou cliente
  data_transacao DATE NOT NULL,
  observacao TEXT,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'resolvido', 'cancelado')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Criar tabela de itens das transações condicionais
CREATE TABLE IF NOT EXISTS itens_condicionais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transacao_id UUID NOT NULL REFERENCES transacoes_condicionais(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'devolvido', 'efetivado')),
  valor_efetivado DECIMAL(10, 2), -- Valor quando efetivado como compra/venda
  data_resolucao TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_transacoes_condicionais_status ON transacoes_condicionais(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_condicionais_data ON transacoes_condicionais(data_transacao);
CREATE INDEX IF NOT EXISTS idx_itens_condicionais_transacao ON itens_condicionais(transacao_id);
CREATE INDEX IF NOT EXISTS idx_itens_condicionais_produto ON itens_condicionais(produto_id);

-- 4. Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transacoes_condicionais_updated_at
  BEFORE UPDATE ON transacoes_condicionais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSTRUÇÕES DE USO:
-- ============================================
-- 1. Acesse seu projeto no Supabase (https://supabase.com)
-- 2. Vá em "SQL Editor" no menu lateral
-- 3. Clique em "New query"
-- 4. Copie e cole TODO este código
-- 5. Clique em "Run" (ou pressione Ctrl+Enter)
-- 6. Aguarde a confirmação de sucesso
-- ============================================
