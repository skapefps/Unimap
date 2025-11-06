const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireProfessor } = require('../middleware/auth');
const router = express.Router();

// 🔧 PROMISIFY DATABASE OPERATIONS
const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const validateAulaData = (req, res, next) => {
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, data_aula, periodo } = req.body;

    console.log('🔍 Validando dados da aula:', {
        disciplina, sala_id, curso, turma, horario_inicio, horario_fim, data_aula, periodo
    });

    const missingFields = [];
    if (!disciplina || disciplina.trim().length === 0) missingFields.push('disciplina');
    if (!sala_id) missingFields.push('sala_id');
    if (!curso || curso.trim().length === 0) missingFields.push('curso');
    if (!turma || turma.trim().length === 0) missingFields.push('turma');
    if (!horario_inicio) missingFields.push('horario_inicio');
    if (!horario_fim) missingFields.push('horario_fim');
    if (!data_aula) missingFields.push('data_aula');

    if (missingFields.length > 0) {
        console.log('❌ Campos faltando:', missingFields);
        return res.status(400).json({
            success: false,
            error: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
        });
    }

    // Validar formato da data
    if (data_aula && !isValidDate(data_aula)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de data inválido. Use YYYY-MM-DD'
        });
    }

    // 🔥 CORREÇÃO RADICAL: REMOVER TODA VALIDAÇÃO DE DATA
    // Permitir qualquer data, incluindo hoje e datas passadas
    console.log('📅 Data aceita sem validação:', data_aula);

    next();
};

const validateAulaDataEdicao = (req, res, next) => {
    const { disciplina, sala_id, curso, turma, horario_inicio, horario_fim, data_aula, periodo } = req.body;

    console.log('🔍 Validando dados da aula para EDIÇÃO:', {
        disciplina, sala_id, curso, turma, horario_inicio, horario_fim, data_aula, periodo
    });

    const missingFields = [];
    if (!disciplina || disciplina.trim().length === 0) missingFields.push('disciplina');
    if (!sala_id) missingFields.push('sala_id');
    if (!curso || curso.trim().length === 0) missingFields.push('curso');
    if (!turma || turma.trim().length === 0) missingFields.push('turma');
    if (!horario_inicio) missingFields.push('horario_inicio');
    if (!horario_fim) missingFields.push('horario_fim');
    if (!data_aula) missingFields.push('data_aula');

    if (missingFields.length > 0) {
        console.log('❌ Campos faltando:', missingFields);
        return res.status(400).json({
            success: false,
            error: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
        });
    }

    if (data_aula && !isValidDate(data_aula)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de data inválido. Use YYYY-MM-DD'
        });
    }

    console.log('📅 Data aceita para edição (sem restrições):', data_aula);

    next();
};

