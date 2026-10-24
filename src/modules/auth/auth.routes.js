/*
 * MÓDULO: LOGIN (AUTH)  —  Responsável: ANDREY
 * ------------------------------------------------------------
 * Objetivo: permitir que o usuário entre no sistema com e-mail e senha.
 *
 * PASSO A PASSO
 * 1. No database/schema.sql, criar a tabela "usuarios"
 *    (id, nome, email, senha, perfil). Combinar com o grupo antes.
 * 2. Inserir 1 usuário de teste direto no MySQL.
 * 3. No auth.controller.js, criar a função de LOGIN:
 *    - receber email e senha do corpo da requisição;
 *    - buscar o usuário pelo email no banco;
 *    - se não achar ou a senha não bater, responder erro 401;
 *    - se der certo, responder com os dados do usuário (sem a senha).
 * 4. Neste arquivo, ligar a rota  POST /api/auth/login  à função de login.
 * 5. Testar a rota no Postman/Insomnia antes de fazer a tela.
 * 6. Fazer a tela public/pages/login.html e o public/js/login.js.
 * 7. Depois de logar, guardar o usuário no navegador e mandar para o index.html.
 * 8. (Extra) Guardar a senha criptografada com a biblioteca bcrypt.
 * 9. Abrir Pull Request da branch "login" para a main.
 *
 * TAREFAS DE ORGANIZAÇÃO (também do Andrey)
 * - Criar o repositório no GitHub e adicionar os 4 colegas.
 * - Criar as Issues com as tarefas de cada um.
 * - Ajudar a juntar as partes na etapa de testes.
 */

const express = require('express');
const router = express.Router();
// const controller = require('./auth.controller');

// Rotas deste módulo vão aqui (passo 4)

module.exports = router;
