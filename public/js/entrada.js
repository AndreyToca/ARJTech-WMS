/*
 * LÓGICA DA TELA: entrada  —  Responsável: LUCAS
 *
 * 1. Entrada por NF-e: bipa a chave de acesso (o leitor funciona como teclado e manda Enter),
 *    carrega o XML da nota, associa cada item a um produto/endereço e lança tudo de uma vez
 *    (POST /api/entrada/lote). A mesma nota não pode ser lançada duas vezes.
 * 2. Entrada manual: um produto por vez (POST /api/entrada), informando o valor por unidade
 *    ou o total da linha.
 * 3. Antes de gravar, avisa quando o custo parece errado (acima do preço de venda ou muito
 *    acima do custo médio atual) e pede confirmação.
 * 4. Histórico (GET /api/entrada).
 */

const $ = (id) => document.getElementById(id);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarMoeda = (valor) => moeda.format(Number(valor || 0));
const inteiro = (n) => Number(n || 0).toLocaleString('pt-BR');
const arred = (v, casas = 4) => Math.round(Number(v) * 10 ** casas) / 10 ** casas;
const VEZES_CUSTO_SUSPEITO = 3; // custo novo acima de 3× o custo médio atual pede confirmação

let produtos = [];
let enderecos = [];
let posicaoPrincipal = new Map(); // produto_id -> endereço onde ele mais tem estoque

function usuarioId() {
  try { return Number(JSON.parse(localStorage.getItem('usuario')).id) || undefined; } catch { return undefined; }
}

function avisar(elemento, texto, tipo) {
  elemento.textContent = texto || '';
  elemento.className = 'aviso' + (texto && tipo ? ' ' + tipo : '');
  if (texto && tipo && window.WMS && window.WMS.avisar) window.WMS.avisar(texto, tipo);
}

async function chamarApi(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || `Erro do servidor (${resposta.status}).`);
  return corpo;
}

function celula(linha, texto, classe) {
  const td = document.createElement('td');
  if (classe) td.className = classe;
  td.textContent = texto == null ? '' : String(texto);
  linha.appendChild(td);
  return td;
}

function preencherSelect(select, itens, rotulo, textoVazio) {
  const atual = select.value;
  select.innerHTML = '';
  const vazio = document.createElement('option');
  vazio.value = '';
  vazio.textContent = textoVazio;
  select.appendChild(vazio);
  itens.forEach((item) => {
    const opcao = document.createElement('option');
    opcao.value = item.id;
    opcao.textContent = rotulo(item);
    select.appendChild(opcao);
  });
  if ([...select.options].some((o) => o.value === atual)) select.value = atual;
}

const rotuloProduto = (p) => `${p.codigo} - ${p.nome}${p.cliente_nome ? ` (${p.cliente_nome})` : ''}`;
const produtoPorId = (id) => produtos.find((p) => String(p.id) === String(id));

// Avisos de custo suspeito (não impedem, mas pedem confirmação)
function avisosDeCusto(produto, valorUnitario) {
  if (!produto || !(valorUnitario > 0)) return [];
  const avisos = [];
  const preco = Number(produto.preco_venda || 0);
  const custo = Number(produto.custo_medio || 0);
  if (preco > 0 && valorUnitario > preco) {
    avisos.push(`custo de ${formatarMoeda(valorUnitario)} por unidade é maior que o preço de venda (${formatarMoeda(preco)})`);
  }
  if (custo > 0 && valorUnitario > custo * VEZES_CUSTO_SUSPEITO) {
    avisos.push(`é ${(valorUnitario / custo).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o custo médio atual (${formatarMoeda(custo)})`);
  }
  return avisos;
}

// ==================== Dados de apoio ====================

