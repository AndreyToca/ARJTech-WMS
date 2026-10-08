/*
 * CONTROLLER DE SAÍDA  —  Responsável: GABRIEL
 *
 * Funções a criar:
 * - criarPedido(req, res)   → salva o pedido como PENDENTE
 * - expedirPedido(req, res) → confere estoque, dá baixa e marca EXPEDIDO
 * - listarPedidos(req, res) → lista pedidos (filtro opcional por status)
 *
 * Lembretes:
 * - Use o arquivo src/config/db.js para acessar o banco.
 * - O estoque NUNCA pode ficar negativo.
 * - Para dar baixa, use a função exportada pelo módulo de estoque
 *   (não altere a tabela "estoque" direto daqui).
 * - Exporte as funções no final do arquivo.
 */
