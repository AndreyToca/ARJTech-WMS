/*
 * MÓDULO: ESTOQUE  —  Responsável: FELIPE
 * ------------------------------------------------------------
 * Objetivo: mostrar quanto tem de cada produto e onde está.
 * Este módulo é o ÚNICO que altera a tabela "estoque".
 * Lucas (entrada) e Gabriel (saída) usam as funções daqui.
 *
 * PASSO A PASSO
 * 1. No database/schema.sql, criar a tabela "estoque"
 *    (id, produto_id, endereco_id, quantidade).
 * 2. No estoque.controller.js, criar PRIMEIRO as funções que os colegas usam
 *    (é prioridade, Lucas e Gabriel dependem delas):
 *    - somar quantidade de um produto em um endereço;
 *    - subtrair quantidade (recusar se ficar negativo).
 *    Avisar no grupo quando estiverem prontas.
 * 3. Criar a função de CONSULTAR ESTOQUE:
 *    lista produto, endereço e quantidade (juntando as tabelas com JOIN).
 * 4. Criar a função de CONSULTAR POR PRODUTO (saldo total de um produto).
 * 5. Neste arquivo, criar as rotas:
 *    GET  /api/estoque                → estoque completo
 *    GET  /api/estoque/produto/:id    → saldo de um produto
 * 6. Testar no Postman/Insomnia.
 * 7. Fazer a tela public/pages/estoque.html com uma tabela e um campo de busca.
 * 8. No public/js/estoque.js, chamar a API com fetch.
 * 9. (Extra) Relatório simples: produtos com estoque baixo.
 * 10. Abrir Pull Request da branch "estoque" para a main.
 */

const express = require('express');
const router = express.Router();
// const controller = require('./estoque.controller');

// Rotas deste módulo vão aqui (passo 5)

module.exports = router;