async function carregarCadastros() {
  try {
    const [listaProdutos, listaEnderecos, estoque] = await Promise.all([
      chamarApi('/api/cadastros/produtos'),
      chamarApi('/api/cadastros/enderecos'),
      chamarApi('/api/estoque').catch(() => []),
    ]);
    produtos = listaProdutos;
    enderecos = listaEnderecos;

    posicaoPrincipal = new Map();
    const maior = new Map();
    estoque.forEach((e) => {
      if ((maior.get(e.produto_id) || -1) < Number(e.quantidade)) {
        maior.set(e.produto_id, Number(e.quantidade));
        posicaoPrincipal.set(e.produto_id, e.endereco_id);
      }
    });

    preencherSelect($('produto_id'), produtos, rotuloProduto, 'Selecione um produto...');
    preencherSelect($('endereco_id'), enderecos, (e) => e.codigo, 'Selecione um endereço...');
    preencherSelect($('endereco-todos'), enderecos, (e) => e.codigo, 'Escolha para aplicar a todos...');
  } catch (erro) {
    avisar($('mensagem-entrada'), 'Não foi possível carregar produtos e endereços: ' + erro.message, 'erro');
  }
}

// ==================== 1. Entrada por NF-e ====================

const nota = { chave: null, consulta: null, xml: null, confirmado: false };

function mostrarStatus(elemento, texto, tipo) {
  elemento.textContent = texto || '';
  elemento.className = 'status-chave' + (tipo ? ' ' + tipo : '');
}

function mostrarDadosNota() {
  const area = $('chave-info');
  const info = nota.chave;
  area.replaceChildren();
  if (!info) { area.hidden = true; return; }

  const adicionar = (rotulo, valor, classe) => {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = rotulo;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    if (classe) dd.className = classe;
    div.append(dt, dd);
    area.appendChild(div);
  };
  adicionar(info.tipo, `nº ${info.numero} · série ${info.serie}`);
  adicionar('Emitente', nota.xml ? `${nota.xml.emitente.nome} · ${NFe.formatarCnpj(info.cnpj)}` : NFe.formatarCnpj(info.cnpj));
  adicionar('Emissão', `${info.emissao} · ${info.uf}`);
  if (nota.consulta) {
    adicionar('Cliente', nota.consulta.cliente ? nota.consulta.cliente.nome : 'CNPJ não cadastrado em Clientes', nota.consulta.cliente ? '' : 'atencao');
    adicionar('Situação', nota.consulta.lancada
      ? `Já lançada em ${new Date(nota.consulta.lancada_em).toLocaleString('pt-BR')}`
      : 'Ainda não lançada', nota.consulta.lancada ? 'problema' : 'ok');
  }
  area.hidden = false;
}

async function processarChave() {
  const info = NFe.lerChave($('chave').value);
  nota.consulta = null;
  if (!info.valida) {
    nota.chave = null;
    mostrarDadosNota();
    mostrarStatus($('chave-status'), info.erro, info.chave.length ? 'erro' : '');
    return;
  }
  // Com o XML já carregado, a chave bipada tem que ser a do XML (conferência física x fiscal)
  if (nota.xml && nota.xml.chave !== info.chave) {
    mostrarStatus($('chave-status'), 'Atenção: a nota bipada NÃO é a mesma do XML carregado.', 'erro');
    nota.chave = info;
    mostrarDadosNota();
    atualizarItens();
    return;
  }

  nota.chave = info;
  $('chave').value = NFe.formatarChave(info.chave);
  mostrarStatus($('chave-status'), `Chave válida · ${info.tipo} nº ${info.numero}. Consultando…`, 'ok');
  mostrarDadosNota();
  try {
    nota.consulta = await chamarApi(`/api/entrada/nota/${info.chave}`);
    if (nota.chave !== info) return; // outra chave foi bipada nesse meio-tempo
    mostrarStatus($('chave-status'),
      nota.consulta.lancada ? 'Esta nota já foi lançada. Não é possível lançar de novo.' :
        nota.xml ? 'Chave confere com o XML.' : 'Chave válida. Agora carregue o XML desta nota.',
      nota.consulta.lancada ? 'erro' : 'ok');
  } catch (erro) {
    mostrarStatus($('chave-status'), erro.message, 'erro');
  }
  mostrarDadosNota();
  if (nota.xml) montarItens();
}

