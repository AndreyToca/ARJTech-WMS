
const express = require('express');
const router = express.Router();

const controller = require('./estoque.controller');

// Rotas deste módulo vão aqui (passo 5)
router.get('/', controller.listarEstoque);
router.get('/produto/:id', controller.saldoPorProduto);


module.exports = router;
