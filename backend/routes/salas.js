const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();


const { validarId } = require('../middleware/validarId');
const { validate, schemas } = require('../middleware/validate');

// Qualquer rota com :id recebe 400 para id nao numerico, em vez de
// 500 por erro de tipo do Postgres.
router.param('id', validarId);

/**
 * Dados do mapa do campus: um registro por bloco, com contagem por andar.
 *
 * Alimenta a planta esquemática. Conta números de sala distintos, não
 * linhas, porque o mesmo número pode aparecer mais de uma vez com tipo ou
 * capacidade diferentes; contar linhas mostraria um campus maior do que ele é.
 *
 * Além da contagem, devolve por bloco:
 *   tipos      — os tipos de local mais frequentes, que dão a "vocação" do
 *                bloco e a cor dele no mapa;
 *   destaques  — até três locais com nome próprio (Biblioteca Central,
 *                Restaurante Universitário...), que dizem ao aluno o que
 *                existe ali muito melhor do que o nome cadastrado do bloco.
 */
router.get('/mapa', authenticateToken, (req, res) => {
    db.all(
        `SELECT s.bloco,
                b.nome AS nome_bloco,
                s.andar,
                COUNT(DISTINCT s.numero) AS salas
           FROM salas s
           LEFT JOIN blocos b ON b.letra = s.bloco
          WHERE s.ativa = 1
          GROUP BY s.bloco, b.nome, s.andar
          ORDER BY s.bloco, s.andar`,
        [],
        (err, linhas) => {
            if (err) {
                console.error('❌ Erro ao montar o mapa:', err.message);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }

            // Agrupa por bloco, com os andares dentro.
            const porBloco = new Map();

            for (const l of linhas || []) {
                if (!porBloco.has(l.bloco)) {
                    porBloco.set(l.bloco, {
                        letra: l.bloco,
                        nome: l.nome_bloco || `Bloco ${l.bloco}`,
                        andares: [],
                        total_salas: 0,
                        tipos: [],
                        destaques: []
                    });
                }
                const bloco = porBloco.get(l.bloco);
                bloco.andares.push({ andar: l.andar, salas: l.salas });
                bloco.total_salas += l.salas;
            }

            // Segunda consulta: tipos e locais com nome próprio.
            db.all(
                `SELECT bloco, tipo, numero
                   FROM salas
                  WHERE ativa = 1
                  ORDER BY bloco, numero`,
                [],
                (err2, detalhes) => {
                    // Os detalhes são enfeite: se falharem, o mapa ainda
                    // funciona com as contagens.
                    if (!err2) {
                        const contaTipos = new Map();

                        for (const d of detalhes || []) {
                            const bloco = porBloco.get(d.bloco);
                            if (!bloco) continue;

                            if (d.tipo) {
                                if (!contaTipos.has(d.bloco)) contaTipos.set(d.bloco, new Map());
                                const mapa = contaTipos.get(d.bloco);
                                mapa.set(d.tipo, (mapa.get(d.tipo) || 0) + 1);
                            }

                            // "Biblioteca Central" é um destaque; "204" não.
                            const temLetra = d.numero && /[A-Za-zÀ-ÿ]{4,}/.test(d.numero);
                            if (temLetra && bloco.destaques.length < 3) {
                                bloco.destaques.push(d.numero);
                            }
                        }

                        for (const [letra, mapa] of contaTipos) {
                            porBloco.get(letra).tipos = [...mapa.entries()]
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 3)
                                .map(([tipo, qtd]) => ({ tipo, qtd }));
                        }
                    }

                    responder();
                }
            );

            function responder() {
                res.json({
                    blocos: [...porBloco.values()],
                    total_blocos: porBloco.size,
                    total_salas: [...porBloco.values()].reduce((s, b) => s + b.total_salas, 0)
                });
            }
        }
    );
});

