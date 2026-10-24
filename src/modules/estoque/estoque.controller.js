/*
 * CONTROLLER DE ESTOQUE  —  Responsável: FELIPE
 *
 * Funções usadas pelos colegas (fazer primeiro):
 * - somarEstoque(produtoId, enderecoId, quantidade)     → usada pela ENTRADA (Lucas)
 * - subtrairEstoque(produtoId, enderecoId, quantidade)  → usada pela SAÍDA (Gabriel)
 *   Obs.: essas duas NÃO recebem (req, res), são funções comuns.
 *
 * Funções das rotas:
 * - listarEstoque(req, res)
 * - saldoPorProduto(req, res)
 *
 * Lembretes:
 * - Use o arquivo src/config/db.js para acessar o banco.
 * - Se o produto ainda não existe naquele endereço, somar = criar a linha.
 * - subtrairEstoque deve dar erro se não houver quantidade suficiente.
 * - Exporte TODAS as funções no final do arquivo.
 */
