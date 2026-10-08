/*
 * MÓDULO: SAÍDA DE MERCADORIA (PEDIDOS)  —  Responsável: GABRIEL
 * ------------------------------------------------------------
 * Objetivo: registrar pedidos de saída e dar baixa no estoque.
 * Toda saída DIMINUI o estoque.
 *
 * PASSO A PASSO
 * 1. No database/schema.sql, criar a tabela "saidas"
 *    (id, produto_id, endereco_id, quantidade, cliente, status, data, usuario_id).
 *    Status sugeridos: "PENDENTE" e "EXPEDIDO".
 * 2. Combinar com o Felipe como chamar a função do módulo de estoque
 *    que subtrai a quantidade (ver estoque.controller.js).
 * 3. No saida.controller.js, criar a função de CRIAR PEDIDO:
 *    - receber produto, quantidade e cliente;
 *    - validar: quantidade maior que zero;
 *    - salvar com status "PENDENTE".
 * 4. Criar a função de EXPEDIR PEDIDO:
 *    - verificar se tem estoque suficiente (se não tiver, responder erro);
 *    - chamar a função do Felipe para subtrair do estoque;
 *    - mudar o status para "EXPEDIDO".
 * 5. Criar a função de LISTAR PEDIDOS (com filtro por status).
 * 6. Neste arquivo, criar as rotas:
 *    POST  /api/saida              → criar pedido
 *    GET   /api/saida              → listar pedidos
 *    PUT   /api/saida/:id/expedir  → expedir
 * 7. Testar no Postman/Insomnia e conferir se o estoque diminuiu.
 * 8. Fazer a tela public/pages/saida.html com:
 *    formulário de pedido + tabela de pedidos com botão "Expedir".
 * 9. No public/js/saida.js, chamar a API com fetch.
 * 10. Abrir Pull Request da branch "saida" para a main.
 */

const express = require('express');
const router = express.Router();
// const controller = require('./saida.controller');

// Rotas deste módulo vão aqui (passo 6)

module.exports = router;
