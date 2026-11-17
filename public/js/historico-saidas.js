/*
 * LÓGICA DA TELA: histórico de saídas  —  Responsável: GABRIEL
 *
 * 1. Filtros: período (padrão: últimos 30 dias), cliente, produto e status.
 * 2. Busca GET /api/saida com os filtros e mostra a tabela + totais.
 * 3. "Exportar CSV" baixa exatamente o que está filtrado (abre no Excel).
 */

const $ = (id) => document.getElementById(id);

const ROTULO_STATUS = { pendente: 'Pendente', separado: 'Separado', enviado: 'Expedido', cancelado: 'Cancelado' };
const COR_STATUS = { pendente: 'atencao', separado: 'neutro', enviado: 'ok', cancelado: 'problema' };

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const inteiro = new Intl.NumberFormat('pt-BR');
const formatarMoeda = (v) => moeda.format(Number(v || 0));

let pedidos = [];
let produtos = [];

const doisDigitos = (n) => String(n).padStart(2, '0');
const textoData = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

function periodoPadrao() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - 29);
  $('filtro-inicio').value = textoData(inicio);
  $('filtro-fim').value = textoData(hoje);
}

async function chamarApi(url) {
  const resposta = await fetch(url);
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || `Erro do servidor (${resposta.status}).`);
  return corpo;
}

function mostrarMensagem(texto, tipo) {
  $('mensagem').textContent = texto;
  $('mensagem').className = 'aviso' + (tipo ? ' ' + tipo : '');
}

function adicionarOpcao(select, valor, texto) {
  const opcao = document.createElement('option');
  opcao.value = valor;
  opcao.textContent = texto;
  select.appendChild(opcao);
}

async function carregarFiltros() {
  try {
    const [clientes, listaProdutos] = await Promise.all([
      chamarApi('/api/cadastros/clientes'),
      chamarApi('/api/cadastros/produtos'),
    ]);
    produtos = listaProdutos;
    clientes.forEach((c) => adicionarOpcao($('filtro-cliente'), c.id, c.nome));
    preencherProdutos();
  } catch (erro) {
    mostrarMensagem('Não foi possível carregar clientes e produtos: ' + erro.message, 'erro');
  }
}

// Com um cliente escolhido, o filtro de produto mostra só os produtos dele
function preencherProdutos() {
  const select = $('filtro-produto');
  const clienteId = $('filtro-cliente').value;
  const atual = select.value;
  select.innerHTML = '<option value="">Todos os produtos</option>';
  produtos
    .filter((p) => !clienteId || String(p.cliente_id) === clienteId)
    .forEach((p) => adicionarOpcao(select, p.id, `${p.codigo} - ${p.nome}`));
  if ([...select.options].some((o) => o.value === atual)) select.value = atual;
}

function parametrosDoFiltro() {
  const parametros = new URLSearchParams();
  const campos = { inicio: 'filtro-inicio', fim: 'filtro-fim', cliente_id: 'filtro-cliente', produto_id: 'filtro-produto', status: 'filtro-status' };
  Object.entries(campos).forEach(([nome, id]) => {
    if ($(id).value) parametros.set(nome, $(id).value);
  });
  return parametros;
}

async function carregarHistorico() {
  if ($('filtro-inicio').value && $('filtro-fim').value && $('filtro-inicio').value > $('filtro-fim').value) {
    mostrarMensagem('A data "De" deve ser anterior à data "Até".', 'erro');
    return;
  }
  try {
    pedidos = await chamarApi(`/api/saida?${parametrosDoFiltro()}`);
    mostrarMensagem('');
    desenharTotais();
    desenharTabela();
  } catch (erro) {
    mostrarMensagem('Não foi possível carregar o histórico: ' + erro.message, 'erro');
    pedidos = [];
    desenharTotais();
    desenharTabela('Não foi possível carregar o histórico.');
  }
}

// ==================== Totais ====================

function calcularTotais() {
  const expedidos = pedidos.filter((p) => p.status === 'enviado');
  const pendentes = pedidos.filter((p) => p.status === 'pendente');
  const soma = (lista, campo) => lista.reduce((t, p) => t + Number(p[campo] || 0), 0);
  const receita = soma(expedidos, 'valor_total');
  const custo = soma(expedidos, 'custo_total');
  return {
    pedidos: pedidos.length,
    unidades: soma(pedidos, 'quantidade'),
    expedidos: expedidos.length,
    receita,
    lucro: receita - custo,
    pendentes: pendentes.length,
    valorPendente: soma(pendentes, 'valor_total'),
  };
}

