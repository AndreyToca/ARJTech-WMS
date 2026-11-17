/*
 * NF-e: CHAVE DE ACESSO E XML  —  Responsável: LUCAS (entrada)
 *
 * Chave de acesso = os 44 números do código de barras do DANFE.
 *   cUF(2) AAMM(4) CNPJ do emitente(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1)
 * A chave identifica a nota, mas NÃO traz os itens. Os itens (produto, quantidade, valor)
 * estão no XML da NF-e, que o fornecedor envia junto com a nota.
 */
const NFe = (() => {
  const UFS = {
    11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE',
    24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
    41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
  };

  // Só os números (o leitor às vezes manda espaços; quem digita pode colar com pontos)
  const somenteNumeros = (texto) => String(texto || '').replace(/\D/g, '');

  // Dígito verificador (módulo 11, pesos 2 a 9 da direita para a esquerda)
  function digitoVerificador(chave43) {
    let soma = 0;
    let peso = 2;
    for (let i = chave43.length - 1; i >= 0; i--) {
      soma += Number(chave43[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  // Devolve { valida, erro, ...campos }
  function lerChave(texto) {
    const chave = somenteNumeros(texto);
    if (chave.length !== 44) {
      return { valida: false, chave, erro: chave.length ? `A chave tem 44 números (lidos ${chave.length}).` : 'Bipe ou digite a chave.' };
    }
    if (digitoVerificador(chave.slice(0, 43)) !== Number(chave[43])) {
      return { valida: false, chave, erro: 'Chave inválida: o dígito verificador não confere. Bipe de novo.' };
    }
    const modelo = chave.slice(20, 22);
    return {
      valida: true,
      chave,
      uf: UFS[Number(chave.slice(0, 2))] || chave.slice(0, 2),
      emissao: `${chave.slice(4, 6)}/20${chave.slice(2, 4)}`,
      cnpj: chave.slice(6, 20),
      modelo,
      tipo: modelo === '55' ? 'NF-e' : modelo === '65' ? 'NFC-e' : `modelo ${modelo}`,
      serie: Number(chave.slice(22, 25)),
      numero: Number(chave.slice(25, 34)),
    };
  }

  const formatarCnpj = (n) => String(n || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  const formatarChave = (n) => String(n || '').replace(/(\d{4})(?=\d)/g, '$1 ');

  // Lê o XML de uma NF-e (nfeProc ou NFe). Devolve { chave, numero, serie, emissao, emitente, itens, totalProdutos }
  function lerXml(textoXml) {
    const doc = new DOMParser().parseFromString(textoXml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é um XML válido.');
    const pegar = (raiz, nome) => {
      const el = raiz && raiz.getElementsByTagName(nome)[0];
      return el ? el.textContent.trim() : '';
    };
    const infNFe = doc.getElementsByTagName('infNFe')[0];
    if (!infNFe) throw new Error('Este XML não é de uma NF-e (não tem o grupo infNFe).');

    const chave = somenteNumeros(infNFe.getAttribute('Id')) || somenteNumeros(pegar(doc, 'chNFe'));
    const ide = infNFe.getElementsByTagName('ide')[0];
    const emit = infNFe.getElementsByTagName('emit')[0];
    const numeroDecimal = (texto) => {
      const n = Number(String(texto || '0').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };

    const itens = [...infNFe.getElementsByTagName('det')].map((det) => {
      const prod = det.getElementsByTagName('prod')[0];
      const quantidade = numeroDecimal(pegar(prod, 'qCom'));
      const valorTotal = numeroDecimal(pegar(prod, 'vProd'));
      return {
        item: Number(det.getAttribute('nItem')) || 0,
        codigo: pegar(prod, 'cProd'),
        ean: pegar(prod, 'cEAN'),
        descricao: pegar(prod, 'xProd'),
        ncm: pegar(prod, 'NCM'),
        unidade: pegar(prod, 'uCom'),
        quantidade,
        valorUnitario: numeroDecimal(pegar(prod, 'vUnCom')) || (quantidade ? valorTotal / quantidade : 0),
        valorTotal,
      };
    });
    if (!itens.length) throw new Error('A nota não tem itens (grupo det).');

    return {
      chave,
      numero: Number(pegar(ide, 'nNF')) || null,
      serie: Number(pegar(ide, 'serie')) || 0,
      emissao: pegar(ide, 'dhEmi') || pegar(ide, 'dEmi'),
      emitente: { cnpj: pegar(emit, 'CNPJ') || pegar(emit, 'CPF'), nome: pegar(emit, 'xNome') },
      totalProdutos: numeroDecimal(pegar(infNFe.getElementsByTagName('ICMSTot')[0], 'vProd')) || itens.reduce((t, i) => t + i.valorTotal, 0),
      itens,
    };
  }

  // Sugere o produto do sistema mais parecido com a descrição da nota (palavras em comum)
  const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const palavras = (t) => new Set(normalizar(t).split(/[^a-z0-9]+/).filter((p) => p.length > 1));
  function sugerirProduto(descricao, produtos) {
    const alvo = palavras(descricao);
    let melhor = null;
    let nota = 0;
    produtos.forEach((p) => {
      const candidato = palavras(p.nome);
      const comuns = [...alvo].filter((x) => candidato.has(x)).length;
      const semelhanca = comuns / Math.max(1, Math.min(alvo.size, candidato.size));
      if (semelhanca > nota) { nota = semelhanca; melhor = p; }
    });
    return nota >= 0.5 ? melhor : null;
  }

  return { lerChave, lerXml, sugerirProduto, formatarCnpj, formatarChave, somenteNumeros };
})();
