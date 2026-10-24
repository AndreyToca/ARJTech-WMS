// Ponto de entrada do sistema (já pronto — só mexa se for combinado com o grupo).
// Rodar: npm run dev  →  abrir http://localhost:3000

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas de cada módulo
app.use('/api/auth', require('./modules/auth/auth.routes'));           // Andrey
app.use('/api/cadastros', require('./modules/cadastros/cadastros.routes')); // Ygor
app.use('/api/entrada', require('./modules/entrada/entrada.routes'));    // Lucas
app.use('/api/saida', require('./modules/saida/saida.routes'));          // Gabriel
app.use('/api/estoque', require('./modules/estoque/estoque.routes'));    // Felipe

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WMS rodando em http://localhost:${PORT}`));