function desenharTotais() {
  const t = calcularTotais();
  const itens = [
    { valor: inteiro.format(t.pedidos), rotulo: 'Pedidos no filtro', detalhe: `${inteiro.format(t.unidades)} unidades`, status: '' },
    { valor: formatarMoeda(t.receita), rotulo: 'Valor expedido', detalhe: t.expedidos === 1 ? '1 pedido expedido' : `${inteiro.format(t.expedidos)} pedidos expedidos`, status: '' },
    { valor: formatarMoeda(t.lucro), rotulo: 'Lucro dos expedidos', detalhe: t.receita > 0 ? `Margem de ${((t.lucro / t.receita) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : 'Sem vendas expedidas', status: t.lucro < 0 ? 'problema' : (t.receita > 0 ? 'ok' : '') },
    { valor: inteiro.format(t.pendentes), rotulo: 'Pendentes', detalhe: t.pendentes ? `${formatarMoeda(t.valorPendente)} a expedir` : 'Nada a expedir', status: t.pendentes ? 'atencao' : 'ok' },
  ];

  const area = $('totais');
  area.replaceChildren();
  itens.forEach((item) => {
    const bloco = document.createElement('div');
    bloco.className = 'indicador';
    const valor = document.createElement('span');
    valor.className = 'indicador-valor';
    valor.textContent = item.valor;
    const rotulo = document.createElement('span');
    rotulo.className = 'indicador-rotulo';
    rotulo.textContent = item.rotulo;
    const detalhe = document.createElement('span');
    detalhe.className = `indicador-detalhe ${item.status}`;
    const ponto = document.createElement('span');
    ponto.className = 'status-ponto';
    detalhe.append(ponto, item.detalhe);
    bloco.append(valor, rotulo, detalhe);
    area.appendChild(bloco);
  });
}

// ==================== Tabela ====================

function celula(linha, texto, classe) {
  const td = document.createElement('td');
  if (classe) td.className = classe;
  td.textContent = texto == null ? '' : String(texto);
  linha.appendChild(td);
  return td;
}

function desenharTabela(textoErro) {
  const corpo = $('tabela-historico');
  corpo.replaceChildren();
  $('total-linhas').textContent = pedidos.length ? `${inteiro.format(pedidos.length)} pedidos` : '';

  if (!pedidos.length) {
    const linha = document.createElement('tr');
    celula(linha, textoErro || 'Nenhum pedido encontrado com esses filtros.', 'vazio').colSpan = 12;
    corpo.appendChild(linha);
    return;
  }

  pedidos.forEach((p) => {
    const linha = document.createElement('tr');
    celula(linha, p.id, 'secundario');
    celula(linha, p.data ? new Date(p.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '', 'secundario');
    celula(linha, p.cliente);
    celula(linha, `${p.produto_codigo} · ${p.produto_nome}`, 'descricao');
    celula(linha, p.endereco_codigo, 'cod');

    const qtd = celula(linha, inteiro.format(p.quantidade), 'num');
    if (p.unidade) {
      const unidade = document.createElement('span');
      unidade.className = 'unidade';
      unidade.textContent = p.unidade.toLowerCase();
      qtd.appendChild(unidade);
    }

    celula(linha, formatarMoeda(p.preco_unitario), 'num');
    celula(linha, formatarMoeda(p.valor_total), 'num');
    if (p.custo_total == null) {
      celula(linha, '-', 'num secundario');
      celula(linha, '-', 'num secundario');
    } else {
      const margem = Number(p.valor_total) - Number(p.custo_total);
      celula(linha, formatarMoeda(p.custo_total), 'num');
      celula(linha, formatarMoeda(margem), margem < 0 ? 'num valor-problema' : 'num valor-ok');
    }

    const status = celula(linha, '');
    const etiqueta = document.createElement('span');
    etiqueta.className = 'estado ' + (COR_STATUS[p.status] || 'neutro');
    const ponto = document.createElement('span');
    ponto.className = 'status-ponto';
    etiqueta.append(ponto, ROTULO_STATUS[p.status] || p.status);
    status.appendChild(etiqueta);

    celula(linha, p.usuario_nome, 'secundario');
    corpo.appendChild(linha);
  });
}

// ==================== CSV ====================

// Separador ";" e vírgula decimal: abre direto no Excel em português
function exportarCsv() {
  if (!pedidos.length) {
    mostrarMensagem('Não há pedidos no filtro para exportar.', 'erro');
    return;
  }
  const numeroCsv = (v) => (v == null ? '' : Number(v).toFixed(2).replace('.', ','));
  const texto = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecalho = ['Nº', 'Data', 'Cliente', 'Código', 'Produto', 'Endereço', 'Quantidade', 'Unidade', 'Preço unitário', 'Valor total', 'Custo', 'Margem', 'Status', 'Usuário'];
  const linhas = pedidos.map((p) => [
    p.id,
    p.data ? new Date(p.data).toLocaleString('pt-BR') : '',
    texto(p.cliente),
    texto(p.produto_codigo),
    texto(p.produto_nome),
    texto(p.endereco_codigo),
    p.quantidade,
    texto(p.unidade),
    numeroCsv(p.preco_unitario),
    numeroCsv(p.valor_total),
    numeroCsv(p.custo_total),
    p.custo_total == null ? '' : numeroCsv(Number(p.valor_total) - Number(p.custo_total)),
    texto(ROTULO_STATUS[p.status] || p.status),
    texto(p.usuario_nome),
  ].join(';'));

  const conteudo = '﻿' + [cabecalho.join(';'), ...linhas].join('\r\n');
  const arquivo = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = `historico-saidas_${$('filtro-inicio').value || 'inicio'}_a_${$('filtro-fim').value || 'hoje'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ==================== Início ====================

['filtro-inicio', 'filtro-fim', 'filtro-produto', 'filtro-status'].forEach((id) =>
  $(id).addEventListener('change', carregarHistorico));
$('filtro-cliente').addEventListener('change', () => {
  preencherProdutos();
  carregarHistorico();
});
$('botao-limpar').addEventListener('click', () => {
  periodoPadrao();
  $('filtro-cliente').value = '';
  $('filtro-status').value = '';
  preencherProdutos();
  $('filtro-produto').value = '';
  carregarHistorico();
});
$('botao-csv').addEventListener('click', exportarCsv);
$('filtros').addEventListener('submit', (e) => e.preventDefault());

periodoPadrao();
carregarFiltros();
carregarHistorico();
