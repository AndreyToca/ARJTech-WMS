# WMS — Sistema de Gerenciamento de Armazém

Projeto da faculdade: sistema web simples para controlar a entrada, o estoque e a saída de produtos de um armazém.

**Tecnologias:** Node.js + Express, MySQL, HTML/CSS/JavaScript.

## Equipe

| Nome    | Módulo                 | Pasta                      |
|---------|------------------------|----------------------------|
| Andrey  | Login e organização    | `src/modules/auth`         |
| Ygor    | Cadastros              | `src/modules/cadastros`    |
| Lucas   | Entrada de mercadoria  | `src/modules/entrada`      |
| Gabriel | Saída de mercadoria    | `src/modules/saida`        |
| Felipe  | Estoque                | `src/modules/estoque`      |

Cada arquivo do seu módulo tem um **PASSO A PASSO** nos comentários do topo. Comece por ele.

## Estrutura

```
wms/
├── database/schema.sql      → tabelas do banco (cada um cria as suas)
├── public/                  → telas (front-end)
│   ├── index.html           → menu principal
│   ├── css/style.css        → estilo compartilhado
│   ├── pages/               → uma tela por módulo
│   └── js/                  → lógica de cada tela
└── src/                     → servidor (back-end)
    ├── server.js            → liga tudo (já pronto)
    ├── config/db.js         → conexão com o MySQL (já pronto)
    └── modules/             → uma pasta por módulo
        └── <modulo>/
            ├── <modulo>.routes.js      → rotas da API
            └── <modulo>.controller.js  → funções que acessam o banco
```

## Como rodar na sua máquina

1. Instale o [Node.js](https://nodejs.org) (versão LTS) e o MySQL.
2. Clone o repositório: `git clone <link-do-repositorio>`
3. Entre na pasta e instale as dependências: `npm install`
4. Copie o arquivo `.env.example` para `.env` e coloque a senha do seu MySQL.
5. Rode o `database/schema.sql` no MySQL.
6. Inicie o servidor: `npm run dev`
7. Abra no navegador: http://localhost:3000

## Como trabalhar no GitHub

1. Antes de começar, atualize: `git checkout main` e `git pull`
2. Crie sua branch: `git checkout -b nome-do-modulo` (ex.: `entrada`)
3. Faça commits pequenos com mensagens claras: `git commit -m "cria tela de entrada"`
4. Suba sua branch: `git push origin nome-do-modulo`
5. No GitHub, abra um **Pull Request** para a `main`.
6. Outra pessoa do grupo revisa e aprova antes do merge.

**Regras:** nunca subir direto na `main` e nunca subir o arquivo `.env`.

## Ordem de desenvolvimento

1. **Juntos:** desenhar as tabelas do banco.
2. **Primeiro:** Ygor (cadastros) e Felipe (funções de somar/subtrair estoque), porque os outros dependem deles.
3. **Depois:** Lucas (entrada) e Gabriel (saída).
4. **No fim:** testar o fluxo completo → cadastrar → dar entrada → ver estoque → dar saída.
