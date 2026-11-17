
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

// Rotas de clientes
router.get('/clientes', controller.listarClientes);
router.get('/clientes/:id', controller.buscarCliente);
router.post('/clientes', controller.criarCliente);
router.put('/clientes/:id', controller.editarCliente);
router.delete('/clientes/:id', controller.excluirCliente);


module.exports = router;