async function carregarXml(arquivo) {
  if (!arquivo) return;
  try {
    const xml = NFe.lerXml(await arquivo.text());
    if (nota.chave && nota.chave.chave !== xml.chave) {
      mostrarStatus($('xml-status'), `Este XML é da nota nº ${xml.numero}, mas a nota bipada é a nº ${nota.chave.numero}. Confira se pegou o arquivo certo.`, 'erro');
      return;
    }
    nota.xml = xml;
    nota.confirmado = false;
    mostrarStatus($('xml-status'), `${arquivo.name}: ${xml.itens.length} item(ns), ${formatarMoeda(xml.totalProdutos)} em produtos.`, 'ok');
    if (!nota.chave) {
      $('chave').value = xml.chave; // sem bipar: usa a chave do próprio XML
      await processarChave();
    } else {
      mostrarDadosNota();
      montarItens();
    }
  } catch (erro) {
    mostrarStatus($('xml-status'), erro.message, 'erro');
  }
}

// Monta a tabela de itens da nota, já com sugestões de produto e endereço
function montarItens() {
  const corpo = $('itens-nota');
  corpo.replaceChildren();
  if (!nota.xml) { $('nota-itens').hidden = true; return; }

  // Se o emitente é um cliente cadastrado, só os produtos dele aparecem
  const cliente = nota.consulta && nota.consulta.cliente;
  const lista = cliente ? produtos.filter((p) => p.cliente_id === cliente.id) : produtos;
  $('dica-itens').textContent = cliente
    ? `Mostrando só os produtos de ${cliente.nome} (CNPJ do emitente).`
    : 'O CNPJ do emitente não está em Clientes: todos os produtos aparecem.';

  nota.xml.itens.forEach((item, i) => {
    const tr = document.createElement('tr');
    tr.dataset.indice = i;

    // Desmarcar = não lançar este item (ex.: produto não cadastrado ou não recebido)
    const tdIncluir = celula(tr, '');
    const incluir = document.createElement('input');
    incluir.type = 'checkbox';
    incluir.className = 'item-incluir';
    incluir.checked = true;
    incluir.setAttribute('aria-label', `Lançar o item ${i + 1}`);
    tdIncluir.appendChild(incluir);
    incluir.addEventListener('change', atualizarItens);

    celula(tr, item.item || i + 1, 'secundario');

    const descricao = celula(tr, '', 'descricao');
    const titulo = document.createElement('div');
    titulo.textContent = item.descricao;
    const detalhe = document.createElement('small');
    detalhe.className = 'secundario';
    detalhe.textContent = `Cód. ${item.codigo}${item.ncm ? ' · NCM ' + item.ncm : ''} · ${formatarMoeda(item.valorUnitario)}/${item.unidade.toLowerCase()}`;
    descricao.append(titulo, detalhe);

    celula(tr, `${item.quantidade.toLocaleString('pt-BR')} ${item.unidade.toLowerCase()}`, 'num');

    // Produto no sistema
    const tdProduto = celula(tr, '');
    const selProduto = document.createElement('select');
    selProduto.className = 'item-produto';
    selProduto.dataset.busca = '';
    selProduto.setAttribute('aria-label', `Produto do sistema para o item ${i + 1}`);
    preencherSelect(selProduto, lista, (p) => `${p.codigo} - ${p.nome}`, 'Associe a um produto...');
    const sugerido = NFe.sugerirProduto(item.descricao, lista);
    if (sugerido) selProduto.value = sugerido.id;
    const avisoItem = document.createElement('small');
    avisoItem.className = 'aviso-item';
    tdProduto.append(selProduto, avisoItem);

    // Endereço
    const tdEndereco = celula(tr, '');
    const selEndereco = document.createElement('select');
    selEndereco.className = 'item-endereco';
    selEndereco.dataset.busca = '';
    selEndereco.setAttribute('aria-label', `Endereço para o item ${i + 1}`);
    preencherSelect(selEndereco, enderecos, (e) => e.codigo, 'Endereço...');
    if (sugerido && posicaoPrincipal.has(sugerido.id)) selEndereco.value = posicaoPrincipal.get(sugerido.id);
    tdEndereco.appendChild(selEndereco);

    // Quantidade e valor (editáveis: a unidade da nota pode ser diferente da do sistema)
    const tdQtd = celula(tr, '', 'num');
    const qtd = document.createElement('input');
    qtd.type = 'number';
    qtd.min = '1';
    qtd.step = '1';
    qtd.className = 'item-qtd';
    qtd.value = Number.isInteger(item.quantidade) ? item.quantidade : Math.round(item.quantidade);
    qtd.setAttribute('aria-label', `Quantidade do item ${i + 1}`);
    tdQtd.appendChild(qtd);

    const tdValor = celula(tr, '', 'num');
    const valor = document.createElement('input');
    valor.type = 'number';
    valor.min = '0';
    valor.step = '0.0001';
    valor.className = 'item-valor';
    valor.value = arred(item.valorUnitario);
    valor.setAttribute('aria-label', `Valor unitário do item ${i + 1}`);
    tdValor.appendChild(valor);

    celula(tr, '', 'num item-total');

    // Quando o produto muda, sugere o endereço onde ele já está
    selProduto.addEventListener('change', () => {
      if (!selEndereco.value && posicaoPrincipal.has(Number(selProduto.value))) selEndereco.value = posicaoPrincipal.get(Number(selProduto.value));
      atualizarItens();
    });
    [selEndereco, qtd, valor].forEach((campo) => campo.addEventListener('input', atualizarItens));
    selEndereco.addEventListener('change', atualizarItens);

    corpo.appendChild(tr);
  });

  $('total-xml').textContent = formatarMoeda(nota.xml.totalProdutos);
  $('nota-itens').hidden = false;
  atualizarItens();
}

