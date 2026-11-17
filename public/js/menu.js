/*
 * LÓGICA DO PAINEL DA OPERAÇÃO  —  Responsável: ANDREY
 *
 * 1. Se não houver usuário salvo pelo login, manda para a tela de login.
 * 2. Mostra nome e perfil no topo.
 * 3. Busca GET /api/relatorios/painel e preenche: indicadores, badges da barra lateral,
 *    últimas movimentações e alertas. Atualiza sozinho a cada 2 minutos.
 * 4. Busca rápida: código de produto ou endereço (A-01-3) abre a tela de Estoque filtrada.
 * 5. O botão "Sair" apaga o usuário e volta para o login.
 */

const ATUALIZAR_A_CADA = 2 * 60 * 1000;

const TIPOS = {
  entrada: { icone: '↓', nome: 'Entrada' },
  saida: { icone: '↑', nome: 'Saída' },
};

const STATUS_SAIDA = { pendente: 'pendente', enviado: 'expedida', cancelado: 'cancelada', separado: 'separada' };

const GRUPOS_ALERTA = {
  custo: 'Custo acima do preço de venda',
  pedidos: 'Pedidos sem estoque suficiente',
  saldo: 'Saldo abaixo do mínimo',
};

const ENDERECO = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/;

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarMoeda = (v) => moeda.format(Number(v || 0));
const inteiro = (n) => Number(n || 0).toLocaleString('pt-BR');
const plural = (n, um, varios) => `${inteiro(n)} ${Number(n) === 1 ? um : varios}`;

// ---------- Início ----------

let usuario = null;
try {
  usuario = JSON.parse(localStorage.getItem('usuario'));
} catch {
  // valor corrompido no localStorage: trata como deslogado
}

if (!usuario) {
  window.location.replace('/pages/login.html');
} else {
  document.getElementById('nome-usuario').textContent = usuario.nome;
  document.getElementById('avatar-usuario').textContent = usuario.nome.charAt(0).toUpperCase();
  document.getElementById('perfil-usuario').textContent =
    usuario.perfil === 'admin' ? 'Administrador' : 'Operador';

  mostrarCarregando();
  carregarPainel();
  setInterval(carregarPainel, ATUALIZAR_A_CADA);
}

// Cria um elemento com classe e texto (sem innerHTML, para não injetar HTML vindo da API)
function el(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

// ---------- Dados ----------

async function carregarPainel() {
  const atualizado = document.getElementById('atualizado');
  try {
    const resposta = await fetch('/api/relatorios/painel');
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || `Erro do servidor (${resposta.status}).`);

    montarIndicadores(dados.indicadores, dados.alertas);
    montarBadges(dados.indicadores, dados.alertas);
    montarMovimentacoes(dados.movimentacoes);
    montarAlertas(dados.alertas);
    atualizado.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    atualizado.classList.remove('erro');
  } catch (erro) {
    atualizado.textContent = `Não foi possível atualizar: ${erro.message}`;
    atualizado.classList.add('erro');
    if (document.querySelector('#indicadores .carregando')) mostrarErro(erro.message);
  }
}

function mostrarCarregando() {
  const area = document.getElementById('indicadores');
  area.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const bloco = el('div', 'indicador carregando');
    bloco.append(el('span', 'indicador-valor', '—'), el('span', 'indicador-rotulo', 'Carregando…'));
    area.append(bloco);
  }
  const linha = el('tr');
  const td = el('td', 'secundario', 'Carregando movimentações…');
  td.colSpan = 8;
  linha.append(td);
  document.getElementById('movimentacoes').replaceChildren(linha);
  document.getElementById('alertas').replaceChildren(el('div', 'vazio', ''));
}

function mostrarErro(mensagem) {
  const linha = el('tr');
  const td = el('td', 'secundario', 'Não foi possível carregar: ' + mensagem);
  td.colSpan = 8;
  linha.append(td);
  document.getElementById('movimentacoes').replaceChildren(linha);
}

// ---------- Indicadores ----------

