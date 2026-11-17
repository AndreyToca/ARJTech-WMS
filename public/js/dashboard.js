/*
 * LÓGICA DO DASHBOARD  —  Responsável: ANDREY
 *
 * 1. Filtros (período e cliente) no topo valem para tudo da página.
 * 2. Busca GET /api/relatorios/dashboard e preenche: lucro em destaque, números do período,
 *    gráfico de lucro por mês (colunas) e rankings de produtos e clientes (barras).
 * 3. Cada gráfico tem tooltip (mouse e teclado) e uma tabela com os mesmos números.
 * Gráficos desenhados à mão (SVG/HTML), sem biblioteca externa.
 */

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCompacta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat('pt-BR');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const formatarMoeda = (v) => moeda.format(Number(v || 0));
const rotuloMes = (aaaamm) => {
  const [ano, mes] = aaaamm.split('-');
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
};

let dados = null;

// ==================== Período ====================

const doisDigitos = (n) => String(n).padStart(2, '0');
const textoData = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

function periodoEscolhido() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const opcoes = {
    'mes': [new Date(ano, mes, 1), hoje],
    'mes-passado': [new Date(ano, mes - 1, 1), new Date(ano, mes, 0)],
    '3m': [new Date(ano, mes - 2, 1), hoje],
    '6m': [new Date(ano, mes - 5, 1), hoje],
    '12m': [new Date(ano, mes - 11, 1), hoje],
    'ano': [new Date(ano, 0, 1), hoje],
  };
  const [inicio, fim] = opcoes[$('filtro-periodo').value] || opcoes['12m'];
  return { inicio: textoData(inicio), fim: textoData(fim) };
}

// ==================== Dados ====================

async function chamarApi(url) {
  const resposta = await fetch(url);
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || `Erro do servidor (${resposta.status}).`);
  return corpo;
}

async function carregarClientes() {
  try {
    const clientes = await chamarApi('/api/cadastros/clientes');
    const select = $('filtro-cliente');
    clientes.forEach((c) => {
      const opcao = document.createElement('option');
      opcao.value = c.id;
      opcao.textContent = c.nome;
      select.appendChild(opcao);
    });
  } catch {
    // Sem a lista, o dashboard mostra todos os clientes
  }
}

async function carregarDashboard() {
  const { inicio, fim } = periodoEscolhido();
  const parametros = new URLSearchParams({ inicio, fim });
  if ($('filtro-cliente').value) parametros.set('cliente_id', $('filtro-cliente').value);

  const caixa = $('mensagem');
  try {
    dados = await chamarApi(`/api/relatorios/dashboard?${parametros}`);
    caixa.textContent = '';
    caixa.className = 'aviso';
    desenharTudo();
  } catch (erro) {
    caixa.textContent = 'Não foi possível carregar o dashboard: ' + erro.message;
    caixa.className = 'aviso erro';
    document.querySelectorAll('.grafico.carregando').forEach((g) => {
      g.classList.remove('carregando');
      g.innerHTML = '<div class="vazio-grafico">Sem dados.</div>';
    });
  }
}

function desenharTudo() {
  if (!dados) return;
  const { periodo } = dados;
  const [ai, mi, di] = periodo.inicio.split('-');
  const [af, mf, df] = periodo.fim.split('-');
  $('periodo-texto').textContent =
    `${di}/${mi}/${ai} a ${df}/${mf}/${af}` + (periodo.cliente ? ` · ${periodo.cliente}` : '');

  desenharResumo(dados.resumo);
  desenharMensal($('grafico-mensal'), dados.mensal);
  desenharRanking($('grafico-produtos'), dados.produtos.map((p) => ({
    nome: p.nome,
    codigo: p.codigo,
    valor: p.unidades,
    texto: `${inteiro.format(p.unidades)} ${String(p.unidade || '').toLowerCase()}`,
    detalhes: [['Pedidos', inteiro.format(p.pedidos)], ['Receita', formatarMoeda(p.receita)], ['Lucro', formatarMoeda(p.lucro)]],
  })), 'Nenhum produto expedido no período.');
  desenharRanking($('grafico-clientes'), dados.clientes.map((c) => ({
    nome: c.nome,
    valor: c.receita,
    texto: formatarMoeda(c.receita),
    detalhes: [['Pedidos', inteiro.format(c.pedidos)], ['Unidades', inteiro.format(c.unidades)], ['Lucro', formatarMoeda(c.lucro)]],
  })), 'Nenhuma venda expedida no período.');

  montarTabelas();
}

// ==================== Números do período ====================

