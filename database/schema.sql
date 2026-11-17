-- =============================================================
-- BANCO DE DADOS DO WMS (TiDB Cloud, compatível com MySQL)
-- SÓ O ANDREY RODA ESTE ARQUIVO (o banco é compartilhado pelo grupo todo).
-- ATENÇÃO: o script APAGA e recria as tabelas (os dados de teste voltam ao início).
-- Mudou uma tabela? Avise no grupo e suba no Git.
-- =============================================================

CREATE DATABASE IF NOT EXISTS wms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wms;

-- Apaga na ordem inversa (por causa das chaves estrangeiras)
DROP TABLE IF EXISTS saidas;
DROP TABLE IF EXISTS entradas;
DROP TABLE IF EXISTS estoque;
DROP TABLE IF EXISTS enderecos;
DROP TABLE IF EXISTS produtos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;

-- -------------------------------------------------------------
-- usuarios (Andrey) — quem acessa o sistema
-- perfil: 'admin' pode tudo, 'operador' faz entrada/saída
-- -------------------------------------------------------------
CREATE TABLE usuarios (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nome   VARCHAR(100) NOT NULL,
  email  VARCHAR(150) NOT NULL UNIQUE,
  senha  VARCHAR(255) NOT NULL,             -- cabe um hash (bcrypt) se quiserem usar
  perfil ENUM('admin', 'operador') NOT NULL DEFAULT 'operador'
);

-- -------------------------------------------------------------
-- clientes (Ygor) — para quem a mercadoria é enviada
-- documento: CPF (11 dígitos) ou CNPJ (14 dígitos), guardado só com números
-- -------------------------------------------------------------
CREATE TABLE clientes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  documento VARCHAR(14)  NULL UNIQUE,
  telefone  VARCHAR(20)  NULL,
  email     VARCHAR(150) NULL,
  cidade    VARCHAR(100) NULL
);

-- -------------------------------------------------------------
-- produtos (Ygor) — o que é guardado no armazém
-- unidade: UN, CX, KG, etc.
-- custo_medio: custo médio ponderado, recalculado pelo sistema a cada entrada
-- preco_venda: preço de venda sugerido, informado no cadastro
-- cliente_id: cliente dono da mercadoria (obrigatório no cadastro; NULL só em produtos antigos)
-- -------------------------------------------------------------
CREATE TABLE produtos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  codigo      VARCHAR(30)    NOT NULL UNIQUE,
  nome        VARCHAR(150)   NOT NULL,
  unidade     VARCHAR(10)    NOT NULL DEFAULT 'UN',
  custo_medio DECIMAL(14,4)  NOT NULL DEFAULT 0 CHECK (custo_medio >= 0),
  preco_venda DECIMAL(12,2)  NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
  cliente_id  INT            NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- -------------------------------------------------------------
-- enderecos (Ygor) — onde o produto fica (rua > prateleira > nível)
-- codigo é a "etiqueta" do local, ex.: A-01-1
-- -------------------------------------------------------------
CREATE TABLE enderecos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  codigo     VARCHAR(20) NOT NULL UNIQUE,
  rua        VARCHAR(10) NOT NULL,
  prateleira VARCHAR(10) NOT NULL,
  nivel      VARCHAR(10) NOT NULL
);

-- -------------------------------------------------------------
-- estoque (Felipe) — saldo ATUAL de cada produto em cada endereço
-- Uma linha por (produto, endereço). Entrada soma, saída subtrai.
-- Dica p/ somar: INSERT ... ON DUPLICATE KEY UPDATE quantidade = quantidade + ?
-- -------------------------------------------------------------
CREATE TABLE estoque (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  produto_id  INT NOT NULL,
  endereco_id INT NOT NULL,
  quantidade  INT NOT NULL DEFAULT 0 CHECK (quantidade >= 0),  -- nunca negativo
  UNIQUE (produto_id, endereco_id),
  FOREIGN KEY (produto_id)  REFERENCES produtos(id),
  FOREIGN KEY (endereco_id) REFERENCES enderecos(id)
);

