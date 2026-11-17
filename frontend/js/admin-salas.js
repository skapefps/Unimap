// js/admin-salas.js - ATUALIZADO COM PAGINAÇÃO, FILTROS E BUSCA
class AdminSalas {
    constructor() {
        this.salas = [];
 // Resolve pela origem atual. Estava fixo em localhost, o que
 // deixava esta tela inteira sem backend em producao.
        this.API_BASE = Config.getBaseURL() + '/admin';
        
 // Configurações de paginação
        this.pagination = {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            itemsPerPage: 10,
            hasNext: false,
            hasPrev: false
        };
        
 // Filtros atuais
        this.filters = {
            bloco: 'todos',
            andar: 'todos',
            tipo: 'todos',
            ativo: 'todos',
            campus: 'todos',
            busca: '' // ⭐ NOVO: filtro de busca
        };

 // Opções de filtros disponíveis
        this.filterOptions = {
            blocos: [],
            andares: [],
            tipos: [],
            campi: []
        };

 // ⭐ NOVO: Timer para busca em tempo real
        this.buscaTimeout = null;
    }

    init() {
        console.log(' Inicializando Admin Salas...');
        if (!this.verificarAutenticacao()) return;
        
        this.setupEventListeners();
        this.carregarSalasComPaginacao();
    }

