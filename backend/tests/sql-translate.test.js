const { toPg, precisaReturningId } = require('../config/sql-translate');

describe('Placeholders', () => {
    test('? vira $1, $2 na ordem', () => {
        expect(toPg('SELECT * FROM a WHERE x = ? AND y = ?'))
            .toBe('SELECT * FROM a WHERE x = $1 AND y = $2');
    });

    test('sem ? o SQL não muda', () => {
        expect(toPg('SELECT 1')).toBe('SELECT 1');
    });

    test('numera corretamente com muitos placeholders', () => {
        const sql = 'INSERT INTO a (b,c,d,e,f,g,h,i,j,k,l) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
        expect(toPg(sql))
            .toBe('INSERT INTO a (b,c,d,e,f,g,h,i,j,k,l) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)');
    });

    test('? dentro de string literal NÃO é convertido', () => {
        expect(toPg("SELECT * FROM a WHERE s = 'por quê?' AND x = ?"))
            .toBe("SELECT * FROM a WHERE s = 'por quê?' AND x = $1");
    });

    test('aspas simples escapadas não confundem o parser', () => {
        expect(toPg("SELECT * FROM a WHERE s = 'it''s a ? here' AND x = ?"))
            .toBe("SELECT * FROM a WHERE s = 'it''s a ? here' AND x = $1");
    });

    test('? depois de literal fechado é convertido', () => {
        expect(toPg("SELECT '%' || ? || '%' FROM a WHERE y = ?"))
            .toBe("SELECT '%' || $1 || '%' FROM a WHERE y = $2");
    });
});

describe('Funções de data', () => {
    test("datetime('now') vira NOW()", () => {
        expect(toPg("SELECT * FROM t WHERE expires_at > datetime('now')"))
            .toBe('SELECT * FROM t WHERE expires_at > NOW()');
    });

    test("date('now') vira CURRENT_DATE", () => {
        expect(toPg("SELECT * FROM a WHERE data_aula = date('now')"))
            .toBe('SELECT * FROM a WHERE data_aula = CURRENT_DATE');
    });

    test('variação de espaçamento é tratada', () => {
        expect(toPg("SELECT datetime( 'now' )")).toBe('SELECT NOW()');
    });
});

describe('LIKE vira ILIKE', () => {
    // SQLite faz LIKE sem diferenciar maiúsculas para ASCII; Postgres
    // diferencia. Sem esta tradução a busca de salas deixaria de achar
    // "Bloco A" quando o usuário digita "bloco a".
    test('LIKE simples vira ILIKE', () => {
        expect(toPg('SELECT * FROM salas WHERE numero LIKE ?'))
            .toBe('SELECT * FROM salas WHERE numero ILIKE $1');
    });

    test('vários LIKE na mesma query', () => {
        expect(toPg('WHERE numero LIKE ? OR bloco LIKE ? OR tipo LIKE ?'))
            .toBe('WHERE numero ILIKE $1 OR bloco ILIKE $2 OR tipo ILIKE $3');
    });

    test('NOT LIKE vira NOT ILIKE', () => {
        expect(toPg('WHERE nome NOT LIKE ?')).toBe('WHERE nome NOT ILIKE $1');
    });

    test('a palavra LIKE dentro de string literal não é tocada', () => {
        expect(toPg("SELECT * FROM a WHERE s = 'I LIKE cake'"))
            .toBe("SELECT * FROM a WHERE s = 'I LIKE cake'");
    });

    test('ILIKE já existente não é duplicado', () => {
        expect(toPg('WHERE nome ILIKE ?')).toBe('WHERE nome ILIKE $1');
    });
});

