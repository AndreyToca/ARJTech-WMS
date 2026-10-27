/*
 * LÓGICA DA TELA: login  —  Responsável: ANDREY
 *
 * PASSO A PASSO
 * 1. Pegar o formulário e escutar o evento de envio (submit).
 * 2. Ler e-mail e senha digitados.
 * 3. Enviar para POST /api/auth/login.
 * 4. Se der erro, mostrar a mensagem na tela.
 * 5. Se der certo, guardar o usuário no localStorage e ir para /index.html.
 *
 * Dica: use fetch('/api/...') para chamar o servidor e
 * async/await para esperar a resposta.
 */

// Já está logado? Vai direto para o menu.
if (localStorage.getItem('usuario')) {
  window.location.replace('/index.html');
}

const form = document.getElementById('form-login');
const mensagemErro = document.getElementById('mensagem-erro');
const botao = form.querySelector('button[type="submit"]');
const rotulo = botao.querySelector('.rotulo');
const botaoOlho = document.getElementById('mostrar-senha');

function mostrarErro(texto) {
  mensagemErro.textContent = texto;
  mensagemErro.hidden = false;
  // remove e recoloca a classe para a animação de "tremer" rodar de novo
  form.classList.remove('tremer');
  void form.offsetWidth;
  form.classList.add('tremer');
}

// Botão do "olho": alterna entre mostrar e esconder a senha
botaoOlho.addEventListener('click', () => {
  const mostrar = form.senha.type === 'password';
  form.senha.type = mostrar ? 'text' : 'password';
  botaoOlho.setAttribute('aria-pressed', mostrar);
  botaoOlho.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // impede o navegador de recarregar a página
  mensagemErro.hidden = true;
  botao.disabled = true;
  botao.classList.add('carregando');
  rotulo.textContent = 'Entrando...';

  const email = form.email.value.trim();
  const senha = form.senha.value;
  let entrou = false;

  try {
    const resposta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarErro(dados.erro || 'Não foi possível entrar.');
      return;
    }

    // Os outros módulos leem esta chave para saber quem está logado (usuario_id)
    localStorage.setItem('usuario', JSON.stringify(dados));
    entrou = true;

    // Mostra a confirmação por um instante antes de ir para o menu
    botao.classList.remove('carregando');
    botao.classList.add('sucesso');
    rotulo.textContent = `Bem-vindo, ${dados.nome}!`;
    setTimeout(() => { window.location.href = '/index.html'; }, 700);
  } catch {
    mostrarErro('Não foi possível conectar ao servidor.');
  } finally {
    // Se entrou, o botão fica travado até trocar de página
    if (!entrou) {
      botao.disabled = false;
      botao.classList.remove('carregando');
      rotulo.textContent = 'Entrar';
    }
  }
});
