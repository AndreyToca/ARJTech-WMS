// Conexão com o MySQL (já pronta — todos usam este arquivo).
// Nos controllers, importe assim: const db = require('../../config/db');
// e use: const [linhas] = await db.query('SELECT ...', [parametros]);

const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = db;