// Lê a tabela, mostra totais e avisos e libera (ou não) o botão de lançar
function lerItensDaTela() {
  return [...$('itens-nota').querySelectorAll('tr')].map((tr) => {
    const item = nota.xml.itens[Number(tr.dataset.indice)];
    return {
      tr,
      item,
      incluir: tr.querySelector('.item-incluir').checked,
      produto: produtoPorId(tr.querySelector('.item-produto').value),
      enderecoId: tr.querySelector('.item-endereco').value,
      quantidade: Number(tr.querySelector('.item-qtd').value),
      valorUnitario: Number(tr.querySelector('.item-valor').value),
    };
  });
}

function atualizarItens() {
  if (!nota.xml) return;
  nota.confirmado = false;
  const todas = lerItensDaTela();
  const linhas = todas.filter((l) => l.incluir);
  const bloqueios = [];
  const suspeitos = [];
  let total = 0;
  let unidades = 0;

  todas.forEach((l) => {
    l.tr.classList.toggle('ignorado', !l.incluir);
    l.tr.querySelectorAll('select, .item-qtd, .item-valor').forEach((campo) => { campo.disabled = !l.incluir; });
    if (!l.incluir) {
      const aviso = l.tr.querySelector('.aviso-item');
      aviso.textContent = 'Não será lançado';
      aviso.className = 'aviso-item';
      l.tr.classList.remove('pendente');
      l.tr.querySelector('.item-total').textContent = '-';
    }
  });

  linhas.forEach((l) => {
    const i = todas.indexOf(l);
    const problemas = [];
    if (!l.produto) problemas.push('associe a um produto');
    if (!l.enderecoId) problemas.push('escolha o endereço');
    if (!Number.isInteger(l.quantidade) || l.quantidade < 1) problemas.push('quantidade inteira maior que zero');
    if (!(l.valorUnitario >= 0) || Number.isNaN(l.valorUnitario)) problemas.push('valor inválido');
    const custo = avisosDeCusto(l.produto, l.valorUnitario);
    const avisoQtd = !Number.isInteger(l.item.quantidade) ? `na nota são ${l.item.quantidade.toLocaleString('pt-BR')} ${l.item.unidade.toLowerCase()} (fracionado)` : '';

    const aviso = l.tr.querySelector('.aviso-item');
    aviso.textContent = problemas.length ? problemas.join(' · ') : [...custo, avisoQtd].filter(Boolean).join(' · ');
    aviso.className = 'aviso-item' + (problemas.length ? ' erro' : custo.length || avisoQtd ? ' atencao' : '');
    l.tr.classList.toggle('pendente', problemas.length > 0);

    const subtotal = Number.isFinite(l.quantidade * l.valorUnitario) ? l.quantidade * l.valorUnitario : 0;
    l.tr.querySelector('.item-total').textContent = formatarMoeda(subtotal);
    total += subtotal;
    unidades += Number.isInteger(l.quantidade) ? l.quantidade : 0;
    if (problemas.length) bloqueios.push(i + 1);
    if (custo.length) suspeitos.push(i + 1);
  });

  $('total-qtd').textContent = `${inteiro(unidades)} un`;
  $('total-lancar').textContent = formatarMoeda(total);

  const botao = $('lancar-nota');
  const jaLancada = nota.consulta && nota.consulta.lancada;
  const chaveDiferente = nota.chave && nota.xml && nota.chave.chave !== nota.xml.chave;
  botao.disabled = bloqueios.length > 0 || jaLancada || chaveDiferente || linhas.length === 0;
  botao.textContent = `Lançar nota (${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'} · ${formatarMoeda(total)})`;

  const mensagem = $('mensagem-nota');
  if (jaLancada) avisar(mensagem, 'Esta nota já foi lançada no sistema.', null);
  else if (chaveDiferente) avisar(mensagem, 'A nota bipada não é a do XML. Bipe a nota certa ou carregue o XML certo.', null);
  else if (!linhas.length) avisar(mensagem, 'Marque pelo menos um item para lançar.', null);
  else if (bloqueios.length) avisar(mensagem, `Complete o(s) item(ns) ${bloqueios.join(', ')} para lançar, ou desmarque os que não vão entrar.`, null);
  else if (suspeitos.length) avisar(mensagem, `Confira o custo do(s) item(ns) ${suspeitos.join(', ')} antes de lançar.`, null);
  else avisar(mensagem, '', null);
  mensagem.className = 'aviso' + (jaLancada || chaveDiferente ? ' erro' : bloqueios.length || suspeitos.length ? ' atencao' : '');
}

