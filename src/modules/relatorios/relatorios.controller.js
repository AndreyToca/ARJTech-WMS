/*
 * CONTROLLER DE RELATÓRIOS (DASHBOARD)  —  Responsável: ANDREY
 *
 * GET /api/relatorios/dashboard?inicio=AAAA-MM-DD&fim=AAAA-MM-DD&cliente_id=N
 *
 * Regras:
 * - "Venda" é um pedido de saída EXPEDIDO (status 'enviado').
 * - Receita = quantidade × preço unitário do pedido.
 * - Custo   = quantidade × custo médio gravado na expedição (NULL conta como 0).
 * - Lucro   = receita − custo.
 * - O mês do pedido é a data em que ele foi criado (saidas.data).
 */

const db = require('../../config/db');

const STATUS_VENDA = 'enviado';
const MAX_MESES = 36;

// "2026-11-17" -> Date (UTC) ou null
function dataValida(texto) {
    if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
    const data = new Date(texto + 'T00:00:00Z');
    return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto ? null : data;
}

const paraTexto = (data) => data.toISOString().slice(0, 10);

// Período padrão: do 1º dia de 11 meses atrás até hoje (12 meses)
function periodoPadrao() {
    const hoje = new Date();
    const fim = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 11, 1));
    return { inicio, fim };
}

// Lista "AAAA-MM" de todos os meses do período (para meses sem venda aparecerem com zero)
function mesesDoPeriodo(inicio, fim) {
    const meses = [];
    const atual = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
    while (atual <= fim && meses.length < MAX_MESES) {
        meses.push(paraTexto(atual).slice(0, 7));
        atual.setUTCMonth(atual.getUTCMonth() + 1);
    }
    return meses;
}

const numero = (valor) => Math.round(Number(valor || 0) * 100) / 100;