    verificarAutenticacao() {
        this.token = localStorage.getItem('authToken') || localStorage.getItem('unimap_token');
        if (!this.token) {
            console.error(' Token não encontrado!');
            this.showNotification('Usuário não autenticado. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }
        console.log(' Token encontrado');
        return true;
    }

    setupEventListeners() {
        const form = document.getElementById('salaForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarSala();
            });
        }

 // Event listeners para filtros
        const filterIds = ['filter-bloco', 'filter-andar', 'filter-tipo', 'filter-ativo', 'filter-campus'];
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.aplicarFiltros());
            }
        });

 // Event listener para tamanho da página
        const pageSize = document.getElementById('page-size');
        if (pageSize) {
            pageSize.addEventListener('change', (e) => this.alterarTamanhoPagina(e.target.value));
        }

 // ⭐ NOVO: Event listener para busca em tempo real
        const buscaInput = document.getElementById('filter-busca');
        if (buscaInput) {
            buscaInput.addEventListener('input', (e) => {
                this.aplicarBuscaEmTempoReal(e.target.value);
            });
            
 // Permitir busca com Enter
            buscaInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.aplicarBusca();
                }
            });
        }
    }

 // ⭐⭐ NOVO: Métodos para busca
    aplicarBuscaEmTempoReal(termo) {
 // Limpar timeout anterior
        clearTimeout(this.buscaTimeout);
        
 // Configurar novo timeout (debounce de 500ms)
        this.buscaTimeout = setTimeout(() => {
            this.filters.busca = termo.trim();
            this.pagination.currentPage = 1;
            this.carregarSalasComPaginacao();
        }, 500);
    }

    aplicarBusca() {
        const termo = document.getElementById('filter-busca').value.trim();
        this.filters.busca = termo;
        this.pagination.currentPage = 1;
        this.carregarSalasComPaginacao();
    }

    limparBusca() {
        document.getElementById('filter-busca').value = '';
        this.filters.busca = '';
        this.pagination.currentPage = 1;
        this.carregarSalasComPaginacao();
    }

 // ⭐ ATUALIZADO: Método para limpar todos os filtros
    limparFiltros() {
        this.filters = {
            bloco: 'todos',
            andar: 'todos',
            tipo: 'todos',
            ativo: 'todos',
            campus: 'todos',
            busca: '' // ⭐ NOVO: também limpa a busca
        };

 // Resetar valores dos selects
        document.getElementById('filter-bloco').value = 'todos';
        document.getElementById('filter-andar').value = 'todos';
        document.getElementById('filter-tipo').value = 'todos';
        document.getElementById('filter-ativo').value = 'todos';
        document.getElementById('filter-campus').value = 'todos';
        document.getElementById('filter-busca').value = ''; // ⭐ NOVO: limpa o campo de busca

        this.pagination.currentPage = 1;
        this.carregarSalasComPaginacao();
    }

 // ⭐ ATUALIZADO: Método para aplicar filtros (mantém a busca)
    aplicarFiltros() {
        this.filters = {
            bloco: document.getElementById('filter-bloco').value,
            andar: document.getElementById('filter-andar').value,
            tipo: document.getElementById('filter-tipo').value,
            ativo: document.getElementById('filter-ativo').value,
            campus: document.getElementById('filter-campus').value,
            busca: this.filters.busca // ⭐ NOVO: mantém o termo de busca atual
        };

 // Reset para primeira página quando aplicar filtros
        this.pagination.currentPage = 1;
        this.carregarSalasComPaginacao();
    }

 // Método principal para carregar salas com paginação
    async carregarSalasComPaginacao() {
        if (!this.verificarAutenticacao()) return;

        try {
            this.showLoading(true);
            console.log(' Carregando salas com paginação e busca...');

 // Construir parâmetros da URL
            const params = new URLSearchParams({
                page: this.pagination.currentPage,
                limit: this.pagination.itemsPerPage,
                ...this.filters
            });

 // Remover parâmetros com valor 'todos' ou vazio
            params.forEach((value, key) => {
                if (value === 'todos' || value === '') {
                    params.delete(key);
                }
            });

            const response = await fetch(`${this.API_BASE}/salas/todos?${params}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(' Response status:', response.status);
            console.log(' URL chamada:', `${this.API_BASE}/salas/todos?${params}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(' Erro na resposta:', errorText);
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(' Dados recebidos:', data);
            
            if (!data.success) {
                throw new Error(data.error || 'Erro ao carregar salas');
            }

            this.salas = data.data.salas || [];
            this.pagination = data.data.pagination || this.pagination;
            this.filterOptions = data.data.filters || this.filterOptions;

 // ⭐ NOVO: Mostrar info de busca se estiver ativa
            if (this.filters.busca) {
                console.log(` Busca por "${this.filters.busca}": ${this.salas.length} resultados`);
            }

            console.log(` ${this.salas.length} salas carregadas (página ${this.pagination.currentPage} de ${this.pagination.totalPages})`);

            this.renderizarSalas();
            this.atualizarFiltros();
            this.atualizarControlesPaginacao();
            this.atualizarEstatisticas();
            return true;

        } catch (error) {
            console.error(' Erro ao carregar salas:', error);
            this.showNotification('Erro ao carregar lista de salas: ' + error.message, 'error');
            return false;
        } finally {
            this.showLoading(false);
        }
    }

 // Atualizar opções dos filtros
    atualizarFiltros() {
        this.preencherSelect('filter-bloco', this.filterOptions.blocos, this.filters.bloco);
        this.preencherSelect('filter-andar', this.filterOptions.andares, this.filters.andar);
        this.preencherSelect('filter-tipo', this.filterOptions.tipos, this.filters.tipo);
        this.preencherSelect('filter-campus', this.filterOptions.campi, this.filters.campus);
    }

    preencherSelect(selectId, options, selectedValue) {
        const select = document.getElementById(selectId);
        if (!select) return;

 // Manter o valor atual selecionado
        const currentValue = selectedValue;

        select.innerHTML = '<option value="todos">Todos</option>';
        
        if (options && options.length > 0) {
            options.forEach(option => {
                if (option) { // Não adicionar valores nulos ou vazios
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    optionElement.selected = option === currentValue;
                    select.appendChild(optionElement);
                }
            });
        }
    }

 // Controles de paginação
    alterarTamanhoPagina(novoTamanho) {
        this.pagination.itemsPerPage = parseInt(novoTamanho);
        this.pagination.currentPage = 1; // Voltar para primeira página
        this.carregarSalasComPaginacao();
    }

    proximaPagina() {
        if (this.pagination.hasNext) {
            this.pagination.currentPage++;
            this.carregarSalasComPaginacao();
        }
    }

    paginaAnterior() {
        if (this.pagination.hasPrev) {
            this.pagination.currentPage--;
            this.carregarSalasComPaginacao();
        }
    }

    irParaPagina(pagina) {
        if (pagina >= 1 && pagina <= this.pagination.totalPages) {
            this.pagination.currentPage = pagina;
            this.carregarSalasComPaginacao();
        }
    }

 // Atualizar controles de paginação na UI
    atualizarControlesPaginacao() {
 // Informações da paginação
        const startItem = ((this.pagination.currentPage - 1) * this.pagination.itemsPerPage) + 1;
        const endItem = Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, this.pagination.totalItems);
        
        const paginationInfo = document.getElementById('pagination-info');
        if (paginationInfo) {
            paginationInfo.textContent = 
                `Mostrando ${startItem}-${endItem} de ${this.pagination.totalItems} salas`;
        }

 // Botões anterior/próximo
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        if (prevBtn) prevBtn.disabled = !this.pagination.hasPrev;
        if (nextBtn) nextBtn.disabled = !this.pagination.hasNext;

 // Números das páginas
        this.renderizarNumerosPaginas();
    }

 // Renderizar números das páginas
    renderizarNumerosPaginas() {
        const container = document.getElementById('pagination-numbers');
        if (!container) return;

        container.innerHTML = '';

        const maxPagesToShow = 5;
        let startPage = Math.max(1, this.pagination.currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(this.pagination.totalPages, startPage + maxPagesToShow - 1);

 // Ajustar se não estamos mostrando páginas suficientes no início
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

 // Botão primeira página
        if (startPage > 1) {
            const firstBtn = this.criarBotaoPagina(1, '1');
            container.appendChild(firstBtn);
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '5px 10px';
                ellipsis.style.color = '#6c757d';
                container.appendChild(ellipsis);
            }
        }

 // Páginas numeradas
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = this.criarBotaoPagina(i, i.toString());
            if (i === this.pagination.currentPage) {
                pageBtn.classList.add('active');
                pageBtn.style.backgroundColor = '#3498db';
                pageBtn.style.color = 'white';
                pageBtn.style.borderColor = '#3498db';
            }
            container.appendChild(pageBtn);
        }

 // Botão última página
        if (endPage < this.pagination.totalPages) {
            if (endPage < this.pagination.totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '5px 10px';
                ellipsis.style.color = '#6c757d';
                container.appendChild(ellipsis);
            }
            const lastBtn = this.criarBotaoPagina(this.pagination.totalPages, this.pagination.totalPages.toString());
            container.appendChild(lastBtn);
        }
    }

    criarBotaoPagina(numeroPagina, texto) {
        const button = document.createElement('button');
        button.textContent = texto;
        button.className = 'btn-pagination';
        button.style.padding = '8px 12px';
        button.style.border = '1px solid #dee2e6';
        button.style.background = 'white';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.transition = 'all 0.3s ease';
        button.style.margin = '0 2px';
        
        button.onclick = () => this.irParaPagina(numeroPagina);
        
        button.addEventListener('mouseenter', () => {
            if (!button.classList.contains('active')) {
                button.style.background = '#f8f9fa';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('active')) {
                button.style.background = 'white';
            }
        });
        
        return button;
    }

 // ⭐ ATUALIZADO: Renderizar salas com destaque para busca
    renderizarSalas() {
        const tbody = document.getElementById('salas-body');
        if (!tbody) return;

        if (this.salas.length === 0) {
            let mensagem = 'Nenhuma sala encontrada';
            if (this.filters.busca) {
                mensagem = `Nenhuma sala encontrada para "${this.filters.busca}"`;
            }
            tbody.innerHTML = `<tr><td colspan="8" class="text-center">${mensagem}</td></tr>`;
            return;
        }

        tbody.innerHTML = this.salas.map(sala => {
            const isAtiva = sala.ativa === 1 || sala.ativa === true;
            const localizacao = `${sala.bloco || ''}${sala.andar ? ` - ${sala.andar}` : ''}${sala.campus ? ` | ${sala.campus}` : ''}`.trim();

 // ⭐ NOVO: Destacar termo de busca se estiver ativo
            let numeroDisplay = this.escapeHtml(sala.numero);
            let tipoDisplay = this.escapeHtml(sala.tipo || '');
            
            if (this.filters.busca) {
                const termo = this.filters.busca.toLowerCase();
                numeroDisplay = this.destacarTexto(sala.numero, termo);
                tipoDisplay = this.destacarTexto(sala.tipo || '', termo);
            }

            return `
        <tr>
            <td><strong>${sala.id}</strong></td>
            <td>
                <div class="sala-info">
                    <div class="sala-nome">${numeroDisplay}</div>
                    <small class="sala-detalhes">${tipoDisplay}</small>
                </div>
            </td>
            <td>${this.escapeHtml(localizacao)}</td>
            <td>
                <span class="tipo-badge ${sala.tipo ? this.escapeHtml(sala.tipo.replace(/\s+/g, '-').toLowerCase()) : ''}">
                    ${tipoDisplay || 'Não definido'}
                </span>
            </td>
            <td>${sala.capacidade} lugares</td>
            <td>
                <div class="recursos-lista">
                    ${sala.recursos ? this.formatarRecursos(sala.recursos) : '-'}
                </div>
            </td>
            <td>
                <span class="status-badge ${isAtiva ? 'status-ativo' : 'status-inativo'}">
                    ${isAtiva ? 'Ativa' : 'Inativa'}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn-action btn-edit" onclick="adminSalas.editarSala(${sala.id})" title="Editar Sala">
                    <i class="fas fa-edit"></i>
                </button>
                
                <button class="btn-action btn-view" onclick="adminSalas.verDetalhes(${sala.id})" title="Ver Detalhes">
                    <i class="fas fa-info-circle"></i>
                </button>
                
                <button class="btn-action ${isAtiva ? 'btn-deactivate' : 'btn-activate'}" 
                        onclick="adminSalas.${isAtiva ? 'desativarSala' : 'ativarSala'}(${sala.id})" 
                        title="${isAtiva ? 'Desativar Sala' : 'Ativar Sala'}">
                    <i class="fas ${isAtiva ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
                
                <button class="btn-action btn-delete-permanent" 
                        onclick="adminSalas.excluirPermanentemente(${sala.id})" 
                        title="Excluir Permanentemente"
                        ${isAtiva ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
        `;
        }).join('');
    }

 // ⭐ NOVO: Método para destacar texto da busca
    destacarTexto(texto, termo) {
        if (!texto || !termo) return this.escapeHtml(texto);
        
        const regex = new RegExp(`(${this.escapeRegex(termo)})`, 'gi');
        return this.escapeHtml(texto).replace(regex, '<mark class="busca-destaque">$1</mark>');
    }

 // ⭐ NOVO: Método utilitário para escapar regex
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    formatarRecursos(recursos) {
        if (!recursos) return '-';
        const lista = recursos.split(',').map(rec => rec.trim()).filter(rec => rec);
        return lista.map(rec => `<span class="recurso-tag">${this.escapeHtml(rec)}</span>`).join('');
    }

    atualizarEstatisticas() {
        const totalSalas = this.pagination.totalItems || 0;
        const salasAtivas = this.salas.filter(sala => sala.ativa === 1 || sala.ativa === true).length;
        const salasInativas = this.salas.length - salasAtivas;

        console.log(` Estatísticas: Total=${totalSalas}, Ativas=${salasAtivas}, Inativas=${salasInativas}`);

        const totalElement = document.getElementById('total-salas');
        const ativasElement = document.getElementById('salas-ativas');
        const inativasElement = document.getElementById('salas-inativas');

        if (totalElement) totalElement.textContent = totalSalas;
        if (ativasElement) ativasElement.textContent = salasAtivas;
        if (inativasElement) inativasElement.textContent = salasInativas;
    }

    abrirModalCriarSala() {
        if (!this.verificarAutenticacao()) return;
        this.limparFormulario();
        const modalTitle = document.getElementById('salaModalTitle');
        const modal = document.getElementById('salaModal');
        
        if (modalTitle) modalTitle.textContent = 'Nova Sala';
        if (modal) modal.style.display = 'block';
    }

    abrirModalEditarSala(salaId) {
        if (!this.verificarAutenticacao()) return;

        const sala = this.salas.find(s => s.id === salaId);
        if (!sala) {
            this.showNotification('Sala não encontrada', 'error');
            return;
        }

        const modalTitle = document.getElementById('salaModalTitle');
        const modal = document.getElementById('salaModal');
        
        if (modalTitle) modalTitle.textContent = 'Editar Sala';
        
        document.getElementById('salaId').value = salaId;
        document.getElementById('salaNumero').value = sala.numero || '';
        document.getElementById('salaBloco').value = sala.bloco || '';
        document.getElementById('salaAndar').value = sala.andar || '';
        document.getElementById('salaTipo').value = sala.tipo || 'Sala de Aula';
        document.getElementById('salaCapacidade').value = sala.capacidade || 30;
        document.getElementById('salaRecursos').value = sala.recursos || '';
        document.getElementById('salaCampus').value = sala.campus || '';

        const isAtiva = sala.ativa === 1 || sala.ativa === true;
        document.getElementById('salaAtiva').value = isAtiva ? 'true' : 'false';

        if (modal) modal.style.display = 'block';
    }

    fecharModalSala() {
        const modal = document.getElementById('salaModal');
        if (modal) modal.style.display = 'none';
        this.limparFormulario();
    }

    limparFormulario() {
        const form = document.getElementById('salaForm');
        if (form) form.reset();
        document.getElementById('salaId').value = '';
    }

    async salvarSala() {
        if (!this.verificarAutenticacao()) return;

        const formData = this.getFormData();

 // Validação básica
        if (!formData.numero || formData.numero.trim() === '') {
            this.showNotification('Número da sala é obrigatório', 'error');
            return;
        }

        if (!formData.bloco || formData.bloco.trim() === '') {
            this.showNotification('Bloco é obrigatório', 'error');
            return;
        }

        if (!formData.capacidade || formData.capacidade <= 0) {
            this.showNotification('Capacidade deve ser um número positivo', 'error');
            return;
        }

        try {
            this.showLoading(true);
            const submitBtn = document.querySelector('#salaForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            }

            console.log(' Enviando dados da sala:', formData);

            const url = formData.id 
                ? `${this.API_BASE}/salas/${formData.id}`
                : `${this.API_BASE}/salas`;
            
            const method = formData.id ? 'PUT' : 'POST';
            
            const requestBody = formData.id 
                ? {
                    numero: formData.numero,
                    bloco: formData.bloco,
                    andar: formData.andar,
                    tipo: formData.tipo,
                    capacidade: formData.capacidade,
                    recursos: formData.recursos,
                    ativa: formData.ativa,
                    campus: formData.campus
                }
                : {
                    numero: formData.numero,
                    bloco: formData.bloco,
                    andar: formData.andar,
                    tipo: formData.tipo,
                    capacidade: formData.capacidade,
                    recursos: formData.recursos,
                    campus: formData.campus
                };

            console.log(formData.id ? ` Editando sala ID: ${formData.id}` : '🆕 Criando nova sala');
            console.log(' URL:', url);

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log(' Status da resposta:', response.status);
            
            const responseData = await response.json();
            console.log(' Resposta completa:', responseData);

            if (response.ok && responseData.success === true) {
                console.log(' Sala salva com sucesso');
                this.fecharModalSala();
                await this.carregarSalasComPaginacao();
                this.showNotification(responseData.message || 'Sala salva com sucesso!', 'success');
            } else {
                throw new Error(responseData.error || responseData.message || `Erro ${response.status}`);
            }

        } catch (error) {
            console.error(' Erro ao salvar sala:', error);
            this.showNotification('Erro ao salvar sala: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
            const submitBtn = document.querySelector('#salaForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Sala';
            }
        }
    }

    getFormData() {
        const id = document.getElementById('salaId').value;

        return {
            id: id ? parseInt(id) : null,
            numero: document.getElementById('salaNumero').value.trim(),
            bloco: document.getElementById('salaBloco').value.trim(),
            andar: document.getElementById('salaAndar').value.trim(),
            tipo: document.getElementById('salaTipo').value,
            capacidade: document.getElementById('salaCapacidade').value ? parseInt(document.getElementById('salaCapacidade').value) : 30,
            recursos: document.getElementById('salaRecursos').value.trim(),
            campus: document.getElementById('salaCampus').value.trim(),
            ativa: document.getElementById('salaAtiva').value === 'true'
        };
    }

    async desativarSala(salaId) {
        if (!this.verificarAutenticacao()) return;

        const sala = this.salas.find(s => s.id === salaId);
        if (!sala) {
            this.showNotification('Sala não encontrada', 'error');
            return;
        }

        if (!confirm(`Tem certeza que deseja DESATIVAR a sala "${sala.numero}" - ${sala.bloco}?\n\nA sala ficará invisível para os usuários mas poderá ser reativada depois.`)) {
            return;
        }

        try {
            this.showLoading(true);
            console.log(`⏸ Desativando sala ID: ${salaId}`);

            const response = await fetch(`${this.API_BASE}/salas/${salaId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(' Status da desativação:', response.status);
            const responseData = await response.json();
            console.log(' Resposta da desativação:', responseData);

            if (!response.ok || !responseData.success) {
                throw new Error(responseData.error || `Erro ${response.status}`);
            }

            await this.carregarSalasComPaginacao();
            this.showNotification(responseData.message || 'Sala desativada com sucesso!', 'success');

        } catch (error) {
            console.error(' Erro ao desativar sala:', error);
            this.showNotification('Erro ao desativar sala: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async ativarSala(salaId) {
        if (!this.verificarAutenticacao()) return;

        const sala = this.salas.find(s => s.id === salaId);
        if (!sala) {
            this.showNotification('Sala não encontrada', 'error');
            return;
        }

        if (!confirm(`Tem certeza que deseja ATIVAR a sala "${sala.numero}" - ${sala.bloco}?`)) {
            return;
        }

        try {
            this.showLoading(true);
            console.log(`▶ Ativando sala ID: ${salaId}`);

            const response = await fetch(`${this.API_BASE}/salas/${salaId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    numero: sala.numero,
                    bloco: sala.bloco,
                    andar: sala.andar,
                    tipo: sala.tipo,
                    capacidade: sala.capacidade,
                    recursos: sala.recursos,
                    campus: sala.campus,
                    ativa: true
                })
            });

            console.log(' Status da ativação:', response.status);
            const responseData = await response.json();
            console.log(' Resposta da ativação:', responseData);

            if (!response.ok || !responseData.success) {
                throw new Error(responseData.error || `Erro ${response.status}`);
            }

            await this.carregarSalasComPaginacao();
            this.showNotification(responseData.message || 'Sala ativada com sucesso!', 'success');

        } catch (error) {
            console.error(' Erro ao ativar sala:', error);
            this.showNotification('Erro ao ativar sala: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async excluirPermanentemente(salaId) {
        if (!this.verificarAutenticacao()) return;

        const sala = this.salas.find(s => s.id === salaId);
        if (!sala) {
            this.showNotification('Sala não encontrada', 'error');
            return;
        }

        if (sala.ativa === 1 || sala.ativa === true) {
            this.showNotification('Não é possível excluir permanentemente uma sala ativa. Desative a sala primeiro.', 'error');
            return;
        }

        if (!confirm(`ATENÇÃO: Esta ação não pode ser desfeita!\n\nTem certeza que deseja EXCLUIR PERMANENTEMENTE a sala "${sala.numero}"- ${sala.bloco}?\n\nTodos os dados relacionados a esta sala serão perdidos.`)) {
            return;
        }

        try {
            this.showLoading(true);
            console.log(` Excluindo permanentemente sala ID: ${salaId}`);

            const response = await fetch(`${this.API_BASE}/salas/admin/excluir-permanentemente/${salaId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(' Status da exclusão:', response.status);
            const responseData = await response.json();
            console.log(' Resposta da exclusão:', responseData);

            if (!response.ok || !responseData.success) {
                throw new Error(responseData.error || `Erro ${response.status}`);
            }

            await this.carregarSalasComPaginacao();
            this.showNotification(responseData.message || 'Sala excluída permanentemente com sucesso!', 'success');

        } catch (error) {
            console.error(' Erro ao excluir sala:', error);
            this.showNotification('Erro ao excluir sala: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    verDetalhes(salaId) {
        const sala = this.salas.find(s => s.id === salaId);
        if (sala) {
            const status = (sala.ativa === 1 || sala.ativa === true) ? 'Ativa' : 'Inativa';
            const localizacao = `${sala.bloco || ''}${sala.andar ? ` - ${sala.andar}` : ''}${sala.campus ? ` | ${sala.campus}` : ''}`.trim();
            
            alert(`Detalhes da Sala: ${sala.numero}\n\n Localização: ${localizacao}\n Tipo: ${sala.tipo || 'Não definido'}\n Capacidade: ${sala.capacidade} lugares\n Recursos: ${sala.recursos || 'Nenhum'}\n Status: ${status}`);
        }
    }

    editarSala(salaId) {
        this.abrirModalEditarSala(salaId);
    }

 // Métodos utilitários
    showLoading(show) {
        if (show) {
            document.body.style.cursor = 'wait';
        } else {
            document.body.style.cursor = 'default';
        }
    }

    showNotification(message, type = 'info') {
 // Remover notificações existentes
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            // Vão para innerHTML; usar Font Awesome mantém o ícone igual
            // em todo sistema operacional e acompanha tamanho e tema.
            success: '<i class="fas fa-circle-check" aria-hidden="true"></i>',
            error: '<i class="fas fa-circle-xmark" aria-hidden="true"></i>',
            info: '<i class="fas fa-circle-info" aria-hidden="true"></i>',
            warning: '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>'
        };

        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icons[type] || icons.info}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.closest('.notification').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

 // Auto-remover após 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

 // Método para recarregar dados
    recarregarDados() {
        this.carregarSalasComPaginacao();
    }

 // Método mantido para compatibilidade
    carregarSalas() {
        this.recarregarDados();
    }

    exportarSalas() {
        if (this.salas.length === 0) {
            this.showNotification('Não há salas para exportar', 'warning');
            return;
        }

        const dataStr = JSON.stringify(this.salas, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `salas_unimap_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('Lista de salas exportada com sucesso!', 'success');
    }

    async testarConexao() {
        try {
            console.log(' Testando conexão com a API de admin salas...');
            const response = await fetch(`${this.API_BASE}/salas/test`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(' Teste bem-sucedido:', data);
                this.showNotification('Conexão com a API funcionando!', 'success');
                return true;
            } else {
                throw new Error(`Erro ${response.status}`);
            }
        } catch (error) {
            console.error(' Erro no teste de conexão:', error);
            this.showNotification('Erro na conexão com a API: ' + error.message, 'error');
            return false;
        }
    }
}

// Inicializar automaticamente
document.addEventListener('DOMContentLoaded', function () {
    console.log(' DOM carregado, inicializando Admin Salas...');
    window.adminSalas = new AdminSalas();
    
 // Pequeno delay para garantir que tudo está carregado
    setTimeout(() => {
        if (window.adminSalas && typeof window.adminSalas.init === 'function') {
            window.adminSalas.init();
        }
    }, 100);
});