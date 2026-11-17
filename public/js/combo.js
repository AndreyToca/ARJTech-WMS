/*
 * LISTAS COM BUSCA  —  Responsável: ANDREY
 *
 * Transforma um <select> comum num campo em que se digita para filtrar as opções.
 * O <select> original continua na página (escondido) e sempre com o valor certo,
 * então o código de cada tela segue usando select.value, change, required etc. sem mudar nada.
 *
 * Quais selects viram busca:
 *  - os marcados com o atributo data-busca;
 *  - qualquer select com mais de 12 opções (mesmo os preenchidos depois pela API).
 * Para impedir num select específico: data-busca="nao".
 *
 * Teclado: digite para filtrar, ↑ ↓ para andar, Enter escolhe, Esc fecha.
 * A busca ignora acentos e maiúsculas e aceita várias palavras em qualquer ordem ("caixa med").
 */
(function () {
  const LIMITE_AUTOMATICO = 12;   // acima disso o select vira busca sozinho
  const MAXIMO_EXIBIDO = 150;     // itens mostrados de uma vez na lista
  let sequencia = 0;

  const normalizar = (texto) =>
    String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function aprimorar(select) {
    if (select.dataset.comboPronto || select.multiple || select.dataset.busca === 'nao') return;
    select.dataset.comboPronto = '1';
    const id = 'combo-' + (++sequencia);

    // ---------- Estrutura ----------
    const caixa = document.createElement('div');
    caixa.className = 'combo';
    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.className = 'combo-entrada';
    entrada.autocomplete = 'off';
    entrada.spellcheck = false;
    entrada.setAttribute('role', 'combobox');
    entrada.setAttribute('aria-autocomplete', 'list');
    entrada.setAttribute('aria-expanded', 'false');
    entrada.setAttribute('aria-controls', id + '-lista');
    const seta = document.createElement('button');
    seta.type = 'button';
    seta.className = 'combo-seta';
    seta.tabIndex = -1;
    seta.setAttribute('aria-label', 'Mostrar opções');
    seta.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    const lista = document.createElement('ul');
    lista.className = 'combo-lista';
    lista.id = id + '-lista';
    lista.setAttribute('role', 'listbox');
    lista.hidden = true;

    // O rótulo (<label for="...">) passa a apontar para o campo de busca
    if (select.id) {
      document.querySelectorAll(`label[for="${CSS.escape(select.id)}"]`).forEach((rotulo) => {
        entrada.id = id + '-entrada';
        rotulo.htmlFor = entrada.id;
      });
      if (!entrada.id) entrada.setAttribute('aria-label', select.getAttribute('aria-label') || select.id);
    }

    select.parentNode.insertBefore(caixa, select);
    caixa.append(entrada, seta, lista, select);
    select.classList.add('combo-original');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    let filtradas = [];
    let ativa = -1;

    const opcoes = () => [...select.options];
    const textoVazio = () => (opcoes().find((o) => o.value === '') || {}).textContent || 'Selecione...';

    // Mostra no campo o texto da opção escolhida
    function mostrarEscolhida() {
      const escolhida = select.selectedOptions[0];
      entrada.value = escolhida && escolhida.value !== '' ? escolhida.textContent : '';
      entrada.placeholder = textoVazio();
      entrada.disabled = select.disabled;
      seta.disabled = select.disabled;
      caixa.classList.toggle('desabilitado', select.disabled);
    }

    function desenhar(termo) {
      const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
      filtradas = opcoes().filter((o) => {
        if (o.disabled && o.value === '') return false;
        if (o.value === '' && palavras.length) return false;
        const alvo = normalizar(o.textContent);
        return palavras.every((p) => alvo.includes(p));
      });

      lista.replaceChildren();
      filtradas.slice(0, MAXIMO_EXIBIDO).forEach((opcao, i) => {
        const item = document.createElement('li');
        item.id = `${id}-op-${i}`;
        item.setAttribute('role', 'option');
        item.className = 'combo-opcao' + (opcao.value === '' ? ' vazia' : '');
        item.textContent = opcao.textContent;
        if (opcao.selected && opcao.value !== '') item.setAttribute('aria-selected', 'true');
        if (opcao.disabled) item.setAttribute('aria-disabled', 'true');
        // mousedown (e não click) para escolher antes de o campo perder o foco
        item.addEventListener('mousedown', (e) => { e.preventDefault(); escolher(opcao); });
        item.addEventListener('mousemove', () => marcar(i));
        lista.appendChild(item);
      });

      if (!filtradas.length) {
        const vazio = document.createElement('li');
        vazio.className = 'combo-nada';
        vazio.textContent = palavras.length ? 'Nada encontrado para essa busca.' : 'Nenhuma opção.';
        lista.appendChild(vazio);
      } else if (filtradas.length > MAXIMO_EXIBIDO) {
        const mais = document.createElement('li');
        mais.className = 'combo-nada';
        mais.textContent = `+${filtradas.length - MAXIMO_EXIBIDO} opções. Digite mais para refinar.`;
        lista.appendChild(mais);
      }

      const indiceEscolhida = filtradas.findIndex((o) => o.selected && o.value !== '');
      marcar(indiceEscolhida >= 0 && !palavras.length ? indiceEscolhida : (filtradas.length ? 0 : -1));
    }

    function marcar(i) {
      ativa = i;
      [...lista.querySelectorAll('.combo-opcao')].forEach((item, n) => item.classList.toggle('ativa', n === i));
      const item = lista.querySelector(`#${id}-op-${i}`);
      if (item) {
        entrada.setAttribute('aria-activedescendant', item.id);
        item.scrollIntoView({ block: 'nearest' });
      } else {
        entrada.removeAttribute('aria-activedescendant');
      }
    }

    // A lista fica "fixa" na tela, calculada a partir do campo: assim não é cortada
    // por tabelas com rolagem nem por janelas. Abre para cima se não couber embaixo.
    // Um ancestral com transform/filter vira a referência do "fixed": desconta a posição dele
    function referenciaFixa() {
      for (let el = caixa.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' ||
            /transform|filter|perspective/.test(cs.willChange) || /paint|layout|strict|content/.test(cs.contain)) {
          return el.getBoundingClientRect();
        }
      }
      return { left: 0, top: 0, bottom: window.innerHeight };
    }

    function posicionar() {
      const r = entrada.getBoundingClientRect();
      const ref = referenciaFixa();
      const embaixo = window.innerHeight - r.bottom - 8;
      const emCima = r.top - 8;
      const altura = Math.min(280, Math.max(embaixo, emCima));
      lista.style.left = `${Math.max(8, r.left) - ref.left}px`;
      lista.style.width = `${Math.max(r.width, 220)}px`;
      lista.style.maxHeight = `${altura}px`;
      if (embaixo >= 160 || embaixo >= emCima) {
        lista.style.top = `${r.bottom + 4 - ref.top}px`;
        lista.style.bottom = '';
      } else {
        lista.style.top = '';
        lista.style.bottom = `${ref.bottom - r.top + 4}px`;
      }
    }
    const aoRolar = (e) => { if (!lista.contains(e.target)) posicionar(); };

    function abrir() {
      if (select.disabled || !lista.hidden) return;
      lista.hidden = false;
      caixa.classList.add('aberto');
      entrada.setAttribute('aria-expanded', 'true');
      desenhar('');
      posicionar();
      window.addEventListener('scroll', aoRolar, true);
      window.addEventListener('resize', posicionar);
    }

    function fechar() {
      window.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('resize', posicionar);
      lista.hidden = true;
      caixa.classList.remove('aberto');
      entrada.setAttribute('aria-expanded', 'false');
      entrada.removeAttribute('aria-activedescendant');
    }

    function escolher(opcao) {
      if (!opcao || opcao.disabled) return;
      const mudou = select.value !== opcao.value;
      select.value = opcao.value;
      mostrarEscolhida();
      fechar();
      if (mudou) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // ---------- Eventos ----------
    entrada.addEventListener('focus', () => { entrada.select(); abrir(); });
    entrada.addEventListener('click', abrir);
    entrada.addEventListener('input', () => { abrir(); desenhar(entrada.value); });
    entrada.addEventListener('blur', () => { fechar(); mostrarEscolhida(); });
    entrada.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lista.hidden) { abrir(); return; }
        const total = Math.min(filtradas.length, MAXIMO_EXIBIDO);
        if (!total) return;
        marcar((ativa + (e.key === 'ArrowDown' ? 1 : -1) + total) % total);
      } else if (e.key === 'Enter') {
        if (!lista.hidden && ativa >= 0) { e.preventDefault(); escolher(filtradas[ativa]); }
      } else if (e.key === 'Escape') {
        if (!lista.hidden) { e.preventDefault(); e.stopPropagation(); fechar(); mostrarEscolhida(); }
      } else if (e.key === 'Tab' && !lista.hidden && ativa >= 0 && entrada.value && normalizar(entrada.value) !== normalizar((select.selectedOptions[0] || {}).textContent)) {
        escolher(filtradas[ativa]); // Tab com busca digitada escolhe o primeiro resultado
      }
    });
    seta.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (lista.hidden) { entrada.focus(); } else { fechar(); }
    });

    // O select muda por fora (opções novas da API, reset do formulário, select.value = x no código da tela)
    new MutationObserver(() => mostrarEscolhida())
      .observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
    select.addEventListener('change', mostrarEscolhida);
    if (select.form) select.form.addEventListener('reset', () => setTimeout(mostrarEscolhida, 0));
    const descritor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() { return descritor.get.call(this); },
      set(v) { descritor.set.call(this, v); mostrarEscolhida(); },
    });
    // Campo obrigatório vazio: em vez do balão do navegador (que apontaria para o select escondido),
    // marca o campo de busca em vermelho com a mensagem logo abaixo e leva o foco até ele
    const erro = document.createElement('small');
    erro.className = 'combo-erro';
    erro.hidden = true;
    caixa.after(erro);
    select.addEventListener('invalid', (e) => {
      e.preventDefault();
      caixa.classList.add('invalido');
      erro.textContent = 'Escolha uma opção da lista.';
      erro.hidden = false;
      const primeiro = select.form && select.form.querySelector(':invalid');
      if (!primeiro || primeiro === select) {
        entrada.scrollIntoView({ block: 'center', behavior: 'smooth' });
        entrada.focus({ preventScroll: true });
      }
    });
    select.addEventListener('change', () => {
      if (select.value) { caixa.classList.remove('invalido'); erro.hidden = true; }
    });

    mostrarEscolhida();
  }

  function candidato(select) {
    return select.dataset.busca === '' || select.dataset.busca === 'sim' ||
      (select.dataset.busca !== 'nao' && select.options.length > LIMITE_AUTOMATICO);
  }

  function procurar(raiz = document) {
    raiz.querySelectorAll('select:not([data-combo-pronto])').forEach((s) => { if (candidato(s)) aprimorar(s); });
  }

  // Selects que só ganham opções depois (a API responde) também são aprimorados
  new MutationObserver((mudancas) => {
    for (const m of mudancas) {
      const alvo = m.target.closest ? m.target.closest('select') : null;
      if (alvo && !alvo.dataset.comboPronto && candidato(alvo)) aprimorar(alvo);
      m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.querySelectorAll) procurar(n); });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.WMS = window.WMS || {};
  window.WMS.aprimorarSelect = aprimorar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => procurar());
  else procurar();
})();
