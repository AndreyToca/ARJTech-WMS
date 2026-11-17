/*
 * ESQUELETO DAS TELAS DOS MÓDULOS  —  Responsável: ANDREY
 *
 * Monta o mesmo topo e a mesma barra lateral do Painel em todas as telas,
 * para não repetir esse HTML em cada página.
 * Uso: <body class="pagina-menu pagina-modulo" data-modulo="entrada"> e carregar
 * este arquivo ANTES do script da tela.
 */
(function () {
  let usuario = null;
  try {
    usuario = JSON.parse(localStorage.getItem('usuario'));
  } catch {
    // valor corrompido: trata como deslogado
  }
  if (!usuario) {
    window.location.replace('/pages/login.html');
    return;
  }

  const ICONES = {
    painel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    produtos: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    enderecos: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    entrada: '<path d="M12 3v11m-4-4 4 4 4-4"/><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    saida: '<path d="M12 15V4m-4 4 4-4 4 4"/><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    estoque: '<path d="M4 3v18M20 3v18M4 9h16M4 15h16"/><rect x="7" y="5" width="4" height="4"/><rect x="12" y="11" width="5" height="4"/><rect x="7" y="17" width="4" height="4"/>',
  };

  // Itens da barra lateral, agrupados (o mesmo menu aparece no index.html)
  const GRUPOS = [
    {
      titulo: 'Cadastros',
      itens: [
        { id: 'produtos', nome: 'Produtos', link: '/pages/produtos.html' },
        { id: 'enderecos', nome: 'Endereços', link: '/pages/enderecos.html' },
        { id: 'clientes', nome: 'Clientes', link: '/pages/clientes.html' },
      ],
    },
    {
      titulo: 'Operação',
      itens: [
        { id: 'entrada', nome: 'Entrada', link: '/pages/entrada.html' },
        { id: 'saida', nome: 'Saída', link: '/pages/saida.html' },
        { id: 'estoque', nome: 'Estoque', link: '/pages/estoque.html' },
      ],
    },
  ];

  const icone = (nome) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;

  const atual = document.body.dataset.modulo;

  // ---------- Topo (igual ao do Painel) ----------
  const topo = document.createElement('header');
  topo.className = 'topo';
  topo.innerHTML = `
    <div class="topo-barra">
      <a href="/index.html" class="marca">
        <svg class="marca-icone" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3 28 9v14l-12 6-12-6V9z" fill="#f5b301"/>
          <path d="M16 3 28 9 16 15 4 9z" fill="#ffd25a"/>
          <path d="M16 15v14M10 6l12 6v5" stroke="#c98f00" stroke-width="1.5" fill="none"/>
        </svg>
        <span>ARJtech <strong>WMS</strong></span>
      </a>
      <form class="busca" id="busca" role="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="busca-termo" placeholder="Produto ou endereço (ex.: P001, A-01-1)" aria-label="Buscar por produto ou endereço" autocomplete="off" spellcheck="false">
        <kbd aria-hidden="true">/</kbd>
      </form>
      <div class="usuario-logado">
        <span class="avatar" id="avatar-usuario" aria-hidden="true"></span>
        <div class="usuario-info">
          <span id="nome-usuario"></span>
          <span id="perfil-usuario" class="perfil"></span>
        </div>
        <button type="button" id="botao-sair" class="botao-sair">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          <span class="botao-sair-texto">Sair</span>
        </button>
      </div>
    </div>
    <div class="esteira" aria-hidden="true">
      <span class="caixa-esteira"></span><span class="caixa-esteira"></span><span class="caixa-esteira"></span>
      <span class="caixa-esteira"></span><span class="caixa-esteira"></span>
      <div class="leitor"></div>
      <div class="cinta"></div>
    </div>`;

  // ---------- Barra lateral ----------
  const lateral = document.createElement('nav');
  lateral.className = 'lateral';
  lateral.setAttribute('aria-label', 'Módulos');
  lateral.innerHTML =
    `<a href="/index.html" class="lateral-item">${icone('painel')}<span>Painel</span></a>` +
    GRUPOS.map((grupo) =>
      '<div class="lateral-separador"></div>' +
      `<span class="lateral-grupo">${grupo.titulo}</span>` +
      grupo.itens.map((m) =>
        `<a href="${m.link}" class="lateral-item" data-modulo="${m.id}"${m.id === atual ? ' aria-current="page"' : ''}>${icone(m.id)}<span>${m.nome}</span></a>`
      ).join('')
    ).join('');

  // ---------- Encaixa o <main> da página no layout ----------
  const main = document.querySelector('main');
  const layout = document.createElement('div');
  layout.className = 'layout';
  main.classList.add('conteudo');
  main.before(layout);
  layout.append(lateral, main);
  document.body.prepend(topo);

  // ---------- Carregamento ----------
  // Barra fina no topo enquanto houver requisição em andamento
  const barra = document.createElement('div');
  barra.className = 'barra-progresso';
  barra.setAttribute('aria-hidden', 'true');
  topo.append(barra);

  // Esqueleto (linhas cinzas com brilho) nas tabelas e indicadores ainda vazios.
  // O script de cada tela apaga o esqueleto quando preenche os dados.
  document.querySelectorAll('.tabela tbody').forEach((corpo) => {
    if (corpo.children.length) return;
    const colunas = corpo.closest('table').querySelectorAll('thead th').length || 1;
    const linha = `<tr class="esqueleto" aria-hidden="true">${'<td><span></span></td>'.repeat(colunas)}</tr>`;
    corpo.innerHTML = linha.repeat(4);
  });
  document.querySelectorAll('.indicadores').forEach((area) => {
    if (area.children.length) return;
    area.innerHTML = '<div class="indicador esqueleto" aria-hidden="true"><span></span><span></span><span></span></div>'.repeat(4);
  });
  // Selects que ainda não têm opções mostram "Carregando..."
  main.querySelectorAll('select').forEach((select) => {
    if (select.options.length === 0) select.innerHTML = '<option value="">Carregando...</option>';
  });

  // Acompanha as requisições da página (fetch) para mostrar o carregamento
  // sem precisar mexer no script de cada tela.
  let pendentes = 0;
  let leiturasPendentes = 0;
  let primeiraCarga = true;
  let ultimoBotao = null;
  let timerFim = null;

  // Guarda o último botão clicado dentro da página (Salvar, Expedir, Excluir...)
  main.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button');
    if (botao) ultimoBotao = botao;
  }, true);

  function atualizarEstado() {
    clearTimeout(timerFim);
    if (pendentes > 0) {
      document.body.classList.add('ocupado');
      if (!primeiraCarga && leiturasPendentes > 0) document.body.classList.add('atualizando');
      return;
    }
    // Pequena folga para o script da tela desenhar os dados antes de tirar o desfoque
    timerFim = setTimeout(() => {
      document.body.classList.remove('ocupado', 'atualizando');
      primeiraCarga = false;
    }, 120);
  }

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (url, opcoes = {}) => {
    const metodo = String(opcoes.method || 'GET').toUpperCase();
    const leitura = metodo === 'GET';
    const botao = !leitura && ultimoBotao && main.contains(ultimoBotao) ? ultimoBotao : null;

    pendentes++;
    if (leitura) leiturasPendentes++;
    if (botao) botao.classList.add('carregando');
    atualizarEstado();
    try {
      return await fetchOriginal(url, opcoes);
    } finally {
      pendentes--;
      if (leitura) leiturasPendentes--;
      if (botao) botao.classList.remove('carregando');
      atualizarEstado();
    }
  };

  // ---------- Usuário ----------
  const nome = String(usuario.nome || 'Usuário');
  document.getElementById('nome-usuario').textContent = nome;
  document.getElementById('avatar-usuario').textContent = nome.charAt(0).toUpperCase();
  document.getElementById('perfil-usuario').textContent =
    usuario.perfil === 'admin' ? 'Administrador' : 'Operador';

  document.getElementById('botao-sair').addEventListener('click', () => {
    localStorage.removeItem('usuario');
    window.location.replace('/pages/login.html');
  });

  // ---------- Busca rápida (abre o Estoque filtrado, igual ao Painel) ----------
  const campoBusca = document.getElementById('busca-termo');
  document.getElementById('busca').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const termo = campoBusca.value.trim().toUpperCase();
    if (!termo) return;
    const filtro = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/.test(termo) ? 'endereco' : 'produto';
    window.location.href = `/pages/estoque.html?${filtro}=${encodeURIComponent(termo)}`;
  });

  document.addEventListener('keydown', (evento) => {
    const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (evento.key === '/' && !digitando) {
      evento.preventDefault();
      campoBusca.focus();
    }
  });
})();