-- -------------------------------------------------------------
-- entradas (Lucas) — histórico de mercadoria que CHEGOU
-- Ao registrar uma entrada, somar no estoque e recalcular o custo médio do produto.
-- valor_unitario: custo unitário da nota fiscal
-- -------------------------------------------------------------
CREATE TABLE entradas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  produto_id     INT NOT NULL,
  endereco_id    INT NOT NULL,
  quantidade     INT NOT NULL CHECK (quantidade > 0),
  valor_unitario DECIMAL(14,4) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  nota_fiscal VARCHAR(50),
  data        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id  INT NOT NULL,
  FOREIGN KEY (produto_id)  REFERENCES produtos(id),
  FOREIGN KEY (endereco_id) REFERENCES enderecos(id),
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)
);

-- -------------------------------------------------------------
-- saidas (Gabriel) — histórico de mercadoria que SAIU
-- status: pendente -> separado -> enviado (ou cancelado)
-- Ao registrar uma saída, subtrair do estoque (checar se tem saldo).
-- preco_unitario: preço de venda do pedido (padrão = preco_venda do produto)
-- custo_unitario: custo médio do produto no momento da expedição (NULL enquanto pendente)
-- -------------------------------------------------------------
CREATE TABLE saidas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  produto_id     INT NOT NULL,
  endereco_id    INT NOT NULL,
  quantidade     INT NOT NULL CHECK (quantidade > 0),
  preco_unitario DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0),
  custo_unitario DECIMAL(14,4) NULL,
  cliente     VARCHAR(150) NOT NULL,
  status      ENUM('pendente', 'separado', 'enviado', 'cancelado') NOT NULL DEFAULT 'pendente',
  data        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id  INT NOT NULL,
  FOREIGN KEY (produto_id)  REFERENCES produtos(id),
  FOREIGN KEY (endereco_id) REFERENCES enderecos(id),
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)
);

-- =============================================================
-- DADOS DE TESTE
-- =============================================================

-- IDs fixos porque as tabelas abaixo usam eles (no TiDB o AUTO_INCREMENT pode pular números)
-- Senhas em texto puro só para teste
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES
  (1, 'Andrey',  'andrey@wms.com',  '123456', 'admin'),
  (2, 'Ygor',    'ygor@wms.com',    '123456', 'operador'),
  (3, 'Lucas',   'lucas@wms.com',   '123456', 'operador'),
  (4, 'Gabriel', 'gabriel@wms.com', '123456', 'operador'),
  (5, 'Felipe',  'felipe@wms.com',  '123456', 'operador');

INSERT INTO clientes (id, nome, documento, telefone, email, cidade) VALUES
  (1, 'Loja Centro', '12345678000190', '(11) 3333-1000', 'compras@lojacentro.com', 'São Paulo'),
  (2, 'Mercado Bom', '98765432000110', '(11) 3333-2000', 'contato@mercadobom.com', 'Campinas');

INSERT INTO produtos (id, codigo, nome, unidade, custo_medio, preco_venda, cliente_id) VALUES
  (1, 'P001', 'Caixa de papelão média', 'UN',  2.5000,  4.90, 1),
  (2, 'P002', 'Fita adesiva 48mm',      'UN',  6.0000,  9.90, 1),
  (3, 'P003', 'Parafuso 6mm (cx 100)',  'CX', 18.0000, 29.90, 1),
  (4, 'P004', 'Arroz 5kg',              'UN', 22.0000, 31.90, 2);

INSERT INTO enderecos (id, codigo, rua, prateleira, nivel) VALUES
  (1, 'A-01-1', 'A', '01', '1'),
  (2, 'A-01-2', 'A', '01', '2'),
  (3, 'B-02-1', 'B', '02', '1');

-- Entradas e saídas de exemplo; o estoque abaixo já bate com elas
INSERT INTO entradas (produto_id, endereco_id, quantidade, valor_unitario, nota_fiscal, usuario_id) VALUES
  (1, 1, 100,  2.5000, 'NF-1001', 3),
  (2, 1,  50,  6.0000, 'NF-1001', 3),
  (3, 2,  20, 18.0000, 'NF-1002', 3),
  (4, 3,  40, 22.0000, 'NF-1003', 3);

INSERT INTO saidas (produto_id, endereco_id, quantidade, preco_unitario, custo_unitario, cliente, status, usuario_id) VALUES
  (1, 1, 10,  4.90, 2.5000, 'Loja Centro', 'enviado',  4),
  (4, 3,  5, 31.90, NULL,   'Mercado Bom', 'pendente', 4);

INSERT INTO estoque (produto_id, endereco_id, quantidade) VALUES
  (1, 1, 90),
  (2, 1, 50),
  (3, 2, 20),
  (4, 3, 35);
