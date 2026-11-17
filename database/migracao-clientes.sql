-- =============================================================
-- MIGRAÇÃO: cadastro de clientes
-- Cria a tabela "clientes" e liga cada produto a um cliente (coluna produtos.cliente_id).
-- Rode UMA vez no banco que já existe (a última linha, da chave estrangeira, dá erro se rodar de novo).
-- Quem recriar tudo com o schema.sql não precisa rodar este arquivo.
-- =============================================================
USE wms;

CREATE TABLE IF NOT EXISTS clientes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  documento VARCHAR(14)  NULL UNIQUE,   -- CPF (11) ou CNPJ (14), só números
  telefone  VARCHAR(20)  NULL,
  email     VARCHAR(150) NULL,
  cidade    VARCHAR(100) NULL
);

-- Traz para o cadastro os clientes que já aparecem nos pedidos de saída
INSERT INTO clientes (nome)
SELECT DISTINCT s.cliente
FROM saidas s
WHERE NOT EXISTS (SELECT 1 FROM clientes c WHERE c.nome = s.cliente);

-- Cada produto pertence a um cliente (dono da mercadoria).
-- Os produtos que já existem ficam sem cliente (NULL) até serem editados no cadastro.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cliente_id INT NULL;
ALTER TABLE produtos ADD CONSTRAINT fk_produtos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id);
