/*
 * LÓGICA DA TELA: entrada  —  Responsável: LUCAS
 * Registra entradas (POST /api/entrada) e mostra o histórico (GET /api/entrada).
 */

const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cria uma célula com texto (sem innerHTML, para não injetar HTML vindo do banco)
function celula(linha, texto, classe) {
    const td = document.createElement('td');
    if (classe) td.className = classe;
    td.textContent = texto == null ? '' : String(texto);
    linha.appendChild(td);
    return td;
}

function mostrarMensagem(texto, tipo) {
    const caixa = document.getElementById('mensagem-entrada');
    caixa.textContent = texto;
    caixa.className = 'aviso ' + tipo;
}

document.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
    carregarEnderecos();
    carregarHistorico();

    const formEntrada = document.getElementById('formEntrada');
    const botao = document.getElementById('botao-entrada');

    formEntrada.addEventListener('submit', async (e) => {
        e.preventDefault();

        const produto_id = document.getElementById('produto_id').value;
        const endereco_id = document.getElementById('endereco_id').value;
        const quantidade = document.getElementById('quantidade').value;
        const nota_fiscal = document.getElementById('nota_fiscal').value;
        const valor_unitario = document.getElementById('valor_unitario').value;

        botao.disabled = true;
        try {
            const resposta = await fetch('/api/entrada', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ produto_id, endereco_id, quantidade, nota_fiscal, valor_unitario })
            });

            const resultado = await resposta.json().catch(() => ({}));

            if (resposta.ok) {
                const custo = resultado.custo_medio !== undefined
                    ? ` Novo custo médio do produto: ${formatarMoeda(resultado.custo_medio)}.`
                    : '';
                mostrarMensagem((resultado.mensagem || 'Entrada registrada com sucesso!') + custo, 'sucesso');
                formEntrada.reset();
                carregarHistorico();
            } else {
                mostrarMensagem(resultado.erro || 'Não foi possível registrar a entrada.', 'erro');
            }
        } catch (erro) {
            console.error('Erro na requisição.', erro);
            mostrarMensagem('Erro de comunicação com o servidor.', 'erro');
        } finally {
            botao.disabled = false;
        }
    });
});

async function carregarProdutos() {
    try {
        const resposta = await fetch('/api/cadastros/produtos');
        if (!resposta.ok) return;
        const produtos = await resposta.json();

        const select = document.getElementById('produto_id');
        produtos.forEach(prod => {
            const option = document.createElement('option');
            option.value = prod.id;
            option.textContent = `${prod.codigo ? prod.codigo + ' - ' : ''}${prod.nome || `Produto #${prod.id}`}`;
            select.appendChild(option);
        });
    } catch (e) {
        console.log('Erro ao carregar produtos:', e);
    }
}

async function carregarEnderecos() {
    try {
        const resposta = await fetch('/api/cadastros/enderecos');
        if (!resposta.ok) return;
        const enderecos = await resposta.json();

        const select = document.getElementById('endereco_id');
        enderecos.forEach(end => {
            const option = document.createElement('option');
            option.value = end.id;
            option.textContent = end.descricao || end.codigo || `Endereço #${end.id}`;
            select.appendChild(option);
        });
    } catch (e) {
        console.log('Erro ao carregar endereços:', e);
    }
}

async function carregarHistorico() {
    const tbody = document.getElementById('tabelaEntradas');
    try {
        const resposta = await fetch('/api/entrada');
        if (!resposta.ok) throw new Error(`Erro do servidor (${resposta.status}).`);
        const entradas = await resposta.json();

        tbody.innerHTML = '';
        document.getElementById('total-entradas').textContent =
            entradas.length ? `${entradas.length} registros` : '';

        if (entradas.length === 0) {
            const tr = document.createElement('tr');
            celula(tr, 'Nenhuma entrada registrada.', 'vazio').colSpan = 8;
            tbody.appendChild(tr);
            return;
        }

        entradas.forEach(item => {
            const tr = document.createElement('tr');
            celula(tr, item.id, 'secundario');
            celula(tr, new Date(item.data).toLocaleString('pt-BR'), 'secundario');
            celula(tr, item.produto_nome || `Produto #${item.produto_id}`, 'descricao');
            celula(tr, item.endereco_codigo || `Endereço #${item.endereco_id}`, 'cod');
            celula(tr, item.quantidade, 'num');
            celula(tr, formatarMoeda(item.valor_unitario), 'num');
            celula(tr, formatarMoeda(item.valor_total), 'num');
            celula(tr, item.nota_fiscal || '-', 'secundario');
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