function montarIndicadores(ind, alertas) {
  const totalAlertas = alertas.saldo.length + alertas.pedidos.length + alertas.custo.length;
  const itens = [
    {
      valor: inteiro(ind.pendentes.pedidos),
      rotulo: 'Pedidos a expedir',
      detalhe: ind.pendentes.atrasados
        ? `${plural(ind.pendentes.atrasados, 'pedido', 'pedidos')} há mais de ${ind.pendentes.dias_atraso} dias`
        : ind.pendentes.pedidos ? `${formatarMoeda(ind.pendentes.valor)} a expedir` : 'Nada pendente',
      status: ind.pendentes.atrasados ? 'atencao' : 'ok',
      link: '/pages/saida.html',
    },
    {
      valor: inteiro(ind.entradas_hoje.itens),
      rotulo: 'Itens recebidos hoje',
      detalhe: ind.entradas_hoje.itens
        ? `${plural(ind.entradas_hoje.notas, 'nota', 'notas')} · ${inteiro(ind.entradas_hoje.unidades)} un`
        : 'Nenhuma entrada hoje',
      status: '',
      link: '/pages/entrada.html',
    },
    {
      valor: formatarMoeda(ind.mes.lucro),
      rotulo: 'Lucro do mês',
      detalhe: ind.mes.pedidos
        ? `${plural(ind.mes.pedidos, 'pedido expedido', 'pedidos expedidos')} · receita ${formatarMoeda(ind.mes.receita)}`
        : 'Nenhuma venda expedida no mês',
      status: ind.mes.lucro < 0 ? 'problema' : ind.mes.pedidos ? 'ok' : '',
      link: '/pages/dashboard.html',
    },
    {
      valor: inteiro(totalAlertas),
      rotulo: 'Alertas',
      detalhe: totalAlertas
        ? [alertas.custo.length && plural(alertas.custo.length, 'custo errado', 'custos errados'),
           alertas.pedidos.length && plural(alertas.pedidos.length, 'pedido sem estoque', 'pedidos sem estoque'),
           alertas.saldo.length && plural(alertas.saldo.length, 'saldo baixo', 'saldos baixos')].filter(Boolean).join(' · ')
        : 'Tudo em dia',
      status: totalAlertas ? 'problema' : 'ok',
      link: '#titulo-alertas',
    },
  ];

  const area = document.getElementById('indicadores');
  area.replaceChildren();
  for (const item of itens) {
    const link = el('a', 'indicador');
    link.href = item.link;

    const detalhe = el('span', `indicador-detalhe ${item.status}`);
    detalhe.append(el('span', 'status-ponto'), item.detalhe);

    link.append(
      el('span', 'indicador-valor', item.valor),
      el('span', 'indicador-rotulo', item.rotulo),
      detalhe,
    );
    area.append(link);
  }
}

// Badges da barra lateral: pendências de cada módulo (vermelho se houver problema)
function montarBadges(ind, alertas) {
  document.querySelectorAll('.lateral-item .badge').forEach((b) => b.remove());
  const porModulo = {
    saida: { total: ind.pendentes.pedidos, problema: alertas.pedidos.length > 0, titulo: 'pedidos a expedir' },
    estoque: { total: alertas.saldo.length + alertas.pedidos.length, problema: alertas.pedidos.length > 0, titulo: 'alertas de estoque' },
    produtos: { total: alertas.custo.length, problema: alertas.custo.length > 0, titulo: 'produtos com custo acima do preço' },
  };

  for (const [modulo, { total, problema, titulo }] of Object.entries(porModulo)) {
    const link = document.querySelector(`.lateral-item[data-modulo="${modulo}"]`);
    if (!link || !total) continue;
    const badge = el('span', problema ? 'badge problema' : 'badge', inteiro(total));
    badge.title = `${inteiro(total)} ${titulo}`;
    link.append(badge);
  }
}

// ---------- Últimas movimentações ----------

