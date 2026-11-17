/*
 * LÓGICA DA TELA: cadastro de clientes  —  Responsável: YGOR
 * Usa as funções de cadastros-comum.js.
 */

const formCliente = document.getElementById('form-cliente');
const listaClientes = document.getElementById('lista-clientes');
const mensagemCliente = document.getElementById('mensagem-cliente');
const buscaCliente = document.getElementById('busca-cliente');
const campoDocumento = document.getElementById('cliente-documento');

let clientesCarregados = [];

// Formata CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) a partir dos números.
function formatarDocumento(valor) {
    const n = String(valor || '').replace(/\D/g, '').slice(0, 14);
    if (n.length <= 11) {
        return n.replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
    }
    return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, (_, a, b, c, d, e) =>
        `${a}.${b}.${c}/${d}${e ? '-' + e : ''}`);
}

function desenharClientes() {
    const clientes = filtrarLista(
        clientesCarregados.map(c => ({ ...c, documento_formatado: formatarDocumento(c.documento) })),
        buscaCliente.value,
        ['nome', 'documento', 'documento_formatado', 'cidade', 'email', 'telefone']
    );
    document.getElementById('total-clientes').textContent =
        clientesCarregados.length ? `${clientesCarregados.length} cadastrados` : '';

    if (clientes.length === 0) {
        listaClientes.innerHTML = linhaVazia(7,
            clientesCarregados.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.');
        return;
    }

    listaClientes.innerHTML = clientes.map(cliente => `
        <tr>
            <td class="descricao">${escapar(cliente.nome)}</td>
            <td class="cod">${escapar(cliente.documento_formatado || '-')}</td>
            <td class="secundario">${escapar(cliente.telefone || '-')}</td>
            <td class="secundario">${escapar(cliente.email || '-')}</td>
            <td>${escapar(cliente.cidade || '-')}</td>
            <td class="num">${escapar(Number(cliente.total_produtos || 0))}</td>
            <td>${botoesAcao(cliente.id)}</td>
        </tr>
    `).join('');
}

async function carregarClientes() {
    try {
        const clientes = await requisicao(`${API}/clientes`);
        clientesCarregados = Array.isArray(clientes) ? clientes : [];
        desenharClientes();
    } catch (erro) {
        listaClientes.innerHTML = linhaVazia(7, 'Não foi possível carregar os clientes.');
        mensagem(mensagemCliente, erro.message, true);
    }
}

function voltarParaNovo() {
    document.getElementById('cliente-id').value = '';
    document.getElementById('botao-cliente').textContent = 'Salvar cliente';
}

formCliente.addEventListener('submit', async evento => {
    evento.preventDefault();

    const id = document.getElementById('cliente-id').value;
    const cliente = {
        nome: document.getElementById('cliente-nome').value.trim(),
        documento: campoDocumento.value.trim(),
        telefone: document.getElementById('cliente-telefone').value.trim(),
        email: document.getElementById('cliente-email').value.trim(),
        cidade: document.getElementById('cliente-cidade').value.trim()
    };

    try {
        await requisicao(id ? `${API}/clientes/${encodeURIComponent(id)}` : `${API}/clientes`, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(cliente)
        });

        mensagem(mensagemCliente, id ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
        formCliente.reset();
        voltarParaNovo();
        await carregarClientes();
    } catch (erro) {
        mensagem(mensagemCliente, erro.message, true);
    }
});

formCliente.addEventListener('reset', () => setTimeout(voltarParaNovo, 0));
campoDocumento.addEventListener('input', () => {
    campoDocumento.value = formatarDocumento(campoDocumento.value);
});
buscaCliente.addEventListener('input', desenharClientes);

listaClientes.addEventListener('click', async evento => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = botao.dataset.id;

    if (botao.dataset.acao === 'editar') {
        try {
            const cliente = await requisicao(`${API}/clientes/${encodeURIComponent(id)}`);

            document.getElementById('cliente-id').value = cliente.id;
            document.getElementById('cliente-nome').value = cliente.nome ?? '';
            campoDocumento.value = formatarDocumento(cliente.documento);
            document.getElementById('cliente-telefone').value = cliente.telefone ?? '';
            document.getElementById('cliente-email').value = cliente.email ?? '';
            document.getElementById('cliente-cidade').value = cliente.cidade ?? '';
            document.getElementById('botao-cliente').textContent = 'Atualizar cliente';

            mensagem(mensagemCliente, 'Edite os campos e salve.');
            formCliente.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('cliente-nome').focus({ preventScroll: true });
        } catch (erro) {
            mensagem(mensagemCliente, erro.message, true);
        }
    }

    if (botao.dataset.acao === 'excluir') {
        if (!confirm('Deseja realmente excluir este cliente? Os pedidos já feitos para ele continuam no histórico.')) return;
        // Clientes com produtos não podem ser excluídos (a API também confere)

        try {
            await requisicao(`${API}/clientes/${encodeURIComponent(id)}`, { method: 'DELETE' });
            mensagem(mensagemCliente, 'Cliente excluído com sucesso!');
            await carregarClientes();
        } catch (erro) {
            mensagem(mensagemCliente, erro.message, true);
        }
    }
});

carregarClientes();
