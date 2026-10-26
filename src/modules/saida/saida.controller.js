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

const db = require('../../config/db');
// Função do Felipe (módulo de estoque). Assinatura: subtrairEstoque(produtoId, enderecoId, quantidade, conexao?)
// O 4º parâmetro (conexao) depende da proposta de ajuste enviada ao Felipe — veja PROPOSTA-estoque.md.
const { subtrairEstoque } = require('../estoque/estoque.controller');

// Status que o banco aceita (ENUM da tabela saidas).
// Mapeamento adotado: "PENDENTE" -> 'pendente' e "EXPEDIDO" -> 'enviado'. 'separado' e 'cancelado' não são usados aqui.
const STATUS_VALIDOS = ['pendente', 'separado', 'enviado', 'cancelado'];
const STATUS_INICIAL = 'pendente';
const STATUS_EXPEDIDO = 'enviado';
const APELIDOS_STATUS = { expedido: 'enviado' };

// Mensagens que o módulo de estoque lança e que representam erro de regra de negócio (não é falha do servidor).
const ERROS_ESTOQUE = ['Estoque Insuficiente', 'Produto não encontrado neste endereço'];

// Erro de regra de negócio com código HTTP próprio.
class ErroNegocio extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

// Converte "5" ou 5 em número inteiro positivo; qualquer outra coisa vira null.
function inteiroPositivo(valor) {
    const texto = String(valor ?? '').trim();
    if (!/^\d+$/.test(texto)) return null;
    const n = Number(texto);
    return n > 0 && n <= 2147483647 ? n : null;
}

function responderErro(res, erro, acao) {
    if (erro instanceof ErroNegocio) {
        return res.status(erro.status).json({ erro: erro.message });
    }
    if (ERROS_ESTOQUE.includes(erro.message)) {
        return res.status(409).json({ erro: erro.message });
    }
    console.error(`Erro ao ${acao} pedido de saída:`, erro);
    return res.status(500).json({ erro: `Erro interno ao ${acao} o pedido.` });
}

// POST /api/saida  — registra o pedido como pendente (NÃO mexe no estoque)
async function criarPedido(req, res) {
    try {
        const { produto_id, endereco_id, quantidade, cliente, usuario_id } = req.body || {};

        const produtoId = inteiroPositivo(produto_id);
        const enderecoId = inteiroPositivo(endereco_id);
        const usuarioId = inteiroPositivo(usuario_id);
        const qtd = inteiroPositivo(quantidade);
        const nomeCliente = typeof cliente === 'string' ? cliente.trim() : '';

        if (!produtoId) return res.status(400).json({ erro: 'Produto inválido.' });
        if (!enderecoId) return res.status(400).json({ erro: 'Endereço inválido.' });
        if (!qtd) return res.status(400).json({ erro: 'A quantidade deve ser um número inteiro maior que zero.' });
        if (!nomeCliente) return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
        if (nomeCliente.length > 150) return res.status(400).json({ erro: 'O nome do cliente deve ter no máximo 150 caracteres.' });
        if (!usuarioId) return res.status(400).json({ erro: 'Usuário responsável inválido. Faça login novamente.' });

        // Confere se produto, endereço e usuário existem (respeita as chaves estrangeiras)
        const [produto] = await db.execute('SELECT id FROM produtos WHERE id = ?', [produtoId]);
        if (produto.length === 0) return res.status(400).json({ erro: 'Produto não encontrado.' });

        const [endereco] = await db.execute('SELECT id FROM enderecos WHERE id = ?', [enderecoId]);
        if (endereco.length === 0) return res.status(400).json({ erro: 'Endereço não encontrado.' });

        const [usuario] = await db.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
        if (usuario.length === 0) return res.status(400).json({ erro: 'Usuário não encontrado.' });

        const [resultado] = await db.execute(
            'INSERT INTO saidas (produto_id, endereco_id, quantidade, cliente, status, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
            [produtoId, enderecoId, qtd, nomeCliente, STATUS_INICIAL, usuarioId]
        );

        return res.status(201).json({ mensagem: 'Pedido criado com status pendente.', id: resultado.insertId });
    } catch (erro) {
        return responderErro(res, erro, 'criar');
    }
}

