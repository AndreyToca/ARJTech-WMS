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

// Converte "12,50", "12.50" ou 12.5 em número >= 0 com até 2 casas; qualquer outra coisa vira null.
function valorMonetario(valor) {
    const texto = String(valor ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null;
    const n = Number(texto);
    return Number.isFinite(n) && n <= 9999999999 ? n : null;
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
        const { produto_id, endereco_id, quantidade, cliente, cliente_id, usuario_id, preco_unitario } = req.body || {};

        const produtoId = inteiroPositivo(produto_id);
        const enderecoId = inteiroPositivo(endereco_id);
        const usuarioId = inteiroPositivo(usuario_id);
        const qtd = inteiroPositivo(quantidade);
        let nomeCliente = typeof cliente === 'string' ? cliente.trim() : '';
        const clienteInformado = cliente_id !== undefined && cliente_id !== null && cliente_id !== '';
        const clienteId = clienteInformado ? inteiroPositivo(cliente_id) : null;
        if (clienteInformado && !clienteId) return res.status(400).json({ erro: 'Cliente inválido.' });

        // Com cliente_id (tela de Saída), o nome vem do cadastro de clientes
        if (clienteId) {
            const [clientes] = await db.execute('SELECT nome FROM clientes WHERE id = ?', [clienteId]);
            if (clientes.length === 0) return res.status(400).json({ erro: 'Cliente não encontrado.' });
            nomeCliente = clientes[0].nome;
        }

        if (!produtoId) return res.status(400).json({ erro: 'Produto inválido.' });
        if (!enderecoId) return res.status(400).json({ erro: 'Endereço inválido.' });
        if (!qtd) return res.status(400).json({ erro: 'A quantidade deve ser um número inteiro maior que zero.' });
        if (!nomeCliente) return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
        if (nomeCliente.length > 150) return res.status(400).json({ erro: 'O nome do cliente deve ter no máximo 150 caracteres.' });
        if (!usuarioId) return res.status(400).json({ erro: 'Usuário responsável inválido. Faça login novamente.' });

        // Preço é opcional: se não vier, usa o preço de venda do cadastro do produto
        const precoInformado = preco_unitario !== undefined && preco_unitario !== null && preco_unitario !== '';
        const precoUnitario = precoInformado ? valorMonetario(preco_unitario) : null;
        if (precoInformado && precoUnitario === null) {
            return res.status(400).json({ erro: 'Preço unitário inválido (use um valor maior ou igual a zero, com até 2 casas).' });
        }

        // Confere se produto, endereço e usuário existem (respeita as chaves estrangeiras)
        const [produto] = await db.execute('SELECT id, preco_venda, cliente_id FROM produtos WHERE id = ?', [produtoId]);
        if (produto.length === 0) return res.status(400).json({ erro: 'Produto não encontrado.' });

        // O produto precisa pertencer ao cliente do pedido
        if (clienteId && produto[0].cliente_id !== null && Number(produto[0].cliente_id) !== clienteId) {
            return res.status(400).json({ erro: 'Este produto não pertence ao cliente selecionado.' });
        }
        const precoFinal = precoInformado ? precoUnitario : Number(produto[0].preco_venda);

        // Disponível = saldo do produto no endereço − o que já está prometido em pedidos pendentes ali
        const [[disp]] = await db.execute(
            `SELECT COALESCE((SELECT quantidade FROM estoque WHERE produto_id = ? AND endereco_id = ?), 0) AS saldo,
                    COALESCE((SELECT SUM(quantidade) FROM saidas WHERE status = 'pendente' AND produto_id = ? AND endereco_id = ?), 0) AS reservado`,
            [produtoId, enderecoId, produtoId, enderecoId]
        );
        const disponivel = Number(disp.saldo) - Number(disp.reservado);
        if (disponivel <= 0) {
            return res.status(409).json({ erro: 'Este produto não tem quantidade disponível neste endereço (o saldo já está em pedidos pendentes ou zerado).' });
        }
        if (qtd > disponivel) {
            return res.status(409).json({ erro: `Quantidade maior que a disponível neste endereço: disponível ${disponivel} (saldo ${Number(disp.saldo)}, ${Number(disp.reservado)} já em pedidos pendentes).` });
        }

        const [usuario] = await db.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
        if (usuario.length === 0) return res.status(400).json({ erro: 'Usuário não encontrado.' });

        const [resultado] = await db.execute(
            'INSERT INTO saidas (produto_id, endereco_id, quantidade, preco_unitario, cliente, status, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [produtoId, enderecoId, qtd, precoFinal, nomeCliente, STATUS_INICIAL, usuarioId]
        );

        return res.status(201).json({ mensagem: 'Pedido criado com status pendente.', id: resultado.insertId });
    } catch (erro) {
        return responderErro(res, erro, 'criar');
    }
}