async function dashboard(req, res) {
    let conexao;
    try {
        let { inicio, fim } = periodoPadrao();

        if (req.query.inicio || req.query.fim) {
            const i = dataValida(req.query.inicio);
            const f = dataValida(req.query.fim);
            if (!i || !f) return res.status(400).json({ erro: 'Período inválido. Use datas no formato AAAA-MM-DD.' });
            if (i > f) return res.status(400).json({ erro: 'A data inicial deve ser anterior à final.' });
            inicio = i;
            fim = f;
        }

        // Filtro opcional por cliente (os pedidos guardam o nome do cliente)
        let nomeCliente = null;
        if (req.query.cliente_id) {
            const clienteId = Number(req.query.cliente_id);
            if (!Number.isInteger(clienteId) || clienteId <= 0) {
                return res.status(400).json({ erro: 'Cliente inválido.' });
            }
            const [clientes] = await db.execute('SELECT nome FROM clientes WHERE id = ?', [clienteId]);
            if (clientes.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });
            nomeCliente = clientes[0].nome;
        }

        // Condição comum a todas as consultas
        let filtro = 's.data >= ? AND s.data < DATE_ADD(?, INTERVAL 1 DAY)';
        const parametros = [paraTexto(inicio), paraTexto(fim)];
        if (nomeCliente) {
            filtro += ' AND s.cliente = ?';
            parametros.push(nomeCliente);
        }

        const RECEITA = 's.quantidade * s.preco_unitario';
        const CUSTO = 's.quantidade * COALESCE(s.custo_unitario, 0)';

        // Uma conexão só, consultas em sequência: o banco fica longe (TiDB em Tóquio)
        // e abrir várias conexões ao mesmo tempo pode estourar o tempo de conexão.
        conexao = await db.getConnection();

        // Vendas expedidas e pedidos pendentes numa consulta só
        const [resumo] = await conexao.execute(
            `SELECT COALESCE(SUM(s.status = ?), 0) AS pedidos,
                    COALESCE(SUM(CASE WHEN s.status = ? THEN s.quantidade END), 0) AS unidades,
                    COALESCE(SUM(CASE WHEN s.status = ? THEN ${RECEITA} END), 0) AS receita,
                    COALESCE(SUM(CASE WHEN s.status = ? THEN ${CUSTO} END), 0) AS custo,
                    COALESCE(SUM(s.status = 'pendente'), 0) AS pendentes,
                    COALESCE(SUM(CASE WHEN s.status = 'pendente' THEN ${RECEITA} END), 0) AS valor_pendente
             FROM saidas s
             WHERE ${filtro}`,
            [STATUS_VENDA, STATUS_VENDA, STATUS_VENDA, STATUS_VENDA, ...parametros]
        );
        const [mensal] = await conexao.execute(
            `SELECT DATE_FORMAT(s.data, '%Y-%m') AS mes,
                    COUNT(*) AS pedidos,
                    COALESCE(SUM(${RECEITA}), 0) AS receita,
                    COALESCE(SUM(${CUSTO}), 0) AS custo
             FROM saidas s
             WHERE s.status = ? AND ${filtro}
             GROUP BY DATE_FORMAT(s.data, '%Y-%m')`,
            [STATUS_VENDA, ...parametros]
        );
        const [produtos] = await conexao.execute(
            `SELECT p.id, p.codigo, p.nome, p.unidade,
                    SUM(s.quantidade) AS unidades,
                    COUNT(*) AS pedidos,
                    COALESCE(SUM(${RECEITA}), 0) AS receita,
                    COALESCE(SUM(${CUSTO}), 0) AS custo
             FROM saidas s
             INNER JOIN produtos p ON p.id = s.produto_id
             WHERE s.status = ? AND ${filtro}
             GROUP BY p.id, p.codigo, p.nome, p.unidade
             ORDER BY unidades DESC, receita DESC
             LIMIT 10`,
            [STATUS_VENDA, ...parametros]
        );
        const [clientes] = await conexao.execute(
            `SELECT s.cliente AS nome,
                    COUNT(*) AS pedidos,
                    COALESCE(SUM(s.quantidade), 0) AS unidades,
                    COALESCE(SUM(${RECEITA}), 0) AS receita,
                    COALESCE(SUM(${CUSTO}), 0) AS custo
             FROM saidas s
             WHERE s.status = ? AND ${filtro}
             GROUP BY s.cliente
             ORDER BY receita DESC, unidades DESC
             LIMIT 10`,
            [STATUS_VENDA, ...parametros]
        );

        const r = resumo[0];
        const receita = numero(r.receita);
        const custo = numero(r.custo);
        const lucro = numero(receita - custo);
        const pedidos = Number(r.pedidos);

        const porMes = new Map(mensal.map((m) => [m.mes, m]));
        const meses = mesesDoPeriodo(inicio, fim).map((mes) => {
            const m = porMes.get(mes);
            const receitaMes = numero(m?.receita);
            const custoMes = numero(m?.custo);
            return {
                mes,
                pedidos: Number(m?.pedidos || 0),
                receita: receitaMes,
                custo: custoMes,
                lucro: numero(receitaMes - custoMes),
            };
        });

        return res.json({
            periodo: { inicio: paraTexto(inicio), fim: paraTexto(fim), cliente: nomeCliente },
            resumo: {
                receita,
                custo,
                lucro,
                margem: receita > 0 ? Math.round((lucro / receita) * 1000) / 10 : null,
                pedidos,
                unidades: Number(r.unidades),
                ticket_medio: pedidos > 0 ? numero(receita / pedidos) : 0,
                pendentes: Number(r.pendentes),
                valor_pendente: numero(r.valor_pendente),
            },
            mensal: meses,
            produtos: produtos.map((p) => ({
                id: p.id,
                codigo: p.codigo,
                nome: p.nome,
                unidade: p.unidade,
                unidades: Number(p.unidades),
                pedidos: Number(p.pedidos),
                receita: numero(p.receita),
                lucro: numero(p.receita - p.custo),
            })),
            clientes: clientes.map((c) => ({
                nome: c.nome,
                pedidos: Number(c.pedidos),
                unidades: Number(c.unidades),
                receita: numero(c.receita),
                lucro: numero(c.receita - c.custo),
            })),
        });
    } catch (erro) {
        console.error('Erro ao montar o dashboard:', erro);
        const semConexao = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST'].includes(erro.code);
        return res.status(semConexao ? 503 : 500).json({
            erro: semConexao
                ? 'O banco de dados não respondeu a tempo. Tente de novo em instantes.'
                : 'Erro interno ao montar o dashboard.'
        });
    } finally {
        if (conexao) conexao.release();
    }
}