// 🔧 CORRIGIR COLUNA DIA_SEMANA (remover NOT NULL constraint)
function corrigirColunaDiaSemana() {
    console.log('🔧 Verificando coluna dia_semana na tabela aulas...');

    db.all(`PRAGMA table_info(aulas)`, (err, rows) => {
        if (err) {
            console.error('❌ Erro ao verificar estrutura da tabela aulas:', err);
            return;
        }

        const colunaDiaSemana = rows.find(row => row.name === 'dia_semana');

        if (colunaDiaSemana) {
            console.log('📊 Coluna dia_semana encontrada:', colunaDiaSemana);

            if (colunaDiaSemana.notnull === 1) {
                console.log('🔄 Coluna dia_semana é NOT NULL, atualizando para permitir NULL...');

                // SQLite não permite alterar diretamente a constraint, então precisamos:
                // 1. Criar uma tabela temporária
                // 2. Copiar os dados
                // 3. Dropar a tabela original
                // 4. Renomear a temporária

                db.serialize(() => {
                    // Criar tabela temporária sem a constraint NOT NULL
                    db.run(`CREATE TABLE IF NOT EXISTS aulas_temp (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        disciplina TEXT NOT NULL,
                        professor_id INTEGER NOT NULL,
                        sala_id INTEGER,
                        curso TEXT,
                        turma TEXT,
                        horario_inicio TIME NOT NULL,
                        horario_fim TIME NOT NULL,
                        data_aula DATE NOT NULL,
                        periodo INTEGER,
                        dia_semana INTEGER,
                        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                        ativa BOOLEAN DEFAULT 1,
                        FOREIGN KEY (professor_id) REFERENCES professores (id),
                        FOREIGN KEY (sala_id) REFERENCES salas (id)
                    )`);

                    // Copiar dados
                    db.run(`INSERT INTO aulas_temp 
                           SELECT id, disciplina, professor_id, sala_id, curso, turma, 
                                  horario_inicio, horario_fim, data_aula, periodo, 
                                  dia_semana, data_criacao, ativa 
                           FROM aulas`);

                    // Dropar tabela original
                    db.run(`DROP TABLE aulas`);

                    // Renomear temporária
                    db.run(`ALTER TABLE aulas_temp RENAME TO aulas`);

                    console.log('✅ Coluna dia_semana atualizada para permitir NULL');
                });
            } else {
                console.log('✅ Coluna dia_semana já permite NULL');
            }
        } else {
            console.log('ℹ️ Coluna dia_semana não encontrada na tabela aulas');
        }
    });
}

// Chamar esta função no initializeDatabase
setTimeout(() => {
    corrigirColunaDiaSemana();
}, 2000);

const isValidDate = (dateString) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regex)) return false;

    const date = new Date(dateString);
    const timestamp = date.getTime();
    return !isNaN(timestamp);
};

const calcularDiaSemana = (dataString) => {
    console.log('📅 Calculando dia da semana para:', dataString);

    const [ano, mes, dia] = dataString.split('-').map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    const diaSemana = data.getUTCDay();
    const resultado = diaSemana === 0 ? 7 : diaSemana;
    console.log(`📅 Data: ${dataString} -> Dia da semana calculado: ${resultado} (${getNomeDiaSemana(resultado)})`);

    return resultado;
};

const getNomeDiaSemana = (diaNumero) => {
    const dias = {
        1: 'Segunda-feira',
        2: 'Terça-feira',
        3: 'Quarta-feira',
        4: 'Quinta-feira',
        5: 'Sexta-feira',
        6: 'Sábado',
        7: 'Domingo'
    };
    return dias[diaNumero] || 'Desconhecido';
};

// 🔧 VERIFICAÇÃO DE DUPLICAÇÃO POR DATA
const verificarDuplicacaoAulaPorData = async (professorId, aulaData) => {
    const query = `
        SELECT id FROM aulas 
        WHERE professor_id = ? 
        AND sala_id = ? 
        AND data_aula = ? 
        AND horario_inicio = ? 
        AND horario_fim = ?
        AND ativa = 1
    `;

    const existing = await dbGet(query, [
        professorId, aulaData.sala_id, aulaData.data_aula,
        aulaData.horario_inicio, aulaData.horario_fim
    ]);

    return !!existing;
};