async function lancarNota() {
  const todas = lerItensDaTela();
  const linhas = todas.filter((l) => l.incluir);
  const suspeitos = linhas.filter((l) => avisosDeCusto(l.produto, l.valorUnitario).length);

  // Custo suspeito: o primeiro clique só pede confirmação
  if (suspeitos.length && !nota.confirmado) {
    nota.confirmado = true;
    $('mensagem-nota').textContent = `O custo do(s) item(ns) ${suspeitos.map((l) => todas.indexOf(l) + 1).join(', ')} parece alto. Se estiver certo, clique de novo para confirmar.`;
    $('mensagem-nota').className = 'aviso atencao';
    $('lancar-nota').textContent = 'Confirmar e lançar mesmo assim';
    return;
  }

  const botao = $('lancar-nota');
  botao.disabled = true;
  try {
    const dados = await chamarApi('/api/entrada/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nota_fiscal: nota.xml.chave,
        usuario_id: usuarioId(),
        itens: linhas.map((l) => ({
          produto_id: l.produto.id,
          endereco_id: Number(l.enderecoId),
          quantidade: l.quantidade,
          valor_unitario: l.valorUnitario,
        })),
      }),
    });
    avisar($('mensagem-entrada'), '', null);
    if (window.WMS && window.WMS.avisar) window.WMS.avisar(`NF-e nº ${nota.xml.numero} lançada: ${dados.itens} item(ns), ${inteiro(dados.unidades)} un, ${formatarMoeda(dados.valor)}.`, 'sucesso');
    limparNota();
    await Promise.all([carregarCadastros(), carregarHistorico()]);
  } catch (erro) {
    avisar($('mensagem-nota'), erro.message, 'erro');
    botao.disabled = false;
  }
}

