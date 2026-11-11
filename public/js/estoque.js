/*
 * LÓGICA DA TELA: estoque  —  Responsável: FELIPE
 *
 * PASSO A PASSO
 * 1. Ao abrir a página, buscar GET /api/estoque e preencher a tabela.
 * 2. Ao digitar na busca, filtrar as linhas da tabela pelo nome do produto.
 * 3. (Extra) Pintar de vermelho as linhas com quantidade baixa.
 *
 * Dica: use fetch('/api/...') para chamar o servidor e
 * async/await para esperar a resposta.
 */
// Variável global para guardar os dados e permitir o filtro sem ir à base de dados várias vezes
let todosProdutos = [];

// 1. Buscar os dados ao servidor
async function carregarEstoque() {
    try {
        const resposta = await fetch('/api/estoque'); 
        todosProdutos = await resposta.json();
        
        // Renderiza a tabela inicial com todos os produtos
        renderizarTabela(todosProdutos);
    } catch (erro) {
        console.error("Erro ao carregar o estoque:", erro);
        alert("Erro ao ligar à API. O servidor Node.js está a correr?");
    }
}

// Função para desenhar a tabela
function renderizarTabela(produtos) {
    const tabelaBody = document.getElementById('tbody-estoque');
    tabelaBody.innerHTML = '';

    produtos.forEach(produto => {
        const linha = document.createElement('tr');

        // 3. (Extra): Pintar de vermelho se a quantidade for baixa
        if (produto.quantidade < 10) {
            linha.style.backgroundColor = '#ffe6e6';
            linha.style.color = '#cc0000';
        }

        // Preenche as 3 colunas exigidas pelo HTML
        linha.innerHTML = `
            <td>${produto.nome}</td>
            <td>${produto.endereco_id}</td>
            <td>${produto.quantidade}</td>
        `;
        tabelaBody.appendChild(linha);
    });
}

// 2. Filtrar as linhas ao digitar na busca
document.getElementById('busca-produto').addEventListener('input', (evento) => {
    const termoBusca = evento.target.value.toLowerCase();
    
    // Filtra o array guardado em memória
    const produtosFiltrados = todosProdutos.filter(produto => 
        produto.nome.toLowerCase().includes(termoBusca)
    );
    
    // Redesenha a tabela apenas com os produtos filtrados
    renderizarTabela(produtosFiltrados);
});

// Arranca a função principal quando a página HTML terminar de carregar
document.addEventListener('DOMContentLoaded', carregarEstoque);