function desenharResumo(r) {
  const lucro = $('kpi-lucro');
  lucro.textContent = formatarMoeda(r.lucro);
  lucro.classList.toggle('negativo', r.lucro < 0);
  $('kpi-lucro-detalhe').textContent = r.pedidos
    ? `${formatarMoeda(r.receita)} de receita − ${formatarMoeda(r.custo)} de custo`
    : 'Nenhum pedido expedido no período';

  $('kpi-receita').textContent = formatarMoeda(r.receita);
  $('kpi-custo').textContent = formatarMoeda(r.custo);
  $('kpi-margem').textContent = r.margem == null ? '—' : `${r.margem.toLocaleString('pt-BR')}%`;
  $('kpi-pedidos').textContent = inteiro.format(r.pedidos);
  $('kpi-unidades').textContent = `${inteiro.format(r.unidades)} unidades`;
  $('kpi-ticket').textContent = formatarMoeda(r.ticket_medio);
  $('kpi-pendentes').textContent = inteiro.format(r.pendentes);
  $('kpi-pendentes-valor').textContent = r.pendentes ? `${formatarMoeda(r.valor_pendente)} a expedir` : 'Nada a expedir';
}

// ==================== Tooltip ====================

const tooltip = $('tooltip');

// linhas: [[rótulo, valor], ...] — os textos entram com textContent (vêm do banco)
function mostrarTooltip(titulo, principal, linhas, negativo, x, y) {
  tooltip.replaceChildren();

  const cabeca = document.createElement('div');
  cabeca.className = 'tooltip-titulo';
  cabeca.textContent = titulo;

  const valor = document.createElement('div');
  valor.className = 'tooltip-principal';
  const chave = document.createElement('span');
  chave.className = 'tooltip-chave' + (negativo ? ' negativa' : '');
  valor.append(chave, principal);

  tooltip.append(cabeca, valor);
  linhas.forEach(([rotulo, texto]) => {
    const linha = document.createElement('div');
    linha.className = 'tooltip-linha';
    const forte = document.createElement('strong');
    forte.textContent = texto;
    linha.append(rotulo, forte);
    tooltip.appendChild(linha);
  });

  tooltip.classList.add('visivel');
  // Posiciona perto do ponto, sem sair da tela
  const largura = tooltip.offsetWidth;
  const altura = tooltip.offsetHeight;
  const esquerda = Math.min(Math.max(8, x + 12), window.innerWidth - largura - 8);
  const topo = y - altura - 12 < 8 ? y + 16 : y - altura - 12;
  tooltip.style.left = `${esquerda}px`;
  tooltip.style.top = `${topo}px`;
}

function esconderTooltip() {
  tooltip.classList.remove('visivel');
}

// ==================== Colunas: lucro por mês ====================