describe('INSERT OR IGNORE / OR REPLACE', () => {
    test('INSERT OR IGNORE vira INSERT + ON CONFLICT DO NOTHING', () => {
        expect(toPg('INSERT OR IGNORE INTO blocos (letra, nome) VALUES (?, ?)'))
            .toBe('INSERT INTO blocos (letra, nome) VALUES ($1, $2) ON CONFLICT DO NOTHING');
    });

    test('INSERT OR IGNORE não duplica ON CONFLICT já presente', () => {
        const sql = 'INSERT OR IGNORE INTO t (a) VALUES (?) ON CONFLICT (a) DO NOTHING';
        expect(toPg(sql)).toBe('INSERT INTO t (a) VALUES ($1) ON CONFLICT (a) DO NOTHING');
    });

    test('INSERT OR REPLACE vira INSERT + ON CONFLICT DO NOTHING', () => {
        // Sem a coluna de conflito não há como fazer DO UPDATE genérico.
        expect(toPg('INSERT OR REPLACE INTO t (a) VALUES (?)'))
            .toBe('INSERT INTO t (a) VALUES ($1) ON CONFLICT DO NOTHING');
    });
});

describe('Agregações', () => {
    test('GROUP_CONCAT(x) vira STRING_AGG(x, \',\')', () => {
        expect(toPg('SELECT GROUP_CONCAT(nome) FROM a'))
            .toBe("SELECT STRING_AGG(nome, ',') FROM a");
    });

    test('GROUP_CONCAT com separador explícito vira STRING_AGG', () => {
        expect(toPg("SELECT GROUP_CONCAT(nome, ' | ') FROM a"))
            .toBe("SELECT STRING_AGG(nome, ' | ') FROM a");
    });

    test('IFNULL vira COALESCE', () => {
        expect(toPg('SELECT IFNULL(a, 0) FROM t')).toBe('SELECT COALESCE(a, 0) FROM t');
    });
});

describe('precisaReturningId', () => {
    test('INSERT sem RETURNING precisa', () => {
        expect(precisaReturningId('INSERT INTO t (a) VALUES ($1)')).toBe(true);
    });

    test('INSERT com RETURNING não precisa', () => {
        expect(precisaReturningId('INSERT INTO t (a) VALUES ($1) RETURNING id')).toBe(false);
    });

    test('UPDATE não precisa', () => {
        expect(precisaReturningId('UPDATE t SET a = $1')).toBe(false);
    });

    test('DELETE não precisa', () => {
        expect(precisaReturningId('DELETE FROM t WHERE id = $1')).toBe(false);
    });

    test('SELECT não precisa', () => {
        expect(precisaReturningId('SELECT * FROM t')).toBe(false);
    });

    test('INSERT com ON CONFLICT DO NOTHING precisa (pode não retornar linha)', () => {
        expect(precisaReturningId('INSERT INTO t (a) VALUES ($1) ON CONFLICT DO NOTHING')).toBe(true);
    });

    test('espaços e quebras de linha antes do INSERT não atrapalham', () => {
        expect(precisaReturningId('\n   INSERT INTO t (a) VALUES ($1)')).toBe(true);
    });
});

describe('Queries reais do projeto', () => {
    test('login por email', () => {
        expect(toPg('SELECT * FROM usuarios WHERE email = ? AND ativo = 1'))
            .toBe('SELECT * FROM usuarios WHERE email = $1 AND ativo = 1');
    });

    test('verificação de token de reset', () => {
        const sql = `SELECT pt.*, u.email, u.nome
         FROM password_reset_tokens pt
         JOIN usuarios u ON pt.user_id = u.id
         WHERE pt.token = ? AND pt.used = 0 AND pt.expires_at > datetime('now')`;
        const out = toPg(sql);

        expect(out).toContain('pt.token = $1');
        expect(out).toContain('NOW()');
        expect(out).not.toContain("datetime('now')");
    });

    test('busca de aulas por turma com concatenação', () => {
        const sql = "SELECT * FROM aulas a WHERE a.turma LIKE '%' || ? || '%' OR a.turma IS NULL";
        expect(toPg(sql))
            .toBe("SELECT * FROM aulas a WHERE a.turma ILIKE '%' || $1 || '%' OR a.turma IS NULL");
    });

    test('insert de usuário', () => {
        const sql = `INSERT INTO usuarios (nome, email, matricula, curso, periodo, senha_hash)
                     VALUES (?, ?, ?, ?, ?, ?)`;
        const out = toPg(sql);
        expect(out).toContain('VALUES ($1, $2, $3, $4, $5, $6)');
    });
});
