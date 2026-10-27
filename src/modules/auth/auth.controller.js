/*
 * CONTROLLER DO LOGIN  —  Responsável: ANDREY
 * Aqui ficam as funções que conversam com o banco.
 *
 * Funções:
 * - login(req, res)     → confere email e senha e devolve o usuário
 * - (Extra) cadastrarUsuario(req, res) → cria um novo usuário
 *
 * Lembretes:
 * - Nunca devolva a senha na resposta.
 * - Sempre trate erros com try/catch e responda com status 500 se o banco falhar.
 */

const db = require('../../config/db');

// POST /api/auth/login
async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');

  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const [linhas] = await db.execute(
      'SELECT id, nome, email, senha, perfil FROM usuarios WHERE email = ?',
      [email]
    );

    // Mesma mensagem para e-mail inexistente e senha errada,
    // para não revelar quais e-mails estão cadastrados.
    // (Extra) Com bcrypt: trocar a comparação por await bcrypt.compare(senha, usuario.senha)
    const usuario = linhas[0];
    if (!usuario || usuario.senha !== senha) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }

    const { senha: _, ...usuarioSemSenha } = usuario;
    return res.json(usuarioSemSenha);
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Erro interno ao acessar o banco de dados.' });
  }
}

module.exports = { login };
