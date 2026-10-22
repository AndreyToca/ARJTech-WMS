
/*
 * MÓDULO: CADASTROS — Responsável: YGOR
 * ------------------------------------------------------------
 * Objetivo: cadastrar PRODUTOS e ENDEREÇOS do armazém.
 *
 * PASSO A PASSO
 * 1. As tabelas produtos e enderecos são compartilhadas pelo grupo.
 * 2. Os dados de exemplo existentes devem ser preservados.
 * 3. No cadastros.controller.js, implementar as funções de produtos:
 *    listar, buscar por id, criar, editar e excluir.
 * 4. Fazer o mesmo para endereços.
 * 5. Criar as rotas da API para essas operações.
 * 6. Validar os dados enviados.
 * 7. Testar as rotas e a tela.
 * 8. A tela public/pages/cadastros.html deve conter formulários e tabelas.
 * 9. O arquivo public/js/cadastros.js deve chamar a API com fetch.
 * 10. Abrir Pull Request da branch Cadastros para a main.
 *
 * IMPORTANTE: não execute database/schema.sql por conta própria,
 * pois o banco é compartilhado com o grupo.
 */

const express = require('express');
const router = express.Router();
const controller = require('./cadastros.controller');

// Rotas de produtos
router.get('/produtos', controller.listarProdutos);
router.get('/produtos/:id', controller.buscarProduto);
router.post('/produtos', controller.criarProduto);
router.put('/produtos/:id', controller.editarProduto);
router.delete('/produtos/:id', controller.excluirProduto);

// Rotas de endereços
router.get('/enderecos', controller.listarEnderecos);
router.get('/enderecos/:id', controller.buscarEndereco);
router.post('/enderecos', controller.criarEndereco);
router.put('/enderecos/:id', controller.editarEndereco);
router.delete('/enderecos/:id', controller.excluirEndereco);

module.exports = router;
