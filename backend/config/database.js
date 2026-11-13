const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLITE_PATH permite que os testes usem um banco isolado.
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'unimap.db');
const db = new sqlite3.Database(dbPath);

db.on('error', (err) => {
    console.error('❌ Erro no banco de dados:', err);
});

if (process.env.NODE_ENV !== 'test') {
    console.log('📊 Banco de dados SQLite conectado:', dbPath);
}

module.exports = db;
