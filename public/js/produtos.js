/*
 * LÓGICA DA TELA: cadastro de produtos  —  Responsável: YGOR
 * Usa as funções de cadastros-comum.js.
 */

const formProduto = document.getElementById('form-produto');
const listaProdutos = document.getElementById('lista-produtos');
const mensagemProduto = document.getElementById('mensagem-produto');
const buscaProduto = document.getElementById('busca-produto');

let produtosCarregados = [];
const campoCliente = document.getElementById('produto-cliente');

// Preenche o select de clientes (dono da mercadoria)
async function carregarClientes() {
    try {
        const clientes = await requisicao(`${API}/clientes`);
        campoCliente.innerHTML = clientes.length
            ? '<option value="">Selecione o cliente</option>'
            : '<option value="">Nenhum cliente cadastrado</option>';
        clientes.forEach(cliente => {
            const opcao = document.createElement('option');
            opcao.value = cliente.id;
            opcao.textContent = cliente.nome;
            campoCliente.appendChild(opcao);
        });
        if (!clientes.length) {
            mensagem(mensagemProduto, 'Cadastre um cliente antes de cadastrar produtos (menu Clientes).', true);
        }
    } catch (erro) {
        campoCliente.innerHTML = '<option value="">Erro ao carregar clientes</option>';
        mensagem(mensagemProduto, erro.message, true);
    }
}

function proximoCodigoProduto(produtos) {
    let maiorNumero = 0;

    produtos.forEach(produto => {
        const resultado = String(produto.codigo || '').match(/^P(\d+)$/i);
        if (resultado) maiorNumero = Math.max(maiorNumero, Number(resultado[1]));
    });

    return `P${String(maiorNumero + 1).padStart(3, '0')}`;
}

function atualizarCodigoProduto() {
    // Durante a edição, mantém o código do produto existente.
    if (document.getElementById('produto-id').value) return;
    document.getElementById('produto-codigo').value = proximoCodigoProduto(produtosCarregados);
}

function desenharProdutos() {
    const produtos = filtrarLista(produtosCarregados, buscaProduto.value, ['codigo', 'nome', 'unidade', 'cliente_nome']);
    document.getElementById('total-produtos').textContent =
        produtosCarregados.length ? `${produtosCarregados.length} cadastrados` : '';

    if (produtos.length === 0) {
        listaProdutos.innerHTML = linhaVazia(7,
            produtosCarregados.length ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.');
        return;
    }

    listaProdutos.innerHTML = produtos.map(produto => `
        <tr>
            <td class="cod">${escapar(produto.codigo)}</td>
            <td class="descricao">${escapar(produto.nome)}</td>
            <td>${produto.cliente_nome
                ? escapar(produto.cliente_nome)
                : '<span class="estado atencao"><span class="status-ponto"></span>Sem cliente</span>'}</td>
            <td>${escapar(produto.unidade)}</td>
            <td class="num">${escapar(formatarMoeda(produto.custo_medio))}</td>
            <td class="num">${escapar(formatarMoeda(produto.preco_venda))}</td>
            <td>${botoesAcao(produto.id)}</td>
        </tr>
    `).join('');
}

async function carregarProdutos() {
    try {
        const produtos = await requisicao(`${API}/produtos`);
        produtosCarregados = Array.isArray(produtos) ? produtos : [];
        atualizarCodigoProduto();
        desenharProdutos();
    } catch (erro) {
        listaProdutos.innerHTML = linhaVazia(7, 'Não foi possível carregar os produtos.');
        mensagem(mensagemProduto, erro.message, true);
    }
}

function voltarParaNovo() {
    document.getElementById('produto-id').value = '';
    document.getElementById('botao-produto').textContent = 'Salvar produto';
    atualizarCodigoProduto();
}

formProduto.addEventListener('submit', async evento => {
    evento.preventDefault();

    const id = document.getElementById('produto-id').value;
    const produto = {
        nome: document.getElementById('produto-nome').value.trim(),
        unidade: document.getElementById('produto-unidade').value.trim(),
        preco_venda: document.getElementById('produto-preco').value.trim(),
        cliente_id: campoCliente.value
    };

    try {
        await requisicao(id ? `${API}/produtos/${encodeURIComponent(id)}` : `${API}/produtos`, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(produto)
        });

        mensagem(mensagemProduto, id ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!');
        formProduto.reset();
        voltarParaNovo();
        await carregarProdutos();
    } catch (erro) {
        mensagem(mensagemProduto, erro.message, true);
    }
});

formProduto.addEventListener('reset', () => setTimeout(voltarParaNovo, 0));
buscaProduto.addEventListener('input', desenharProdutos);

listaProdutos.addEventListener('click', async evento => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = botao.dataset.id;

    if (botao.dataset.acao === 'editar') {
        try {
            const produto = await requisicao(`${API}/produtos/${encodeURIComponent(id)}`);

            document.getElementById('produto-id').value = produto.id;
            document.getElementById('produto-codigo').value = produto.codigo ?? '';
            document.getElementById('produto-nome').value = produto.nome ?? '';
            document.getElementById('produto-unidade').value = produto.unidade ?? '';
            document.getElementById('produto-preco').value = Number(produto.preco_venda || 0).toFixed(2);
            campoCliente.value = produto.cliente_id ?? '';
            document.getElementById('botao-produto').textContent = 'Atualizar produto';

            mensagem(mensagemProduto, 'Edite os campos e salve.');
            formProduto.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('produto-nome').focus({ preventScroll: true });
        } catch (erro) {
            mensagem(mensagemProduto, erro.message, true);
        }
    }

    if (botao.dataset.acao === 'excluir') {
        if (!confirm('Deseja realmente excluir este produto?')) return;

        try {
            await requisicao(`${API}/produtos/${encodeURIComponent(id)}`, { method: 'DELETE' });
            mensagem(mensagemProduto, 'Produto excluído com sucesso!');
            await carregarProdutos();
        } catch (erro) {
            mensagem(mensagemProduto, erro.message, true);
        }
    }
});

carregarClientes();
carregarProdutos();
