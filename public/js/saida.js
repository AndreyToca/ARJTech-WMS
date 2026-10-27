/*
 * LÓGICA DA TELA: saida  —  Responsável: GABRIEL
 *
 * PASSO A PASSO
 * 1. Ao abrir a página, carregar o select de produtos (rota do Ygor).
 * 2. Carregar a tabela de pedidos com GET /api/saida.
 * 3. No "Criar pedido", enviar POST /api/saida e recarregar a tabela.
 * 4. No "Expedir", enviar PUT /api/saida/:id/expedir.
 * 5. Se não houver estoque, mostrar a mensagem de erro que a API devolver.
 * 6. Fazer o filtro por status funcionar.
 *
 * Dica: use fetch('/api/...') para chamar o servidor e
 * async/await para esperar a resposta.
 */
const API_SAIDA = '/api/saida';
const $ = (id) => document.getElementById(id);

const ROTULO_STATUS = {
  pendente: 'Pendente',
  separado: 'Separado',
  enviado: 'Expedido',
  cancelado: 'Cancelado'
};

function usuarioLogado() {
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    return usuario && Number.isInteger(Number(usuario.id)) && Number(usuario.id) > 0
      ? usuario
      : null;
  } catch {
    return null;
  }
}

function mostrarMensagem(texto, tipo) {
  const caixa = $('mensagem');
  caixa.textContent = texto;
  caixa.className = 'msg ' + tipo;
}

async function chamarApi(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  let dados = null;

  try {
    dados = await resposta.json();
  } catch {}

  if (!resposta.ok) {
    throw new Error(
      (dados && dados.erro) || `Erro do servidor (${resposta.status}).`
    );
  }

  return dados;
}

function preencherSelect(select, itens, rotulo) {
  select.innerHTML = '';

  const opcaoInicial = document.createElement('option');
  opcaoInicial.value = '';
  opcaoInicial.textContent = 'Selecione...';
  select.appendChild(opcaoInicial);

  itens.forEach((item) => {
    const opcao = document.createElement('option');
    opcao.value = item.id;
    opcao.textContent = rotulo(item);
    select.appendChild(opcao);
  });
}

async function carregarSelects() {
  try {
    const [produtos, enderecos] = await Promise.all([
      chamarApi('/api/cadastros/produtos'),
      chamarApi('/api/cadastros/enderecos')
    ]);

    preencherSelect(
      $('produto'),
      produtos,
      (p) => `${p.codigo ? p.codigo + ' - ' : ''}${p.nome}`
    );

    preencherSelect($('endereco'), enderecos, (e) => e.codigo);
  } catch (erro) {
    mostrarMensagem(
      'Não foi possível carregar produtos e endereços: ' + erro.message,
      'erro'
    );
  }
}

function celula(linha, texto) {
  const td = document.createElement('td');
  td.textContent = texto == null ? '' : String(texto);
  linha.appendChild(td);
  return td;
}

async function carregarPedidos() {
  const corpo = $('tabela-pedidos');

  try {
    const status = $('filtro-status').value;
    const url = status
      ? `${API_SAIDA}?status=${encodeURIComponent(status)}`
      : API_SAIDA;

    const pedidos = await chamarApi(url);
    corpo.innerHTML = '';

    if (!Array.isArray(pedidos)) {
      throw new Error('A API não retornou uma lista de pedidos.');
    }

    if (pedidos.length === 0) {
      const linha = document.createElement('tr');
      const td = celula(linha, 'Nenhum pedido encontrado.');
      td.colSpan = 8;
      corpo.appendChild(linha);
      return;
    }

    pedidos.forEach((pedido) => {
      const linha = document.createElement('tr');

      celula(linha, pedido.id);
      celula(linha, pedido.produto_nome);
      celula(linha, pedido.endereco_codigo);
      celula(linha, `${pedido.quantidade} ${pedido.unidade || ''}`.trim());
      celula(linha, pedido.cliente);
      celula(linha, ROTULO_STATUS[pedido.status] || pedido.status);

      const data = pedido.data ? new Date(pedido.data).toLocaleString('pt-BR') : '';
      celula(linha, data);

      const acao = celula(linha, '');

      if (pedido.status === 'pendente') {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.textContent = 'Expedir';
        botao.addEventListener('click', () => expedir(pedido.id, botao));
        acao.appendChild(botao);
      }

      corpo.appendChild(linha);
    });
  } catch (erro) {
    mostrarMensagem('Não foi possível carregar os pedidos: ' + erro.message, 'erro');
  }
}

async function expedir(id, botao) {
  botao.disabled = true;

  try {
    const dados = await chamarApi(`${API_SAIDA}/${id}/expedir`, {
      method: 'PUT'
    });

    mostrarMensagem(dados.mensagem || 'Pedido expedido com sucesso.', 'sucesso');
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    await carregarPedidos();
  }
}

async function criarPedido(evento) {
  evento.preventDefault();

  const usuario = usuarioLogado();
  const produto = $('produto').value;
  const endereco = $('endereco').value;
  const quantidade = Number($('quantidade').value);
  const cliente = $('cliente').value.trim();

  if (!usuario) {
    mostrarMensagem('Faça login antes de criar um pedido.', 'erro');
    return;
  }

  if (!produto) {
    mostrarMensagem('Selecione um produto.', 'erro');
    return;
  }

  if (!endereco) {
    mostrarMensagem('Selecione um endereço.', 'erro');
    return;
  }

  if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
    mostrarMensagem('Informe uma quantidade inteira maior que zero.', 'erro');
    return;
  }

  if (!cliente) {
    mostrarMensagem('Informe o nome do cliente.', 'erro');
    return;
  }

  const botao = $('btn-criar');
  botao.disabled = true;

  try {
    const dados = await chamarApi(API_SAIDA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produto_id: Number(produto),
        endereco_id: Number(endereco),
        quantidade,
        cliente,
        usuario_id: Number(usuario.id)
      })
    });

    mostrarMensagem(
      `${dados.mensagem || 'Pedido criado.'} (nº ${dados.id})`,
      'sucesso'
    );

    $('quantidade').value = '';
    $('cliente').value = '';

    await carregarPedidos();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
}

function iniciar() {
  const usuario = usuarioLogado();

  $('usuario-info').textContent = usuario
    ? 'Usuário responsável: ' + (usuario.nome || 'id ' + usuario.id)
    : 'Nenhum usuário logado. Faça login para criar pedidos.';

  $('form-pedido').addEventListener('submit', criarPedido);
  $('filtro-status').addEventListener('change', carregarPedidos);

  carregarSelects();
  carregarPedidos();
}

document.addEventListener('DOMContentLoaded', iniciar);
