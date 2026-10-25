/*
 * LÓGICA DO PAINEL DA OPERAÇÃO  —  Responsável: ANDREY
 *
 * 1. Se não houver usuário salvo pelo login, manda para a tela de login.
 * 2. Mostra nome e perfil no topo.
 * 3. Preenche indicadores do dia, badges da barra lateral, últimas movimentações e alertas.
 * 4. Busca rápida: código de produto ou endereço (A-01-03) abre a tela de Estoque filtrada.
 * 5. O botão "Sair" apaga o usuário e volta para o login.
 */

// ---------- Dados de exemplo ----------
// TODO: trocar pelas APIs de entrada, saída e estoque quando estiverem prontas.
// status: 'ok' | 'atencao' | 'problema' (é o que define a cor na tela)

const indicadores = [
  { valor: 7,  rotulo: 'Notas a receber',   detalhe: '2 na doca, no horário',    status: 'ok',       modulo: 'entrada', link: '/pages/entrada.html' },
  { valor: 46, rotulo: 'Itens a endereçar', detalhe: 'Mais antigo há 1h40',      status: 'atencao',  modulo: 'entrada', link: '/pages/entrada.html' },
  { valor: 18, rotulo: 'Pedidos a separar', detalhe: '4 com corte às 16:00',     status: 'atencao',  modulo: 'saida',   link: '/pages/saida.html' },
  { valor: 3,  rotulo: 'Divergências',      detalhe: '2 posições bloqueadas',    status: 'problema', modulo: 'estoque', link: '/pages/estoque.html' },
];

// minutos: há quanto tempo a movimentação aconteceu
const movimentacoes = [
  { minutos: 3,  tipo: 'saida',         documento: 'PED 8841', codigo: '100318', descricao: 'Luva nitrílica M cx 100',      endereco: 'B-02-01',            qtd: 6,   unidade: 'cx', usuario: 'gabriel.s' },
  { minutos: 7,  tipo: 'entrada',       documento: 'NF 45112', codigo: '100245', descricao: 'Detergente alcalino 5 L',      endereco: 'A-01-03',            qtd: 48,  unidade: 'gl', usuario: 'lucas.m' },
  { minutos: 12, tipo: 'transferencia', documento: 'TRF 0193', codigo: '100772', descricao: 'Filme stretch 500 mm 25 µm',   endereco: 'C-04-02 → C-01-01',  qtd: 10,  unidade: 'rl', usuario: 'felipe.r' },
  { minutos: 18, tipo: 'saida',         documento: 'PED 8839', codigo: '100911', descricao: 'Óleo hidráulico ISO 68 20 L',  endereco: 'D-02-04',            qtd: 4,   unidade: 'bd', usuario: 'gabriel.s' },
  { minutos: 25, tipo: 'entrada',       documento: 'NF 45109', codigo: '100533', descricao: 'Fita adesiva 48 mm x 100 m',   endereco: 'B-05-02',            qtd: 60,  unidade: 'rl', usuario: 'lucas.m' },
  { minutos: 31, tipo: 'saida',         documento: 'PED 8838', codigo: '100045', descricao: 'Etiqueta térmica 100x150 mm',  endereco: 'A-03-05',            qtd: 12,  unidade: 'rl', usuario: 'gabriel.s' },
  { minutos: 40, tipo: 'entrada',       documento: 'NF 45109', codigo: '100127', descricao: 'Caixa papelão 40x30x30 cm',    endereco: 'E-01-01',            qtd: 500, unidade: 'un', usuario: 'lucas.m' },
  { minutos: 52, tipo: 'transferencia', documento: 'TRF 0192', codigo: '100604', descricao: 'Desengraxante 1 L cx 12',      endereco: 'A-02-04 → A-01-06',  qtd: 8,   unidade: 'cx', usuario: 'felipe.r' },
  { minutos: 66, tipo: 'saida',         documento: 'PED 8835', codigo: '100389', descricao: 'Parafuso sext. M8x30 cx 500',  endereco: 'F-03-02',            qtd: 3,   unidade: 'cx', usuario: 'gabriel.s' },
  { minutos: 78, tipo: 'entrada',       documento: 'NF 45104', codigo: '100211', descricao: 'Palete PBR 1,20 x 1,00 m',     endereco: 'G-01-01',            qtd: 20,  unidade: 'un', usuario: 'lucas.m' },
];

