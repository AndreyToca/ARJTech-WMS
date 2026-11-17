/*
 * LÓGICA DA TELA: saida  —  Responsável: GABRIEL
 *
 * PASSO A PASSO
 * 1. Ao abrir a página, carregar clientes, produtos e endereços (rotas do Ygor).
 *    Ao escolher o cliente, o select de produtos mostra só os produtos dele.
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

// Cor do status, igual ao Painel (verde = ok, âmbar = atenção, vermelho = problema)
const COR_STATUS = {
  pendente: 'atencao',
  separado: 'neutro',
  enviado: 'ok',
  cancelado: 'problema'
};

// Guarda os produtos para preencher o preço de venda ao escolher um item
let produtosCarregados = [];

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  caixa.className = 'aviso ' + tipo;
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
    const [clientes, produtos, enderecos] = await Promise.all([
      chamarApi('/api/cadastros/clientes'),
      chamarApi('/api/cadastros/produtos'),
      chamarApi('/api/cadastros/enderecos')
    ]);

    produtosCarregados = produtos;

    preencherSelect(
      $('cliente'),
      clientes,
      (c) => c.cidade ? `${c.nome} (${c.cidade})` : c.nome
    );
    preencherSelect($('endereco'), enderecos, (e) => e.codigo);
    filtrarProdutosDoCliente();
  } catch (erro) {
    mostrarMensagem(
      'Não foi possível carregar clientes, produtos e endereços: ' + erro.message,
      'erro'
    );
  }
}

// Mostra no select de produtos só os produtos do cliente escolhido
function filtrarProdutosDoCliente() {
  const clienteId = $('cliente').value;
  const select = $('produto');

  if (!clienteId) {
    select.innerHTML = '<option value="">Escolha o cliente primeiro</option>';
    select.disabled = true;
    preencherPreco();
    return;
  }

  const doCliente = produtosCarregados.filter((p) => String(p.cliente_id) === clienteId);

  if (doCliente.length === 0) {
    select.innerHTML = '<option value="">Este cliente não tem produtos</option>';
    select.disabled = true;
  } else {
    preencherSelect(select, doCliente, (p) => `${p.codigo ? p.codigo + ' - ' : ''}${p.nome}`);
    select.disabled = false;
    // Só um produto: já deixa escolhido
    if (doCliente.length === 1) select.value = String(doCliente[0].id);
  }
  preencherPreco();
}

function celula(linha, texto, classe) {
  const td = document.createElement('td');
  if (classe) td.className = classe;
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
      const td = celula(linha, 'Nenhum pedido encontrado.', 'vazio');
      td.colSpan = 11;
      corpo.appendChild(linha);
      return;
    }

    pedidos.forEach((pedido) => {
      const linha = document.createElement('tr');

      celula(linha, pedido.id, 'secundario');
      celula(linha, pedido.produto_nome, 'descricao');
      celula(linha, pedido.endereco_codigo, 'cod');

      const qtd = celula(linha, pedido.quantidade, 'num');
      if (pedido.unidade) {
        const unidade = document.createElement('span');
        unidade.className = 'unidade';
        unidade.textContent = pedido.unidade.toLowerCase();
        qtd.appendChild(unidade);
      }

      celula(linha, formatarMoeda(pedido.preco_unitario), 'num');
      celula(linha, formatarMoeda(pedido.valor_total), 'num');

      // Margem só existe depois de expedido (quando o custo é gravado)
      if (pedido.custo_total == null) {
        celula(linha, '-', 'num secundario');
      } else {
        const margem = Number(pedido.valor_total) - Number(pedido.custo_total);
        celula(linha, formatarMoeda(margem), margem < 0 ? 'num valor-problema' : 'num valor-ok');
      }

      celula(linha, pedido.cliente);

      const status = celula(linha, '');
      const etiqueta = document.createElement('span');
      etiqueta.className = 'estado ' + (COR_STATUS[pedido.status] || 'neutro');
      const ponto = document.createElement('span');
      ponto.className = 'status-ponto';
      etiqueta.append(ponto, ROTULO_STATUS[pedido.status] || pedido.status);
      status.appendChild(etiqueta);

      const data = pedido.data ? new Date(pedido.data).toLocaleString('pt-BR') : '';
      celula(linha, data, 'secundario');

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
    corpo.innerHTML = '';
    const linha = document.createElement('tr');
    celula(linha, 'Não foi possível carregar os pedidos.', 'vazio').colSpan = 11;
    corpo.appendChild(linha);
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
  const clienteId = $('cliente').value;
  const preco = $('preco').value.trim();

  if (!usuario) {
    mostrarMensagem('Faça login antes de criar um pedido.', 'erro');
    return;
  }

  if (!clienteId) {
    mostrarMensagem('Selecione o cliente.', 'erro');
    return;
  }

  if (!produto) {
    mostrarMensagem('Selecione um produto do cliente.', 'erro');
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

  if (preco !== '' && !(Number(preco) >= 0)) {
    mostrarMensagem('Informe um preço unitário maior ou igual a zero.', 'erro');
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
        cliente_id: Number(clienteId),
        usuario_id: Number(usuario.id),
        // vazio = o servidor usa o preço de venda do cadastro
        preco_unitario: preco === '' ? undefined : preco
      })
    });

    mostrarMensagem(
      `${dados.mensagem || 'Pedido criado.'} (nº ${dados.id})`,
      'sucesso'
    );

    // Mantém cliente e produto escolhidos para agilizar o próximo pedido
    $('quantidade').value = '';
    preencherPreco();

    await carregarPedidos();
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
}

// Ao escolher o produto, sugere o preço de venda do cadastro (pode ser alterado)
function preencherPreco() {
  const produto = produtosCarregados.find((p) => String(p.id) === $('produto').value);
  $('preco').value = produto ? Number(produto.preco_venda || 0).toFixed(2) : '';
}

function iniciar() {
  const usuario = usuarioLogado();

  $('usuario-info').textContent = usuario
    ? 'Usuário responsável: ' + (usuario.nome || 'id ' + usuario.id)
    : 'Nenhum usuário logado. Faça login para criar pedidos.';

  $('form-pedido').addEventListener('submit', criarPedido);
  $('produto').addEventListener('change', preencherPreco);
  $('cliente').addEventListener('change', filtrarProdutosDoCliente);
  $('filtro-status').addEventListener('change', carregarPedidos);

  carregarSelects();
  carregarPedidos();
}

document.addEventListener('DOMContentLoaded', iniciar);
