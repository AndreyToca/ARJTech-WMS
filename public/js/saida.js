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
// Disponível para saída do cliente escolhido: uma linha por produto/endereço
// (saldo no endereço − o que já está em pedidos pendentes ali). Vem de GET /api/saida/disponivel.
let disponiveis = [];

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

// Mostra a mensagem no topo do formulário e também num aviso flutuante,
// para ser vista mesmo com a lista de pedidos rolada para baixo.
function mostrarMensagem(texto, tipo) {
  const caixa = $('mensagem');
  caixa.textContent = texto;
  caixa.className = 'aviso ' + tipo;
  if (window.WMS && window.WMS.avisar) window.WMS.avisar(texto, tipo);
}

// Pedido que acabou de ser expedido: a linha pisca em verde depois de recarregar
let pedidoDestacado = null;

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
    const clientes = await chamarApi('/api/cadastros/clientes');
    preencherSelect(
      $('cliente'),
      clientes,
      (c) => c.cidade ? `${c.nome} (${c.cidade})` : c.nome
    );
    filtrarProdutosDoCliente();
  } catch (erro) {
    mostrarMensagem('Não foi possível carregar os clientes: ' + erro.message, 'erro');
  }
}

const numeroBr = (n) => Number(n || 0).toLocaleString('pt-BR');

// Deixa um select vazio e travado com uma mensagem (ex.: "Escolha o cliente primeiro")
function travarSelect(select, texto) {
  select.innerHTML = '';
  const opcao = document.createElement('option');
  opcao.value = '';
  opcao.textContent = texto;
  select.appendChild(opcao);
  select.disabled = true;
}

// Cliente escolhido -> produtos dele com quantidade disponível para saída
async function filtrarProdutosDoCliente(manterEscolha = false) {
  const clienteId = $('cliente').value;
  const select = $('produto');
  const produtoAntes = manterEscolha ? select.value : '';
  const enderecoAntes = manterEscolha ? $('endereco').value : '';
  disponiveis = [];

  if (!clienteId) {
    travarSelect(select, 'Escolha o cliente primeiro');
    filtrarEnderecos();
    return;
  }

  travarSelect(select, 'Carregando disponíveis...');
  try {
    disponiveis = await chamarApi(`${API_SAIDA}/disponivel?cliente_id=${encodeURIComponent(clienteId)}`);
  } catch (erro) {
    travarSelect(select, 'Não foi possível consultar o estoque');
    mostrarMensagem('Não foi possível consultar o disponível: ' + erro.message, 'erro');
    filtrarEnderecos();
    return;
  }
  if ($('cliente').value !== clienteId) return; // trocaram o cliente enquanto carregava

  // Um item por produto, somando o disponível de todos os endereços
  const porProduto = new Map();
  disponiveis.forEach((d) => {
    const atual = porProduto.get(d.produto_id) || { id: d.produto_id, codigo: d.codigo, nome: d.nome, unidade: d.unidade, disponivel: 0 };
    atual.disponivel += d.disponivel;
    porProduto.set(d.produto_id, atual);
  });
  const produtos = [...porProduto.values()];

  if (produtos.length === 0) {
    travarSelect(select, 'Nada disponível para este cliente');
  } else {
    preencherSelect(select, produtos,
      (p) => `${p.codigo} - ${p.nome} · ${numeroBr(p.disponivel)} ${String(p.unidade || '').toLowerCase()} disp.`);
    select.disabled = false;
    if (produtoAntes && porProduto.has(Number(produtoAntes))) select.value = produtoAntes;
    else if (produtos.length === 1) select.value = String(produtos[0].id); // só um: já escolhe
  }
  filtrarEnderecos(enderecoAntes);
}