// 🔧 CRIAÇÃO DE AULA - VERSÃO SIMPLIFICADA
router.post('/', authenticateToken, requireProfessor, validateAulaData, async (req, res) => {
    const aulaData = req.body;
    console.log('📝 Criando aula com data:', aulaData.data_aula, 'para professor:', req.user.email);

    try {
        // Buscar professor pelo email do usuário logado
        const professor = await dbGet('SELECT id, nome FROM professores WHERE email = ?', [req.user.email]);
        if (!professor) {
            return res.status(404).json({
                success: false,
                error: 'Professor não encontrado'
            });
        }

        // VERIFICAR DUPLICAÇÃO por data e horário
        const duplicata = await verificarDuplicacaoAulaPorData(professor.id, aulaData);

        if (duplicata) {
            return res.status(400).json({
                success: false,
                error: 'Já existe uma aula agendada para esta data e horário'
            });
        }

        // 🔥 CORREÇÃO: Calcular dia da semana de forma simples
        const dia_semana = calcularDiaSemana(aulaData.data_aula);

        // 🔥 SALVAR COM OS DADOS RECEBIDOS (sem manipulação de timezone)
        const result = await dbRun(
            `INSERT INTO aulas (disciplina, professor_id, sala_id, curso, turma, 
             horario_inicio, horario_fim, data_aula, periodo, dia_semana, ativa) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                aulaData.disciplina,
                professor.id,
                aulaData.sala_id,
                aulaData.curso,
                aulaData.turma,
                aulaData.horario_inicio,
                aulaData.horario_fim,
                aulaData.data_aula, // 🔥 Usar a data exatamente como veio
                aulaData.periodo,
                dia_semana
            ]
        );

        // Buscar aula criada
        const aulaCriada = await dbGet(`
            SELECT 
                a.id, a.disciplina, a.professor_id, a.sala_id, a.curso, a.turma,
                a.horario_inicio, a.horario_fim, a.data_aula, a.periodo, 
                a.dia_semana, a.ativa,
                s.numero as sala_numero, s.bloco as sala_bloco,
                p.nome as professor_nome, p.email as professor_email
            FROM aulas a 
            LEFT JOIN salas s ON a.sala_id = s.id 
            LEFT JOIN professores p ON a.professor_id = p.id
            WHERE a.id = ?
        `, [result.lastID]);

        console.log(`✅ Aula criada para ${aulaData.data_aula} (dia ${dia_semana}) pelo professor ${professor.nome}`);

        res.json({
            success: true,
            message: `Aula criada com sucesso para ${formatarDataDisplay(aulaData.data_aula)}!`,
            aula: aulaCriada
        });

    } catch (error) {
        console.error('❌ Erro ao criar aula:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor: ' + error.message
        });
    }
});

// 🔧 IMPORTAR CSV - PROCESSAR E VALIDAR
router.post('/importar-csv', authenticateToken, requireAdmin, async (req, res) => {
    const { csvData } = req.body;

    console.log('📤 Processando importação de CSV:', csvData.length, 'linhas');

    try {
        if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Dados CSV inválidos ou vazios'
            });
        }

        const resultados = {
            aulasValidas: [],
            erros: [],
            totais: {
                linhasProcessadas: csvData.length,
                aulasValidas: 0,
                erros: 0
            }
        };

        // Processar cada linha do CSV
        for (let i = 0; i < csvData.length; i++) {
            const linha = csvData[i];
            try {
                console.log(`🔍 Processando linha ${i + 1}:`, linha);

                // Validar estrutura mínima
                if (!linha.Professor || !linha.Disciplina || !linha.Sala || !linha.Horário || !linha['Data da Aula']) {
                    resultados.erros.push({
                        linha: i + 1,
                        dados: linha,
                        erro: 'Campos obrigatórios faltando (Professor, Disciplina, Sala, Horário, Data da Aula)'
                    });
                    continue;
                }

                // Parse do horário (formato: "18:50-19:40")
                const horarioParts = linha.Horário.split('-');
                if (horarioParts.length !== 2) {
                    resultados.erros.push({
                        linha: i + 1,
                        dados: linha,
                        erro: 'Formato de horário inválido. Use: HH:MM-HH:MM'
                    });
                    continue;
                }

                const [horario_inicio, horario_fim] = horarioParts;

                // Validar formato de hora
                const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
                if (!horaRegex.test(horario_inicio.trim()) || !horaRegex.test(horario_fim.trim())) {
                    resultados.erros.push({
                        linha: i + 1,
                        dados: linha,
                        erro: 'Formato de hora inválido. Use: HH:MM (24h)'
                    });
                    continue;
                }

                // Validar data
                if (!isValidDate(linha['Data da Aula'])) {
                    resultados.erros.push({
                        linha: i + 1,
                        dados: linha,
                        erro: 'Formato de data inválido. Use: YYYY-MM-DD'
                    });
                    continue;
                }

                // Buscar professor pelo nome
                const professor = await dbGet('SELECT id, nome FROM professores WHERE nome = ?', [linha.Professor]);
                if (!professor) {
                    resultados.erros.push({
                        linha: i + 1,
                        dados: linha,
                        erro: `Professor não encontrado: ${linha.Professor}`
                    });
                    continue;
                }

                // Buscar sala pelo número
                const sala = await dbGet('SELECT id, numero, bloco FROM salas WHERE numero = ?', [linha.Sala]);
                if (!sala) {
                    resultados.erros.push({
                        linha: i + 1,
                        dados: linha,
                        erro: `Sala não encontrada: ${linha.Sala}`
                    });
                    continue;
                }

                // Extrair número do período (ex: "5º Período" -> 5)
                let periodo = null;
                if (linha.Período) {
                    const periodoMatch = linha.Período.match(/(\d+)/);
                    periodo = periodoMatch ? parseInt(periodoMatch[1]) : null;
                }

                // Calcular dia da semana
                const dia_semana = calcularDiaSemana(linha['Data da Aula']);

                // Verificar duplicação
                const duplicata = await verificarDuplicacaoAulaPorData(professor.id, {
                    sala_id: sala.id,
                    data_aula: linha['Data da Aula'],
                    horario_inicio: horario_inicio.trim(),
                    horario_fim: horario_fim.trim()
                });

                if (duplicata) {
                    resultados.erros.push({
                        linha: i + 1,
                        dados: linha,
                        erro: 'Já existe uma aula agendada para esta data e horário'
                    });
                    continue;
                }

                // Aula válida - adicionar aos resultados
                const aulaProcessada = {
                    linha: i + 1,
                    dados: {
                        professor_nome: linha.Professor,
                        professor_id: professor.id,
                        disciplina: linha.Disciplina,
                        sala_numero: linha.Sala,
                        sala_id: sala.id,
                        sala_bloco: sala.bloco,
                        curso: linha.Curso || '',
                        turma: linha.Turma || '',
                        periodo: periodo,
                        periodo_original: linha.Período || '',
                        horario_inicio: horario_inicio.trim(),
                        horario_fim: horario_fim.trim(),
                        horario_original: linha.Horário,
                        data_aula: linha['Data da Aula'],
                        dia_semana: dia_semana,
                        dia_semana_nome: getNomeDiaSemana(dia_semana)
                    },
                    status: 'valida'
                };

                resultados.aulasValidas.push(aulaProcessada);
                resultados.totais.aulasValidas++;

                console.log(`✅ Linha ${i + 1} processada com sucesso`);

            } catch (error) {
                console.error(`❌ Erro ao processar linha ${i + 1}:`, error);
                resultados.erros.push({
                    linha: i + 1,
                    dados: linha,
                    erro: `Erro interno: ${error.message}`
                });
            }
        }

        resultados.totais.erros = resultados.erros.length;

        console.log(`📊 Resultado do processamento: ${resultados.totais.aulasValidas} válidas, ${resultados.totais.erros} erros`);

        res.json({
            success: true,
            message: `CSV processado: ${resultados.totais.aulasValidas} aulas válidas, ${resultados.totais.erros} erros`,
            data: resultados
        });

    } catch (error) {
        console.error('❌ Erro ao processar CSV:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao processar CSV: ' + error.message
        });
    }
});

// 🔧 CRIAR AULAS EM LOTE
router.post('/criar-lote', authenticateToken, requireAdmin, async (req, res) => {
    const { aulas } = req.body;

    console.log('📦 Criando lote de aulas:', aulas.length);

    try {
        if (!aulas || !Array.isArray(aulas) || aulas.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma aula fornecida para criação'
            });
        }

        const resultados = {
            sucessos: [],
            erros: []
        };

        for (const aulaData of aulas) {
            try {
                console.log('🔍 Criando aula:', aulaData);

                // Verificar se ainda não existe duplicata
                const duplicata = await verificarDuplicacaoAulaPorData(aulaData.professor_id, {
                    sala_id: aulaData.sala_id,
                    data_aula: aulaData.data_aula,
                    horario_inicio: aulaData.horario_inicio,
                    horario_fim: aulaData.horario_fim
                });

                if (duplicata) {
                    resultados.erros.push({
                        aula: aulaData,
                        erro: 'Já existe uma aula agendada para esta data e horário'
                    });
                    continue;
                }

                // Inserir aula
                const result = await dbRun(
                    `INSERT INTO aulas (disciplina, professor_id, sala_id, curso, turma, 
                     horario_inicio, horario_fim, data_aula, periodo, dia_semana, ativa) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        aulaData.disciplina,
                        aulaData.professor_id,
                        aulaData.sala_id,
                        aulaData.curso,
                        aulaData.turma,
                        aulaData.horario_inicio,
                        aulaData.horario_fim,
                        aulaData.data_aula,
                        aulaData.periodo,
                        aulaData.dia_semana
                    ]
                );

                // Buscar aula criada
                const aulaCriada = await dbGet(`
                    SELECT 
                        a.id, a.disciplina, a.professor_id, a.sala_id, a.curso, a.turma,
                        a.horario_inicio, a.horario_fim, a.data_aula, a.periodo, 
                        a.dia_semana, a.ativa,
                        s.numero as sala_numero, s.bloco as sala_bloco,
                        p.nome as professor_nome, p.email as professor_email
                    FROM aulas a 
                    LEFT JOIN salas s ON a.sala_id = s.id 
                    LEFT JOIN professores p ON a.professor_id = p.id
                    WHERE a.id = ?
                `, [result.lastID]);

                resultados.sucessos.push({
                    aula: aulaCriada,
                    mensagem: 'Aula criada com sucesso'
                });

                console.log(`✅ Aula criada: ${aulaData.disciplina} - ${aulaData.data_aula}`);

            } catch (error) {
                console.error('❌ Erro ao criar aula:', error);
                resultados.erros.push({
                    aula: aulaData,
                    erro: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Lote processado: ${resultados.sucessos.length} sucessos, ${resultados.erros.length} erros`,
            data: resultados
        });

    } catch (error) {
        console.error('❌ Erro ao criar lote de aulas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao criar aulas: ' + error.message
        });
    }
});

// Função para formatar data para exibição
const formatarDataDisplay = (dataString) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// 🔧 ATUALIZAÇÃO DE AULA COM CÁLCULO CORRETO
router.put('/:id', authenticateToken, requireProfessor, validateAulaDataEdicao, async (req, res) => {
    const { id } = req.params;
    const aulaData = req.body;

    console.log('✏️ Atualizando aula:', id, aulaData);

    try {
        // 🔥 CORREÇÃO: Usar a mesma função corrigida
        const dia_semana = calcularDiaSemana(aulaData.data_aula);

        const result = await dbRun(
            `UPDATE aulas SET 
                disciplina = ?, sala_id = ?, curso = ?, turma = ?, 
                horario_inicio = ?, horario_fim = ?, data_aula = ?, 
                periodo = ?, dia_semana = ?
             WHERE id = ?`,
            [
                aulaData.disciplina, aulaData.sala_id, aulaData.curso, aulaData.turma,
                aulaData.horario_inicio, aulaData.horario_fim, aulaData.data_aula,
                aulaData.periodo, dia_semana, id
            ]
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Aula não encontrada'
            });
        }

        console.log('✅ Aula atualizada com data:', aulaData.data_aula, 'dia:', dia_semana);
        res.json({
            success: true,
            message: `Aula atualizada para ${formatarDataDisplay(aulaData.data_aula)}!`
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar aula:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// 🔧 OPERAÇÕES COMUNS DE AULA
const executarOperacaoAula = async (req, res, operacao, mensagemSucesso) => {
    const { id } = req.params;

    console.log(`🔄 ${mensagemSucesso} aula:`, id);

    try {
        const result = await dbRun(
            'UPDATE aulas SET ativa = ? WHERE id = ?',
            [operacao, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Aula não encontrada' });
        }

        console.log(`✅ ${mensagemSucesso} com sucesso`);
        res.json({
            success: true,
            message: `${mensagemSucesso} com sucesso!`
        });

    } catch (error) {
        console.error(`❌ Erro ao ${mensagemSucesso.toLowerCase()} aula:`, error);
        res.status(400).json({ error: error.message });
    }
};

// Cancelar aula
router.put('/:id/cancelar', authenticateToken, requireProfessor, (req, res) => {
    executarOperacaoAula(req, res, 0, 'Aula cancelada');
});

// Reativar aula
router.put('/:id/reativar', authenticateToken, requireProfessor, (req, res) => {
    executarOperacaoAula(req, res, 1, 'Aula reativada');
});

// 🔧 CONSULTAS OTIMIZADAS

const getAulasBaseQuery = (filtroProfessor = false) => `
    SELECT 
        a.*, 
        s.numero as sala_numero, 
        s.bloco as sala_bloco,
        s.andar as sala_andar,
        p.nome as professor_nome,
        p.email as professor_email
    FROM aulas a
    LEFT JOIN salas s ON a.sala_id = s.id
    LEFT JOIN professores p ON a.professor_id = p.id
    ${filtroProfessor ? 'WHERE p.email = ?' : ''}
    ORDER BY a.ativa DESC, a.data_aula, a.horario_inicio
`;

// Obter aulas do usuário
router.get('/usuario/:usuario_id', authenticateToken, async (req, res) => {
    const { usuario_id } = req.params;
    console.log('📚 Buscando aulas para usuário:', usuario_id);

    try {
        const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [usuario_id]);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log('👤 Usuário encontrado:', user.nome, '- Tipo:', user.tipo);

        let query, params;

        if (user.tipo === 'professor') {
            query = `
                SELECT 
                    a.*, 
                    d.nome as disciplina_nome,
                    s.numero as sala_numero, 
                    s.bloco as sala_bloco,
                    s.andar as sala_andar,
                    p.nome as professor_nome
                FROM aulas a
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN professores p ON a.professor_id = p.id
                WHERE p.email = ? AND a.ativa = 1
                ORDER BY a.data_aula, a.horario_inicio
            `;
            params = [user.email];
        } else {
            query = `
                SELECT a.*, p.nome as professor_nome, s.numero as sala_numero, s.bloco as sala_bloco,
                       d.nome as disciplina_nome
                FROM aulas a
                LEFT JOIN professores p ON a.professor_id = p.id
                LEFT JOIN salas s ON a.sala_id = s.id
                LEFT JOIN disciplinas d ON a.disciplina_id = d.id
                WHERE a.ativa = 1
                ORDER BY a.data_aula, a.horario_inicio
            `;
            params = [];
        }

        const rows = await dbAll(query, params);
        console.log(`✅ ${rows.length} aulas encontradas para o usuário`);
        res.json(rows);

    } catch (error) {
        console.error('❌ Erro ao buscar aulas do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// Aulas do professor
router.get('/professor/minhas-aulas', authenticateToken, requireProfessor, async (req, res) => {
    console.log('📚 Buscando aulas do professor:', req.user.email);

    try {
        const query = getAulasBaseQuery(true);
        const rows = await dbAll(query, [req.user.email]);

        console.log(`✅ ${rows.length} aulas encontradas para o professor ${req.user.email}`);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('❌ Erro ao buscar aulas do professor:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔧 AULAS DO ALUNO - TODAS AS AULAS FUTURAS E RECENTES
router.get('/aluno/:aluno_id', authenticateToken, async (req, res) => {
    const { aluno_id } = req.params;

    console.log('🎓 Buscando TODAS as aulas para aluno:', aluno_id);

    if (!aluno_id || aluno_id === 'undefined' || isNaN(parseInt(aluno_id))) {
        return res.status(400).json({
            success: false,
            error: 'ID do aluno inválido'
        });
    }

    try {
        // Buscar dados do aluno
        const aluno = await dbGet(`
            SELECT u.id, u.nome, u.curso, u.periodo, t.nome as turma_nome
            FROM usuarios u
            LEFT JOIN aluno_turmas at ON u.id = at.aluno_id AND at.status = 'cursando'
            LEFT JOIN turmas t ON at.turma_id = t.id
            WHERE u.id = ? AND u.tipo = 'aluno'
        `, [aluno_id]);

        if (!aluno) {
            console.log('❌ Aluno não encontrado ou não é do tipo aluno:', aluno_id);
            return res.status(404).json({
                success: false,
                error: 'Aluno não encontrado'
            });
        }

        console.log('👤 Dados do aluno encontrado:', aluno);

        if (!aluno.curso) {
            console.log('⚠️ Aluno não tem curso definido, retornando aulas vazias');
            return res.json([]);
        }

        // 🔥 CORREÇÃO: Buscar TODAS as aulas do curso, ordenadas por data
        const query = `
            SELECT 
                a.*, 
                p.nome as professor_nome, 
                s.numero as sala_numero, 
                s.bloco as sala_bloco,
                s.andar as sala_andar,
                a.disciplina as disciplina_nome,
                CASE 
                    WHEN a.ativa = 0 THEN 'cancelada'
                    ELSE 'ativa'
                END as status_aula
            FROM aulas a
            LEFT JOIN professores p ON a.professor_id = p.id
            LEFT JOIN salas s ON a.sala_id = s.id
            WHERE a.curso = ?
            ORDER BY a.data_aula ASC, a.horario_inicio ASC
        `;

        const params = [aluno.curso];

        console.log('🔍 Executando query para aluno (TODAS as aulas):', aluno.nome);
        const rows = await dbAll(query, params);
        console.log(`✅ ${rows.length} aulas encontradas para o aluno ${aluno.nome} (todas as datas)`);

        res.json(rows);

    } catch (error) {
        console.error('❌ Erro ao buscar aulas do aluno:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor: ' + error.message
        });
    }
});

// Todas as aulas (apenas admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    console.log('📚 Buscando todas as aulas...');

    try {
        const query = `
            SELECT 
                a.*, 
                p.nome as professor_nome,
                d.nome as disciplina_nome,
                s.numero as sala_numero,
                s.bloco as sala_bloco
            FROM aulas a
            LEFT JOIN professores p ON a.professor_id = p.id
            LEFT JOIN disciplinas d ON a.disciplina_id = d.id
            LEFT JOIN salas s ON a.sala_id = s.id
            WHERE a.ativa = 1
            ORDER BY a.data_aula, a.horario_inicio
        `;

        const rows = await dbAll(query, []);
        console.log(`✅ ${rows.length} aulas encontradas`);
        res.json(rows);

    } catch (error) {
        console.error('❌ Erro ao buscar aulas:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔧 EXCLUIR AULA
router.delete('/:id', authenticateToken, requireProfessor, async (req, res) => {
    const { id } = req.params;

    console.log('🗑️ Excluindo aula:', id, 'para professor:', req.user.email);

    try {
        // Verificar se a aula existe e pertence ao professor
        const aula = await dbGet(
            `SELECT a.*, p.email 
             FROM aulas a 
             LEFT JOIN professores p ON a.professor_id = p.id 
             WHERE a.id = ? AND p.email = ?`,
            [id, req.user.email]
        );

        if (!aula) {
            return res.status(404).json({
                success: false,
                error: 'Aula não encontrada ou você não tem permissão para excluí-la'
            });
        }

        // Excluir a aula
        const result = await dbRun('DELETE FROM aulas WHERE id = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Aula não encontrada'
            });
        }

        console.log('✅ Aula excluída com sucesso');
        res.json({
            success: true,
            message: 'Aula excluída com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro ao excluir aula:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor: ' + error.message
        });
    }
});

// ROTA DE HEALTH CHECK
router.get('/health', async (req, res) => {
    try {
        const aulaCount = await dbGet('SELECT COUNT(*) as count FROM aulas', []);
        res.json({
            status: 'healthy',
            aulaCount: aulaCount.count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;