


// 1. Importar a ligação à base de dados
const db = require('../../config/db');

// 2. Criar a função de somar estoque
// conexao (opcional): passe a conexão de uma transação para a operação fazer parte dela
async function somarEstoque(produtoId, enderecoId, quantidade, conexao = db) {
    try {
        //Verificar se o produto já existe neste endereço
        const [linhas] = await conexao.execute(
            'SELECT quantidade FROM estoque WHERE produto_id = ? AND endereco_id = ?',
            [produtoId, enderecoId]
        );

        if (linhas.length > 0) {
            //O produto já existe. Fazer um UPDATE somando a quantidade.
            await conexao.execute(
                'UPDATE estoque SET quantidade = quantidade + ? WHERE produto_id = ? AND endereco_id = ?',
                [quantidade, produtoId, enderecoId]
            )
            
        } else {
            //O produto não existe neste endereço. Fazer um INSERT.
            await conexao.execute(
                'INSERT INTO estoque (produto_id, endereco_id, quantidade) VALUES ( ?, ?, ?)',
                [produtoId, enderecoId, quantidade]
            )
            
        }

        return { sucesso: true, mensagem: 'Estoque atualizado com sucesso.' };
    } catch (erro) {
        console.error('Erro ao somar estoque:', erro);
        throw erro; // Lança o erro para quem chamou a função poder tratar
    }
}

// 2.1. Criar a função de subtrair estoque
// conexao (opcional): passe a conexão de uma transação para a operação fazer parte dela
async function subtrairEstoque(produtoId, enderecoId, quantidade, conexao = db) {
    try {
        //Verificar se o produto já existe neste endereço
        const [linhas] = await conexao.execute(
            'SELECT quantidade FROM estoque WHERE produto_id = ? AND endereco_id = ?',
            [produtoId, enderecoId]
        );

        if (linhas.length > 0) {
            //O produto já existe. Fazer um UPDATE subtraindo a quantidade.

            //Definir a nova quantidade
            quantidade = linhas[0].quantidade - quantidade
            //Verificando se a quantidade vai ser suficiente
            if (quantidade >= 0) {
                await conexao.execute(
                    'UPDATE estoque SET quantidade = ? WHERE produto_id = ? AND endereco_id = ?',
                [quantidade, produtoId, enderecoId]
                )
            } else {
                    throw new Error('Estoque Insuficiente');
            }
            
        } else {
            //O produto não existe neste endereço.
            throw new Error('Produto não encontrado neste endereço');
        }

        return { sucesso: true, mensagem: 'Estoque atualizado com sucesso.' };
    } catch (erro) {
        console.error('Erro ao subtrair estoque:', erro);
        throw erro; // Lança o erro para quem chamou a função poder tratar
    }
}

// Colunas devolvidas pela listagem (inclui os valores: custo médio, preço de venda e valor total em estoque)
const SQL_ESTOQUE = `
    SELECT
        estoque.id,
        estoque.produto_id,
        estoque.endereco_id,
        estoque.quantidade,
        produtos.codigo,
        produtos.nome,
        produtos.unidade,
        enderecos.codigo AS endereco_codigo,
        produtos.custo_medio,
        produtos.preco_venda,
        ROUND(estoque.quantidade * produtos.custo_medio, 2) AS valor_total
    FROM estoque
    INNER JOIN produtos ON estoque.produto_id = produtos.id
    INNER JOIN enderecos ON estoque.endereco_id = enderecos.id`;

// 3. Criar a função de listar estoque
async function listarEstoque(req, res) {
    try {
        //listar produto, endereco e quantidade
        const [linhas] = await db.execute(
            SQL_ESTOQUE + ' ORDER BY produtos.nome, enderecos.codigo'
        );

        //envia o pedido
        res.json(linhas);

    } catch (erro) {
        console.error('Erro ao listar estoque:', erro);
        res.status(500).json({ erro: 'Erro interno ao buscar o estoque.' }); // Lança o erro para quem chamou a função poder tratar
    }
}

// 4. Criar a função de listar por produto
async function saldoPorProduto(req, res) {
    try {

        const { id } = req.params;
        //listar produto, endereco e quantidade
        const [linhas] = await db.execute(
            SQL_ESTOQUE + ' WHERE estoque.produto_id = ? ORDER BY enderecos.codigo',
            [id]
        );

        //envia o pedido
        res.json(linhas);

    } catch (erro) {
        console.error('Erro ao listar estoque:', erro);
        res.status(500).json({ erro: 'Erro interno ao buscar o estoque.' }); // Lança o erro para quem chamou a função poder tratar
    }
}

// 4. Exportar TODAS as funções no final do arquivo
module.exports = {
    somarEstoque,
    subtrairEstoque,
    listarEstoque,  
    saldoPorProduto
}