// Produto escolhido -> só os endereços onde ele está disponível (o de maior saldo primeiro)
function filtrarEnderecos(enderecoAntes = '') {
  const select = $('endereco');
  const produtoId = $('produto').value;
  if (!produtoId) {
    travarSelect(select, $('cliente').value ? 'Escolha o produto primeiro' : 'Escolha o cliente primeiro');
  } else {
    const onde = disponiveis.filter((d) => String(d.produto_id) === produtoId);
    preencherSelect(select, onde.map((d) => ({ ...d, id: d.endereco_id })),
      (d) => `${d.endereco_codigo} · ${numeroBr(d.disponivel)} disponíveis`);
    select.disabled = false;
    if (enderecoAntes && onde.some((d) => String(d.endereco_id) === enderecoAntes)) select.value = enderecoAntes;
    else if (onde.length) select.value = String(onde[0].endereco_id); // o de maior disponível
  }
  preencherPreco();
  atualizarDisponivel();
}

// Linha de disponibilidade do produto/endereço escolhidos
function disponivelEscolhido() {
  return disponiveis.find((d) => String(d.produto_id) === $('produto').value && String(d.endereco_id) === $('endereco').value);
}

// Limita a quantidade ao disponível e mostra a dica embaixo do campo
function atualizarDisponivel() {
  const linha = disponivelEscolhido();
  const dica = $('dica-disponivel');
  const campo = $('quantidade');
  if (!linha) {
    campo.removeAttribute('max');
    dica.textContent = '';
    dica.className = 'dica-campo';
    return;
  }
  campo.max = linha.disponivel;
  const unidade = String(linha.unidade || '').toLowerCase();
  const qtd = Number(campo.value);
  const passou = campo.value !== '' && qtd > linha.disponivel;
  dica.textContent = passou
    ? `Máximo disponível: ${numeroBr(linha.disponivel)} ${unidade}`
    : `Disponível: ${numeroBr(linha.disponivel)} ${unidade}` + (linha.reservado ? ` · ${numeroBr(linha.reservado)} já em pedidos` : '');
  dica.title = `Saldo no endereço ${numeroBr(linha.saldo)} ${unidade}, ${numeroBr(linha.reservado)} em pedidos pendentes`;
  dica.className = 'dica-campo' + (passou ? ' erro' : '');
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
        botao.addEventListener('click', () => expedir(pedido));
        acao.appendChild(botao);
      }

      if (pedido.id === pedidoDestacado) linha.classList.add('destaque-ok');
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

// ==================== Janela de expedição ====================
// Expedir dá baixa no estoque e não pode ser desfeito: a janela mostra o pedido,
// o saldo do endereço e permite expedir tudo ou só uma parte.

const janela = {
  pedido: null,
  saldo: null, // saldo do produto no endereço do pedido (null enquanto carrega)
};

const unidadeDe = (pedido) => String(pedido.unidade || '').toLowerCase();
const quantidadeTexto = (n, pedido) => `${Number(n).toLocaleString('pt-BR')} ${unidadeDe(pedido)}`;

function modoEscolhido() {
  return document.querySelector('#form-expedir input[name="modo"]:checked').value;
}

// Quantidade que vai ser expedida conforme o modo escolhido
function quantidadeAExpedir() {
  if (modoEscolhido() === 'total') return janela.pedido.quantidade;
  const valor = Number($('exp-quantidade').value);
  return Number.isInteger(valor) ? valor : NaN;
}

function erroNaJanela(texto) {
  $('exp-erro').textContent = texto || '';
  $('exp-erro').className = texto ? 'aviso erro' : 'aviso';
}

