/*
 * CONTROLLER DE ENTRADA  —  Responsável: LUCAS
 *
 * POST /api/entrada              → uma entrada (formulário manual)
 * POST /api/entrada/lote         → todos os itens de uma nota fiscal numa transação só
 * GET  /api/entrada/nota/:chave  → valida a chave da NF-e e diz se a nota já foi lançada
 * GET  /api/entrada              → histórico
 *
 * Toda entrada soma no estoque e recalcula o custo médio do produto.
 */

const db = require('../../config/db');

// Valor máximo aceito para custo unitário (cabe no DECIMAL(14,4) do banco)
const VALOR_MAXIMO = 9999999999;
const MAX_ITENS_NOTA = 200;

class ErroEntrada extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

// Converte "12,50", "12.50" ou 12.5 em número >= 0; qualquer outra coisa vira null.
function valorMonetario(valor) {
    const texto = String(valor ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(texto)) return null;
    const n = Number(texto);
    return Number.isFinite(n) && n <= VALOR_MAXIMO ? n : null;
}

function inteiroPositivo(valor) {
    const texto = String(valor ?? '').trim();
    if (!/^\d+$/.test(texto)) return null;
    const n = Number(texto);
    return n > 0 && n <= 2147483647 ? n : null;
}

// Custo médio ponderado: (saldo atual × custo atual + quantidade nova × custo novo) / saldo final
function calcularCustoMedio(saldoAtual, custoAtual, quantidade, valorUnitario) {
    const saldoFinal = saldoAtual + quantidade;
    const custo = (saldoAtual * custoAtual + quantidade * valorUnitario) / saldoFinal;
    return Math.round(custo * 10000) / 10000; // 4 casas decimais, igual ao banco
}

