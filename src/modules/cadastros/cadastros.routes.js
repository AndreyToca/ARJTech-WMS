/*
 * MÓDULO: CADASTROS  —  Responsável: YGOR
 * ------------------------------------------------------------
 * Objetivo: cadastrar PRODUTOS e ENDEREÇOS do armazém
 * (ex.: endereço "A-02-03" = Rua A, Prateleira 2, Nível 3).
 * Os outros módulos dependem deste, então ele é o primeiro a ficar pronto.
 *
 * PASSO A PASSO
 * 1. No database/schema.sql, criar as tabelas:
 *    - "produtos"  (id, codigo, nome, unidade)
 *    - "enderecos" (id, codigo, rua, prateleira, nivel)
 * 2. Inserir alguns produtos e endereços de exemplo para o grupo testar.
 * 3. No cadastros.controller.js, criar as funções de PRODUTOS:
 *    listar, buscar por id, criar, editar e excluir.
 * 4. Fazer o mesmo para ENDEREÇOS.
 * 5. Neste arquivo, criar as rotas:
 *    GET / POST            /api/cadastros/produtos
 *    GET / PUT / DELETE    /api/cadastros/produtos/:id
 *    (e as mesmas para /api/cadastros/enderecos)
 * 6. Validar: código do produto não pode repetir; nome é obrigatório.
 * 7. Testar todas as rotas no Postman/Insomnia.
 * 8. Fazer a tela public/pages/cadastros.html com:
 *    formulário de cadastro + tabela listando os itens.
 * 9. No public/js/cadastros.js, chamar a API com fetch e preencher a tabela.
 * 10. Abrir Pull Request da branch "cadastros" para a main.
 */

const express = require('express');
const router = express.Router();
// const controller = require('./cadastros.controller');

// Rotas deste módulo vão aqui (passo 5)

module.exports = router;
