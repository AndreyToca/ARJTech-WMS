
const API = '/api/cadastros';

const formProduto = document.getElementById('form-produto');
const formEndereco = document.getElementById('form-endereco');

const listaProdutos = document.getElementById('lista-produtos');
const listaEnderecos = document.getElementById('lista-enderecos');

const mensagemProduto = document.getElementById('mensagem-produto');
const mensagemEndereco = document.getElementById('mensagem-endereco');

// Exibe mensagens para o usuário.
function mensagem(elemento, texto, erro = false) {
    elemento.textContent = texto;
    elemento.style.color = erro ? '#b91c1c' : '#15803d';
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

// ==================== PRODUTOS ====================

async function carregarProdutos() {
    try {
        const produtos = await requisicao(`${API}/produtos`);

        listaProdutos.innerHTML = '';

        if (!Array.isArray(produtos) || produtos.length === 0) {
            listaProdutos.innerHTML =
                '<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>';
            return;
        }

        listaProdutos.innerHTML = produtos.map(produto => `
            <tr>
                <td>${escapar(produto.id)}</td>
                <td>${escapar(produto.codigo)}</td>
                <td>${escapar(produto.nome)}</td>
                <td>${escapar(produto.unidade)}</td>
                <td>
                    <button type="button"
                        data-acao="editar"
                        data-id="${escapar(produto.id)}">
                        Editar
                    </button>
                    <button type="button"
                        data-acao="excluir"
                        data-id="${escapar(produto.id)}">
                        Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        listaProdutos.innerHTML =
            '<tr><td colspan="5">Não foi possível carregar os produtos.</td></tr>';
        mensagem(mensagemProduto, erro.message, true);
    }
}

formProduto.addEventListener('submit', async evento => {
    evento.preventDefault();

    const id = document.getElementById('produto-id').value;

    const produto = {
        codigo: document.getElementById('produto-codigo').value.trim(),
        nome: document.getElementById('produto-nome').value.trim(),
        unidade: document.getElementById('produto-unidade').value.trim()
    };

    try {
        const url = id
            ? `${API}/produtos/${encodeURIComponent(id)}`
            : `${API}/produtos`;

        await requisicao(url, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(produto)
        });

        mensagem(
            mensagemProduto,
            id ? 'Produto atualizado com sucesso!' :
                'Produto cadastrado com sucesso!'
        );

        formProduto.reset();
        document.getElementById('produto-id').value = '';
        document.getElementById('botao-produto').textContent =
            'Salvar produto';

        await carregarProdutos();
    } catch (erro) {
        mensagem(mensagemProduto, erro.message, true);
    }
});

formProduto.addEventListener('reset', () => {
    setTimeout(() => {
        document.getElementById('produto-id').value = '';
        document.getElementById('botao-produto').textContent =
            'Salvar produto';
    }, 0);
});

listaProdutos.addEventListener('click', async evento => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = botao.dataset.id;

    if (botao.dataset.acao === 'editar') {
        try {
            const produto = await requisicao(
                `${API}/produtos/${encodeURIComponent(id)}`
            );

            document.getElementById('produto-id').value = produto.id;
            document.getElementById('produto-codigo').value =
                produto.codigo ?? '';
            document.getElementById('produto-nome').value =
                produto.nome ?? '';
            document.getElementById('produto-unidade').value =
                produto.unidade ?? '';

            document.getElementById('botao-produto').textContent =
                'Atualizar produto';

            mensagem(mensagemProduto, 'Edite os campos e salve.');
            formProduto.scrollIntoView({ behavior: 'smooth' });
        } catch (erro) {
            mensagem(mensagemProduto, erro.message, true);
        }
    }

    if (botao.dataset.acao === 'excluir') {
        if (!confirm('Deseja realmente excluir este produto?')) return;

        try {
            await requisicao(
                `${API}/produtos/${encodeURIComponent(id)}`,
                { method: 'DELETE' }
            );

            mensagem(mensagemProduto, 'Produto excluído com sucesso!');
            await carregarProdutos();
        } catch (erro) {
            mensagem(mensagemProduto, erro.message, true);
        }
    }
});

// ==================== ENDEREÇOS ====================

async function carregarEnderecos() {
    try {
        const enderecos = await requisicao(`${API}/enderecos`);

        listaEnderecos.innerHTML = '';

        if (!Array.isArray(enderecos) || enderecos.length === 0) {
            listaEnderecos.innerHTML =
                '<tr><td colspan="6">Nenhum endereço cadastrado.</td></tr>';
            return;
        }

        listaEnderecos.innerHTML = enderecos.map(endereco => `
            <tr>
                <td>${escapar(endereco.id)}</td>
                <td>${escapar(endereco.codigo)}</td>
                <td>${escapar(endereco.rua)}</td>
                <td>${escapar(endereco.prateleira)}</td>
                <td>${escapar(endereco.nivel)}</td>
                <td>
                    <button type="button"
                        data-acao="editar"
                        data-id="${escapar(endereco.id)}">
                        Editar
                    </button>
                    <button type="button"
                        data-acao="excluir"
                        data-id="${escapar(endereco.id)}">
                        Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        listaEnderecos.innerHTML =
            '<tr><td colspan="6">Não foi possível carregar os endereços.</td></tr>';
        mensagem(mensagemEndereco, erro.message, true);
    }
}

formEndereco.addEventListener('submit', async evento => {
    evento.preventDefault();

    const id = document.getElementById('endereco-id').value;

    const endereco = {
        codigo: document.getElementById('endereco-codigo').value.trim(),
        rua: document.getElementById('endereco-rua').value.trim(),
        prateleira: document.getElementById('endereco-prateleira').value.trim(),
        nivel: document.getElementById('endereco-nivel').value.trim()
    };

    try {
        const url = id
            ? `${API}/enderecos/${encodeURIComponent(id)}`
            : `${API}/enderecos`;

        await requisicao(url, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(endereco)
        });

        mensagem(
            mensagemEndereco,
            id ? 'Endereço atualizado com sucesso!' :
                'Endereço cadastrado com sucesso!'
        );

        formEndereco.reset();
        document.getElementById('endereco-id').value = '';
        document.getElementById('botao-endereco').textContent =
            'Salvar endereço';

        await carregarEnderecos();
    } catch (erro) {
        mensagem(mensagemEndereco, erro.message, true);
    }
});

formEndereco.addEventListener('reset', () => {
    setTimeout(() => {
        document.getElementById('endereco-id').value = '';
        document.getElementById('botao-endereco').textContent =
            'Salvar endereço';
    }, 0);
});

listaEnderecos.addEventListener('click', async evento => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = botao.dataset.id;

    if (botao.dataset.acao === 'editar') {
        try {
            const endereco = await requisicao(
                `${API}/enderecos/${encodeURIComponent(id)}`
            );

            document.getElementById('endereco-id').value = endereco.id;
            document.getElementById('endereco-codigo').value =
                endereco.codigo ?? '';
            document.getElementById('endereco-rua').value =
                endereco.rua ?? '';
            document.getElementById('endereco-prateleira').value =
                endereco.prateleira ?? '';
            document.getElementById('endereco-nivel').value =
                endereco.nivel ?? '';

            document.getElementById('botao-endereco').textContent =
                'Atualizar endereço';

            mensagem(mensagemEndereco, 'Edite os campos e salve.');
            formEndereco.scrollIntoView({ behavior: 'smooth' });
        } catch (erro) {
            mensagem(mensagemEndereco, erro.message, true);
        }
    }

    if (botao.dataset.acao === 'excluir') {
        if (!confirm('Deseja realmente excluir este endereço?')) return;

        try {
            await requisicao(
                `${API}/enderecos/${encodeURIComponent(id)}`,
                { method: 'DELETE' }
            );

            mensagem(mensagemEndereco, 'Endereço excluído com sucesso!');
            await carregarEnderecos();
        } catch (erro) {
            mensagem(mensagemEndereco, erro.message, true);
        }
    }
});

// Carrega as duas tabelas ao abrir a página.
carregarProdutos();
carregarEnderecos();