// PUT /api/saida/:id/expedir  — confere estoque, dá baixa e marca como expedido (tudo numa transação)
// Corpo opcional: { "quantidade": N } para expedir só parte do pedido.
//   O pedido fica EXPEDIDO com N e o restante vira um NOVO pedido PENDENTE
//   (mesmo cliente, produto, endereço, preço e data). Sem corpo, expede tudo.
async function expedirPedido(req, res) {
    const id = inteiroPositivo(req.params.id);
    if (!id) return res.status(400).json({ erro: 'Id do pedido inválido.' });

    const qtdInformada = req.body && req.body.quantidade !== undefined && req.body.quantidade !== null && req.body.quantidade !== '';
    const qtdPedida = qtdInformada ? inteiroPositivo(req.body.quantidade) : null;
    if (qtdInformada && !qtdPedida) {
        return res.status(400).json({ erro: 'A quantidade a expedir deve ser um número inteiro maior que zero.' });
    }

    let conexao;
    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        // 1. Trava a linha do pedido (outra requisição para o mesmo pedido espera aqui)
        //    e já traz o custo médio do produto, numa ida só ao banco
        const [pedidos] = await conexao.execute(
            `SELECT s.id, s.produto_id, s.endereco_id, s.quantidade, s.status, s.preco_unitario,
                    s.cliente, s.data, s.usuario_id, p.custo_medio
             FROM saidas s
             INNER JOIN produtos p ON p.id = s.produto_id
             WHERE s.id = ?
             FOR UPDATE`,
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

        // Quanto expedir agora (padrão: o pedido inteiro)
        const qtdExpedir = qtdPedida || pedido.quantidade;
        if (qtdExpedir > pedido.quantidade) {
            throw new ErroNegocio(400, `Não dá para expedir ${qtdExpedir}: o pedido tem ${pedido.quantidade}.`);
        }
        const restante = pedido.quantidade - qtdExpedir;

        // 3. Baixa pelo módulo de estoque, na MESMA conexão/transação.
        //    A baixa é atômica (só acontece se houver saldo) e explica o motivo quando falha.
        try {
            await subtrairEstoque(pedido.produto_id, pedido.endereco_id, qtdExpedir, conexao);
        } catch (erroEstoque) {
            if (erroEstoque.message === 'Produto não encontrado neste endereço') {
                throw new ErroNegocio(409, 'Produto não encontrado neste endereço do estoque.');
            }
            if (erroEstoque.message === 'Estoque Insuficiente') {
                throw new ErroNegocio(409, `Estoque insuficiente: disponível ${erroEstoque.disponivel}, solicitado ${qtdExpedir}.`);
            }
            throw erroEstoque;
        }

        // 4. Custo médio do produto neste momento (custo da mercadoria vendida), lido junto com o pedido
        const custoUnitario = Number(pedido.custo_medio || 0);

        // 5. Marca como expedido (a condição status = 'pendente' é uma segunda trava)
        //    Na expedição parcial, o pedido passa a ter só a quantidade expedida
        const [atualizacao] = await conexao.execute(
            'UPDATE saidas SET status = ?, custo_unitario = ?, quantidade = ? WHERE id = ? AND status = ?',
            [STATUS_EXPEDIDO, custoUnitario, qtdExpedir, id, STATUS_INICIAL]
        );
        if (atualizacao.affectedRows !== 1) {
            throw new ErroNegocio(409, 'Não foi possível atualizar o pedido. Tente novamente.');
        }

        // 6. Expedição parcial: o que faltou vira um novo pedido pendente, igual ao original
        let novoPedidoId = null;
        if (restante > 0) {
            const [novo] = await conexao.execute(
                `INSERT INTO saidas (produto_id, endereco_id, quantidade, preco_unitario, cliente, status, data, usuario_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [pedido.produto_id, pedido.endereco_id, restante, pedido.preco_unitario,
                 pedido.cliente, STATUS_INICIAL, pedido.data, pedido.usuario_id]
            );
            novoPedidoId = novo.insertId;
        }

        // 7. Tudo certo: confirma baixa, status e o pedido do restante juntos
        await conexao.commit();
        return res.json({
            mensagem: restante > 0
                ? `Expedição parcial: ${qtdExpedir} expedido(s). Os ${restante} restantes ficaram no pedido nº ${novoPedidoId}.`
                : 'Pedido expedido com sucesso.',
            id,
            status: STATUS_EXPEDIDO,
            expedido: qtdExpedir,
            restante,
            novo_pedido_id: novoPedidoId
        });
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

// GET /api/saida?status=pendente  — lista pedidos
// Filtros opcionais (usados pelo Histórico de saídas):
//   inicio=AAAA-MM-DD, fim=AAAA-MM-DD, cliente_id=N, produto_id=N
async function listarPedidos(req, res) {
    try {
        let sql =
            'SELECT s.id, s.produto_id, p.codigo AS produto_codigo, p.nome AS produto_nome, p.unidade, ' +
            's.endereco_id, e.codigo AS endereco_codigo, s.quantidade, s.cliente, s.status, s.data, ' +
            's.preco_unitario, s.custo_unitario, ROUND(s.quantidade * s.preco_unitario, 2) AS valor_total, ' +
            'ROUND(s.quantidade * s.custo_unitario, 2) AS custo_total, ' +
            's.usuario_id, u.nome AS usuario_nome ' +
            'FROM saidas s ' +
            'INNER JOIN produtos p ON s.produto_id = p.id ' +
            'INNER JOIN enderecos e ON s.endereco_id = e.id ' +
            'INNER JOIN usuarios u ON s.usuario_id = u.id';
        const parametros = [];
        const condicoes = [];

        const { status, inicio, fim, cliente_id, produto_id } = req.query;
        if (status !== undefined && status !== '') {
            const normalizado = typeof status === 'string' ? status.trim().toLowerCase() : '';
            const statusFiltro = APELIDOS_STATUS[normalizado] || normalizado;
            if (!STATUS_VALIDOS.includes(statusFiltro)) {
                return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}.` });
            }
            condicoes.push('s.status = ?');
            parametros.push(statusFiltro);
        }

        const DATA = /^\d{4}-\d{2}-\d{2}$/;
        if (inicio) {
            if (!DATA.test(inicio)) return res.status(400).json({ erro: 'Data inicial inválida (use AAAA-MM-DD).' });
            condicoes.push('s.data >= ?');
            parametros.push(inicio);
        }
        if (fim) {
            if (!DATA.test(fim)) return res.status(400).json({ erro: 'Data final inválida (use AAAA-MM-DD).' });
            condicoes.push('s.data < DATE_ADD(?, INTERVAL 1 DAY)');
            parametros.push(fim);
        }

        if (cliente_id) {
            const clienteId = inteiroPositivo(cliente_id);
            if (!clienteId) return res.status(400).json({ erro: 'Cliente inválido.' });
            // Os pedidos guardam o nome do cliente
            condicoes.push('s.cliente = (SELECT c.nome FROM clientes c WHERE c.id = ?)');
            parametros.push(clienteId);
        }

        if (produto_id) {
            const produtoId = inteiroPositivo(produto_id);
            if (!produtoId) return res.status(400).json({ erro: 'Produto inválido.' });
            condicoes.push('s.produto_id = ?');
            parametros.push(produtoId);
        }

        if (condicoes.length) sql += ' WHERE ' + condicoes.join(' AND ');
        sql += ' ORDER BY s.data DESC, s.id DESC';

        const [linhas] = await db.execute(sql, parametros);
        return res.json(linhas);
    } catch (erro) {
        console.error('Erro ao listar pedidos de saída:', erro);
        return res.status(500).json({ erro: 'Erro interno ao listar os pedidos.' });
    }
}

