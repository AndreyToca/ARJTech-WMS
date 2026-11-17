/*
 * FUNÇÕES COMUNS DAS TELAS DE CADASTRO  —  Responsável: YGOR
 * Usado por produtos.js, enderecos.js e clientes.js (carregar este arquivo antes deles).
 */

const API = '/api/cadastros';

const formatarMoeda = valor =>
    Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Exibe mensagens para o usuário.
function mensagem(elemento, texto, erro = false) {
    elemento.textContent = texto;
    elemento.className = 'aviso ' + (erro ? 'erro' : 'sucesso');
}

function limparMensagem(elemento) {
    elemento.textContent = '';
    elemento.className = 'aviso';
}

// Escapa os valores antes de colocá-los na tabela.
function escapar(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caractere]);
}

// Faz requisições para a API.
async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
        ...opcoes,
        headers: {
            'Content-Type': 'application/json',
            ...opcoes.headers
        }
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        throw new Error(dados.erro || dados.mensagem ||
            `Erro na requisição (${resposta.status}).`);
    }

    return dados;
}

// Linha única de aviso dentro da tabela (lista vazia ou erro).
function linhaVazia(colunas, texto) {
    return `<tr><td colspan="${colunas}" class="vazio">${escapar(texto)}</td></tr>`;
}

// Botões Editar/Excluir de cada linha.
function botoesAcao(id) {
    return `
        <button type="button" data-acao="editar" data-id="${escapar(id)}">Editar</button>
        <button type="button" class="perigo" data-acao="excluir" data-id="${escapar(id)}">Excluir</button>`;
}

// Filtra a lista pelo texto digitado na busca, olhando os campos informados.
function filtrarLista(lista, termo, campos) {
    const busca = termo.trim().toLowerCase();
    if (!busca) return lista;
    return lista.filter(item =>
        campos.some(campo => String(item[campo] ?? '').toLowerCase().includes(busca))
    );
}