// ---------- Chave de acesso da NF-e (44 dígitos) ----------
// Formato: cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1)
function chaveValida(chave) {
    if (!/^\d{44}$/.test(chave)) return false;
    let soma = 0;
    let peso = 2;
    for (let i = 42; i >= 0; i--) {
        soma += Number(chave[i]) * peso;
        peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    return dv === Number(chave[43]);
}

function lerChave(chave) {
    return {
        uf: chave.slice(0, 2),
        ano_mes: `20${chave.slice(2, 4)}-${chave.slice(4, 6)}`,
        cnpj_emitente: chave.slice(6, 20),
        modelo: chave.slice(20, 22),
        serie: Number(chave.slice(22, 25)),
        numero: Number(chave.slice(25, 34)),
    };
}

// Registra os itens de entrada dentro da transação aberta em "conexao".
// Feito em lote (cerca de 6 idas ao banco, com 1 ou 100 itens), porque o banco fica longe:
//   1. trava os produtos (FOR UPDATE) para que outra entrada não calcule o custo ao mesmo tempo;
//   2. lê o saldo atual de cada produto (todos os endereços);
//   3. calcula o custo médio em memória, item a item, na ordem da nota;
//   4. grava entradas, estoque e custo médio em consultas agrupadas.
// Devolve o custo médio final de cada produto.
async function registrarItens(conexao, itens, notaFiscal, usuarioId) {
    const idsProdutos = [...new Set(itens.map((i) => i.produtoId))];
    const marcas = idsProdutos.map(() => '?').join(',');

    const [produtos] = await conexao.query(
        `SELECT id, custo_medio FROM produtos WHERE id IN (${marcas}) FOR UPDATE`,
        idsProdutos
    );
    const faltando = idsProdutos.filter((id) => !produtos.some((p) => p.id === id));
    if (faltando.length) throw new ErroEntrada(400, `Produto(s) não encontrado(s): ${faltando.join(', ')}.`);

    const [saldos] = await conexao.query(
        `SELECT produto_id, COALESCE(SUM(quantidade), 0) AS total FROM estoque WHERE produto_id IN (${marcas}) GROUP BY produto_id`,
        idsProdutos
    );

    // Custo médio item a item (o mesmo produto pode aparecer mais de uma vez na nota)
    const situacao = new Map(produtos.map((p) => [p.id, { custo: Number(p.custo_medio), saldo: 0 }]));
    saldos.forEach((s) => { situacao.get(s.produto_id).saldo = Number(s.total); });
    itens.forEach((item) => {
        const atual = situacao.get(item.produtoId);
        atual.custo = calcularCustoMedio(atual.saldo, atual.custo, item.quantidade, item.valorUnitario);
        atual.saldo += item.quantidade;
    });

    // Entradas (uma linha por item). A data fica com o padrão do banco (CURRENT_TIMESTAMP), igual às demais.
    await conexao.query(
        'INSERT INTO entradas (produto_id, endereco_id, quantidade, valor_unitario, nota_fiscal, usuario_id) VALUES ?',
        [itens.map((i) => [i.produtoId, i.enderecoId, i.quantidade, i.valorUnitario, notaFiscal || null, usuarioId])]
    );

    // Estoque: soma por produto/endereço (cria a linha se ainda não existir)
    const somaPorPosicao = new Map();
    itens.forEach((i) => {
        const chave = `${i.produtoId}:${i.enderecoId}`;
        somaPorPosicao.set(chave, (somaPorPosicao.get(chave) || 0) + i.quantidade);
    });
    await conexao.query(
        'INSERT INTO estoque (produto_id, endereco_id, quantidade) VALUES ? ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)',
        [[...somaPorPosicao].map(([chave, qtd]) => [...chave.split(':').map(Number), qtd])]
    );

    // Custo médio final de cada produto
    const casos = idsProdutos.map(() => 'WHEN ? THEN ?').join(' ');
    await conexao.query(
        `UPDATE produtos SET custo_medio = CASE id ${casos} END WHERE id IN (${marcas})`,
        [...idsProdutos.flatMap((id) => [id, situacao.get(id).custo]), ...idsProdutos]
    );

    return idsProdutos.map((id) => ({ produto_id: id, custo_medio: situacao.get(id).custo }));
}

// Lê e valida um item vindo do corpo da requisição
function lerItem(bruto, posicao) {
    const prefixo = posicao ? `Item ${posicao}: ` : '';
    const produtoId = inteiroPositivo(bruto.produto_id);
    const enderecoId = inteiroPositivo(bruto.endereco_id);
    const quantidade = inteiroPositivo(bruto.quantidade);
    const valorUnitario = valorMonetario(bruto.valor_unitario);
    if (!produtoId || !enderecoId) throw new ErroEntrada(400, `${prefixo}produto e endereço são obrigatórios.`);
    if (!quantidade) throw new ErroEntrada(400, `${prefixo}a quantidade deve ser um número inteiro maior que zero.`);
    if (valorUnitario === null) throw new ErroEntrada(400, `${prefixo}informe um valor unitário válido (maior ou igual a zero).`);
    return { produtoId, enderecoId, quantidade, valorUnitario };
}

function usuarioDaRequisicao(req) {
    return req.userId || inteiroPositivo(req.body && req.body.usuario_id) || 1;
}

function responderErro(res, erro, acao) {
    if (erro instanceof ErroEntrada) return res.status(erro.status).json({ erro: erro.message });
    if (erro.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ erro: 'Produto, endereço ou usuário não encontrado.' });
    }
    console.error(`Erro ao ${acao}:`, erro);
    return res.status(500).json({ erro: `Erro interno do servidor ao ${acao}.` });
}

// POST /api/entrada — uma entrada (formulário manual)
async function registrarEntrada(req, res) {
    let item;
    try {
        item = lerItem(req.body || {});
    } catch (erro) {
        return responderErro(res, erro, 'registrar entrada');
    }
    const notaFiscal = String((req.body && req.body.nota_fiscal) || '').trim().slice(0, 50);

    let conexao;
    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();
        const [custo] = await registrarItens(conexao, [item], notaFiscal, usuarioDaRequisicao(req));
        await conexao.commit();
        return res.status(201).json({ mensagem: 'Entrada registrada com sucesso!', custo_medio: custo.custo_medio });
    } catch (erro) {
        if (conexao) {
            try { await conexao.rollback(); } catch (e) { console.error('Falha no rollback:', e); }
        }
        return responderErro(res, erro, 'registrar entrada');
    } finally {
        if (conexao) conexao.release();
    }
}

