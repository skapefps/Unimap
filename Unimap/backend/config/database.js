const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'unimap.db');
const db = new sqlite3.Database(dbPath);

// Tratamento de erros de conexão
db.on('error', (err) => {
    console.error('❌ Erro no banco de dados:', err);
});

console.log('📊 Banco de dados SQLite conectado:', dbPath);

module.exports = db;