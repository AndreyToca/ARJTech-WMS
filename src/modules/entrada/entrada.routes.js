const express = require('express');
const router = express.Router();
const controller = require('./entrada.controller');

router.post('/', controller.registrarEntrada);             // uma entrada (formulário)
router.post('/lote', controller.registrarLote);            // todos os itens de uma nota fiscal
router.get('/nota/:chave', controller.consultarNota);      // valida a chave e diz se já foi lançada
router.get('/', controller.listarEntradas);                // histórico

module.exports = router;
