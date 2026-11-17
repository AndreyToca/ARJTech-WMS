

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

// Converte "12,50", "12.50" ou 12.5 em número >= 0 com até 2 casas; vazio vira 0; inválido vira null.
function precoValido(valor) {
  const texto = String(valor ?? '').trim().replace(',', '.');
  if (texto === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null;
  const n = Number(texto);
  return Number.isFinite(n) && n <= 9999999999 ? n : null;
}

// Valida o cliente dono do produto. Devolve { erro, status } ou { clienteId }.
async function clienteDoProduto(valor) {
  const clienteId = idValido(valor);
  if (!clienteId) {
    return { status: 400, erro: 'Selecione o cliente dono do produto.' };
  }
  const [clientes] = await db.execute('SELECT id FROM clientes WHERE id = ?', [clienteId]);
  if (clientes.length === 0) {
    return { status: 400, erro: 'Cliente não encontrado.' };
  }
  return { clienteId };
}

// Colunas do produto, já com o nome do cliente dono
const SQL_PRODUTO = `
  SELECT p.id, p.codigo, p.nome, p.unidade, p.custo_medio, p.preco_venda,
         p.cliente_id, c.nome AS cliente_nome
  FROM produtos p
  LEFT JOIN clientes c ON c.id = p.cliente_id`;

// ==================== PRODUTOS ====================

// GET /api/cadastros/produtos
async function listarProdutos(req, res) {
  try {
    const [produtos] = await db.execute(
      SQL_PRODUTO + ' ORDER BY p.id'
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
      SQL_PRODUTO + ' WHERE p.id = ?',
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

  const precoVenda = precoValido(req.body.preco_venda);
  if (precoVenda === null) {
    return res.status(400).json({
      erro: 'Preço de venda inválido (use um valor maior ou igual a zero, com até 2 casas).'
    });
  }

  try {
    const cliente = await clienteDoProduto(req.body.cliente_id);
    if (cliente.erro) return res.status(cliente.status).json({ erro: cliente.erro });

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
      'INSERT INTO produtos (codigo, nome, unidade, preco_venda, cliente_id) VALUES (?, ?, ?, ?, ?)',
      [codigo, nome, unidade, precoVenda, cliente.clienteId]
    );

    return res.status(201).json({
      mensagem: 'Produto cadastrado com sucesso.',
      id: resultado.insertId,
      codigo,
      nome,
      unidade,
      preco_venda: precoVenda,
      cliente_id: cliente.clienteId
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

  const precoVenda = precoValido(req.body.preco_venda);
  if (precoVenda === null) {
    return res.status(400).json({
      erro: 'Preço de venda inválido (use um valor maior ou igual a zero, com até 2 casas).'
    });
  }

  try {
    const cliente = await clienteDoProduto(req.body.cliente_id);
    if (cliente.erro) return res.status(cliente.status).json({ erro: cliente.erro });

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

    // A edição altera nome, unidade, preço de venda e cliente (o custo médio é calculado pelas entradas).
    await db.execute(
      `UPDATE produtos
       SET nome = ?, unidade = ?, preco_venda = ?, cliente_id = ?
       WHERE id = ?`,
      [nome, unidade, precoVenda, cliente.clienteId, id]
    );

    return res.json({
      mensagem: 'Produto atualizado com sucesso.',
      id,
      codigo,
      nome,
      unidade,
      preco_venda: precoVenda,
      cliente_id: cliente.clienteId
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

// ==================== CLIENTES ====================

const CAMPOS_CLIENTE = 'id, nome, documento, telefone, email, cidade';

// Lê e valida os campos do cliente. Devolve { erro } ou { dados }.
function lerCliente(corpo = {}) {
  const texto = (valor) => String(valor ?? '').trim();
  const nome = texto(corpo.nome);
  const documento = texto(corpo.documento).replace(/\D/g, ''); // guarda só os números
  const telefone = texto(corpo.telefone);
  const email = texto(corpo.email).toLowerCase();
  const cidade = texto(corpo.cidade);

  if (!nome) return { erro: 'O nome do cliente é obrigatório.' };
  if (nome.length > 150) return { erro: 'O nome deve ter no máximo 150 caracteres.' };
  if (documento && documento.length !== 11 && documento.length !== 14) {
    return { erro: 'Documento inválido: informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' };
  }
  if (telefone.length > 20) return { erro: 'O telefone deve ter no máximo 20 caracteres.' };
  if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { erro: 'E-mail inválido.' };
  }
  if (cidade.length > 100) return { erro: 'A cidade deve ter no máximo 100 caracteres.' };

  return {
    dados: {
      nome,
      documento: documento || null,
      telefone: telefone || null,
      email: email || null,
      cidade: cidade || null
    }
  };
}

function erroCliente(res, erro) {
  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Já existe um cliente com este CPF/CNPJ.' });
  }
  return erroBanco(res, erro);
}

// GET /api/cadastros/clientes
async function listarClientes(req, res) {
  try {
    const [clientes] = await db.execute(
      `SELECT c.id, c.nome, c.documento, c.telefone, c.email, c.cidade,
              (SELECT COUNT(*) FROM produtos p WHERE p.cliente_id = c.id) AS total_produtos
       FROM clientes c
       ORDER BY c.nome`
    );
    return res.json(clientes);
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// GET /api/cadastros/clientes/:id
async function buscarCliente(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });

  try {
    const [linhas] = await db.execute(
      `SELECT ${CAMPOS_CLIENTE} FROM clientes WHERE id = ?`,
      [id]
    );
    if (linhas.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    return res.json(linhas[0]);
  } catch (erro) {
    return erroBanco(res, erro);
  }
}

// POST /api/cadastros/clientes
async function criarCliente(req, res) {
  const { erro, dados } = lerCliente(req.body);
  if (erro) return res.status(400).json({ erro });

  try {
    const [resultado] = await db.execute(
      `INSERT INTO clientes (nome, documento, telefone, email, cidade)
       VALUES (?, ?, ?, ?, ?)`,
      [dados.nome, dados.documento, dados.telefone, dados.email, dados.cidade]
    );
    return res.status(201).json({
      mensagem: 'Cliente cadastrado com sucesso.',
      id: resultado.insertId,
      ...dados
    });
  } catch (erroBancoDados) {
    return erroCliente(res, erroBancoDados);
  }
}

// PUT /api/cadastros/clientes/:id
async function editarCliente(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });

  const { erro, dados } = lerCliente(req.body);
  if (erro) return res.status(400).json({ erro });

  try {
    const [resultado] = await db.execute(
      `UPDATE clientes
       SET nome = ?, documento = ?, telefone = ?, email = ?, cidade = ?
       WHERE id = ?`,
      [dados.nome, dados.documento, dados.telefone, dados.email, dados.cidade, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    return res.json({ mensagem: 'Cliente atualizado com sucesso.', id, ...dados });
  } catch (erroBancoDados) {
    return erroCliente(res, erroBancoDados);
  }
}

// DELETE /api/cadastros/clientes/:id
// Os pedidos de saída guardam o NOME do cliente, então excluir o cadastro não apaga o histórico.
async function excluirCliente(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });

  try {
    const [[uso]] = await db.execute(
      'SELECT COUNT(*) AS total FROM produtos WHERE cliente_id = ?',
      [id]
    );
    if (Number(uso.total) > 0) {
      return res.status(409).json({
        erro: `Não é possível excluir: o cliente tem ${uso.total} produto(s) cadastrado(s). Troque o cliente desses produtos antes.`
      });
    }

    const [resultado] = await db.execute('DELETE FROM clientes WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    return res.json({ mensagem: 'Cliente excluído com sucesso.' });
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
  excluirEndereco,
  listarClientes,
  buscarCliente,
  criarCliente,
  editarCliente,
  excluirCliente
};