function limparNota() {
  Object.assign(nota, { chave: null, consulta: null, xml: null, confirmado: false });
  $('chave').value = '';
  $('xml-arquivo').value = '';
  mostrarStatus($('chave-status'), '');
  mostrarStatus($('xml-status'), '');
  mostrarDadosNota();
  $('itens-nota').replaceChildren();
  $('nota-itens').hidden = true;
  $('chave').focus();
}

function prepararNota() {
  const chave = $('chave');
  // Leitor de código de barras: digita os números e manda Enter
  chave.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); processarChave(); }
  });
  chave.addEventListener('input', () => {
    const numeros = NFe.somenteNumeros(chave.value);
    if (numeros.length === 44) processarChave();
    else if (numeros.length > 44) mostrarStatus($('chave-status'), `Números demais (${numeros.length}). A chave tem 44.`, 'erro');
    else mostrarStatus($('chave-status'), numeros.length ? `${numeros.length} de 44 números` : '');
  });
  chave.addEventListener('paste', () => setTimeout(() => chave.dispatchEvent(new Event('input')), 0));

  $('xml-arquivo').addEventListener('change', (e) => carregarXml(e.target.files[0]));
  const area = $('area-xml');
  ['dragenter', 'dragover'].forEach((tipo) => area.addEventListener(tipo, (e) => { e.preventDefault(); area.classList.add('arrastando'); }));
  ['dragleave', 'drop'].forEach((tipo) => area.addEventListener(tipo, () => area.classList.remove('arrastando')));
  area.addEventListener('drop', (e) => { e.preventDefault(); carregarXml(e.dataTransfer.files[0]); });

  $('endereco-todos').addEventListener('change', () => {
    const valor = $('endereco-todos').value;
    if (!valor) return;
    $('itens-nota').querySelectorAll('.item-endereco').forEach((s) => { s.value = valor; });
    atualizarItens();
  });
  $('lancar-nota').addEventListener('click', lancarNota);
  $('cancelar-nota').addEventListener('click', limparNota);
  $('limpar-nota').addEventListener('click', limparNota);
}

// ==================== 2. Entrada manual ====================

let manualConfirmado = false;

function modoValor() {
  return document.querySelector('input[name="modo-valor"]:checked').value;
}

// Valor por unidade, seja qual for o modo escolhido
function valorUnitarioManual() {
  const quantidade = Number($('quantidade').value);
  const valor = Number($('valor_unitario').value);
  if ($('valor_unitario').value === '' || !(valor >= 0)) return NaN;
  if (modoValor() === 'unitario') return valor;
  return Number.isInteger(quantidade) && quantidade > 0 ? arred(valor / quantidade) : NaN;
}

function atualizarPrevia() {
  manualConfirmado = false;
  $('botao-entrada').textContent = 'Registrar entrada';
  $('rotulo-valor').textContent = modoValor() === 'unitario' ? 'Valor unitário (R$)' : 'Valor total da linha (R$)';

  const quantidade = Number($('quantidade').value);
  const unitario = valorUnitarioManual();
  const previa = $('previa-entrada');
  if (!Number.isInteger(quantidade) || quantidade < 1 || Number.isNaN(unitario)) {
    previa.textContent = '';
    previa.className = 'previa-entrada';
    return;
  }
  const avisos = avisosDeCusto(produtoPorId($('produto_id').value), unitario);
  previa.textContent = `${inteiro(quantidade)} un × ${formatarMoeda(unitario)} = ${formatarMoeda(quantidade * unitario)}` +
    (avisos.length ? `  ·  Atenção: ${avisos.join('; ')}.` : '');
  previa.className = 'previa-entrada' + (avisos.length ? ' atencao' : '');
}

