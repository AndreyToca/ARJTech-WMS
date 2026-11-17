/*
 * MAPA DO ARMAZÉM (vista de cima)  —  Responsável: FELIPE (estoque)
 *
 * Desenha a planta a partir dos endereços cadastrados (rua > prateleira > nível):
 *  - cada RUA é uma fileira de porta-paletes; entre as fileiras ficam os corredores;
 *  - cada PRATELEIRA é um vão da fileira (números que faltam aparecem como vão sem cadastro);
 *  - cada NÍVEL é uma faixa dentro do vão (nível 1 embaixo).
 * Cor = quanto há no endereço (quantidade ou valor), numa escala de um tom só (validada contra o fundo escuro).
 * Vermelho com "!" = estoque baixo. Passe o mouse para ver os produtos; clique para abrir os detalhes.
 *
 * Uso (estoque.js): EstoqueMapa.iniciar(elemento, { aoEscolher }) e EstoqueMapa.atualizar(estoque, enderecos, termoBusca)
 */
const EstoqueMapa = (() => {
  const SVG = 'http://www.w3.org/2000/svg';
  // Escala sequencial (validada: monotônica, um tom, contraste ≥ 2:1 contra o piso #132a45)
  const ESCALA = ['#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];
  const TEXTO_ESCURO = new Set(['#9ec5f4', '#cde2fb']); // tons claros pedem texto escuro
  const ESTOQUE_BAIXO = 10;

  const G = { vao: 112, nivelAltura: 22, folgaVao: 6, corredor: 54, margemEsq: 84, margemTopo: 54, doca: 190, margemBaixo: 40 };

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
  const inteiro = (n) => Number(n || 0).toLocaleString('pt-BR');
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ordemNatural = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true });

  let raiz, palco, tooltip, legenda, detalhes, opcoes = {};
  let modoCor = 'quantidade';
  let ultimo = { estoque: [], enderecos: [], termo: '' };
  let selecionado = null;

  function el(tag, attrs = {}, pai) {
    const e = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (pai) pai.appendChild(e);
    return e;
  }
  function html(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  // ---------- Estrutura da área do mapa ----------
  function iniciar(container, op = {}) {
    raiz = container;
    opcoes = op;
    raiz.classList.add('mapa-armazem');
    raiz.replaceChildren();

    const barra = html('div', 'mapa-barra');
    const cor = html('div', 'alternador mapa-cor');
    cor.setAttribute('role', 'radiogroup');
    cor.setAttribute('aria-label', 'Colorir o mapa por');
    [['quantidade', 'Quantidade'], ['valor', 'Valor em estoque']].forEach(([valor, rotulo]) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'mapa-cor';
      input.value = valor;
      input.checked = valor === modoCor;
      input.addEventListener('change', () => { modoCor = valor; desenhar(); });
      label.append(input, html('span', null, rotulo));
      cor.appendChild(label);
    });
    legenda = html('div', 'mapa-legenda');
    barra.append(html('span', 'mapa-rotulo', 'Colorir por'), cor, legenda);

    const corpo = html('div', 'mapa-corpo');
    palco = html('div', 'mapa-palco');
    detalhes = html('aside', 'mapa-detalhes');
    detalhes.setAttribute('aria-live', 'polite');
    corpo.append(palco, detalhes);

    tooltip = html('div', 'tooltip-grafico mapa-tooltip');
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    raiz.append(barra, corpo);
    mostrarDetalhes(null);
  }

  function atualizar(estoque, enderecos, termo) {
    ultimo = { estoque, enderecos, termo: termo || '' };
    if (raiz && !raiz.hidden) desenhar();
  }

  // ---------- Dados por endereço ----------
  function montarPosicoes() {
    const porEndereco = new Map();
    ultimo.enderecos.forEach((e) => porEndereco.set(e.id, { ...e, itens: [], quantidade: 0, valor: 0, baixo: false }));
    ultimo.estoque.forEach((linha) => {
      const pos = porEndereco.get(linha.endereco_id);
      if (!pos) return;
      pos.itens.push(linha);
      pos.quantidade += Number(linha.quantidade || 0);
      pos.valor += Number(linha.valor_total || 0);
      if (Number(linha.quantidade) < ESTOQUE_BAIXO) pos.baixo = true;
    });
    const termo = semAcento(ultimo.termo.trim());
    porEndereco.forEach((pos) => {
      pos.combina = !termo || semAcento(pos.codigo).includes(termo) ||
        pos.itens.some((i) => semAcento(`${i.codigo} ${i.nome}`).includes(termo));
    });
    return [...porEndereco.values()];
  }

  // Faixas da escala: divide os endereços ocupados em 5 grupos de tamanho parecido
  function faixas(valores) {
    const ordenados = valores.filter((v) => v > 0).sort((a, b) => a - b);
    if (!ordenados.length) return [];
    const limites = [];
    for (let i = 1; i < ESCALA.length; i++) limites.push(ordenados[Math.floor((ordenados.length * i) / ESCALA.length)] ?? ordenados[ordenados.length - 1]);
    return limites;
  }
  const passo = (valor, limites) => { let i = 0; while (i < limites.length && valor >= limites[i]) i++; return i; };

  // ---------- Desenho ----------
  function desenhar() {
    if (!palco) return;
    esconderTooltip();
    const posicoes = montarPosicoes();
    palco.replaceChildren();

    if (!posicoes.length) {
      palco.appendChild(html('p', 'mapa-vazio', 'Nenhum endereço cadastrado. Cadastre em Endereços para ver a planta.'));
      legenda.replaceChildren();
      return;
    }

    // Agrupa: rua -> prateleira -> nível
    const ruas = new Map();
    posicoes.forEach((p) => {
      if (!ruas.has(p.rua)) ruas.set(p.rua, new Map());
      const rua = ruas.get(p.rua);
      if (!rua.has(p.prateleira)) rua.set(p.prateleira, new Map());
      rua.get(p.prateleira).set(p.nivel, p);
    });
    const nomesRuas = [...ruas.keys()].sort(ordemNatural);

    // Vãos de cada rua: prateleiras numéricas preenchem os números que faltam (vão sem cadastro)
    const vaosDaRua = (rua) => {
      const chaves = [...ruas.get(rua).keys()].sort(ordemNatural);
      if (chaves.every((k) => /^\d+$/.test(k))) {
        const nums = chaves.map(Number);
        const largura = Math.max(...chaves.map((k) => k.length));
        const lista = [];
        for (let n = Math.min(...nums); n <= Math.max(...nums); n++) lista.push(String(n).padStart(largura, '0'));
        return lista;
      }
      return chaves;
    };
    const niveisDaRua = (rua) => {
      const todos = new Set();
      ruas.get(rua).forEach((niveis) => niveis.forEach((_, n) => todos.add(n)));
      return [...todos].sort(ordemNatural).reverse(); // nível mais alto em cima
    };

    const maxVaos = Math.max(...nomesRuas.map((r) => vaosDaRua(r).length));
    const alturaRua = (rua) => niveisDaRua(rua).length * G.nivelAltura;
    const larguraArea = G.margemEsq + maxVaos * (G.vao + G.folgaVao) + 40;
    const largura = larguraArea + G.doca;
    let y = G.margemTopo;
    const linhasY = nomesRuas.map((rua) => { const topo = y; y += alturaRua(rua) + G.corredor; return topo; });
    const altura = y - G.corredor + G.margemBaixo + 20;

    const valores = posicoes.map((p) => (modoCor === 'valor' ? p.valor : p.quantidade));
    const limites = faixas(valores);
    desenharLegenda(limites);

    const svg = el('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'mapa-svg', role: 'img', 'aria-label': `Planta do armazém com ${posicoes.length} endereços` });
    svg.style.minWidth = `${Math.min(largura, 760)}px`;

    // Piso com grade e faixas de corredor
    const defs = el('defs', {}, svg);
    const grade = el('pattern', { id: 'piso-grade', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M24 0H0V24', fill: 'none', stroke: '#1b3655', 'stroke-width': 1 }, grade);
    const zebra = el('pattern', { id: 'zebra-doca', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 7, height: 14, fill: '#f5b301' }, zebra);
    el('rect', { x: 7, width: 7, height: 14, fill: '#1f3a5f' }, zebra);
    const vazio = el('pattern', { id: 'vao-vazio', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#2a4668', 'stroke-width': 2 }, vazio);
    const brilho = el('filter', { id: 'brilho', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    el('feGaussianBlur', { stdDeviation: 3, result: 'b' }, brilho);
    const merge = el('feMerge', {}, brilho);
    el('feMergeNode', { in: 'b' }, merge);
    el('feMergeNode', { in: 'SourceGraphic' }, merge);

    el('rect', { width: largura, height: altura, fill: '#132a45' }, svg);
    el('rect', { width: largura, height: altura, fill: 'url(#piso-grade)' }, svg);
    el('rect', { x: 8, y: 8, width: largura - 16, height: altura - 16, rx: 10, fill: 'none', stroke: '#2c4a6e', 'stroke-width': 2 }, svg);

    // Corredor principal (vertical) ligando as ruas à doca
    const xCorredor = larguraArea - 26;
    el('rect', { x: xCorredor - 14, y: 20, width: 28, height: altura - 40, fill: '#17314f' }, svg);
    el('line', { x1: xCorredor, y1: 26, x2: xCorredor, y2: altura - 26, stroke: '#f5b301', 'stroke-width': 2, 'stroke-dasharray': '10 10', opacity: 0.55 }, svg);
    const tituloCorredor = el('text', { x: xCorredor, y: 18, class: 'mapa-texto-fraco', 'text-anchor': 'middle' }, svg);
    tituloCorredor.textContent = 'CORREDOR PRINCIPAL';

    // Doca de recebimento/expedição
    const xDoca = larguraArea + 18;
    el('rect', { x: xDoca, y: 28, width: G.doca - 34, height: altura - 56, rx: 8, fill: '#0f2238', stroke: '#2c4a6e' }, svg);
    el('rect', { x: largura - 22, y: 28, width: 10, height: altura - 56, fill: 'url(#zebra-doca)', opacity: 0.85 }, svg);
    const textoDoca = el('text', { x: xDoca + (G.doca - 34) / 2, y: 50, class: 'mapa-doca-titulo', 'text-anchor': 'middle' }, svg);
    textoDoca.textContent = 'DOCA 01';
    const portas = Math.max(2, Math.min(4, Math.floor((altura - 120) / 70)));
    for (let i = 0; i < portas; i++) {
      const py = 70 + i * ((altura - 110) / portas);
      el('rect', { x: largura - 64, y: py, width: 40, height: 46, rx: 4, fill: '#1a3352', stroke: '#3a5577' }, svg);
      const sinal = el('circle', { cx: largura - 70, cy: py + 8, r: 3.5, class: i === 0 ? 'mapa-sinal ativo' : 'mapa-sinal' }, svg);
      sinal.setAttribute('fill', i === 0 ? '#3ddc84' : '#3a5577');
      // pallets esperando na doca
      if (i < 2) {
        el('rect', { x: xDoca + 14, y: py + 6, width: 30, height: 22, rx: 2, fill: '#c8915a' }, svg);
        el('rect', { x: xDoca + 14, y: py + 15, width: 30, height: 3, fill: 'rgba(150,100,55,.6)' }, svg);
        el('rect', { x: xDoca + 50, y: py + 10, width: 22, height: 16, rx: 2, fill: '#b98250' }, svg);
      }
    }

    // Ruas (fileiras de porta-paletes)
    const celulas = [];
    nomesRuas.forEach((rua, iRua) => {
      const topo = linhasY[iRua];
      const niveis = niveisDaRua(rua);
      const vaos = vaosDaRua(rua);
      const alt = niveis.length * G.nivelAltura;

      // Rótulo da rua e corredor abaixo dela
      const rotulo = el('text', { x: 24, y: topo + alt / 2 + 6, class: 'mapa-rua' }, svg);
      rotulo.textContent = `RUA ${rua}`;
      if (iRua < nomesRuas.length - 1) {
        const yc = topo + alt + G.corredor / 2;
        el('line', { x1: G.margemEsq - 8, y1: yc, x2: xCorredor - 18, y2: yc, stroke: '#f5b301', 'stroke-width': 1.5, 'stroke-dasharray': '6 10', opacity: 0.35 }, svg);
        const seta = el('text', { x: (G.margemEsq + xCorredor) / 2, y: yc + 4, class: 'mapa-texto-fraco', 'text-anchor': 'middle' }, svg);
        seta.textContent = '›   ›   ›';
      }

      vaos.forEach((vao, iVao) => {
        const x = G.margemEsq + iVao * (G.vao + G.folgaVao);
        const niveisDoVao = ruas.get(rua).get(vao);
        // Estrutura do porta-palete (montantes laranja, como nos armazéns de verdade)
        el('rect', { x: x - 1, y: topo - 1, width: G.vao + 2, height: alt + 2, rx: 3, fill: '#0f2238', stroke: niveisDoVao ? '#e07b2e' : '#2c4a6e', 'stroke-width': niveisDoVao ? 1.5 : 1, 'stroke-dasharray': niveisDoVao ? '' : '4 4' }, svg);
        const nomeVao = el('text', { x: x + G.vao / 2, y: topo - 6, class: 'mapa-texto-fraco', 'text-anchor': 'middle' }, svg);
        nomeVao.textContent = niveisDoVao ? `${rua}-${vao}` : `${rua}-${vao} · sem cadastro`;

        niveis.forEach((nivel, iNivel) => {
          const yN = topo + iNivel * G.nivelAltura;
          const pos = niveisDoVao && niveisDoVao.get(nivel);
          if (!pos) {
            el('rect', { x: x + 3, y: yN + 2, width: G.vao - 6, height: G.nivelAltura - 4, rx: 2, fill: 'url(#vao-vazio)', opacity: 0.6 }, svg);
            return;
          }
          const valor = modoCor === 'valor' ? pos.valor : pos.quantidade;
          const ocupado = valor > 0;
          const cor = ocupado ? ESCALA[passo(valor, limites)] : null;

          const grupo = el('g', { class: 'mapa-celula' + (pos.combina ? '' : ' apagada') + (pos.baixo ? ' baixo' : '') + (selecionado === pos.id ? ' selecionada' : ''), tabindex: 0, role: 'button' }, svg);
          grupo.setAttribute('aria-label', `${pos.codigo}: ${pos.itens.length ? pos.itens.map((i) => `${i.nome} ${i.quantidade} ${String(i.unidade || '').toLowerCase()}`).join(', ') : 'vazio'}`);
          grupo.style.setProperty('--atraso', `${(iRua * 6 + iVao * 2 + iNivel) * 18}ms`);
          const caixa = el('rect', {
            x: x + 3, y: yN + 2, width: G.vao - 6, height: G.nivelAltura - 4, rx: 3,
            fill: cor || '#1a3352', stroke: pos.baixo ? '#d03b3b' : cor ? 'rgba(255,255,255,.18)' : '#3a5577',
            'stroke-width': pos.baixo ? 2 : 1, class: 'mapa-caixa',
          }, grupo);
          if (ocupado && pos.combina && ultimo.termo) caixa.setAttribute('filter', 'url(#brilho)');
          const texto = el('text', { x: x + 9, y: yN + G.nivelAltura / 2 + 4, class: 'mapa-codigo', fill: !cor ? '#7f94ad' : TEXTO_ESCURO.has(cor) ? '#0b1a2b' : '#ffffff' }, grupo);
          texto.textContent = pos.codigo;
          if (ocupado) {
            const qtd = el('text', { x: x + G.vao - 9, y: yN + G.nivelAltura / 2 + 4, class: 'mapa-qtd', 'text-anchor': 'end', fill: TEXTO_ESCURO.has(cor) ? '#0b1a2b' : '#ffffff' }, grupo);
            qtd.textContent = modoCor === 'valor' ? moedaCurta.format(pos.valor) : inteiro(pos.quantidade);
          }
          if (pos.baixo) {
            el('circle', { cx: x + G.vao - 4, cy: yN + 3, r: 6, fill: '#d03b3b', stroke: '#132a45', 'stroke-width': 2 }, grupo);
            const exc = el('text', { x: x + G.vao - 4, y: yN + 6.5, 'text-anchor': 'middle', class: 'mapa-exclamacao' }, grupo);
            exc.textContent = '!';
          }

          grupo.addEventListener('pointermove', (e) => mostrarTooltip(pos, e.clientX, e.clientY));
          grupo.addEventListener('pointerleave', esconderTooltip);
          grupo.addEventListener('focus', () => { const r = grupo.getBoundingClientRect(); mostrarTooltip(pos, r.left + r.width / 2, r.top); });
          grupo.addEventListener('blur', esconderTooltip);
          grupo.addEventListener('click', () => escolher(pos));
          grupo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(pos); } });
          celulas.push(pos);
        });
      });
    });

    // Empilhadeira circulando pelo corredor principal (só decoração; respeita "reduzir movimento")
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const empilhadeira = el('g', { class: 'mapa-empilhadeira', 'aria-hidden': 'true' }, svg);
      el('rect', { x: -9, y: -12, width: 18, height: 22, rx: 3, fill: '#f5b301' }, empilhadeira);
      el('rect', { x: -6, y: -8, width: 12, height: 9, rx: 1, fill: '#1f3a5f' }, empilhadeira);
      el('rect', { x: -7, y: 10, width: 3, height: 12, fill: '#8a9bb0' }, empilhadeira);
      el('rect', { x: 4, y: 10, width: 3, height: 12, fill: '#8a9bb0' }, empilhadeira);
      el('circle', { cx: 0, cy: -14, r: 3, fill: '#ff9a1f', class: 'mapa-giroflex' }, empilhadeira);
      const caminho = `M${xCorredor},${altura - 40} V40 V${altura - 40}`;
      const anim = el('animateMotion', { dur: `${Math.max(10, altura / 30)}s`, repeatCount: 'indefinite', path: caminho, rotate: 'auto-reverse' }, empilhadeira);
      anim.setAttribute('keyPoints', '0;0.5;1');
      anim.setAttribute('keyTimes', '0;0.5;1');
      anim.setAttribute('calcMode', 'linear');
    }

    palco.appendChild(svg);
    if (selecionado != null) mostrarDetalhes(celulas.find((c) => c.id === selecionado) || null);
  }

  function desenharLegenda(limites) {
    legenda.replaceChildren();
    const formato = (v) => (modoCor === 'valor' ? moedaCurta.format(v) : inteiro(v));
    const item = (cor, texto, extra) => {
      const span = html('span', 'mapa-legenda-item');
      const amostra = html('span', 'mapa-amostra' + (extra ? ' ' + extra : ''));
      if (cor) amostra.style.background = cor;
      if (extra === 'baixo') amostra.textContent = '!';
      span.append(amostra, texto);
      legenda.appendChild(span);
    };
    item(null, 'Vazio', 'vazia');
    if (limites.length) {
      const escala = html('span', 'mapa-legenda-item');
      const faixa = html('span', 'mapa-escala');
      ESCALA.forEach((c) => { const s = html('span'); s.style.background = c; faixa.appendChild(s); });
      escala.append('Menos', faixa, `Mais (${modoCor === 'valor' ? 'acima de ' : '≥ '}${formato(limites[limites.length - 1])})`);
      legenda.appendChild(escala);
    }
    item(null, `Estoque baixo (< ${ESTOQUE_BAIXO})`, 'baixo');
  }

  // ---------- Tooltip e detalhes ----------
  function mostrarTooltip(pos, x, y) {
    tooltip.replaceChildren();
    tooltip.appendChild(html('div', 'tooltip-titulo', `Endereço ${pos.codigo} · Rua ${pos.rua}, prateleira ${pos.prateleira}, nível ${pos.nivel}`));
    if (!pos.itens.length) {
      tooltip.appendChild(html('div', 'tooltip-principal', 'Vazio'));
    } else {
      const principal = html('div', 'tooltip-principal');
      principal.append(html('span', 'tooltip-chave'), modoCor === 'valor' ? moeda.format(pos.valor) : `${inteiro(pos.quantidade)} unidades`);
      tooltip.appendChild(principal);
      pos.itens.slice(0, 5).forEach((i) => {
        const linha = html('div', 'tooltip-linha');
        linha.append(`${i.codigo} ${i.nome}`, html('strong', null, `${inteiro(i.quantidade)} ${String(i.unidade || '').toLowerCase()}`));
        tooltip.appendChild(linha);
      });
      if (pos.itens.length > 5) tooltip.appendChild(html('div', 'tooltip-linha', `+${pos.itens.length - 5} produtos`));
      if (pos.baixo) tooltip.appendChild(html('div', 'tooltip-linha mapa-tooltip-alerta', '! Estoque baixo neste endereço'));
    }
    tooltip.classList.add('visivel');
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    tooltip.style.left = `${Math.min(Math.max(8, x + 14), window.innerWidth - w - 8)}px`;
    tooltip.style.top = `${y - h - 14 < 8 ? y + 18 : y - h - 14}px`;
  }
  function esconderTooltip() { if (tooltip) tooltip.classList.remove('visivel'); }

  function escolher(pos) {
    selecionado = pos.id;
    palco.querySelectorAll('.mapa-celula.selecionada').forEach((c) => c.classList.remove('selecionada'));
    desenhar();
  }

  function mostrarDetalhes(pos) {
    detalhes.replaceChildren();
    if (!pos) {
      detalhes.append(
        html('h3', null, 'Clique num endereço'),
        html('p', 'secundario', 'Passe o mouse para espiar o que está guardado. Clique para ver os detalhes aqui.'),
      );
      const resumo = montarResumo();
      if (resumo) detalhes.appendChild(resumo);
      return;
    }
    detalhes.append(html('span', 'mapa-detalhes-rotulo', `Rua ${pos.rua} · prateleira ${pos.prateleira} · nível ${pos.nivel}`), html('h3', 'cod', pos.codigo));
    const numeros = html('dl', 'mapa-detalhes-numeros');
    [['Unidades', inteiro(pos.quantidade)], ['Valor (custo)', moeda.format(pos.valor)], ['Produtos', inteiro(pos.itens.length)]].forEach(([dt, dd]) => {
      const div = html('div');
      div.append(html('dt', null, dt), html('dd', null, dd));
      numeros.appendChild(div);
    });
    detalhes.appendChild(numeros);
    if (!pos.itens.length) {
      detalhes.appendChild(html('p', 'secundario', 'Endereço vazio. Disponível para armazenar.'));
    } else {
      const lista = html('ul', 'mapa-detalhes-lista');
      pos.itens.slice().sort((a, b) => b.quantidade - a.quantidade).forEach((i) => {
        const li = html('li', Number(i.quantidade) < ESTOQUE_BAIXO ? 'baixo' : '');
        const nome = html('span');
        nome.append(html('span', 'cod', i.codigo), ` ${i.nome}`);
        li.append(nome, html('strong', null, `${inteiro(i.quantidade)} ${String(i.unidade || '').toLowerCase()}`));
        lista.appendChild(li);
      });
      detalhes.appendChild(lista);
    }
    const acoes = html('div', 'botoes');
    const verLista = html('button', 'secundario', 'Ver na lista');
    verLista.type = 'button';
    verLista.addEventListener('click', () => opcoes.aoVerNaLista && opcoes.aoVerNaLista(pos.codigo));
    const fechar = html('button', 'secundario', 'Fechar');
    fechar.type = 'button';
    fechar.addEventListener('click', () => { selecionado = null; desenhar(); mostrarDetalhes(null); });
    acoes.append(verLista, fechar);
    detalhes.appendChild(acoes);
  }

  // Resumo de ocupação do armazém (mostrado quando nada está selecionado)
  function montarResumo() {
    const posicoes = montarPosicoes();
    if (!posicoes.length) return null;
    const ocupados = posicoes.filter((p) => p.quantidade > 0).length;
    const alertas = posicoes.filter((p) => p.baixo).length;
    const dl = html('dl', 'mapa-detalhes-numeros');
    [['Endereços', inteiro(posicoes.length)], ['Ocupados', `${inteiro(ocupados)} (${Math.round((ocupados / posicoes.length) * 100)}%)`], ['Com alerta', inteiro(alertas)]].forEach(([dt, dd]) => {
      const div = html('div');
      div.append(html('dt', null, dt), html('dd', null, dd));
      dl.appendChild(div);
    });
    return dl;
  }

  return { iniciar, atualizar, desenhar };
})();