// PUT /api/saida/:id/expedir  — confere estoque, dá baixa e marca como expedido (tudo numa transação)
async function expedirPedido(req, res) {
    const id = inteiroPositivo(req.params.id);
    if (!id) return res.status(400).json({ erro: 'Id do pedido inválido.' });

    let conexao;
    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        // 1. Trava a linha do pedido: outra requisição para o mesmo pedido espera aqui
        const [pedidos] = await conexao.execute(
            'SELECT id, produto_id, endereco_id, quantidade, status FROM saidas WHERE id = ? FOR UPDATE',
            [id]
        );
        if (pedidos.length === 0) throw new ErroNegocio(404, 'Pedido não encontrado.');
        const pedido = pedidos[0];

        // 2. Só expede quem está pendente (evita expedir duas vezes)
        if (pedido.status === STATUS_EXPEDIDO) throw new ErroNegocio(409, 'Este pedido já foi expedido.');
        if (pedido.status !== STATUS_INICIAL) {
            throw new ErroNegocio(409, `Pedido com status "${pedido.status}" não pode ser expedido.`);
        }
        if (!Number.isInteger(pedido.quantidade) || pedido.quantidade <= 0) {
            throw new ErroNegocio(422, 'Quantidade do pedido inválida.');
        }

        // 3. Conferência do saldo (só para dar uma mensagem clara; a proteção real está na baixa atômica do estoque)
        const [saldo] = await conexao.execute(
            'SELECT quantidade FROM estoque WHERE produto_id = ? AND endereco_id = ?',
            [pedido.produto_id, pedido.endereco_id]
        );
        if (saldo.length === 0) {
            throw new ErroNegocio(409, 'Produto não encontrado neste endereço do estoque.');
        }
        if (saldo[0].quantidade < pedido.quantidade) {
            throw new ErroNegocio(409, `Estoque insuficiente: disponível ${saldo[0].quantidade}, solicitado ${pedido.quantidade}.`);
        }

        // 4. Baixa pelo módulo de estoque, na MESMA conexão/transação
        await subtrairEstoque(pedido.produto_id, pedido.endereco_id, pedido.quantidade, conexao);

        // 5. Marca como expedido (a condição status = 'pendente' é uma segunda trava)
        const [atualizacao] = await conexao.execute(
            'UPDATE saidas SET status = ? WHERE id = ? AND status = ?',
            [STATUS_EXPEDIDO, id, STATUS_INICIAL]
        );
        if (atualizacao.affectedRows !== 1) {
            throw new ErroNegocio(409, 'Não foi possível atualizar o pedido. Tente novamente.');
        }

        // 6. Tudo certo: confirma baixa e status juntos
        await conexao.commit();
        return res.json({ mensagem: 'Pedido expedido com sucesso.', id, status: STATUS_EXPEDIDO });
    } catch (erro) {
        // Qualquer falha desfaz tudo: estoque e status voltam ao que eram
        if (conexao) {
            try { await conexao.rollback(); } catch (e) { console.error('Falha no rollback:', e); }
        }
        return responderErro(res, erro, 'expedir');
    } finally {
        if (conexao) conexao.release();
    }
}

// GET /api/saida?status=pendente  — lista pedidos (filtro opcional)
async function listarPedidos(req, res) {
    try {
        let sql =
            'SELECT s.id, s.produto_id, p.codigo AS produto_codigo, p.nome AS produto_nome, p.unidade, ' +
            's.endereco_id, e.codigo AS endereco_codigo, s.quantidade, s.cliente, s.status, s.data, ' +
            's.usuario_id, u.nome AS usuario_nome ' +
            'FROM saidas s ' +
            'INNER JOIN produtos p ON s.produto_id = p.id ' +
            'INNER JOIN enderecos e ON s.endereco_id = e.id ' +
            'INNER JOIN usuarios u ON s.usuario_id = u.id';
        const parametros = [];

        const { status } = req.query;
        if (status !== undefined && status !== '') {
            const normalizado = typeof status === 'string' ? status.trim().toLowerCase() : '';
            const statusFiltro = APELIDOS_STATUS[normalizado] || normalizado;
            if (!STATUS_VALIDOS.includes(statusFiltro)) {
                return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}.` });
            }
            sql += ' WHERE s.status = ?';
            parametros.push(statusFiltro);
        }
        sql += ' ORDER BY s.data DESC, s.id DESC';

        const [linhas] = await db.execute(sql, parametros);
        return res.json(linhas);
    } catch (erro) {
        console.error('Erro ao listar pedidos de saída:', erro);
        return res.status(500).json({ erro: 'Erro interno ao listar os pedidos.' });
    }
}

module.exports = {
    criarPedido,
    expedirPedido,
    listarPedidos
};
