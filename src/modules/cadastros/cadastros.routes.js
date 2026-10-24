<<<<<<< HEAD
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
=======

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
>>>>>>> origin/main
 */

const express = require('express');
const router = express.Router();
<<<<<<< HEAD
// const controller = require('./cadastros.controller');

// Rotas deste módulo vão aqui (passo 5)
=======
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
>>>>>>> origin/main

module.exports = router;
