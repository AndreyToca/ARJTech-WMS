const express = require('express');
const router = express.Router();
const controller = require('./entrada.controller');

router.post('/', controller.registrarEntrada);
router.get('/', controller.listarEntradas);

module.exports = router;