// Atualiza o resumo, o texto do botão e as validações a cada mudança
function atualizarJanela() {
  const pedido = janela.pedido;
  const parcial = modoEscolhido() === 'parcial';
  $('campo-parcial').hidden = !parcial;

  const qtd = quantidadeAExpedir();
  const valida = Number.isInteger(qtd) && qtd >= 1 && qtd <= pedido.quantidade;
  const semSaldo = janela.saldo !== null && valida && qtd > janela.saldo;
  const restante = valida ? pedido.quantidade - qtd : null;

  // Resumo do que vai acontecer
  const resumo = $('exp-resumo');
  resumo.replaceChildren();
  const linha = (rotulo, valor, classe) => {
    const div = document.createElement('div');
    div.className = 'linha' + (classe ? ' ' + classe : '');
    const forte = document.createElement('strong');
    forte.textContent = valor;
    div.append(rotulo, forte);
    resumo.appendChild(div);
  };
  if (valida) {
    linha('Sai do estoque agora', quantidadeTexto(qtd, pedido));
    linha('Valor desta expedição', formatarMoeda(qtd * Number(pedido.preco_unitario || 0)));
    if (restante > 0) linha('Fica pendente (novo pedido)', quantidadeTexto(restante, pedido), 'destaque');
    if (janela.saldo !== null) linha('Saldo no endereço depois', quantidadeTexto(Math.max(janela.saldo - qtd, 0), pedido));
  }

  // Validações
  if (parcial && !valida) {
    erroNaJanela(`Informe uma quantidade entre 1 e ${pedido.quantidade}.`);
  } else if (semSaldo) {
    erroNaJanela(`Estoque insuficiente no endereço: há ${quantidadeTexto(janela.saldo, pedido)}. ` +
      (janela.saldo > 0 ? 'Use a expedição parcial.' : 'Faça uma entrada antes de expedir.'));
  } else {
    erroNaJanela('');
  }

  const botao = $('exp-confirmar');
  botao.disabled = !valida || semSaldo;
  botao.textContent = valida
    ? (restante > 0 ? `Expedir ${quantidadeTexto(qtd, pedido)} (parcial)` : `Expedir ${quantidadeTexto(qtd, pedido)}`)
    : 'Expedir';
}

async function carregarSaldo(pedido) {
  janela.saldo = null;
  $('exp-saldo').textContent = 'Carregando…';
  $('exp-saldo').className = '';
  try {
    const linhas = await chamarApi(`/api/estoque/produto/${pedido.produto_id}`);
    if (janela.pedido !== pedido) return; // janela já foi trocada
    const noEndereco = linhas.find((l) => Number(l.endereco_id) === Number(pedido.endereco_id));
    janela.saldo = noEndereco ? Number(noEndereco.quantidade) : 0;
    $('exp-saldo').textContent = quantidadeTexto(janela.saldo, pedido);
    $('exp-saldo').className = janela.saldo < pedido.quantidade ? 'falta' : '';

    // Sem saldo para o pedido inteiro: já sugere a parcial com o máximo possível
    if (janela.saldo < pedido.quantidade && janela.saldo > 0) {
      document.querySelector('#form-expedir input[value="parcial"]').checked = true;
      $('exp-quantidade').value = janela.saldo;
    }
    document.querySelector('#form-expedir input[value="total"]').disabled = janela.saldo < pedido.quantidade;
    $('exp-maximo').disabled = janela.saldo <= 0;
  } catch {
    $('exp-saldo').textContent = 'Não foi possível consultar';
  }
  atualizarJanela();
}

function abrirJanelaExpedir(pedido) {
  janela.pedido = pedido;
  const dialogo = $('dialogo-expedir');

  $('dialogo-titulo').textContent = `Expedir pedido nº ${pedido.id}`;
  $('dialogo-sub').textContent = `${pedido.cliente} · criado em ${pedido.data ? new Date(pedido.data).toLocaleDateString('pt-BR') : '-'}`;
  $('exp-produto').textContent = pedido.produto_nome;
  $('exp-endereco').textContent = pedido.endereco_codigo;
  $('exp-pedido').textContent = `${quantidadeTexto(pedido.quantidade, pedido)} · ${formatarMoeda(pedido.valor_total)}`;
  $('exp-total-texto').textContent = `${quantidadeTexto(pedido.quantidade, pedido)} de uma vez`;
  $('exp-unidade').textContent = unidadeDe(pedido);

  const quantidade = $('exp-quantidade');
  quantidade.max = Math.max(pedido.quantidade - 1, 1);
  quantidade.value = Math.max(Math.floor(pedido.quantidade / 2), 1);

  const total = document.querySelector('#form-expedir input[value="total"]');
  total.checked = true;
  total.disabled = false;
  // Pedido de 1 unidade não tem como ser parcial
  document.querySelector('#form-expedir input[value="parcial"]').disabled = pedido.quantidade <= 1;

  erroNaJanela('');
  atualizarJanela();
  dialogo.showModal();
  $('exp-confirmar').focus();
  carregarSaldo(pedido);
}

