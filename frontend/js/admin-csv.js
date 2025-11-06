class AdminCSV {
    constructor() {
        this.aulasProcessadas = [];
        this.errosProcessamento = [];
        this.importacaoSucesso = { sucessos: 0, erros: 0 };
        this.handleBtnImportClick = null;
        this.handleFileInputChange = null;
        this.handleDragOver = null;
        this.handleDragLeave = null;
        this.handleDrop = null;
        this.init();
    }

    init() {
        console.log('📊 Inicializando Admin CSV...');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.configurarEventListeners();
            });
        } else {
            this.configurarEventListeners();
        }
    }

    setupEventListeners() {
        const fileInput = document.getElementById('csvFile');
        if (fileInput) {
            fileInput.addEventListener('change', (event) => {
                this.handleFileSelect(event);
            });
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('📁 Arquivo selecionado:', file.name);

        // Validar tipo de arquivo
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.mostrarErro('Por favor, selecione um arquivo CSV.');
            return;
        }

        // Mostrar informações do arquivo
        this.mostrarInfoArquivo(file);

        this.mostrarLoading('Processando arquivo CSV...');

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const csvText = e.target.result;
                console.log('📄 Conteúdo do CSV carregado');
                this.processarCSV(csvText);
            } catch (error) {
                console.error('❌ Erro ao ler arquivo:', error);
                this.mostrarErro('Erro ao ler arquivo: ' + error.message);
            }
        };

        reader.onerror = () => {
            this.mostrarErro('Erro ao ler o arquivo.');
        };

        reader.readAsText(file, 'UTF-8');
    }

    mostrarInfoArquivo(file) {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        if (fileInfo && fileName && fileSize) {
            fileName.textContent = file.name;
            fileSize.textContent = this.formatarTamanhoArquivo(file.size);
            fileInfo.style.display = 'flex';
        }
    }

    formatarTamanhoArquivo(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removerArquivo() {
        const fileInput = document.getElementById('csvFile');
        const fileInfo = document.getElementById('fileInfo');

        if (fileInput) {
            fileInput.value = '';
        }
        if (fileInfo) {
            fileInfo.style.display = 'none';
        }

        // Limpar qualquer preview existente, mas manter os event listeners
        const previewSection = document.querySelector('.preview-section');
        const errosSection = document.querySelector('.erros-section');
        const globalActions = document.querySelector('.global-actions');

        if (previewSection) previewSection.remove();
        if (errosSection) errosSection.remove();
        if (globalActions) globalActions.remove();

        // Mostrar o drop zone novamente
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.style.display = 'block';
        }

        // Resetar estatísticas
        this.aulasProcessadas = [];
        this.errosProcessamento = [];

        console.log('🗑️ Arquivo removido, pronto para nova seleção');
    }

    configurarEventListeners() {
        // Prevenir configuração múltipla
        if (this.eventListenersConfigured) {
            console.log('⚠️ Event listeners já configurados, ignorando...');
            return;
        }

        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('csvFile');
        const btnImport = document.getElementById('btnImport');
        const btnRemover = document.getElementById('btnRemover');

        if (!dropZone || !fileInput || !btnImport) {
            console.error('❌ Elementos não encontrados para configurar event listeners');
            return;
        }

        console.log('🔧 Configurando event listeners...');

        // **SOLUÇÃO: Usar event delegation e evitar múltiplos registros**

        // 1. Botão de importação - CLIQUE ÚNICO
        btnImport.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📁 Clique no botão de importação');

            if (this.isProcessing) {
                console.log('⏳ Já processando, ignorando clique...');
                return;
            }

            this.isProcessing = true;
            fileInput.click();

            // Reset após um tempo
            setTimeout(() => {
                this.isProcessing = false;
            }, 1000);
        });

        // 2. Input file - CHANGE ÚNICO
        const fileInputHandler = (e) => {
            if (e.target.files.length > 0) {
                console.log('📁 Arquivo selecionado via input:', e.target.files[0].name);
                this.handleFileSelect(e);

                // Remover o listener temporariamente para evitar duplicação
                fileInput.removeEventListener('change', fileInputHandler);

                // Re-adicionar após processamento
                setTimeout(() => {
                    fileInput.addEventListener('change', fileInputHandler);
                }, 1000);
            }
        };

        fileInput.addEventListener('change', fileInputHandler);

        // 3. Drag & drop - Configurar apenas uma vez
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('active');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');

            const files = e.dataTransfer.files;
            if (files.length > 0 && !this.isProcessing) {
                console.log('📁 Arquivo arrastado e solto:', files[0].name);
                this.isProcessing = true;
                fileInput.files = files;
                this.handleFileSelect({ target: { files: files } });

                setTimeout(() => {
                    this.isProcessing = false;
                }, 1000);
            }
        });

        // 4. Botão remover
        if (btnRemover) {
            btnRemover.addEventListener('click', (e) => {
                e.preventDefault();
                this.removerArquivo();
            });
        }

        // Marcar como configurado
        this.eventListenersConfigured = true;
        console.log('✅ Event listeners configurados com sucesso');
    }

    processarCSV(csvText) {
        try {
            console.log('🔧 Processando CSV...');

            const lines = csvText.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) {
                throw new Error('Arquivo CSV vazio ou com apenas cabeçalho');
            }

            // Parse do cabeçalho
            const headers = lines[0].split(',').map(header => header.trim());
            console.log('📋 Cabeçalhos:', headers);

            // Validar cabeçalho esperado
            const expectedHeaders = ['Professor', 'Curso', 'Período', 'Turma', 'Disciplina', 'Sala', 'Horário', 'Data da Aula'];
            const hasRequiredHeaders = expectedHeaders.every(header =>
                headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
            );

            if (!hasRequiredHeaders) {
                throw new Error(`Cabeçalhos esperados: ${expectedHeaders.join(', ')}`);
            }

            // Processar linhas
            const csvData = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = this.parseCSVLine(line);

                if (values.length >= expectedHeaders.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] ? values[index].trim() : '';
                    });
                    csvData.push(row);
                }
            }

            console.log('📊 Dados extraídos:', csvData);
            this.enviarParaBackend(csvData);

        } catch (error) {
            console.error('❌ Erro ao processar CSV:', error);
            this.mostrarErro('Erro ao processar CSV: ' + error.message);
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result.map(field => field.replace(/^"|"$/g, '').trim());
    }

    async enviarParaBackend(csvData) {
        try {
            console.log('📤 Enviando dados para backend...');
            this.mostrarLoading('Validando dados com o servidor...');

            const response = await adminAPI.importarCSV(csvData);

            if (response.success) {
                console.log('✅ CSV processado com sucesso:', response.data);
                this.aulasProcessadas = response.data.aulasValidas;
                this.errosProcessamento = response.data.erros;
                this.exibirPreview();
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('❌ Erro ao enviar para backend:', error);
            this.mostrarErro('Erro ao processar CSV: ' + error.message);
        }
    }

    exibirPreview() {
        console.log('🎨 Exibindo preview...');

        let main = document.querySelector('main');
        if (!main) {
            console.error('❌ Elemento main não encontrado');
            return;
        }

        // Limpar conteúdo anterior
        main.innerHTML = '';

        // Criar container principal
        const container = document.createElement('div');
        container.className = 'csv-import-container';

        // Título
        const titulo = document.createElement('h2');
        titulo.innerHTML = '<i class="fas fa-file-import"></i> Importação de CSV - Preview';
        container.appendChild(titulo);

        // Estatísticas - usando classes específicas do CSV
        const stats = document.createElement('div');
        stats.className = 'csv-stats-grid';
        stats.innerHTML = `
        <div class="csv-stat-card">
            <div class="csv-stat-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3>Aulas Válidas</h3>
            <div class="csv-stat-number">${this.aulasProcessadas.length}</div>
        </div>
        <div class="csv-stat-card">
            <div class="csv-stat-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Erros Encontrados</h3>
            <div class="csv-stat-number">${this.errosProcessamento.length}</div>
        </div>
    `;
        container.appendChild(stats);
        // Seção de erros
        if (this.errosProcessamento.length > 0) {
            const errosSection = document.createElement('div');
            errosSection.className = 'erros-section';

            const errosTitulo = document.createElement('h3');
            errosTitulo.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erros Encontrados';
            errosSection.appendChild(errosTitulo);

            const errosList = document.createElement('div');
            errosList.className = 'erros-list';

            this.errosProcessamento.forEach(erro => {
                const erroItem = document.createElement('div');
                erroItem.className = 'erro-item';
                erroItem.innerHTML = `
                    <div class="erro-header">
                        <strong>Linha ${erro.linha}:</strong> ${erro.erro}
                    </div>
                    <div class="erro-dados">
                        ${JSON.stringify(erro.dados, null, 2)}
                    </div>
                `;
                errosList.appendChild(erroItem);
            });

            errosSection.appendChild(errosList);
            container.appendChild(errosSection);
        }

        // Seção de preview das aulas válidas
        if (this.aulasProcessadas.length > 0) {
            const previewSection = document.createElement('div');
            previewSection.className = 'preview-section';

            const previewTitulo = document.createElement('h3');
            previewTitulo.innerHTML = '<i class="fas fa-eye"></i> Preview das Aulas';
            previewTitulo.innerHTML += ` <span class="subtitle">(${this.aulasProcessadas.length} aulas para criar)</span>`;
            previewSection.appendChild(previewTitulo);

            const aulasGrid = document.createElement('div');
            aulasGrid.className = 'aulas-preview-grid';

            this.aulasProcessadas.forEach(aula => {
                const aulaCard = this.criarCardAula(aula);
                aulasGrid.appendChild(aulaCard);
            });

            previewSection.appendChild(aulasGrid);

            // Ações
            const actions = document.createElement('div');
            actions.className = 'preview-actions';
            actions.innerHTML = `
                <button class="btn-secondary" onclick="adminCSV.cancelarImportacao()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="btn-primary" onclick="adminCSV.confirmarImportacao()">
                    <i class="fas fa-check"></i> Confirmar Importação (${this.aulasProcessadas.length} aulas)
                </button>
            `;

            previewSection.appendChild(actions);
            container.appendChild(previewSection);
        } else {
            const nenhumaAula = document.createElement('div');
            nenhumaAula.className = 'empty-state';
            nenhumaAula.innerHTML = `
                <i class="fas fa-exclamation-circle fa-3x"></i>
                <h3>Nenhuma aula válida encontrada</h3>
                <p>Verifique os erros acima e tente novamente.</p>
                <button class="btn-primary" onclick="adminCSV.reiniciarImportacao()">
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
            `;
            container.appendChild(nenhumaAula);
        }

        main.appendChild(container);
    }

    criarCardAula(aula) {
        const card = document.createElement('div');
        card.className = 'aula-preview-card';
        card.dataset.linha = aula.linha;

        card.innerHTML = `
        <div class="card-header">
            <h4 class="editable-field" data-field="disciplina" data-original="${aula.dados.disciplina}">${aula.dados.disciplina}</h4>
            <span class="status-badge valida">Válida</span>
        </div>
        <div class="card-content">
            <div class="info-row">
                <label>Professor:</label>
                <span class="editable-field" data-field="professor_nome" data-original="${aula.dados.professor_nome}">${aula.dados.professor_nome}</span>
            </div>
            <div class="info-row">
                <label>Data:</label>
                <span class="editable-field" data-field="data_aula" data-original="${aula.dados.data_aula}" data-display="${this.formatarDataDisplay(aula.dados.data_aula)}">
                    ${this.formatarDataDisplay(aula.dados.data_aula)}
                </span>
            </div>
            <div class="info-row">
                <label>Horário:</label>
                <span class="editable-field" data-field="horario" data-original="${aula.dados.horario_inicio}-${aula.dados.horario_fim}">
                    ${aula.dados.horario_inicio} - ${aula.dados.horario_fim}
                </span>
            </div>
            <div class="info-row">
                <label>Sala:</label>
                <span class="editable-field" data-field="sala_numero" data-original="${aula.dados.sala_numero}">
                    ${aula.dados.sala_numero} (Bloco ${aula.dados.sala_bloco})
                </span>
            </div>
            <div class="info-row">
                <label>Curso:</label>
                <span class="editable-field" data-field="curso" data-original="${aula.dados.curso}">${aula.dados.curso}</span>
            </div>
            <div class="info-row">
                <label>Turma:</label>
                <span class="editable-field" data-field="turma" data-original="${aula.dados.turma}">${aula.dados.turma}</span>
            </div>
            <div class="info-row">
                <label>Período:</label>
                <span class="editable-field" data-field="periodo" data-original="${aula.dados.periodo_original}">${aula.dados.periodo_original}</span>
            </div>
            <div class="info-row">
                <label>Dia da Semana:</label>
                <span class="dia-semana-field">${aula.dados.dia_semana_nome}</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="btn-edit" onclick="adminCSV.habilitarEdicao(${aula.linha})">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn-save" onclick="adminCSV.salvarEdicao(${aula.linha})" style="display: none;">
                <i class="fas fa-check"></i> Salvar
            </button>
            <button class="btn-cancel" onclick="adminCSV.cancelarEdicao(${aula.linha})" style="display: none;">
                <i class="fas fa-times"></i> Cancelar
            </button>
        </div>
    `;

        return card;
    }

    editarAula(linha) {
        console.log('✏️ Editando aula da linha:', linha);
        // Implementar edição inline
        const aula = this.aulasProcessadas.find(a => a.linha === linha);
        if (aula) {
            this.mostrarModalEdicao(aula);
        }
    }

    // 🔧 MÉTODOS DE EDIÇÃO

    habilitarEdicao(linha) {
        const card = document.querySelector(`.aula-preview-card[data-linha="${linha}"]`);
        if (!card) return;

        // Configurar validação em tempo real
        this.configurarValidacaoTempoReal();

        // Salvar estado original
        const camposEditaveis = card.querySelectorAll('.editable-field');
        camposEditaveis.forEach(campo => {
            const field = campo.getAttribute('data-field');

            // Para o campo de data, mostrar o valor original (YYYY-MM-DD) em vez do valor formatado
            if (field === 'data_aula') {
                campo.textContent = campo.getAttribute('data-original');
            }

            campo.setAttribute('data-original', campo.textContent);
            campo.contentEditable = true;
            campo.classList.add('editing');

            // Adicionar placeholder para campos específicos
            if (field === 'data_aula') {
                campo.setAttribute('data-placeholder', 'YYYY-MM-DD');
            } else if (field === 'horario') {
                campo.setAttribute('data-placeholder', 'HH:MM-HH:MM');
            }
        });

        // Mostrar/ocultar botões
        card.querySelector('.btn-edit').style.display = 'none';
        card.querySelector('.btn-save').style.display = 'inline-block';
        card.querySelector('.btn-cancel').style.display = 'inline-block';

        // Adicionar estilos de edição
        card.classList.add('card-editing');

        console.log(`✏️ Editando aula da linha ${linha}`);
    }

    salvarEdicao(linha) {
        const card = document.querySelector(`.aula-preview-card[data-linha="${linha}"]`);
        if (!card) return;

        const aulaIndex = this.aulasProcessadas.findIndex(a => a.linha === linha);
        if (aulaIndex === -1) return;

        const aula = this.aulasProcessadas[aulaIndex];
        const camposEditaveis = card.querySelectorAll('.editable-field');

        let hasErrors = false;

        camposEditaveis.forEach(campo => {
            const field = campo.getAttribute('data-field');
            const newValue = campo.textContent.trim();

            console.log(`🔍 Processando campo ${field}: "${newValue}"`);

            // Validações específicas por campo
            switch (field) {
                case 'data_aula':
                    // Primeiro tente a validação simplificada para debug
                    if (!this.validarDataSimplificada(newValue)) {
                        console.log('❌ Validação simplificada falhou');
                        // Se a simplificada falhar, tente a completa
                        if (!this.validarData(newValue)) {
                            this.mostrarErroCampo(campo, 'Data inválida. Use formato YYYY-MM-DD (ex: 2025-11-10)');
                            hasErrors = true;
                            return;
                        }
                    }
                    aula.dados.data_aula = newValue;
                    // Recalcular dia da semana
                    aula.dados.dia_semana = this.calcularDiaSemana(newValue);
                    aula.dados.dia_semana_nome = this.getNomeDiaSemana(aula.dados.dia_semana);
                    // Atualizar o valor de display
                    campo.setAttribute('data-display', this.formatarDataDisplay(newValue));
                    break;

                case 'horario':
                    const horarioValido = this.validarHorario(newValue);
                    if (!horarioValido) {
                        this.mostrarErroCampo(campo, 'Horário inválido. Use formato HH:MM-HH:MM (ex: 18:50-19:40)');
                        hasErrors = true;
                        return;
                    }
                    aula.dados.horario_inicio = horarioValido.inicio;
                    aula.dados.horario_fim = horarioValido.fim;
                    // Atualizar o valor original do horário
                    campo.setAttribute('data-original', `${horarioValido.inicio}-${horarioValido.fim}`);
                    break;

                case 'disciplina':
                    if (!newValue) {
                        this.mostrarErroCampo(campo, 'Disciplina não pode estar vazia');
                        hasErrors = true;
                        return;
                    }
                    aula.dados.disciplina = newValue;
                    break;

                case 'professor_nome':
                    if (!newValue) {
                        this.mostrarErroCampo(campo, 'Professor não pode estar vazio');
                        hasErrors = true;
                        return;
                    }
                    aula.dados.professor_nome = newValue;
                    break;

                case 'sala_numero':
                    // Extrair apenas o número da sala (ex: "D206" de "D206 (Bloco D)")
                    const salaMatch = newValue.match(/([A-Z]\d+)/);
                    if (salaMatch) {
                        aula.dados.sala_numero = salaMatch[1];
                    } else {
                        aula.dados.sala_numero = newValue;
                    }
                    break;

                default:
                    aula.dados[field] = newValue;
            }

            campo.contentEditable = false;
            campo.classList.remove('editing');
            campo.classList.remove('error');

            // Remover tooltips de erro se existirem
            const tooltipExistente = campo.parentNode.querySelector('.field-error-tooltip');
            if (tooltipExistente) {
                tooltipExistente.remove();
            }
        });

        if (hasErrors) {
            console.log('❌ Erros de validação encontrados, cancelando salvamento');
            return; // Não salvar se houver erros
        }

        // Atualizar display dos campos formatados
        this.atualizarDisplayAula(card, aula);

        // Mostrar/ocultar botões
        card.querySelector('.btn-edit').style.display = 'inline-block';
        card.querySelector('.btn-save').style.display = 'none';
        card.querySelector('.btn-cancel').style.display = 'none';

        // Remover estilos de edição
        card.classList.remove('card-editing');

        // Atualizar no array
        this.aulasProcessadas[aulaIndex] = aula;

        this.mostrarNotificacao('Alterações salvas com sucesso!', 'success');
        console.log(`✅ Alterações salvas para linha ${linha}`);
    }

    // 🔧 VALIDAÇÃO EM TEMPO REAL DURANTE A EDIÇÃO
    configurarValidacaoTempoReal() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('editable-field') && e.target.classList.contains('editing')) {
                const field = e.target.getAttribute('data-field');
                const value = e.target.textContent.trim();

                if (field === 'data_aula') {
                    this.validarEmTempoReal(e.target, value, 'data');
                } else if (field === 'horario') {
                    this.validarEmTempoReal(e.target, value, 'horario');
                }
            }
        });
    }

    validarEmTempoReal(campo, valor, tipo) {
        // Remover estilos anteriores
        campo.classList.remove('valid');
        campo.classList.remove('error');

        let isValid = false;

        if (tipo === 'data') {
            isValid = this.validarDataSimplificada(valor);
        } else if (tipo === 'horario') {
            isValid = this.validarHorario(valor);
        }

        if (valor && isValid) {
            campo.classList.add('valid');
        } else if (valor && !isValid) {
            campo.classList.add('error');
        }
    }

    cancelarEdicao(linha) {
        const card = document.querySelector(`.aula-preview-card[data-linha="${linha}"]`);
        if (!card) return;

        const aulaIndex = this.aulasProcessadas.findIndex(a => a.linha === linha);
        if (aulaIndex === -1) return;

        const aula = this.aulasProcessadas[aulaIndex];
        const camposEditaveis = card.querySelectorAll('.editable-field');

        camposEditaveis.forEach(campo => {
            const field = campo.getAttribute('data-field');
            const originalValue = campo.getAttribute('data-original');

            // Para o campo de data, restaurar o valor de display em vez do valor original
            if (field === 'data_aula') {
                const displayValue = campo.getAttribute('data-display') || this.formatarDataDisplay(originalValue);
                campo.textContent = displayValue;
            } else {
                campo.textContent = originalValue;
            }

            campo.contentEditable = false;
            campo.classList.remove('editing');
            campo.classList.remove('error');

            // Remover tooltips de erro se existirem
            const tooltipExistente = campo.parentNode.querySelector('.field-error-tooltip');
            if (tooltipExistente) {
                tooltipExistente.remove();
            }
        });

        // Mostrar/ocultar botões
        card.querySelector('.btn-edit').style.display = 'inline-block';
        card.querySelector('.btn-save').style.display = 'none';
        card.querySelector('.btn-cancel').style.display = 'none';

        // Remover estilos de edição
        card.classList.remove('card-editing');

        console.log(`❌ Edição cancelada para linha ${linha}`);
    }

    atualizarDisplayAula(card, aula) {
        // Atualizar campos formatados
        const disciplinaField = card.querySelector('[data-field="disciplina"]');
        const dataField = card.querySelector('[data-field="data_aula"]');
        const horarioField = card.querySelector('[data-field="horario"]');
        const salaField = card.querySelector('[data-field="sala_numero"]');
        const cursoField = card.querySelector('[data-field="curso"]');
        const turmaField = card.querySelector('[data-field="turma"]');
        const periodoField = card.querySelector('[data-field="periodo"]');
        const diaSemanaField = card.querySelector('.dia-semana-field');

        if (disciplinaField) {
            disciplinaField.textContent = aula.dados.disciplina;
            disciplinaField.setAttribute('data-original', aula.dados.disciplina);
        }

        if (dataField) {
            const displayValue = this.formatarDataDisplay(aula.dados.data_aula);
            dataField.textContent = displayValue;
            dataField.setAttribute('data-original', aula.dados.data_aula);
            dataField.setAttribute('data-display', displayValue);
        }

        if (horarioField) {
            horarioField.textContent = `${aula.dados.horario_inicio} - ${aula.dados.horario_fim}`;
            horarioField.setAttribute('data-original', `${aula.dados.horario_inicio}-${aula.dados.horario_fim}`);
        }

        if (salaField) {
            salaField.textContent = `${aula.dados.sala_numero} (Bloco ${aula.dados.sala_bloco})`;
            salaField.setAttribute('data-original', aula.dados.sala_numero);
        }

        if (cursoField) {
            cursoField.textContent = aula.dados.curso;
            cursoField.setAttribute('data-original', aula.dados.curso);
        }

        if (turmaField) {
            turmaField.textContent = aula.dados.turma;
            turmaField.setAttribute('data-original', aula.dados.turma);
        }

        if (periodoField) {
            periodoField.textContent = aula.dados.periodo_original;
            periodoField.setAttribute('data-original', aula.dados.periodo_original);
        }

        if (diaSemanaField) {
            diaSemanaField.textContent = aula.dados.dia_semana_nome;
        }
    }

    // 🔧 MÉTODOS DE VALIDAÇÃO

    validarData(dataString) {
        console.log(`🔍 Validando data: "${dataString}"`);

        // Remover espaços em branco
        const dataLimpa = dataString.trim();

        // Verificar formato básico YYYY-MM-DD
        const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
        if (!regex.test(dataLimpa)) {
            console.log('❌ Formato de data inválido - não corresponde ao padrão YYYY-MM-DD');
            return false;
        }

        const [ano, mes, dia] = dataLimpa.split('-').map(Number);

        // Verificar intervalos básicos
        if (ano < 2000 || ano > 2100) {
            console.log(`❌ Ano fora do intervalo válido: ${ano}`);
            return false;
        }
        if (mes < 1 || mes > 12) {
            console.log(`❌ Mês fora do intervalo válido: ${mes}`);
            return false;
        }
        if (dia < 1 || dia > 31) {
            console.log(`❌ Dia fora do intervalo válido: ${dia}`);
            return false;
        }

        // Verificar meses com 30 dias
        const meses30Dias = [4, 6, 9, 11];
        if (meses30Dias.includes(mes) && dia > 30) {
            console.log(`❌ Mês ${mes} tem apenas 30 dias`);
            return false;
        }

        // Verificar fevereiro e anos bissextos
        if (mes === 2) {
            const isBissexto = (ano % 4 === 0 && ano % 100 !== 0) || (ano % 400 === 0);
            const maxDiasFevereiro = isBissexto ? 29 : 28;
            if (dia > maxDiasFevereiro) {
                console.log(`❌ Fevereiro de ${ano} tem apenas ${maxDiasFevereiro} dias`);
                return false;
            }
        }

        // Verificação final com Date object (mais permissiva)
        const date = new Date(ano, mes - 1, dia);
        const isValid = date.getFullYear() === ano &&
            date.getMonth() === mes - 1 &&
            date.getDate() === dia;

        console.log(`✅ Data válida: ${dataLimpa} -> ${isValid ? 'VÁLIDA' : 'INVÁLIDA'}`);
        return isValid;
    }

    validarDataSimplificada(dataString) {
        console.log(`🔍 [DEBUG] Validando data: "${dataString}"`);

        // Verificação básica de formato
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        const isValid = regex.test(dataString.trim());

        console.log(`🔍 [DEBUG] Resultado: ${isValid ? 'VÁLIDA' : 'INVÁLIDA'}`);
        return isValid;
    }

    validarHorario(horarioString) {
        const parts = horarioString.split('-');
        if (parts.length !== 2) return false;

        const [inicio, fim] = parts.map(p => p.trim());
        const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

        if (!horaRegex.test(inicio) || !horaRegex.test(fim)) {
            return false;
        }

        // Verificar se horário de início é antes do fim
        const inicioMinutos = this.horaParaMinutos(inicio);
        const fimMinutos = this.horaParaMinutos(fim);

        if (inicioMinutos >= fimMinutos) {
            return false;
        }

        return { inicio, fim };
    }

    horaParaMinutos(horaString) {
        const [horas, minutos] = horaString.split(':').map(Number);
        return horas * 60 + minutos;
    }

    mostrarErroCampo(campo, mensagem) {
        campo.classList.add('error');

        // Remover tooltip anterior se existir
        const tooltipExistente = campo.parentNode.querySelector('.field-error-tooltip');
        if (tooltipExistente) {
            tooltipExistente.remove();
        }

        // Adicionar tooltip de erro
        const tooltip = document.createElement('div');
        tooltip.className = 'field-error-tooltip';

        // Para campo de data, mostrar exemplo do formato esperado
        if (mensagem.includes('Data inválida')) {
            tooltip.innerHTML = `${mensagem}<br><small>Exemplo: 2025-11-10</small>`;
        } else if (mensagem.includes('Horário inválido')) {
            tooltip.innerHTML = `${mensagem}<br><small>Exemplo: 18:50-19:40</small>`;
        } else {
            tooltip.textContent = mensagem;
        }

        campo.parentNode.appendChild(tooltip);

        // Focar no campo com erro
        campo.focus();

        // Rolagem suave para o campo com erro
        campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // 🔧 FUNÇÕES AUXILIARES (adicionar ao final da classe)

    calcularDiaSemana(dataString) {
        const [ano, mes, dia] = dataString.split('-').map(Number);
        const data = new Date(Date.UTC(ano, mes - 1, dia));
        const diaSemana = data.getUTCDay();
        return diaSemana === 0 ? 7 : diaSemana;
    }

    getNomeDiaSemana(diaNumero) {
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
    }

    formatarDataDisplay(dataString) {
        if (!dataString) return 'Data não definida';

        try {
            const [ano, mes, dia] = dataString.split('-').map(Number);
            const data = new Date(ano, mes - 1, dia);

            return data.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error('❌ Erro ao formatar data:', error);
            return dataString;
        }
    }

    mostrarNotificacao(mensagem, tipo = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <i class="fas fa-${tipo === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            </div>
            <div class="notification-message">${mensagem}</div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

        document.body.appendChild(notification);

        // Animação de entrada
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto-remover após 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }

    exibirPreview() {
        console.log('🎨 Exibindo preview...');

        let main = document.querySelector('main');
        if (!main) {
            console.error('❌ Elemento main não encontrado');
            return;
        }

        // Limpar conteúdo anterior
        main.innerHTML = '';

        // Criar container principal
        const container = document.createElement('div');
        container.className = 'csv-import-container';

        // Título
        const titulo = document.createElement('h2');
        titulo.innerHTML = '<i class="fas fa-file-import"></i> Importação de CSV - Preview';
        container.appendChild(titulo);

        // Estatísticas
        const stats = document.createElement('div');
        stats.className = 'import-stats';
        stats.innerHTML = `
        <div class="stat validas">
            <span class="stat-number">${this.aulasProcessadas.length}</span>
            <span class="stat-label">Aulas Válidas</span>
        </div>
        <div class="stat erros">
            <span class="stat-number">${this.errosProcessamento.length}</span>
            <span class="stat-label">Erros</span>
        </div>
    `;
        container.appendChild(stats);

        // Ações globais
        const globalActions = document.createElement('div');
        globalActions.className = 'global-actions';
        globalActions.innerHTML = `
        <button class="btn-secondary" onclick="adminCSV.habilitarTodasEdicoes()">
            <i class="fas fa-edit"></i> Editar Todas
        </button>
        <button class="btn-secondary" onclick="adminCSV.cancelarTodasEdicoes()">
            <i class="fas fa-times"></i> Cancelar Todas as Edições
        </button>
    `;
        container.appendChild(globalActions);

        // Seção de erros
        if (this.errosProcessamento.length > 0) {
            const errosSection = document.createElement('div');
            errosSection.className = 'erros-section';

            const errosTitulo = document.createElement('h3');
            errosTitulo.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erros Encontrados';
            errosSection.appendChild(errosTitulo);

            const errosList = document.createElement('div');
            errosList.className = 'erros-list';

            this.errosProcessamento.forEach(erro => {
                const erroItem = document.createElement('div');
                erroItem.className = 'erro-item';
                erroItem.innerHTML = `
                <div class="erro-header">
                    <strong>Linha ${erro.linha}:</strong> ${erro.erro}
                </div>
                <div class="erro-dados">
                    ${JSON.stringify(erro.dados, null, 2)}
                </div>
            `;
                errosList.appendChild(erroItem);
            });

            errosSection.appendChild(errosList);
            container.appendChild(errosSection);
        }

        // Seção de preview das aulas válidas
        if (this.aulasProcessadas.length > 0) {
            const previewSection = document.createElement('div');
            previewSection.className = 'preview-section';

            const previewTitulo = document.createElement('h3');
            previewTitulo.innerHTML = '<i class="fas fa-eye"></i> Preview das Aulas';
            previewTitulo.innerHTML += ` <span class="subtitle">(${this.aulasProcessadas.length} aulas para criar)</span>`;
            previewSection.appendChild(previewTitulo);

            const aulasGrid = document.createElement('div');
            aulasGrid.className = 'aulas-preview-grid';

            this.aulasProcessadas.forEach(aula => {
                const aulaCard = this.criarCardAula(aula);
                aulasGrid.appendChild(aulaCard);
            });

            previewSection.appendChild(aulasGrid);

            // Ações
            const actions = document.createElement('div');
            actions.className = 'preview-actions';
            actions.innerHTML = `
            <button class="btn-secondary" onclick="adminCSV.cancelarImportacao()">
                <i class="fas fa-times"></i> Cancelar
            </button>
            <button class="btn-primary" onclick="adminCSV.confirmarImportacao()">
                <i class="fas fa-check"></i> Confirmar Importação (${this.aulasProcessadas.length} aulas)
            </button>
        `;

            previewSection.appendChild(actions);
            container.appendChild(previewSection);
        } else {
            const nenhumaAula = document.createElement('div');
            nenhumaAula.className = 'empty-state';
            nenhumaAula.innerHTML = `
            <i class="fas fa-exclamation-circle fa-3x"></i>
            <h3>Nenhuma aula válida encontrada</h3>
            <p>Verifique os erros acima e tente novamente.</p>
            <button class="btn-primary" onclick="adminCSV.reiniciarImportacao()">
                <i class="fas fa-redo"></i> Tentar Novamente
            </button>
        `;
            container.appendChild(nenhumaAula);
        }

        main.appendChild(container);
    }

    // 🔧 MÉTODOS DE EDIÇÃO EM MASSA

    habilitarTodasEdicoes() {
        this.aulasProcessadas.forEach(aula => {
            this.habilitarEdicao(aula.linha);
        });
        this.mostrarNotificacao('Todas as aulas estão em modo de edição', 'info');
    }

    cancelarTodasEdicoes() {
        this.aulasProcessadas.forEach(aula => {
            this.cancelarEdicao(aula.linha);
        });
        this.mostrarNotificacao('Todas as edições foram canceladas', 'info');
    }

    mostrarModalEdicao(aula) {
        // Implementar modal de edição
        console.log('📝 Modal de edição para:', aula);
        // Para versão inicial, vamos apenas alert
        alert(`Edição da linha ${aula.linha} - Em desenvolvimento`);
    }

    async confirmarImportacao() {
        if (this.aulasProcessadas.length === 0) {
            this.mostrarNotificacao('Nenhuma aula para importar.', 'error');
            return;
        }

        const confirmacao = confirm(`Deseja criar ${this.aulasProcessadas.length} aulas?`);
        if (!confirmacao) return;

        this.mostrarLoading('Criando aulas...');

        try {
            const aulasParaCriar = this.aulasProcessadas.map(a => a.dados);

            const response = await adminAPI.criarAulasLote(aulasParaCriar);

            if (response.success) {
                // Salvar as estatísticas para usar no modal de sucesso
                this.importacaoSucesso = {
                    sucessos: response.data.sucessos.length,
                    erros: response.data.erros.length
                };

                // Mostrar modal de sucesso
                let mensagemSucesso;
                if (response.data.erros.length > 0) {
                    mensagemSucesso = `
                    <strong>${response.data.sucessos.length}</strong> aulas criadas com sucesso.<br>
                    <strong>${response.data.erros.length}</strong> aulas não puderam ser criadas.
                `;
                } else {
                    mensagemSucesso = `
                    Todas as <strong>${response.data.sucessos.length}</strong> aulas 
                    foram importadas com sucesso!
                `;
                }

                this.mostrarSucesso(mensagemSucesso);

            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('❌ Erro ao criar aulas:', error);
            this.mostrarNotificacao('Erro ao criar aulas: ' + error.message, 'error');
        } finally {
            this.esconderLoading();
        }
    }

    cancelarImportacao() {
        if (confirm('Deseja cancelar a importação? Todos os dados serão perdidos.')) {
            window.location.reload();
        }
    }

    reiniciarImportacao() {
        window.location.reload();
    }

    mostrarLoading(mensagem = 'Carregando...') {
        // Implementar loading
        console.log('⏳', mensagem);
    }

    mostrarErro(mensagem) {
        alert('❌ ' + mensagem);
    }

    mostrarSucesso(mensagem) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay success-modal-overlay';
        modal.innerHTML = `
        <div class="success-modal">
            <div class="success-modal-content">
                <div class="success-animation">
                    <div class="success-checkmark">
                        <div class="check-icon">
                            <span class="icon-line line-tip"></span>
                            <span class="icon-line line-long"></span>
                            <div class="icon-circle"></div>
                            <div class="icon-fix"></div>
                        </div>
                    </div>
                </div>
                
                <div class="success-header">
                    <h2><i class="fas fa-check-circle"></i> Importação Concluída!</h2>
                </div>
                
                <div class="success-body">
                    <div class="success-message">
                        ${mensagem}
                    </div>
                    
                    <div class="success-stats">
                        <div class="csv-stat-item">
                            <div class="csv-success-stat-icon success">
                                <i class="fas fa-check"></i>
                            </div>
                            <div class="csv-stat-info">
                                <div class="csv-stat-number">${this.importacaoSucesso.sucessos}</div>
                                <div class="csv-stat-label">Aulas Criadas</div>
                            </div>
                        </div>
                        <div class="csv-stat-item">
                            <div class="csv-success-stat-icon warning">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="csv-stat-info">
                                <div class="csv-stat-number">${this.importacaoSucesso.erros}</div>
                                <div class="csv-stat-label">Erros</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="success-actions">
                    <button class="btn-success" onclick="adminCSV.fecharModalSucesso()">
                        <i class="fas fa-check"></i> Continuar
                    </button>
                </div>
                
                <div class="success-footer">
                    <p>Redirecionando automaticamente em <span id="countdown">5</span> segundos...</p>
                </div>
            </div>
        </div>
    `;

        document.body.appendChild(modal);
        this.iniciarCountdown();
    }

    fecharModalSucesso() {
        const modal = document.querySelector('.success-modal-overlay');
        if (modal) {
            // Adicionar animação de saída
            modal.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
        // Redirecionar para o dashboard
        window.location.href = 'admin.html';
    }

    iniciarCountdown() {
        let countdown = 5;
        const countdownElement = document.getElementById('countdown');

        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdownElement) {
                countdownElement.textContent = countdown;
            }

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.fecharModalSucesso();
            }
        }, 1000);
    }
}

// Inicializar
const adminCSV = new AdminCSV();