async function registrarManual(e) {
  e.preventDefault();
  const unitario = valorUnitarioManual();
  if (Number.isNaN(unitario)) {
    avisar($('mensagem-entrada'), 'Informe quantidade e valor válidos.', 'erro');
    return;
  }

  // Custo suspeito: o primeiro clique só pede confirmação
  const avisos = avisosDeCusto(produtoPorId($('produto_id').value), unitario);
  if (avisos.length && !manualConfirmado) {
    manualConfirmado = true;
    $('botao-entrada').textContent = 'Confirmar mesmo assim';
    $('mensagem-entrada').textContent = `Confira: o ${avisos.join(' e ')}. Se o valor for o total da nota, escolha "Total da linha". Se estiver certo, clique de novo.`;
    $('mensagem-entrada').className = 'aviso atencao';
    return;
  }

  const botao = $('botao-entrada');
  botao.disabled = true;
  try {
    const resultado = await chamarApi('/api/entrada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produto_id: $('produto_id').value,
        endereco_id: $('endereco_id').value,
        quantidade: $('quantidade').value,
        nota_fiscal: $('nota_fiscal').value,
        valor_unitario: unitario,
        usuario_id: usuarioId(),
      }),
    });
    avisar($('mensagem-entrada'),
      `${resultado.mensagem || 'Entrada registrada!'} Novo custo médio do produto: ${formatarMoeda(resultado.custo_medio)}.`, 'sucesso');
    $('formEntrada').reset();
    atualizarPrevia();
    await Promise.all([carregarCadastros(), carregarHistorico()]);
  } catch (erro) {
    avisar($('mensagem-entrada'), erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
}

// ==================== 3. Histórico ====================

async function carregarHistorico() {
  const tbody = $('tabelaEntradas');
  try {
    const entradas = await chamarApi('/api/entrada');
    tbody.innerHTML = '';
    $('total-entradas').textContent = entradas.length ? `${inteiro(entradas.length)} registros` : '';

    if (entradas.length === 0) {
      const tr = document.createElement('tr');
      celula(tr, 'Nenhuma entrada registrada.', 'vazio').colSpan = 8;
      tbody.appendChild(tr);
      return;
    }

    entradas.forEach((item) => {
      const tr = document.createElement('tr');
      celula(tr, item.id, 'secundario');
      celula(tr, new Date(item.data).toLocaleString('pt-BR'), 'secundario');
      celula(tr, `${item.produto_codigo ? item.produto_codigo + ' · ' : ''}${item.produto_nome || `Produto #${item.produto_id}`}`, 'descricao');
      celula(tr, item.endereco_codigo || `Endereço #${item.endereco_id}`, 'cod');
      celula(tr, inteiro(item.quantidade), 'num');
      celula(tr, formatarMoeda(item.valor_unitario), 'num');
      celula(tr, formatarMoeda(item.valor_total), 'num');
      // Chave de 44 números: mostra "NF-e nº" e deixa a chave completa no título
      const chave = NFe.lerChave(item.nota_fiscal || '');
      const tdNota = celula(tr, chave.valida ? `NF-e ${chave.numero}` : (item.nota_fiscal || '-'), 'secundario');
      if (chave.valida) tdNota.title = NFe.formatarChave(chave.chave);
      tbody.appendChild(tr);
    });
  } catch (erro) {
    console.error('Erro ao carregar histórico:', erro);
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    celula(tr, 'Não foi possível carregar o histórico.', 'vazio').colSpan = 8;
    tbody.appendChild(tr);
  }
}

// ==================== Início ====================

document.addEventListener('DOMContentLoaded', () => {
  prepararNota();
  $('formEntrada').addEventListener('submit', registrarManual);
  $('formEntrada').addEventListener('input', atualizarPrevia);
  $('formEntrada').addEventListener('change', atualizarPrevia);
  $('formEntrada').addEventListener('reset', () => setTimeout(atualizarPrevia, 0));
  carregarCadastros();
  carregarHistorico();
});
