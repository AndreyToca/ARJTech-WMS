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
  // TiDB Cloud exige SSL: coloque DB_SSL=true no .env
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  // O banco guarda as datas em UTC (NOW() do TiDB é UTC). Sem isto o driver lê as datas como se
  // fossem do horário do computador e tudo aparece 3 horas adiantado na tela.
  timezone: 'Z',
});

module.exports = db;