// ==================== Painel da operação ====================
// GET /api/relatorios/painel — tudo o que a tela inicial mostra, numa chamada só:
//   indicadores (pedidos a expedir, entradas de hoje, lucro do mês, alertas),
//   últimas movimentações (entradas e saídas) e alertas (saldo baixo, pedidos sem estoque, custo acima do preço).
const ESTOQUE_BAIXO = 10;
const DIAS_ATRASO = 2;

// "AAAA-MM-DD HH:MM:SS" em UTC (o banco guarda em UTC)
const utcSql = (data) => data.toISOString().slice(0, 19).replace('T', ' ');

async function painel(req, res) {
    let conexao;
    try {
        // "Hoje" e "este mês" no horário local do servidor, convertidos para UTC
        const agora = new Date();
        const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
        const limiteAtraso = new Date(agora.getTime() - DIAS_ATRASO * 24 * 3600 * 1000);

        conexao = await db.getConnection();

        const [[n]] = await conexao.query(
            `SELECT
               (SELECT COUNT(*) FROM saidas WHERE status = 'pendente') AS pend_pedidos,
               (SELECT COALESCE(SUM(quantidade * preco_unitario), 0) FROM saidas WHERE status = 'pendente') AS pend_valor,
               (SELECT COUNT(*) FROM saidas WHERE status = 'pendente' AND data < ?) AS pend_atrasados,
               (SELECT COUNT(*) FROM entradas WHERE data >= ?) AS ent_itens,
               (SELECT COUNT(DISTINCT COALESCE(nota_fiscal, CONCAT('#', id))) FROM entradas WHERE data >= ?) AS ent_notas,
               (SELECT COALESCE(SUM(quantidade), 0) FROM entradas WHERE data >= ?) AS ent_unidades,
               (SELECT COALESCE(SUM(quantidade * preco_unitario), 0) FROM saidas WHERE status = 'enviado' AND data >= ?) AS mes_receita,
               (SELECT COALESCE(SUM(quantidade * COALESCE(custo_unitario, 0)), 0) FROM saidas WHERE status = 'enviado' AND data >= ?) AS mes_custo,
               (SELECT COUNT(*) FROM saidas WHERE status = 'enviado' AND data >= ?) AS mes_pedidos`,
            [utcSql(limiteAtraso), utcSql(inicioDia), utcSql(inicioDia), utcSql(inicioDia), utcSql(inicioMes), utcSql(inicioMes), utcSql(inicioMes)]
        );

        // Últimas movimentações (entradas e saídas misturadas, mais recentes primeiro)
        const [movimentos] = await conexao.query(
            `(SELECT 'entrada' AS tipo, e.id, e.data, e.nota_fiscal AS documento, NULL AS status,
                     p.codigo, p.nome, p.unidade, en.codigo AS endereco, e.quantidade, u.nome AS usuario
              FROM entradas e
              JOIN produtos p ON p.id = e.produto_id
              JOIN enderecos en ON en.id = e.endereco_id
              JOIN usuarios u ON u.id = e.usuario_id
              ORDER BY e.data DESC, e.id DESC LIMIT 12)
             UNION ALL
             (SELECT 'saida' AS tipo, s.id, s.data, CAST(s.id AS CHAR) AS documento, s.status,
                     p.codigo, p.nome, p.unidade, en.codigo AS endereco, s.quantidade, u.nome AS usuario
              FROM saidas s
              JOIN produtos p ON p.id = s.produto_id
              JOIN enderecos en ON en.id = s.endereco_id
              JOIN usuarios u ON u.id = s.usuario_id
              ORDER BY s.data DESC, s.id DESC LIMIT 12)
             ORDER BY data DESC, id DESC
             LIMIT 12`
        );

        // Alertas 1: saldo baixo ou zerado
        const [baixos] = await conexao.query(
            `SELECT p.codigo, p.nome, p.unidade, en.codigo AS endereco, e.quantidade
             FROM estoque e
             JOIN produtos p ON p.id = e.produto_id
             JOIN enderecos en ON en.id = e.endereco_id
             WHERE e.quantidade < ?
             ORDER BY e.quantidade, p.codigo
             LIMIT 8`,
            [ESTOQUE_BAIXO]
        );

        // Alertas 2: pedidos pendentes que o estoque do endereço não cobre
        const [semEstoque] = await conexao.query(
            `SELECT p.codigo, p.nome, p.unidade, en.codigo AS endereco,
                    SUM(s.quantidade) AS pedido, COALESCE(MAX(e.quantidade), 0) AS saldo, COUNT(*) AS pedidos
             FROM saidas s
             JOIN produtos p ON p.id = s.produto_id
             JOIN enderecos en ON en.id = s.endereco_id
             LEFT JOIN estoque e ON e.produto_id = s.produto_id AND e.endereco_id = s.endereco_id
             WHERE s.status = 'pendente'
             GROUP BY p.codigo, p.nome, p.unidade, en.codigo
             HAVING SUM(s.quantidade) > COALESCE(MAX(e.quantidade), 0)
             ORDER BY (SUM(s.quantidade) - COALESCE(MAX(e.quantidade), 0)) DESC
             LIMIT 8`
        );

        // Alertas 3: custo médio acima do preço de venda (provável erro de lançamento ou preço desatualizado)
        const [custoAlto] = await conexao.query(
            `SELECT codigo, nome, custo_medio, preco_venda
             FROM produtos
             WHERE preco_venda > 0 AND custo_medio > preco_venda
             ORDER BY custo_medio / preco_venda DESC
             LIMIT 8`
        );

        const receita = numero(n.mes_receita);
        const custo = numero(n.mes_custo);
        return res.json({
            gerado_em: agora.toISOString(),
            indicadores: {
                pendentes: { pedidos: Number(n.pend_pedidos), valor: numero(n.pend_valor), atrasados: Number(n.pend_atrasados), dias_atraso: DIAS_ATRASO },
                entradas_hoje: { itens: Number(n.ent_itens), notas: Number(n.ent_notas), unidades: Number(n.ent_unidades) },
                mes: { receita, custo, lucro: numero(receita - custo), pedidos: Number(n.mes_pedidos) },
                alertas: baixos.length + semEstoque.length + custoAlto.length,
            },
            movimentacoes: movimentos.map((m) => ({
                tipo: m.tipo,
                id: m.id,
                data: m.data,
                documento: m.documento,
                status: m.status,
                codigo: m.codigo,
                nome: m.nome,
                unidade: m.unidade,
                endereco: m.endereco,
                quantidade: Number(m.quantidade),
                usuario: m.usuario,
            })),
            alertas: {
                saldo: baixos.map((b) => ({ ...b, quantidade: Number(b.quantidade), limite: ESTOQUE_BAIXO })),
                pedidos: semEstoque.map((x) => ({ ...x, pedido: Number(x.pedido), saldo: Number(x.saldo), pedidos: Number(x.pedidos) })),
                custo: custoAlto.map((c) => ({ ...c, custo_medio: Number(c.custo_medio), preco_venda: Number(c.preco_venda) })),
            },
        });
    } catch (erro) {
        console.error('Erro ao montar o painel:', erro);
        const semConexao = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST'].includes(erro.code);
        return res.status(semConexao ? 503 : 500).json({
            erro: semConexao ? 'O banco de dados não respondeu a tempo. Tente de novo em instantes.' : 'Erro interno ao montar o painel.'
        });
    } finally {
        if (conexao) conexao.release();
    }
}

module.exports = { dashboard, painel };
