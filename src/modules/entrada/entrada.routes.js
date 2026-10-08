/*
 * MÓDULO: ENTRADA DE MERCADORIA  —  Responsável: LUCAS
 * ------------------------------------------------------------
 * Objetivo: registrar a mercadoria que chegou e em qual endereço foi guardada.
 * Toda entrada AUMENTA o estoque.
 *
 * PASSO A PASSO
 * 1. No database/schema.sql, criar a tabela "entradas"
 *    (id, produto_id, endereco_id, quantidade, nota_fiscal, data, usuario_id).
 * 2. Combinar com o Felipe como chamar a função do módulo de estoque
 *    que soma a quantidade (ver estoque.controller.js).
 * 3. No entrada.controller.js, criar a função de REGISTRAR ENTRADA:
 *    - receber produto, endereço, quantidade e nota fiscal;
 *    - validar: quantidade maior que zero, produto e endereço existem;
 *    - salvar na tabela "entradas";
 *    - chamar a função do Felipe para somar no estoque.
 * 4. Criar a função de LISTAR ENTRADAS (histórico, mais recentes primeiro).
 * 5. Neste arquivo, criar as rotas:
 *    POST  /api/entrada     → registrar
 *    GET   /api/entrada     → listar
 * 6. Testar no Postman/Insomnia e conferir se o estoque aumentou.
 * 7. Fazer a tela public/pages/entrada.html com:
 *    selects de produto e endereço (vindos da API do Ygor),
 *    campo de quantidade e nota, botão "Registrar" e tabela do histórico.
 * 8. No public/js/entrada.js, chamar a API com fetch.
 * 9. Abrir Pull Request da branch "entrada" para a main.
 */

const express = require('express');
const router = express.Router();
// const controller = require('./entrada.controller');

// Rotas deste módulo vão aqui (passo 5)

module.exports = router;