const alertas = [
  { grupo: 'saldo',      status: 'problema', codigo: '100045', descricao: 'Etiqueta térmica 100x150 mm', endereco: 'A-03-05', info: 'Saldo 0 · mín. 10 rl',     marcador: 'Ruptura' },
  { grupo: 'saldo',      status: 'atencao',  codigo: '100772', descricao: 'Filme stretch 500 mm 25 µm',  endereco: 'C-04-02', info: 'Saldo 6 · mín. 20 rl',     marcador: '30%' },
  { grupo: 'saldo',      status: 'atencao',  codigo: '100318', descricao: 'Luva nitrílica M cx 100',     endereco: 'B-02-01', info: 'Saldo 14 · mín. 40 cx',    marcador: '35%' },
  { grupo: 'divergencia', status: 'problema', codigo: '100533', descricao: 'Fita adesiva 48 mm x 100 m', endereco: 'B-05-02', info: 'Sistema 60 · físico 0 · bloqueado',    marcador: '−60' },
  { grupo: 'divergencia', status: 'problema', codigo: '100245', descricao: 'Detergente alcalino 5 L',    endereco: 'A-01-03', info: 'Sistema 120 · físico 96 · bloqueado',  marcador: '−24' },
  { grupo: 'divergencia', status: 'atencao',  codigo: '100604', descricao: 'Desengraxante 1 L cx 12',    endereco: 'A-01-06', info: 'Sistema 340 · físico 338 · recontar',  marcador: '−2' },
];

const TIPOS = {
  entrada: { icone: '↓', nome: 'Entrada' },
  saida: { icone: '↑', nome: 'Saída' },
  transferencia: { icone: '⇄', nome: 'Transferência' },
};

const GRUPOS_ALERTA = {
  saldo: 'Saldo abaixo do mínimo',
  divergencia: 'Divergência físico x sistema',
};

const ENDERECO = /^[A-Z]-\d{2}-\d{2}$/;

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

  document.getElementById('atualizado').textContent =
    `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  montarIndicadores();
  montarBadges();
  montarMovimentacoes();
  montarAlertas();
}

// Cria um elemento com classe e texto (sem innerHTML, para não injetar HTML vindo da API)
function el(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function montarIndicadores() {
  const area = document.getElementById('indicadores');

  for (const item of indicadores) {
    const link = el('a', 'indicador');
    link.href = item.link;

    const detalhe = el('span', `indicador-detalhe ${item.status}`);
    detalhe.append(el('span', 'status-ponto'), item.detalhe);

    link.append(
      el('span', 'indicador-valor', item.valor.toLocaleString('pt-BR')),
      el('span', 'indicador-rotulo', item.rotulo),
      detalhe,
    );
    area.append(link);
  }
}

// Soma as pendências de cada módulo; o badge só fica vermelho se houver problema
function montarBadges() {
  const porModulo = {};
  for (const item of indicadores) {
    const atual = porModulo[item.modulo] || { total: 0, problema: false };
    atual.total += item.valor;
    atual.problema ||= item.status === 'problema';
    porModulo[item.modulo] = atual;
  }

  for (const [modulo, { total, problema }] of Object.entries(porModulo)) {
    const link = document.querySelector(`.lateral-item[data-modulo="${modulo}"]`);
    if (!link || total === 0) continue;
    const badge = el('span', problema ? 'badge problema' : 'badge', total);
    badge.title = `${total} pendências`;
    link.append(badge);
  }
}

function formatarDataHora(minutosAtras) {
  const data = new Date(Date.now() - minutosAtras * 60000);
  const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} ${hora}`;
}

function montarMovimentacoes() {
  const corpo = document.getElementById('movimentacoes');

  for (const mov of movimentacoes) {
    const tipo = TIPOS[mov.tipo];
    const linha = document.createElement('tr');

    const celulaTipo = el('td');
    celulaTipo.append(el('span', 'tipo-icone', tipo.icone), tipo.nome);

    const celulaQtd = el('td', 'num', mov.qtd.toLocaleString('pt-BR'));
    celulaQtd.append(el('span', 'unidade', mov.unidade));

    linha.append(
      el('td', 'secundario', formatarDataHora(mov.minutos)),
      celulaTipo,
      el('td', 'secundario', mov.documento),
      el('td', 'cod', mov.codigo),
      el('td', 'descricao', mov.descricao),
      el('td', 'cod', mov.endereco),
      celulaQtd,
      el('td', 'secundario', mov.usuario),
    );
    corpo.append(linha);
  }
}

function montarAlertas() {
  const area = document.getElementById('alertas');
  document.getElementById('total-alertas').textContent = alertas.length ? `${alertas.length} abertos` : '';

  if (alertas.length === 0) {
    const vazio = el('div', 'vazio');
    const esteira = document.querySelector('.topo .esteira').cloneNode(true);
    esteira.classList.add('vazia');
    vazio.append(esteira, el('p', null, 'Sem alertas. Saldos e contagens em dia.'));
    area.append(vazio);
    return;
  }

  for (const [grupo, titulo] of Object.entries(GRUPOS_ALERTA)) {
    const itens = alertas.filter((a) => a.grupo === grupo);
    if (itens.length === 0) continue;

    const secao = el('div', 'alertas-grupo');
    secao.append(el('h3', null, titulo));

    for (const alerta of itens) {
      const link = el('a', `alerta ${alerta.status}`);
      link.href = `/pages/estoque.html?endereco=${encodeURIComponent(alerta.endereco)}`;

      const produto = el('span', 'alerta-produto');
      produto.append(el('span', 'cod', alerta.codigo), ` ${alerta.descricao}`);

      const info = el('span', 'alerta-info');
      info.append(el('span', 'cod', alerta.endereco), ` · ${alerta.info}`);

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
