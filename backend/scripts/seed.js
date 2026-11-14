#!/usr/bin/env node
/**
 * Dados iniciais para um banco novo.
 *
 * Antes isso rodava a cada boot do servidor, encadeado em callbacks
 * dentro do databaseInit.js. Virou script explícito: o servidor não
 * deve escrever no banco só por estar subindo.
 *
 * Idempotente — cada tabela só é populada se estiver vazia, e os inserts
 * usam ON CONFLICT DO NOTHING. Rodar duas vezes não duplica nada e não
 * sobrescreve dados reais.
 *
 * Uso:
 *   npm run seed                  # popula o que estiver vazio
 *   ADMIN_SENHA=... npm run seed   # define a senha do admin criado
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');

const { pool } = db;

const BLOCOS = [
    ['A', 'Bloco A - Administração'],
    ['B', 'Bloco B - Laboratórios'],
    ['C', 'Bloco C - Salas de Aula'],
    ['D', 'Bloco D - Auditórios'],
    ['E', 'Bloco E - Pós-Graduação'],
    ['F', 'Bloco F - Biblioteca'],
    ['G', 'Bloco G - Laboratórios de Informática'],
    ['H', 'Bloco H - Sala de Professores'],
    ['I', 'Bloco I - Coordenações'],
    ['J', 'Bloco J - Laboratórios Especiais'],
    ['K', 'Bloco K - Pesquisa'],
    ['L', 'Bloco L - Extensão'],
    ['M', 'Bloco M - Mestrado'],
    ['N', 'Bloco N - Doutorado']
];

const CURSOS = [
    ['Sistemas de Informação', 8, 'Noturno', 8],
    ['Administração', 8, 'Noturno', 8],
    ['Direito', 10, 'Integral', 10],
    ['Engenharia Civil', 10, 'Integral', 10],
    ['Medicina', 12, 'Integral', 12],
    ['Psicologia', 10, 'Integral', 10],
    ['Enfermagem', 8, 'Integral', 8],
    ['Educação Física', 8, 'Integral', 8],
    ['Ciências Contábeis', 8, 'Noturno', 8],
    ['Arquitetura e Urbanismo', 10, 'Integral', 10]
];

const HORARIOS = [
    ['M1', '07:30', '09:10'],
    ['M2', '09:20', '11:00'],
    ['M3', '11:10', '12:50'],
    ['T1', '13:00', '14:40'],
    ['T2', '14:50', '16:30'],
    ['T3', '16:40', '18:20'],
    ['N1', '19:00', '20:40'],
    ['N2', '20:50', '22:30']
];

/** @returns {Promise<number>} linhas na tabela */
async function contar(tabela) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM ${tabela}`);
    return rows[0].total;
}

/**
 * Popula a tabela apenas se estiver vazia.
 * @returns {Promise<number>} linhas inseridas
 */
async function popular(tabela, colunas, valores, conflito) {
    const existentes = await contar(tabela);
    if (existentes > 0) {
        console.log(`⏭️  ${tabela}: já tem ${existentes} registro(s), mantido`);
        return 0;
    }

    const listaColunas = colunas.join(', ');
    const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');
    const onConflict = conflito ? `ON CONFLICT (${conflito}) DO NOTHING` : 'ON CONFLICT DO NOTHING';

    let inseridos = 0;
    for (const linha of valores) {
        const res = await pool.query(
            `INSERT INTO ${tabela} (${listaColunas}) VALUES (${placeholders}) ${onConflict}`,
            linha
        );
        inseridos += res.rowCount || 0;
    }

    console.log(`✅ ${tabela}: ${inseridos} registro(s) inserido(s)`);
    return inseridos;
}

/**
 * Cria o administrador inicial.
 *
 * A senha vem de ADMIN_SENHA ou é sorteada e impressa uma única vez —
 * antes havia um admin fixo com senha "admin123" criado em todo boot e
 * anunciado no log do servidor.
 */
async function criarAdmin() {
    const email = process.env.ADMIN_EMAIL || 'admin@unipam.edu.br';

    const { rows } = await pool.query('SELECT id FROM usuarios WHERE tipo = $1 LIMIT 1', ['admin']);
    if (rows.length > 0) {
        console.log('⏭️  admin: já existe, mantido');
        return;
    }

    const senha = process.env.ADMIN_SENHA || crypto.randomBytes(12).toString('base64url');
    const hash = await bcrypt.hash(senha, 12);

    await pool.query(
        `INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
         VALUES ($1, $2, $3, 'admin', 1)
         ON CONFLICT (email) DO NOTHING`,
        ['Administrador', email, hash]
    );

    console.log(`✅ admin criado: ${email}`);
    if (!process.env.ADMIN_SENHA) {
        console.log('');
        console.log('   ┌─────────────────────────────────────────────────┐');
        console.log('   │ Senha gerada. Anote agora — não será mostrada   │');
        console.log('   │ de novo e não fica salva em lugar nenhum.       │');
        console.log('   └─────────────────────────────────────────────────┘');
        console.log(`   ${senha}`);
        console.log('');
    }
}

async function main() {
    console.log('🌱 Populando dados iniciais...\n');

    await popular('blocos', ['letra', 'nome'], BLOCOS, 'letra');
    await popular('cursos', ['nome', 'duracao', 'turno', 'total_periodos'], CURSOS, 'nome');
    await popular('horarios', ['nome', 'horario_inicio', 'horario_fim'], HORARIOS);
    await criarAdmin();

    console.log('\n✅ Seed concluído.');
}

main()
    .then(() => pool.end())
    .catch(async (err) => {
        console.error('❌ Seed falhou:', err.message);
        await pool.end().catch(() => {});
        process.exit(1);
    });