// Escala "redonda" para o eixo Y (0, 500, 1.000...)
function marcasEixo(min, max, quantidade = 4) {
  if (min === max) { max = min + 1; }
  const passoBruto = (max - min) / quantidade;
  const potencia = Math.pow(10, Math.floor(Math.log10(passoBruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= passoBruto);
  const inicio = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const marcas = [];
  for (let v = inicio; v <= fim + passo / 2; v += passo) marcas.push(Math.round(v * 100) / 100);
  return marcas;
}

function el(tag, atributos = {}, pai) {
  const elemento = document.createElementNS(SVG, tag);
  Object.entries(atributos).forEach(([k, v]) => elemento.setAttribute(k, v));
  if (pai) pai.appendChild(elemento);
  return elemento;
}

// Caminho de uma coluna com cantos de 4px só na ponta (a base fica reta)
function caminhoColuna(x, largura, yBase, yValor) {
  const altura = Math.abs(yBase - yValor);
  if (altura < 0.5) return '';
  const r = Math.min(4, altura, largura / 2);
  if (yValor < yBase) { // para cima
    return `M${x},${yBase} V${yValor + r} Q${x},${yValor} ${x + r},${yValor} H${x + largura - r} Q${x + largura},${yValor} ${x + largura},${yValor + r} V${yBase} Z`;
  }
  return `M${x},${yBase} V${yValor - r} Q${x},${yValor} ${x + r},${yValor} H${x + largura - r} Q${x + largura},${yValor} ${x + largura},${yValor - r} V${yBase} Z`;
}

function desenharMensal(container, meses) {
  container.classList.remove('carregando');
  container.replaceChildren();

  if (!meses.length || meses.every((m) => m.pedidos === 0)) {
    container.innerHTML = '<div class="vazio-grafico">Nenhuma venda expedida no período.</div>';
    return;
  }

  const largura = Math.max(container.clientWidth - 28, 280);
  const altura = 240;
  const margem = { topo: 18, direita: 8, baixo: 26, esquerda: 64 };
  const larguraUtil = largura - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.topo - margem.baixo;

  const valores = meses.map((m) => m.lucro);
  const marcas = marcasEixo(Math.min(0, ...valores), Math.max(0, ...valores));
  const minimo = marcas[0];
  const maximo = marcas[marcas.length - 1];
  const y = (v) => margem.topo + alturaUtil - ((v - minimo) / (maximo - minimo)) * alturaUtil;

  const svg = el('svg', { viewBox: `0 0 ${largura} ${altura}`, height: altura, role: 'img', 'aria-label': 'Lucro por mês' });

  // Grade e eixo Y
  marcas.forEach((m) => {
    const yy = Math.round(y(m)) + 0.5;
    el('line', { x1: margem.esquerda, x2: largura - margem.direita, y1: yy, y2: yy, class: m === 0 ? 'linha-base' : 'grade' }, svg);
    const texto = el('text', { x: margem.esquerda - 8, y: yy + 4, 'text-anchor': 'end', class: 'eixo-texto' }, svg);
    texto.textContent = moedaCompacta.format(m);
  });

  const faixa = larguraUtil / meses.length;
  const larguraColuna = Math.min(24, faixa * 0.6);
  const pularRotulo = meses.length > 12 ? 2 : 1;
  const yZero = y(0);

  meses.forEach((m, i) => {
    const x0 = margem.esquerda + i * faixa;
    const xColuna = x0 + (faixa - larguraColuna) / 2;
    const negativa = m.lucro < 0;

    const fundo = el('rect', { x: x0, y: margem.topo, width: faixa, height: alturaUtil, class: 'alvo-faixa', fill: 'transparent' }, svg);
    const caminho = caminhoColuna(xColuna, larguraColuna, yZero, y(m.lucro));
    const coluna = caminho ? el('path', { d: caminho, class: 'coluna' + (negativa ? ' negativa' : '') }, svg) : null;

    if (i % pularRotulo === 0 || i === meses.length - 1) {
      const rotulo = el('text', { x: x0 + faixa / 2, y: altura - 8, 'text-anchor': 'middle', class: 'eixo-texto' }, svg);
      rotulo.textContent = rotuloMes(m.mes);
    }

    // Área de toque: a faixa inteira do mês (maior que a coluna)
    const alvo = el('rect', {
      x: x0, y: margem.topo, width: faixa, height: alturaUtil, class: 'alvo', tabindex: 0,
      'aria-label': `${rotuloMes(m.mes)}: lucro ${formatarMoeda(m.lucro)}, receita ${formatarMoeda(m.receita)}, custo ${formatarMoeda(m.custo)}`,
    }, svg);

    const ativar = (evento) => {
      fundo.classList.add('ativa');
      if (coluna) coluna.classList.add('ativa');
      const caixa = alvo.getBoundingClientRect();
      const px = evento && evento.clientX != null ? evento.clientX : caixa.left + caixa.width / 2;
      const py = evento && evento.clientY != null ? evento.clientY : caixa.top + 20;
      mostrarTooltip(rotuloMes(m.mes), formatarMoeda(m.lucro), [
        ['Receita', formatarMoeda(m.receita)],
        ['Custo', formatarMoeda(m.custo)],
        ['Pedidos', inteiro.format(m.pedidos)],
      ], negativa, px, py);
    };
    const desativar = () => {
      fundo.classList.remove('ativa');
      if (coluna) coluna.classList.remove('ativa');
      esconderTooltip();
    };
    alvo.addEventListener('pointermove', ativar);
    alvo.addEventListener('pointerleave', desativar);
    alvo.addEventListener('focus', () => ativar());
    alvo.addEventListener('blur', desativar);
  });

  // Rótulo direto só no último mês (o mais recente)
  const ultimo = meses[meses.length - 1];
  const xUltimo = margem.esquerda + (meses.length - 0.5) * faixa;
  const yUltimo = ultimo.lucro < 0 ? y(ultimo.lucro) + 14 : y(ultimo.lucro) - 6;
  // Centralizado sobre a coluna; perto da borda direita, alinha pelo fim para não cortar
  const pertoDaBorda = xUltimo > largura - 32;
  const rotuloFinal = el('text', {
    x: pertoDaBorda ? largura - 2 : xUltimo,
    y: yUltimo,
    'text-anchor': pertoDaBorda ? 'end' : 'middle',
    class: 'rotulo-direto',
  }, svg);
  rotuloFinal.textContent = moedaCompacta.format(ultimo.lucro);

  container.appendChild(svg);
}

// ==================== Ranking (barras horizontais) ====================

function desenharRanking(container, itens, textoVazio) {
  container.classList.remove('carregando');
  container.replaceChildren();

  if (!itens.length) {
    const vazio = document.createElement('div');
    vazio.className = 'vazio-grafico';
    vazio.textContent = textoVazio;
    container.appendChild(vazio);
    return;
  }

  const maior = Math.max(...itens.map((i) => i.valor), 0) || 1;
  const lista = document.createElement('ol');
  lista.className = 'ranking';

  itens.forEach((item) => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.setAttribute('aria-label', `${item.nome}: ${item.texto}`);

    const nome = document.createElement('span');
    nome.className = 'ranking-nome';
    if (item.codigo) {
      const cod = document.createElement('span');
      cod.className = 'cod';
      cod.textContent = item.codigo;
      nome.appendChild(cod);
    }
    nome.append(item.nome);
    nome.title = item.nome;

    const trilho = document.createElement('div');
    trilho.className = 'ranking-trilho';
    const barra = document.createElement('div');
    barra.className = 'ranking-barra';
    barra.style.width = `${Math.max(0, (item.valor / maior) * 100)}%`;
    trilho.appendChild(barra);

    const valor = document.createElement('span');
    valor.className = 'ranking-valor';
    valor.textContent = item.texto;

    li.append(nome, trilho, valor);

    const ativar = (evento) => {
      const caixa = li.getBoundingClientRect();
      const px = evento && evento.clientX != null ? evento.clientX : caixa.left + caixa.width / 2;
      const py = evento && evento.clientY != null ? evento.clientY : caixa.top;
      mostrarTooltip(item.codigo ? `${item.codigo} · ${item.nome}` : item.nome, item.texto, item.detalhes, false, px, py);
    };
    li.addEventListener('pointermove', ativar);
    li.addEventListener('pointerleave', esconderTooltip);
    li.addEventListener('focus', () => ativar());
    li.addEventListener('blur', esconderTooltip);

    lista.appendChild(li);
  });

  container.appendChild(lista);
}

// ==================== Tabelas (mesmos números dos gráficos) ====================

function tabela(cabecalhos, linhas) {
  const t = document.createElement('table');
  t.className = 'tabela';
  const thead = t.createTHead().insertRow();
  cabecalhos.forEach(([texto, numero]) => {
    const th = document.createElement('th');
    th.textContent = texto;
    if (numero) th.className = 'num';
    thead.appendChild(th);
  });
  const corpo = t.createTBody();
  if (!linhas.length) {
    const td = corpo.insertRow().insertCell();
    td.colSpan = cabecalhos.length;
    td.className = 'vazio';
    td.textContent = 'Sem dados no período.';
  }
  linhas.forEach((linha) => {
    const tr = corpo.insertRow();
    linha.forEach((valor, i) => {
      const td = tr.insertCell();
      td.textContent = valor;
      if (cabecalhos[i][1]) td.className = 'num';
    });
  });
  return t;
}

function montarTabelas() {
  $('tabela-mensal').replaceChildren(tabela(
    [['Mês'], ['Pedidos', true], ['Receita', true], ['Custo', true], ['Lucro', true]],
    dados.mensal.map((m) => [rotuloMes(m.mes), inteiro.format(m.pedidos), formatarMoeda(m.receita), formatarMoeda(m.custo), formatarMoeda(m.lucro)])
  ));
  $('tabela-produtos').replaceChildren(tabela(
    [['Código'], ['Produto'], ['Quantidade', true], ['Receita', true], ['Lucro', true]],
    dados.produtos.map((p) => [p.codigo, p.nome, `${inteiro.format(p.unidades)} ${String(p.unidade || '').toLowerCase()}`, formatarMoeda(p.receita), formatarMoeda(p.lucro)])
  ));
  $('tabela-clientes').replaceChildren(tabela(
    [['Cliente'], ['Pedidos', true], ['Receita', true], ['Lucro', true]],
    dados.clientes.map((c) => [c.nome, inteiro.format(c.pedidos), formatarMoeda(c.receita), formatarMoeda(c.lucro)])
  ));
}

// Botão "Ver tabela" / "Ver gráfico"
document.querySelectorAll('button.alternar').forEach((botao) => {
  botao.addEventListener('click', () => {
    const alvo = botao.dataset.alvo;
    const mostrarTabela = botao.getAttribute('aria-pressed') !== 'true';
    botao.setAttribute('aria-pressed', String(mostrarTabela));
    botao.textContent = mostrarTabela ? 'Ver gráfico' : 'Ver tabela';
    $(`grafico-${alvo}`).hidden = mostrarTabela;
    $(`tabela-${alvo}`).hidden = !mostrarTabela;
  });
});

// ==================== Início ====================

$('filtro-periodo').addEventListener('change', carregarDashboard);
$('filtro-cliente').addEventListener('change', carregarDashboard);
$('filtros').addEventListener('submit', (e) => e.preventDefault());

// Redesenha o gráfico de colunas quando a largura muda
let ultimaLargura = 0;
new ResizeObserver(([entrada]) => {
  const largura = Math.round(entrada.contentRect.width);
  if (dados && Math.abs(largura - ultimaLargura) > 4) {
    ultimaLargura = largura;
    desenharMensal($('grafico-mensal'), dados.mensal);
  }
}).observe($('grafico-mensal'));

carregarClientes();
carregarDashboard();