// GET /api/saida/disponivel?cliente_id=N
// Produtos do cliente com quantidade disponível para saída, por endereço.
// Disponível = saldo no endereço − quantidade em pedidos pendentes desse produto/endereço.
async function listarDisponivel(req, res) {
    const clienteId = inteiroPositivo(req.query.cliente_id);
    if (!clienteId) return res.status(400).json({ erro: 'Informe o cliente.' });
    try {
        const [linhas] = await db.execute(
            `SELECT e.produto_id, p.codigo, p.nome, p.unidade, p.preco_venda,
                    e.endereco_id, en.codigo AS endereco_codigo,
                    e.quantidade AS saldo, COALESCE(r.reservado, 0) AS reservado,
                    e.quantidade - COALESCE(r.reservado, 0) AS disponivel
             FROM estoque e
             INNER JOIN produtos p ON p.id = e.produto_id
             INNER JOIN enderecos en ON en.id = e.endereco_id
             LEFT JOIN (
                 SELECT produto_id, endereco_id, SUM(quantidade) AS reservado
                 FROM saidas WHERE status = 'pendente'
                 GROUP BY produto_id, endereco_id
             ) r ON r.produto_id = e.produto_id AND r.endereco_id = e.endereco_id
             WHERE p.cliente_id = ? AND e.quantidade - COALESCE(r.reservado, 0) > 0
             ORDER BY p.codigo, disponivel DESC`,
            [clienteId]
        );
        return res.json(linhas.map((l) => ({
            ...l,
            saldo: Number(l.saldo),
            reservado: Number(l.reservado),
            disponivel: Number(l.disponivel),
        })));
    } catch (erro) {
        console.error('Erro ao listar disponível para saída:', erro);
        return res.status(500).json({ erro: 'Erro interno ao consultar o disponível.' });
    }
}

module.exports = {
    criarPedido,
    expedirPedido,
    listarPedidos,
    listarDisponivel
};