function fecharJanelaExpedir() {
  $('dialogo-expedir').close();
}

async function confirmarExpedicao(evento) {
  evento.preventDefault();
  const pedido = janela.pedido;
  const qtd = quantidadeAExpedir();
  if (!pedido || !Number.isInteger(qtd)) return;

  const botao = $('exp-confirmar');
  botao.disabled = true;
  $('exp-cancelar').disabled = true;

  try {
    const corpo = qtd < pedido.quantidade ? { quantidade: qtd } : {};
    const dados = await chamarApi(`${API_SAIDA}/${pedido.id}/expedir`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });

    fecharJanelaExpedir();
    pedidoDestacado = dados.novo_pedido_id || pedido.id;
    mostrarMensagem(
      dados.restante > 0
        ? `Pedido nº ${pedido.id}: ${quantidadeTexto(dados.expedido, pedido)} expedido(s). ${quantidadeTexto(dados.restante, pedido)} continuam pendentes no pedido nº ${dados.novo_pedido_id}.`
        : `Pedido nº ${pedido.id} expedido: ${quantidadeTexto(pedido.quantidade, pedido)} de ${pedido.produto_nome} para ${pedido.cliente}.`,
      'sucesso'
    );
    await carregarPedidos();
  } catch (erro) {
    // Mantém a janela aberta com o motivo, para o usuário ajustar (ex.: expedir parcial)
    erroNaJanela(erro.message);
    carregarSaldo(pedido);
  } finally {
    $('exp-cancelar').disabled = false;
    if ($('dialogo-expedir').open) atualizarJanela();
  }
}

function prepararJanelaExpedir() {
  $('form-expedir').addEventListener('submit', confirmarExpedicao);
  $('form-expedir').addEventListener('change', atualizarJanela);
  $('exp-quantidade').addEventListener('input', atualizarJanela);
  $('exp-maximo').addEventListener('click', () => {
    if (janela.saldo === null) return;
    $('exp-quantidade').value = Math.min(janela.saldo, janela.pedido.quantidade);
    atualizarJanela();
  });
  $('exp-cancelar').addEventListener('click', fecharJanelaExpedir);
  $('dialogo-fechar').addEventListener('click', fecharJanelaExpedir);
  // Clique no fundo escurecido fecha a janela
  $('dialogo-expedir').addEventListener('click', (evento) => {
    if (evento.target === evento.currentTarget) fecharJanelaExpedir();
  });
}

function expedir(pedido) {
  abrirJanelaExpedir(pedido);
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

  const linhaDisponivel = disponivelEscolhido();
  if (linhaDisponivel && quantidade > linhaDisponivel.disponivel) {
    mostrarMensagem(`Quantidade maior que a disponível neste endereço (${numeroBr(linhaDisponivel.disponivel)}).`, 'erro');
    $('quantidade').focus();
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
    // e recalcula o disponível (este pedido acabou de reservar parte do saldo)
    $('quantidade').value = '';
    await Promise.all([carregarPedidos(), filtrarProdutosDoCliente(true)]);
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
}

// Ao escolher o produto, sugere o preço de venda do cadastro (pode ser alterado)
function preencherPreco() {
  const linha = disponiveis.find((d) => String(d.produto_id) === $('produto').value);
  $('preco').value = linha ? Number(linha.preco_venda || 0).toFixed(2) : '';
}

function iniciar() {
  const usuario = usuarioLogado();

  $('usuario-info').textContent = usuario
    ? 'Usuário responsável: ' + (usuario.nome || 'id ' + usuario.id)
    : 'Nenhum usuário logado. Faça login para criar pedidos.';

  $('form-pedido').addEventListener('submit', criarPedido);
  prepararJanelaExpedir();
  $('cliente').addEventListener('change', () => filtrarProdutosDoCliente());
  $('produto').addEventListener('change', () => filtrarEnderecos());
  $('endereco').addEventListener('change', atualizarDisponivel);
  $('quantidade').addEventListener('input', atualizarDisponivel);
  $('filtro-status').addEventListener('change', carregarPedidos);

  carregarSelects();
  carregarPedidos();
}

document.addEventListener('DOMContentLoaded', iniciar);
