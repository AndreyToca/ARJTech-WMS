document.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
    carregarEnderecos();
    carregarHistorico();

    const formEntrada = document.getElementById('formEntrada');
    formEntrada.addEventListener('submit', async (e) => {
        e.preventDefault(); // Corrigido preventDefault

        const produto_id = document.getElementById('produto_id').value;
        const endereco_id = document.getElementById('endereco_id').value;
        const quantidade = document.getElementById('quantidade').value;
        const nota_fiscal = document.getElementById('nota_fiscal').value;

        try{
            const resposta = await fetch('/api/entrada', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ produto_id, endereco_id, quantidade, nota_fiscal })
            });
            
            const resultado = await resposta.json();

            if (resposta.ok){
                alert(resultado.mensagem || 'Entrada registrada com sucesso!');
                formEntrada.reset();
                carregarHistorico();
            } else{
                alert('Erro: ' + (resultado.erro || 'Não foi possível registrar a entrada.'));   
            }
        }catch (erro){
            console.error('Erro na aquisição.' , erro);
            alert('Erro de comunicação com o servidor.');
        }
    });
});

async function carregarProdutos(){
    try{
        const resposta = await fetch('/api/cadastros/produtos');
        if (!resposta.ok) return;
        const produtos = await resposta.json();

        const select = document.getElementById('produto_id');
        produtos.forEach(prod => { // Corrigido de 'end' para 'prod'
            const option = document.createElement('option'); // Corrigido creatElement
            option.value = prod.id;
            option.textContent = prod.nome || `Produto #${prod.id}`;
            select.appendChild(option);
        });
    } catch (e) {
        console.log('Erro ao carregar produtos:', e);
    }
}

async function carregarEnderecos(){
    try{
        const resposta = await fetch('/api/cadastros/enderecos');
        if (!resposta.ok) return;
        const enderecos = await resposta.json();

        const select = document.getElementById('endereco_id');
        enderecos.forEach(end => {
            const option = document.createElement('option'); // Corrigido creatElement
            option.value = end.id; // Corrigido de prod para end.id
            option.textContent = end.descricao || end.codigo || `Endereço #${end.id}`;
            select.appendChild(option);
        });
    } catch (e) {
        console.log('Erro ao carregar endereços:', e);
    }
}

async function carregarHistorico(){
    try{
        const resposta = await fetch('/api/entrada');
        if (!resposta.ok) return;
        const entradas = await resposta.json();

        const tbody = document.getElementById('tabelaEntradas');
        tbody.innerHTML = '';

        entradas.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 8px; border: 1px solid #ddd;">${item.id}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.produto_nome || `Produto #${item.produto_id}`}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.endereco_codigo || `Endereço #${item.endereco_id}`}</td> 
                <td style="padding: 8px; border: 1px solid #ddd;">${item.quantidade}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.nota_fiscal || '-'}</td>  
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(item.data).toLocaleString('pt-BR')}</td>
            `;
            tbody.appendChild(tr);                
        });
    } catch (erro){
        console.error('Erro ao carregar histórico:', erro);
    }
}