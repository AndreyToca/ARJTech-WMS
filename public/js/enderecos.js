/*
 * LÓGICA DA TELA: cadastro de endereços  —  Responsável: YGOR
 * Usa as funções de cadastros-comum.js.
 */

const formEndereco = document.getElementById('form-endereco');
const listaEnderecos = document.getElementById('lista-enderecos');
const mensagemEndereco = document.getElementById('mensagem-endereco');
const buscaEndereco = document.getElementById('busca-endereco');

const campoRua = document.getElementById('endereco-rua');
const campoPrateleira = document.getElementById('endereco-prateleira');
const campoNivel = document.getElementById('endereco-nivel');
const campoCodigo = document.getElementById('endereco-codigo');

let enderecosCarregados = [];

// Gera o código do endereço a partir dos três campos (ex.: A-01-2).
function atualizarCodigo() {
    const valores = [campoRua, campoPrateleira, campoNivel].map(campo => campo.value.trim().toUpperCase());
    campoCodigo.value = valores.every(Boolean) ? valores.join('-') : '';
}

function desenharEnderecos() {
    const enderecos = filtrarLista(enderecosCarregados, buscaEndereco.value, ['codigo', 'rua', 'prateleira', 'nivel']);
    document.getElementById('total-enderecos').textContent =
        enderecosCarregados.length ? `${enderecosCarregados.length} cadastrados` : '';

    if (enderecos.length === 0) {
        listaEnderecos.innerHTML = linhaVazia(6,
            enderecosCarregados.length ? 'Nenhum endereço encontrado.' : 'Nenhum endereço cadastrado.');
        return;
    }

    listaEnderecos.innerHTML = enderecos.map(endereco => `
        <tr>
            <td class="secundario">${escapar(endereco.id)}</td>
            <td class="cod">${escapar(endereco.codigo)}</td>
            <td>${escapar(endereco.rua)}</td>
            <td>${escapar(endereco.prateleira)}</td>
            <td>${escapar(endereco.nivel)}</td>
            <td>${botoesAcao(endereco.id)}</td>
        </tr>
    `).join('');
}

async function carregarEnderecos() {
    try {
        const enderecos = await requisicao(`${API}/enderecos`);
        enderecosCarregados = Array.isArray(enderecos) ? enderecos : [];
        desenharEnderecos();
    } catch (erro) {
        listaEnderecos.innerHTML = linhaVazia(6, 'Não foi possível carregar os endereços.');
        mensagem(mensagemEndereco, erro.message, true);
    }
}

function voltarParaNovo() {
    document.getElementById('endereco-id').value = '';
    document.getElementById('botao-endereco').textContent = 'Salvar endereço';
    atualizarCodigo();
}

formEndereco.addEventListener('submit', async evento => {
    evento.preventDefault();

    const id = document.getElementById('endereco-id').value;
    const endereco = {
        rua: campoRua.value.trim(),
        prateleira: campoPrateleira.value.trim(),
        nivel: campoNivel.value.trim()
    };

    try {
        await requisicao(id ? `${API}/enderecos/${encodeURIComponent(id)}` : `${API}/enderecos`, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(endereco)
        });

        mensagem(mensagemEndereco, id ? 'Endereço atualizado com sucesso!' : 'Endereço cadastrado com sucesso!');
        formEndereco.reset();
        voltarParaNovo();
        await carregarEnderecos();
    } catch (erro) {
        mensagem(mensagemEndereco, erro.message, true);
    }
});

formEndereco.addEventListener('reset', () => setTimeout(voltarParaNovo, 0));
[campoRua, campoPrateleira, campoNivel].forEach(campo => campo.addEventListener('input', atualizarCodigo));
buscaEndereco.addEventListener('input', desenharEnderecos);

listaEnderecos.addEventListener('click', async evento => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = botao.dataset.id;

    if (botao.dataset.acao === 'editar') {
        try {
            const endereco = await requisicao(`${API}/enderecos/${encodeURIComponent(id)}`);

            document.getElementById('endereco-id').value = endereco.id;
            campoRua.value = endereco.rua ?? '';
            campoPrateleira.value = endereco.prateleira ?? '';
            campoNivel.value = endereco.nivel ?? '';
            atualizarCodigo();
            document.getElementById('botao-endereco').textContent = 'Atualizar endereço';

            mensagem(mensagemEndereco, 'Edite os campos e salve.');
            formEndereco.scrollIntoView({ behavior: 'smooth' });
            campoRua.focus({ preventScroll: true });
        } catch (erro) {
            mensagem(mensagemEndereco, erro.message, true);
        }
    }

    if (botao.dataset.acao === 'excluir') {
        if (!confirm('Deseja realmente excluir este endereço?')) return;

        try {
            await requisicao(`${API}/enderecos/${encodeURIComponent(id)}`, { method: 'DELETE' });
            mensagem(mensagemEndereco, 'Endereço excluído com sucesso!');
            await carregarEnderecos();
        } catch (erro) {
            mensagem(mensagemEndereco, erro.message, true);
        }
    }
});

atualizarCodigo();
carregarEnderecos();
