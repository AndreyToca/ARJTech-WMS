/*
 * MÓDULO: RELATÓRIOS (DASHBOARD)  —  Responsável: ANDREY
 * Só leitura: não altera nenhuma tabela.
 */

const express = require('express');
const router = express.Router();
const controller = require('./relatorios.controller');

router.get('/dashboard', controller.dashboard);   // ?inicio=&fim=&cliente_id=
router.get('/painel', controller.painel);         // tela inicial (painel da operação)

module.exports = router;
