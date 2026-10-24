const db = require('../../config/db');
// const { somarEstoque } = require('../estoque/estoque.controller');

async function registrarEntrada(req, res) {
    try {
        const { produto_id, endereco_id, quantidade, nota_fiscal } = req.body;
        const usuario_id = req.userId || 1; 

        if (!quantidade || quantidade <= 0) {
            return res.status(400).json({ erro: 'A quantidade deve ser maior que zero.' });
        }
        if (!produto_id || !endereco_id) {
            return res.status(400).json({ erro: 'Produto e Endereço são obrigatórios.' });
        }

        const queryInsert = `
            INSERT INTO entradas (produto_id, endereco_id, quantidade, nota_fiscal, data, usuario_id) 
            VALUES (?, ?, ?, ?, NOW(), ?)
        `;
        await db.execute(queryInsert, [produto_id, endereco_id, quantidade, nota_fiscal, usuario_id]);

        // await somarEstoque(produto_id, endereco_id, quantidade);

        return res.status(201).json({ mensagem: 'Entrada registrada com sucesso!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ erro: 'Erro interno ao registrar entrada.' });
    }
}

async function listarEntradas(req, res) {
    try {
        const querySelect = `
            SELECT * FROM entradas 
            ORDER BY data DESC
        `;
        const [entradas] = await db.execute(querySelect);
        return res.status(200).json(entradas);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ erro: 'Erro ao buscar o histórico de entradas.' });
    }
}

module.exports = {
    registrarEntrada,
    listarEntradas
};