const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// O banco será criado AUTOMATICAMENTE
const dbPath = path.join(__dirname, '..', 'unimap.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Criando banco de dados SQLite...');

// Criar todas as tabelas DE UMA VEZ
db.serialize(() => {
    // Tabela de usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        matricula TEXT UNIQUE,
        tipo TEXT DEFAULT 'aluno',
        curso TEXT,
        periodo TEXT,
        senha_hash TEXT NOT NULL,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Blocos
    db.run(`CREATE TABLE IF NOT EXISTS blocos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        letra TEXT UNIQUE NOT NULL,
        nome TEXT
    )`);

    // Salas
    db.run(`CREATE TABLE IF NOT EXISTS salas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL,
        bloco_id INTEGER,
        andar INTEGER NOT NULL,
        capacidade INTEGER,
        tipo TEXT,
        FOREIGN KEY (bloco_id) REFERENCES blocos (id)
    )`);

    // Professores
    db.run(`CREATE TABLE IF NOT EXISTS professores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        ativo BOOLEAN DEFAULT 1
    )`);

    // Aulas
    db.run(`CREATE TABLE IF NOT EXISTS aulas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        disciplina TEXT NOT NULL,
        professor_id INTEGER,
        sala_id INTEGER,
        horario TEXT,
        dia_semana TEXT,
        ativa BOOLEAN DEFAULT 1
    )`);

    // Dados iniciais
    db.run(`INSERT OR IGNORE INTO blocos (letra, nome) VALUES 
        ('A', 'Bloco A - Administração'),
        ('B', 'Bloco B - Laboratórios'),
        ('C', 'Bloco C - Salas de Aula'),
        ('D', 'Bloco D - Auditórios')`);

    db.run(`INSERT OR IGNORE INTO salas (numero, bloco_id, andar, capacidade, tipo) VALUES 
        ('101', 1, 1, 40, 'sala_aula'),
        ('102', 1, 1, 40, 'sala_aula'),
        ('201', 1, 2, 30, 'sala_aula'),
        ('LAB1', 2, 1, 20, 'laboratorio'),
        ('AUD1', 4, 1, 100, 'auditorio')`);

    db.run(`INSERT OR IGNORE INTO professores (nome, email) VALUES 
        ('João Silva', 'joao.silva@unipam.edu.br'),
        ('Maria Santos', 'maria.santos@unipam.edu.br'),
        ('Pedro Costa', 'pedro.costa@unipam.edu.br')`);

    console.log('✅ Banco SQLite criado: unimap.db');
});

db.close();