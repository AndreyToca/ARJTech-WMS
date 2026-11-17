/*
 * LÓGICA DA TELA: estoque  —  Responsável: FELIPE
 *
 * 1. Ao abrir a página, buscar GET /api/estoque e preencher a tabela.
 * 2. Ao digitar na busca, filtrar as linhas (produto, código ou endereço).
 * 3. Destacar em vermelho as linhas com quantidade baixa.
 * 4. A busca do topo (Painel) chega aqui como ?produto=... ou ?endereco=...
 */

const ESTOQUE_BAIXO = 10;

// Variável global para guardar os dados e permitir o filtro sem ir ao banco várias vezes
let todosProdutos = [];
let todosEnderecos = [];
const CHAVE_VISAO = 'estoque-visao';

const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function celula(linha, texto, classe) {
    const td = document.createElement('td');
    if (classe) td.className = classe;
    td.textContent = texto == null ? '' : String(texto);
    linha.appendChild(td);
    return td;
}

// 1. Buscar os dados no servidor
async function carregarEstoque() {
    try {
        // Estoque e endereços juntos (o mapa precisa de todos os endereços, inclusive os vazios)
        const [resposta, respostaEnderecos] = await Promise.all([fetch('/api/estoque'), fetch('/api/cadastros/enderecos')]);
        if (!resposta.ok) throw new Error(`Erro do servidor (${resposta.status}).`);
        todosProdutos = await resposta.json();
        todosEnderecos = respostaEnderecos.ok ? await respostaEnderecos.json() : [];
        filtrar();
    } catch (erro) {
        console.error('Erro ao carregar o estoque:', erro);
        document.getElementById('indicadores-estoque').innerHTML = '';
        const tabelaBody = document.getElementById('tbody-estoque');
        tabelaBody.innerHTML = '';
        const linha = document.createElement('tr');
        celula(linha, 'Não foi possível carregar o estoque. O servidor está rodando?', 'vazio').colSpan = 7;
        tabelaBody.appendChild(linha);
    }
}

// Resumo no topo, no mesmo formato dos indicadores do Painel
function renderizarIndicadores(produtos) {
    const quantidade = produtos.reduce((soma, p) => soma + Number(p.quantidade || 0), 0);
    const custo = produtos.reduce((soma, p) => soma + Number(p.valor_total || 0), 0);
    const venda = produtos.reduce((soma, p) => soma + Number(p.quantidade || 0) * Number(p.preco_venda || 0), 0);
    const baixos = produtos.filter(p => Number(p.quantidade) < ESTOQUE_BAIXO).length;

    const itens = [
        { valor: produtos.length.toLocaleString('pt-BR'), rotulo: 'Posições com saldo', detalhe: `${quantidade.toLocaleString('pt-BR')} unidades no total`, status: '' },
        { valor: formatarMoeda(custo), rotulo: 'Valor em estoque (custo)', detalhe: 'Quantidade × custo médio', status: '' },
        { valor: formatarMoeda(venda), rotulo: 'Valor de venda', detalhe: venda > 0 ? `Margem potencial ${formatarMoeda(venda - custo)}` : 'Sem preço de venda cadastrado', status: venda >= custo ? 'ok' : 'problema' },
        { valor: baixos.toLocaleString('pt-BR'), rotulo: 'Estoque baixo', detalhe: `Menos de ${ESTOQUE_BAIXO} unidades`, status: baixos > 0 ? 'problema' : 'ok' },
    ];

    const area = document.getElementById('indicadores-estoque');
    area.innerHTML = '';
    itens.forEach(item => {
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

// Função para desenhar a tabela
function renderizarTabela(produtos) {
    const tabelaBody = document.getElementById('tbody-estoque');
    tabelaBody.innerHTML = '';

    // Soma o valor das linhas exibidas (acompanha o filtro da busca)
    const total = produtos.reduce((soma, p) => soma + Number(p.valor_total || 0), 0);
    document.getElementById('total-estoque').textContent = formatarMoeda(total);
    renderizarIndicadores(produtos);

    if (produtos.length === 0) {
        const linha = document.createElement('tr');
        celula(linha, 'Nenhum item encontrado.', 'vazio').colSpan = 7;
        tabelaBody.appendChild(linha);
        return;
    }

    produtos.forEach(produto => {
        const linha = document.createElement('tr');

        // 3. Destaca em vermelho se a quantidade for baixa
        if (Number(produto.quantidade) < ESTOQUE_BAIXO) linha.className = 'baixo';

        celula(linha, produto.codigo, 'cod');
        celula(linha, produto.nome, 'descricao');
        celula(linha, produto.endereco_codigo || produto.endereco_id, 'cod');
        const qtd = celula(linha, Number(produto.quantidade).toLocaleString('pt-BR'), 'num qtd');
        if (produto.unidade) {
            const unidade = document.createElement('span');
            unidade.className = 'unidade';
            unidade.textContent = produto.unidade.toLowerCase();
            qtd.appendChild(unidade);
        }
        celula(linha, formatarMoeda(produto.custo_medio), 'num');
        celula(linha, formatarMoeda(produto.preco_venda), 'num');
        celula(linha, formatarMoeda(produto.valor_total), 'num');
        tabelaBody.appendChild(linha);
    });
}

// 2. Filtrar as linhas pelo texto da busca
function filtrar() {
    const termo = document.getElementById('busca-produto').value.trim().toLowerCase();
    const filtrados = todosProdutos.filter(p =>
        [p.nome, p.codigo, p.endereco_codigo].some(campo => String(campo || '').toLowerCase().includes(termo))
    );
    renderizarTabela(filtrados);
    // O mapa mostra todos os endereços e acende os que combinam com a busca
    EstoqueMapa.atualizar(todosProdutos, todosEnderecos, termo);
}

document.getElementById('busca-produto').addEventListener('input', filtrar);

// ---------- Lista | Mapa do armazém ----------
function mostrarVisao(visao) {
    const mapa = visao === 'mapa';
    document.getElementById('mapa-armazem').hidden = !mapa;
    document.getElementById('visao-lista').hidden = mapa;
    document.querySelector(`input[name="visao"][value="${visao}"]`).checked = true;
    try { localStorage.setItem(CHAVE_VISAO, visao); } catch { /* sem armazenamento: só não lembra */ }
    if (mapa) EstoqueMapa.desenhar();
}

EstoqueMapa.iniciar(document.getElementById('mapa-armazem'), {
    // "Ver na lista" no painel de detalhes: filtra pelo endereço e volta para a lista
    aoVerNaLista: (codigo) => {
        document.getElementById('busca-produto').value = codigo;
        filtrar();
        mostrarVisao('lista');
    },
});
document.querySelectorAll('input[name="visao"]').forEach((opcao) =>
    opcao.addEventListener('change', () => mostrarVisao(opcao.value)));
try { if (localStorage.getItem(CHAVE_VISAO) === 'mapa') mostrarVisao('mapa'); } catch { /* ignora */ }

// Busca vinda do topo: /pages/estoque.html?produto=P001 ou ?endereco=A-01-1
const parametros = new URLSearchParams(window.location.search);
const termoInicial = parametros.get('produto') || parametros.get('endereco');
if (termoInicial) document.getElementById('busca-produto').value = termoInicial;

// Começa quando a página HTML terminar de carregar
document.addEventListener('DOMContentLoaded', carregarEstoque);