function formatarDataHora(data) {
  const d = new Date(data);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} ${hora}`;
}

// Nota fiscal: chave de 44 números vira "NF-e nº"; saída vira "PED nº"
function documento(mov) {
  if (mov.tipo === 'saida') return `PED ${mov.documento}`;
  const doc = String(mov.documento || '');
  if (/^\d{44}$/.test(doc)) return `NF-e ${Number(doc.slice(25, 34))}`;
  return doc ? `NF ${doc.replace(/^NF-?\s*/i, '')}` : '-';
}

function montarMovimentacoes(movimentacoes) {
  const corpo = document.getElementById('movimentacoes');
  corpo.replaceChildren();

  if (!movimentacoes.length) {
    const linha = el('tr');
    const td = el('td', 'secundario', 'Nenhuma movimentação ainda.');
    td.colSpan = 8;
    linha.append(td);
    corpo.append(linha);
    return;
  }

  for (const mov of movimentacoes) {
    const tipo = TIPOS[mov.tipo];
    const linha = document.createElement('tr');

    const celulaTipo = el('td');
    celulaTipo.append(el('span', 'tipo-icone', tipo.icone), tipo.nome);
    if (mov.tipo === 'saida' && mov.status) celulaTipo.append(el('span', 'unidade', STATUS_SAIDA[mov.status] || mov.status));

    const celulaQtd = el('td', 'num', inteiro(mov.quantidade));
    celulaQtd.append(el('span', 'unidade', String(mov.unidade || '').toLowerCase()));

    linha.append(
      el('td', 'secundario', formatarDataHora(mov.data)),
      celulaTipo,
      el('td', 'secundario', documento(mov)),
      el('td', 'cod', mov.codigo),
      el('td', 'descricao', mov.nome),
      el('td', 'cod', mov.endereco),
      celulaQtd,
      el('td', 'secundario', mov.usuario),
    );
    corpo.append(linha);
  }
}

// ---------- Alertas ----------

function montarAlertas(alertas) {
  const area = document.getElementById('alertas');
  area.replaceChildren();
  const total = alertas.saldo.length + alertas.pedidos.length + alertas.custo.length;
  document.getElementById('total-alertas').textContent = total ? `${inteiro(total)} abertos` : '';

  if (total === 0) {
    const vazio = el('div', 'vazio');
    const esteira = document.querySelector('.topo .esteira').cloneNode(true);
    esteira.classList.add('vazia');
    vazio.append(esteira, el('p', null, 'Sem alertas. Saldos, pedidos e custos em dia.'));
    area.append(vazio);
    return;
  }

  // Cada tipo de alerta vira um item com link para a tela onde se resolve
  const montar = {
    custo: (a) => ({
      status: 'problema',
      link: `/pages/produtos.html`,
      codigo: a.codigo,
      descricao: a.nome,
      marcador: `${(a.custo_medio / a.preco_venda).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`,
      info: `Custo médio ${formatarMoeda(a.custo_medio)} · preço ${formatarMoeda(a.preco_venda)}. Confira a entrada.`,
    }),
    pedidos: (a) => ({
      status: 'problema',
      link: '/pages/saida.html',
      codigo: a.codigo,
      descricao: a.nome,
      endereco: a.endereco,
      marcador: `−${inteiro(a.pedido - a.saldo)}`,
      info: `${plural(a.pedidos, 'pedido pede', 'pedidos pedem')} ${inteiro(a.pedido)}, há ${inteiro(a.saldo)} ${String(a.unidade || '').toLowerCase()}`,
    }),
    saldo: (a) => ({
      status: a.quantidade === 0 ? 'problema' : 'atencao',
      link: `/pages/estoque.html?produto=${encodeURIComponent(a.codigo)}`,
      codigo: a.codigo,
      descricao: a.nome,
      endereco: a.endereco,
      marcador: a.quantidade === 0 ? 'Ruptura' : `${inteiro(a.quantidade)} ${String(a.unidade || '').toLowerCase()}`,
      info: `Saldo ${inteiro(a.quantidade)} · mín. ${a.limite}`,
    }),
  };

  for (const [grupo, titulo] of Object.entries(GRUPOS_ALERTA)) {
    const itens = alertas[grupo];
    if (!itens.length) continue;

    const secao = el('div', 'alertas-grupo');
    secao.append(el('h3', null, titulo));

    for (const bruto of itens) {
      const alerta = montar[grupo](bruto);
      const link = el('a', `alerta ${alerta.status}`);
      link.href = alerta.link;

      const produto = el('span', 'alerta-produto');
      produto.append(el('span', 'cod', alerta.codigo), ` ${alerta.descricao}`);

      const info = el('span', 'alerta-info');
      if (alerta.endereco) info.append(el('span', 'cod', alerta.endereco), ' · ');
      info.append(alerta.info);

      link.append(el('span', 'status-ponto'), produto, el('span', 'alerta-marcador', alerta.marcador), info);
      secao.append(link);
    }
    area.append(secao);
  }
}

// ---------- Busca rápida ----------

const campoBusca = document.getElementById('busca-termo');

document.getElementById('busca').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const termo = campoBusca.value.trim().toUpperCase();
  if (!termo) return;
  const filtro = ENDERECO.test(termo) ? 'endereco' : 'produto';
  window.location.href = `/pages/estoque.html?${filtro}=${encodeURIComponent(termo)}`;
});

// Atalho "/" foca a busca
document.addEventListener('keydown', (evento) => {
  const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if (evento.key === '/' && !digitando) {
    evento.preventDefault();
    campoBusca.focus();
  }
});

document.getElementById('botao-sair').addEventListener('click', () => {
  localStorage.removeItem('usuario');
  window.location.replace('/pages/login.html');
});
