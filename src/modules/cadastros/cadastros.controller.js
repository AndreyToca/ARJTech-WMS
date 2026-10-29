
const db = require('../../config/db');

// Converte e valida IDs positivos
function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Trata erros de código duplicado
function erroBanco(res, erro) {
  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      erro: 'Este código já está cadastrado.'
    });
  }

  console.error(erro);
  return res.status(500).json({
    erro: 'Erro interno ao acessar o banco de dados.'
  });
}

// ==================== PRODUTOS ====================

// GET /api/cadastros/produtos
async function listarProdutos(req, res) {
  try {
    const [produtos] = await db.execute(
      'SELECT id, codigo, nome, unidade FROM produtos ORDER BY id'
    );
    return res.json(produtos);
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// GET /api/cadastros/produtos/:id
async function buscarProduto(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });

  try {
    const [linhas] = await db.execute(
      'SELECT id, codigo, nome, unidade FROM produtos WHERE id = ?',
      [id]
    );

    if (linhas.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    return res.json(linhas[0]);
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// POST /api/cadastros/produtos

async function criarProduto(req, res) {
  const nome = String(req.body.nome || '').trim();
  const unidade = String(req.body.unidade || '').trim();

  if (!nome || !unidade) {
    return res.status(400).json({
      erro: 'Nome e unidade sao obrigatorios.'
    });
  }

  if (nome.length > 150 || unidade.length > 10) {
    return res.status(400).json({
      erro: 'Um ou mais campos excedem o tamanho permitido.'
    });
  }

  try {
    // Busca os codigos automaticos que ja existem.
    const [produtos] = await db.execute(
      "SELECT codigo FROM produtos WHERE codigo REGEXP '^P[0-9]+$'"
    );

    let maiorNumero = 0;

    for (const produto of produtos) {
      const resultado = String(produto.codigo).match(/^P(\d+)$/i);

      if (resultado) {
        maiorNumero = Math.max(
          maiorNumero,
          Number(resultado[1])
        );
      }
    }

    // Procura o proximo codigo P disponivel.
    let numero = maiorNumero + 1;
    let codigo;

    while (true) {
      codigo = `P${String(numero).padStart(3, '0')}`;

      const [existentes] = await db.execute(
        'SELECT id FROM produtos WHERE codigo = ? LIMIT 1',
        [codigo]
      );

      if (existentes.length === 0) {
        break;
      }

      numero++;

      if (!Number.isSafeInteger(numero)) {
        return res.status(500).json({
          erro: 'Nao foi possivel gerar um codigo de produto.'
        });
      }
    }

    const [resultado] = await db.execute(
      'INSERT INTO produtos (codigo, nome, unidade) VALUES (?, ?, ?)',
      [codigo, nome, unidade]
    );

    return res.status(201).json({
      mensagem: 'Produto cadastrado com sucesso.',
      id: resultado.insertId,
      codigo,
      nome,
      unidade
    });
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// PUT /api/cadastros/produtos/:id

async function editarProduto(req, res) {
  const id = idValido(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  const nome = String(req.body.nome || '').trim();
  const unidade = String(req.body.unidade || '').trim();

  if (!nome || !unidade) {
    return res.status(400).json({
      erro: 'Nome e unidade são obrigatórios.'
    });
  }

  if (nome.length > 150 || unidade.length > 10) {
    return res.status(400).json({
      erro: 'Um ou mais campos excedem o tamanho permitido.'
    });
  }

  try {
    // Busca o produto para preservar seu código automático.
    const [produtos] = await db.execute(
      'SELECT id, codigo FROM produtos WHERE id = ?',
      [id]
    );

    if (produtos.length === 0) {
      return res.status(404).json({
        erro: 'Produto não encontrado.'
      });
    }

    const codigo = produtos[0].codigo;

    // A edição altera somente o nome e a unidade.
    await db.execute(
      `UPDATE produtos
       SET nome = ?, unidade = ?
       WHERE id = ?`,
      [nome, unidade, id]
    );

    return res.json({
      mensagem: 'Produto atualizado com sucesso.',
      id,
      codigo,
      nome,
      unidade
    });
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// DELETE /api/cadastros/produtos/:id
async function excluirProduto(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });

  try {
    const [produtos] = await db.execute(
      'SELECT id FROM produtos WHERE id = ?',
      [id]
    );

    if (produtos.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const [uso] = await db.execute(
      `SELECT
        (SELECT COUNT(*) FROM estoque WHERE produto_id = ?) +
        (SELECT COUNT(*) FROM entradas WHERE produto_id = ?) +
        (SELECT COUNT(*) FROM saidas WHERE produto_id = ?) AS total`,
      [id, id, id]
    );

    if (uso[0].total > 0) {
      return res.status(409).json({
        erro: 'Não é possível excluir: o produto está sendo usado no estoque ou em movimentações.'
      });
    }

    await db.execute('DELETE FROM produtos WHERE id = ?', [id]);

    return res.json({ mensagem: 'Produto excluído com sucesso.' });
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// ==================== ENDEREÇOS ====================

// GET /api/cadastros/enderecos
async function listarEnderecos(req, res) {
  try {
    const [enderecos] = await db.execute(
      'SELECT id, codigo, rua, prateleira, nivel FROM enderecos ORDER BY id'
    );
    return res.json(enderecos);
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// GET /api/cadastros/enderecos/:id
async function buscarEndereco(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });

  try {
    const [linhas] = await db.execute(
      `SELECT id, codigo, rua, prateleira, nivel
       FROM enderecos WHERE id = ?`,
      [id]
    );

    if (linhas.length === 0) {
      return res.status(404).json({ erro: 'Endereço não encontrado.' });
    }

    return res.json(linhas[0]);
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// POST /api/cadastros/enderecos

async function criarEndereco(req, res) {
  const rua = String(req.body.rua || '').trim().toUpperCase();
  const prateleira = String(req.body.prateleira || '').trim().toUpperCase();
  const nivel = String(req.body.nivel || '').trim().toUpperCase();

  if (!rua || !prateleira || !nivel) {
    return res.status(400).json({
      erro: 'Rua, prateleira e nível são obrigatórios.'
    });
  }

  if (
    rua.length > 10 ||
    prateleira.length > 10 ||
    nivel.length > 10
  ) {
    return res.status(400).json({
      erro: 'Rua, prateleira ou nível excedem o tamanho permitido.'
    });
  }

  // O código é gerado automaticamente pelo sistema.
  const codigo = `${rua}-${prateleira}-${nivel}`;

  if (codigo.length > 20) {
    return res.status(400).json({
      erro: 'O código gerado excede o tamanho permitido.'
    });
  }

  try {
    const [resultado] = await db.execute(
      `INSERT INTO enderecos (codigo, rua, prateleira, nivel)
       VALUES (?, ?, ?, ?)`,
      [codigo, rua, prateleira, nivel]
    );

    return res.status(201).json({
      mensagem: 'Endereço cadastrado com sucesso.',
      id: resultado.insertId,
      codigo,
      rua,
      prateleira,
      nivel
    });
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// PUT /api/cadastros/enderecos/:id

async function editarEndereco(req, res) {
  const id = idValido(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  const rua = String(req.body.rua || '').trim().toUpperCase();
  const prateleira = String(req.body.prateleira || '').trim().toUpperCase();
  const nivel = String(req.body.nivel || '').trim().toUpperCase();

  if (!rua || !prateleira || !nivel) {
    return res.status(400).json({
      erro: 'Rua, prateleira e nível são obrigatórios.'
    });
  }

  if (
    rua.length > 10 ||
    prateleira.length > 10 ||
    nivel.length > 10
  ) {
    return res.status(400).json({
      erro: 'Rua, prateleira ou nível excedem o tamanho permitido.'
    });
  }

  // Recalcula o código sempre que o endereço for editado.
  const codigo = `${rua}-${prateleira}-${nivel}`;

  if (codigo.length > 20) {
    return res.status(400).json({
      erro: 'O código gerado excede o tamanho permitido.'
    });
  }

  try {
    const [resultado] = await db.execute(
      `UPDATE enderecos
       SET codigo = ?, rua = ?, prateleira = ?, nivel = ?
       WHERE id = ?`,
      [codigo, rua, prateleira, nivel, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        erro: 'Endereço não encontrado.'
      });
    }

    return res.json({
      mensagem: 'Endereço atualizado com sucesso.',
      codigo,
      rua,
      prateleira,
      nivel
    });
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// DELETE /api/cadastros/enderecos/:id
async function excluirEndereco(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });

  try {
    const [enderecos] = await db.execute(
      'SELECT id FROM enderecos WHERE id = ?',
      [id]
    );

    if (enderecos.length === 0) {
      return res.status(404).json({ erro: 'Endereço não encontrado.' });
    }

    const [uso] = await db.execute(
      `SELECT
        (SELECT COUNT(*) FROM estoque WHERE endereco_id = ?) +
        (SELECT COUNT(*) FROM entradas WHERE endereco_id = ?) +
        (SELECT COUNT(*) FROM saidas WHERE endereco_id = ?) AS total`,
      [id, id, id]
    );

    if (uso[0].total > 0) {
      return res.status(409).json({
        erro: 'Não é possível excluir: o endereço está sendo usado no estoque ou em movimentações.'
      });
    }

    await db.execute('DELETE FROM enderecos WHERE id = ?', [id]);

    return res.json({ mensagem: 'Endereço excluído com sucesso.' });
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

module.exports = {
  listarProdutos,
  buscarProduto,
  criarProduto,
  editarProduto,
  excluirProduto,
  listarEnderecos,
  buscarEndereco,
  criarEndereco,
  editarEndereco,
  excluirEndereco
};