// POST /api/entrada/lote — todos os itens de uma nota numa transação só
// Corpo: { nota_fiscal: "<chave de 44 dígitos ou número>", usuario_id, itens: [{ produto_id, endereco_id, quantidade, valor_unitario }] }
// Se a mesma nota já foi lançada, recusa (409). Se qualquer item falhar, nada é gravado.
async function registrarLote(req, res) {
    const corpo = req.body || {};
    const notaFiscal = String(corpo.nota_fiscal || '').trim();
    let itens;
    try {
        if (!notaFiscal) throw new ErroEntrada(400, 'Informe a nota fiscal (chave de acesso ou número).');
        if (notaFiscal.length > 50) throw new ErroEntrada(400, 'Nota fiscal com mais de 50 caracteres.');
        if (/^\d{44}$/.test(notaFiscal) && !chaveValida(notaFiscal)) {
            throw new ErroEntrada(400, 'Chave de acesso inválida (dígito verificador não confere).');
        }
        if (!Array.isArray(corpo.itens) || corpo.itens.length === 0) throw new ErroEntrada(400, 'A nota não tem itens para lançar.');
        if (corpo.itens.length > MAX_ITENS_NOTA) throw new ErroEntrada(400, `Máximo de ${MAX_ITENS_NOTA} itens por nota.`);
        itens = corpo.itens.map((item, i) => lerItem(item || {}, i + 1));
    } catch (erro) {
        return responderErro(res, erro, 'lançar a nota');
    }

    let conexao;
    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [jaLancada] = await conexao.execute(
            'SELECT MIN(data) AS data, COUNT(*) AS itens FROM entradas WHERE nota_fiscal = ?',
            [notaFiscal]
        );
        if (Number(jaLancada[0].itens) > 0) {
            throw new ErroEntrada(409, `Esta nota já foi lançada em ${new Date(jaLancada[0].data).toLocaleString('pt-BR')} (${jaLancada[0].itens} item(ns)).`);
        }

        const custos = await registrarItens(conexao, itens, notaFiscal, usuarioDaRequisicao(req));

        await conexao.commit();
        const unidades = itens.reduce((t, i) => t + i.quantidade, 0);
        const valor = itens.reduce((t, i) => t + i.quantidade * i.valorUnitario, 0);
        return res.status(201).json({
            mensagem: `Nota lançada: ${itens.length} item(ns), ${unidades} unidade(s).`,
            itens: itens.length,
            unidades,
            valor: Math.round(valor * 100) / 100,
            custos,
        });
    } catch (erro) {
        if (conexao) {
            try { await conexao.rollback(); } catch (e) { console.error('Falha no rollback:', e); }
        }
        return responderErro(res, erro, 'lançar a nota');
    } finally {
        if (conexao) conexao.release();
    }
}

// GET /api/entrada/nota/:chave — confere a chave e se a nota já entrou no sistema
async function consultarNota(req, res) {
    const chave = String(req.params.chave || '').replace(/\D/g, '');
    if (chave.length !== 44) return res.status(400).json({ erro: 'A chave de acesso tem 44 números.' });
    if (!chaveValida(chave)) return res.status(400).json({ erro: 'Chave de acesso inválida (dígito verificador não confere). Bipe de novo.' });

    try {
        const dados = lerChave(chave);
        const [lancada] = await db.execute(
            'SELECT MIN(data) AS data, COUNT(*) AS itens FROM entradas WHERE nota_fiscal = ?',
            [chave]
        );
        // O emitente costuma ser o cliente dono da mercadoria (remessa para armazenagem)
        const [clientes] = await db.execute('SELECT id, nome FROM clientes WHERE documento = ?', [dados.cnpj_emitente]);
        return res.json({
            chave,
            ...dados,
            cliente: clientes[0] || null,
            lancada: Number(lancada[0].itens) > 0,
            lancada_em: lancada[0].data,
            itens_lancados: Number(lancada[0].itens),
        });
    } catch (erro) {
        return responderErro(res, erro, 'consultar a nota');
    }
}

// GET /api/entrada — histórico
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
                p.codigo AS produto_codigo,
                p.nome AS produto_nome,
                en.codigo AS endereco_codigo
            FROM entradas e
            LEFT JOIN produtos p ON e.produto_id = p.id
            LEFT JOIN enderecos en ON e.endereco_id = en.id
            ORDER BY e.data DESC, e.id DESC
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
    registrarLote,
    consultarNota,
    listarEntradas,
    chaveValida,
};
