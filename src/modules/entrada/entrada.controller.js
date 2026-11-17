const db = require('../../config/db');
const { somarEstoque } = require('../estoque/estoque.controller');

// Valor máximo aceito para custo unitário (cabe no DECIMAL(14,4) do banco)
const VALOR_MAXIMO = 9999999999;

// Converte "12,50", "12.50" ou 12.5 em número >= 0; qualquer outra coisa vira null.
function valorMonetario(valor) {
    const texto = String(valor ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(texto)) return null;
    const n = Number(texto);
    return Number.isFinite(n) && n <= VALOR_MAXIMO ? n : null;
}

// Custo médio ponderado: (saldo atual × custo atual + quantidade nova × custo novo) / saldo final
function calcularCustoMedio(saldoAtual, custoAtual, quantidade, valorUnitario) {
    const saldoFinal = saldoAtual + quantidade;
    const custo = (saldoAtual * custoAtual + quantidade * valorUnitario) / saldoFinal;
    return Math.round(custo * 10000) / 10000; // 4 casas decimais, igual ao banco
}

async function registrarEntrada(req, res) {
    const { produto_id, endereco_id, quantidade, nota_fiscal, valor_unitario } = req.body || {};
    const usuario_id = req.userId || 1;

    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0) {
        return res.status(400).json({ erro: 'A quantidade deve ser um número inteiro maior que zero.' });
    }
    if (!produto_id || !endereco_id) {
        return res.status(400).json({ erro: 'Produto e Endereço são obrigatórios.' });
    }
    const valorUnitario = valorMonetario(valor_unitario);
    if (valorUnitario === null) {
        return res.status(400).json({ erro: 'Informe um valor unitário válido (maior ou igual a zero).' });
    }

    let conexao;
    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        // Trava o produto: duas entradas simultâneas do mesmo produto não calculam o custo ao mesmo tempo
        const [produtos] = await conexao.execute(
            'SELECT id, custo_medio FROM produtos WHERE id = ? FOR UPDATE',
            [produto_id]
        );
        if (produtos.length === 0) {
            await conexao.rollback();
            return res.status(400).json({ erro: 'Produto não encontrado.' });
        }

        // O custo médio é do produto, então considera o saldo em todos os endereços
        const [saldo] = await conexao.execute(
            'SELECT COALESCE(SUM(quantidade), 0) AS total FROM estoque WHERE produto_id = ?',
            [produto_id]
        );
        const novoCusto = calcularCustoMedio(
            Number(saldo[0].total),
            Number(produtos[0].custo_medio),
            qtd,
            valorUnitario
        );

        await conexao.execute(
            `INSERT INTO entradas (produto_id, endereco_id, quantidade, valor_unitario, nota_fiscal, data, usuario_id)
             VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
            [produto_id, endereco_id, qtd, valorUnitario, nota_fiscal || null, usuario_id]
        );

        await somarEstoque(produto_id, endereco_id, qtd, conexao);

        await conexao.execute(
            'UPDATE produtos SET custo_medio = ? WHERE id = ?',
            [novoCusto, produto_id]
        );

        await conexao.commit();
        return res.status(201).json({
            mensagem: 'Entrada registrada com sucesso!',
            custo_medio: novoCusto
        });
    } catch (error) {
        if (conexao) {
            try { await conexao.rollback(); } catch (e) { console.error('Falha no rollback:', e); }
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ erro: 'Endereço ou usuário não encontrado.' });
        }
        console.error('Erro ao registrar entrada:', error);
        return res.status(500).json({ erro: 'Erro interno do servidor ao registrar entrada.' });
    } finally {
        if (conexao) conexao.release();
    }
}

async function listarEntradas(req, res) {
    try {
        const querySelect = `
            SELECT
                e.id,
                e.produto_id,
                e.endereco_id,
                e.quantidade,
                e.valor_unitario,
                ROUND(e.quantidade * e.valor_unitario, 2) AS valor_total,
                e.nota_fiscal,
                e.data,
                p.nome AS produto_nome,
                en.codigo AS endereco_codigo
            FROM entradas e
            LEFT JOIN produtos p ON e.produto_id = p.id
            LEFT JOIN enderecos en ON e.endereco_id = en.id
            ORDER BY e.data DESC
        `;
        const [rows] = await db.execute(querySelect);
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Erro ao listar entradas:', error);
        return res.status(500).json({ erro: 'Erro interno ao listar entradas.' });
    }
}

module.exports = {
    registrarEntrada,
    listarEntradas
};