// Listar todas as salas
router.get('/', authenticateToken, (req, res) => {
    console.log('🏫 Buscando salas...');
    
    db.all('SELECT * FROM salas ORDER BY bloco, andar, numero', [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar salas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Criar nova sala (apenas admin)
router.post('/', authenticateToken, requireAdmin, validate(schemas.sala), (req, res) => {
    const { numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus } = req.body;
    
    console.log('🏫 Criando nova sala:', { numero, bloco, andar });
    
    db.run(
        `INSERT INTO salas 
         (numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus, ativa) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [numero, bloco, andar, tipo, capacidade, recursos || '', telefone || '', email || '', campus || ''],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            console.log('✅ Sala criada com ID:', this.lastID);
            res.json({ 
                success: true, 
                message: 'Sala criada com sucesso!', 
                id: this.lastID 
            });
        }
    );
});

// Obter estatísticas dos blocos
router.get('/blocos', authenticateToken, (req, res) => {
    const query = `
        SELECT 
            bloco as letra,
            COUNT(*) as total_salas,
            COUNT(DISTINCT andar) as total_andares
        FROM salas 
        WHERE ativa = 1
        GROUP BY bloco 
        ORDER BY bloco
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar blocos:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Obter andares de um bloco
router.get('/bloco/:bloco/andares', authenticateToken, (req, res) => {
    const { bloco } = req.params;
    
    const query = `
        SELECT DISTINCT andar 
        FROM salas 
        WHERE bloco = ? AND ativa = 1
        ORDER BY andar
    `;
    
    db.all(query, [bloco], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar andares:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Converter números para nomes de andares
        const andaresFormatados = rows.map(row => {
            switch(row.andar) {
                case 0: return 'Térreo';
                case 1: return '1º Andar';
                case 2: return '2º Andar';
                case 3: return '3º Andar';
                default: return `${row.andar}º Andar`;
            }
        });
        
        res.json(andaresFormatados);
    });
});

// Obter salas de um andar específico
router.get('/bloco/:bloco/andar/:andar', authenticateToken, (req, res) => {
    const { bloco, andar } = req.params;
    
    // Converter nome do andar para número
    let andarNumero;
    switch(andar) {
        case 'Térreo': andarNumero = 0; break;
        case '1º Andar': andarNumero = 1; break;
        case '2º Andar': andarNumero = 2; break;
        case '3º Andar': andarNumero = 3; break;
        default: andarNumero = parseInt(andar);
    }
    
    // DISTINCT ON por número: a tabela tem o mesmo número repetido até
    // 5 vezes, cada cópia com tipo e capacidade diferentes. Sem isto a
    // tela lista "A001" quatro vezes dizendo coisas contraditórias.
    // Fica com a linha de menor id, que é a mais antiga.
    const query = `
        SELECT DISTINCT ON (numero)
            id, numero, bloco, andar, tipo, capacidade, recursos,
            telefone, email, campus, ativa
        FROM salas
        WHERE bloco = ? AND andar = ? AND ativa = 1
        ORDER BY numero, id
    `;

    db.all(query, [bloco, andarNumero], (err, rows) => {
        if (err) {
            console.error('❌ Erro ao carregar salas:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Obter salas de um bloco específico
router.get('/bloco/:bloco', authenticateToken, (req, res) => {
    const { bloco } = req.params;
    
    db.all(
        'SELECT * FROM salas WHERE bloco = ? AND ativa = 1 ORDER BY andar, numero',
        [bloco],
        (err, rows) => {
            if (err) {
                console.error('❌ Erro ao buscar salas do bloco:', bloco, err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Atualizar sala (apenas admin)
router.put('/:id', authenticateToken, requireAdmin, validate(schemas.sala), (req, res) => {
    const { id } = req.params;
    const { numero, bloco, andar, tipo, capacidade, recursos, telefone, email, campus } = req.body;
    
    db.run(
        `UPDATE salas SET 
            numero = ?, bloco = ?, andar = ?, tipo = ?, capacidade = ?, 
            recursos = ?, telefone = ?, email = ?, campus = ?
         WHERE id = ?`,
        [numero, bloco, andar, tipo, capacidade, recursos || '', telefone || '', email || '', campus || '', id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Sala não encontrada' });
            }
            
            res.json({ success: true, message: 'Sala atualizada com sucesso!' });
        }
    );
});

// Excluir sala (apenas admin - soft delete)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.run(
        'UPDATE salas SET ativa = 0 WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error('❌ Erro ao desativar sala:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Sala não encontrada' });
            }
            
            res.json({ success: true, message: 'Sala desativada com sucesso!' });
        }
    );
});

// Obter sala por ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM salas WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('❌ Erro ao buscar sala:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Sala não encontrada' });
        }
        
        res.json(row);
    });
});

module.exports = router;