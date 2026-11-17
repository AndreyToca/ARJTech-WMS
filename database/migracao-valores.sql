-- =============================================================
-- MIGRAÇÃO: controle de valor dos itens
-- Adiciona as colunas de custo e preço SEM apagar os dados atuais.
-- Rode UMA vez no banco que já existe. (Quem recriar tudo com o schema.sql não precisa rodar este arquivo.)
-- =============================================================
USE wms;

-- Produtos: custo médio (calculado pelo sistema) e preço de venda (informado no cadastro)
ALTER TABLE produtos ADD COLUMN custo_medio DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE produtos ADD COLUMN preco_venda DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Entradas: custo unitário da nota fiscal
ALTER TABLE entradas ADD COLUMN valor_unitario DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER quantidade;

-- Saídas: preço de venda do pedido e custo no momento da expedição
ALTER TABLE saidas ADD COLUMN preco_unitario DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER quantidade;
ALTER TABLE saidas ADD COLUMN custo_unitario DECIMAL(14,4) NULL AFTER preco_unitario;

-- Os produtos que já existem ficam com custo 0 até a próxima entrada com valor.
-- Ajuste o preço de venda pela tela de Cadastros.
