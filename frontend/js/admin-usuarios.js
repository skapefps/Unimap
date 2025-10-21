// js/admin-usuarios.js - VERSÃO APENAS PARA USUÁRIOS
class AdminUsuarios {
    constructor() {
        this.usuarios = [];
        this.usuariosFiltrados = [];
        this.paginaAtual = 1;
        this.itensPorPagina = 10;
        this.usuarioEditando = null;
        this.carregando = false;
        this.inicializado = false;
    }

    // Inicializar
    async init() {
        if (this.inicializado) {
            console.log('✅ AdminUsuarios já foi inicializado');
            return;
        }

        try {
            console.log('🚀 Inicializando AdminUsuarios...');
            
            await this.carregarUsuarios();
            this.setupEventListeners();
            this.inicializado = true;
            console.log('✅ AdminUsuarios inicializado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro na inicialização do AdminUsuarios:', error);
            this.showNotification('Erro ao carregar dados do sistema', 'error');
        }
    }

    // Fazer requisições autenticadas
    async makeRequest(endpoint, options = {}) {
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            this.showNotification('Usuário não autenticado', 'error');
            throw new Error('Usuário não autenticado');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(`/api${endpoint}`, mergedOptions);
            
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            console.log(`📡 API Response [${endpoint}]:`, data);

            if (!response.ok) {
                throw new Error(typeof data === 'object' ? (data.error || `Erro ${response.status}`) : `Erro ${response.status}`);
            }

            return {
                success: true,
                data: data,
                message: typeof data === 'object' ? data.message : 'Sucesso'
            };
        } catch (error) {
            console.error(`❌ Erro na requisição ${endpoint}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Carregar todos os usuários
    async carregarUsuarios() {
        if (this.carregando) return;

        this.carregando = true;

        try {
            console.log('📥 Carregando usuários...');
            
            const response = await this.makeRequest('/usuarios');
            
            if (response.success) {
                let usuariosArray = [];
                
                if (Array.isArray(response.data)) {
                    usuariosArray = response.data;
                } else if (response.data && Array.isArray(response.data.usuarios)) {
                    usuariosArray = response.data.usuarios;
                } else if (response.data && Array.isArray(response.data.data)) {
                    usuariosArray = response.data.data;
                } else {
                    console.warn('⚠️ Estrutura inesperada da resposta:', response);
                    usuariosArray = [];
                }
                
                console.log('👥 Usuários carregados:', usuariosArray.length);
                
                this.usuarios = Array.isArray(usuariosArray) ? usuariosArray : [];
                this.usuariosFiltrados = [...this.usuarios];
                
                this.atualizarEstatisticas();
                this.exibirUsuarios();
                
            } else {
                throw new Error(response.error || 'Erro ao carregar usuários');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar usuários:', error);
            this.showNotification('Erro ao carregar usuários: ' + error.message, 'error');
            this.usuarios = [];
            this.usuariosFiltrados = [];
            this.exibirUsuarios();
        } finally {
            this.carregando = false;
        }
    }

    // MÉTODOS PARA USUÁRIOS
    atualizarEstatisticas() {
        try {
            if (!Array.isArray(this.usuarios)) {
                this.usuarios = [];
            }

            const totalUsuarios = this.usuarios.length;
            const totalAlunos = this.usuarios.filter(u => u && u.tipo === 'aluno').length;
            const totalProfessores = this.usuarios.filter(u => u && u.tipo === 'professor').length;
            const totalAdmins = this.usuarios.filter(u => u && u.tipo === 'admin').length;

            const totalUsuariosEl = document.getElementById('totalUsuarios');
            const totalAlunosEl = document.getElementById('totalAlunos');
            const totalProfessoresEl = document.getElementById('totalProfessores');
            const totalAdminsEl = document.getElementById('totalAdmins');

            if (totalUsuariosEl) totalUsuariosEl.textContent = totalUsuarios;
            if (totalAlunosEl) totalAlunosEl.textContent = totalAlunos;
            if (totalProfessoresEl) totalProfessoresEl.textContent = totalProfessores;
            if (totalAdminsEl) totalAdminsEl.textContent = totalAdmins;

        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas:', error);
        }
    }

    exibirUsuarios() {
        const tbody = document.getElementById('usuarios-body');
        if (!tbody) {
            console.error('❌ Elemento usuarios-body não encontrado');
            return;
        }

        try {
            if (!Array.isArray(this.usuariosFiltrados)) {
                this.usuariosFiltrados = [];
            }

            const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
            const fim = inicio + this.itensPorPagina;
            const usuariosPagina = this.usuariosFiltrados.slice(inicio, fim);

            if (!usuariosPagina || usuariosPagina.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <i class="fas fa-users-slash"></i>
                            <p>Nenhum usuário encontrado</p>
                            <button onclick="adminUsuarios.recarregarUsuarios()" class="btn-primary" style="margin-top: 10px;">
                                <i class="fas fa-redo"></i> Recarregar
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = usuariosPagina.map(usuario => `
                    <tr>
                        <td><strong>${this.escapeHtml(usuario.nome || 'N/A')}</strong></td>
                        <td>${this.escapeHtml(usuario.email || 'N/A')}</td>
                        <td>${this.escapeHtml(usuario.matricula || 'N/A')}</td>
                        <td>
                            <span class="badge ${usuario.tipo || 'aluno'}">
                                ${this.formatarTipo(usuario.tipo)}
                            </span>
                        </td>
                        <td>${this.escapeHtml(usuario.curso || 'N/A')}</td>
                        <td>${this.formatarData(usuario.data_cadastro)}</td>
                        <td>
                            <button class="btn-action small" onclick="adminUsuarios.editarUsuario(${usuario.id})" 
                                    title="Editar usuário">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-action small secundario" 
                                    onclick="adminUsuarios.alterarTipo(${usuario.id}, '${usuario.tipo}')"
                                    title="Alterar tipo">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <button class="btn-action small perigo" onclick="adminUsuarios.excluirUsuario(${usuario.id})"
                                    title="Excluir usuário">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }

            this.atualizarPaginacao();
        } catch (error) {
            console.error('❌ Erro ao exibir usuários:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erro ao carregar lista de usuários</p>
                        <button onclick="adminUsuarios.recarregarUsuarios()" class="btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-redo"></i> Tentar Novamente
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    async recarregarUsuarios() {
        console.log('🔄 Recarregando usuários manualmente...');
        await this.carregarUsuarios();
    }

    filtrarUsuarios(termo) {
        try {
            if (!termo) {
                this.usuariosFiltrados = [...this.usuarios];
            } else {
                const termoLower = termo.toLowerCase();
                this.usuariosFiltrados = this.usuarios.filter(usuario =>
                    usuario && (
                        (usuario.nome && usuario.nome.toLowerCase().includes(termoLower)) ||
                        (usuario.email && usuario.email.toLowerCase().includes(termoLower)) ||
                        (usuario.matricula && usuario.matricula.toLowerCase().includes(termoLower)) ||
                        (usuario.curso && usuario.curso.toLowerCase().includes(termoLower))
                    )
                );
            }
            
            this.paginaAtual = 1;
            this.exibirUsuarios();
        } catch (error) {
            console.error('❌ Erro ao filtrar usuários:', error);
        }
    }

    filtrarPorTipo(tipo) {
        try {
            if (!tipo) {
                this.usuariosFiltrados = [...this.usuarios];
            } else {
                this.usuariosFiltrados = this.usuarios.filter(usuario => 
                    usuario && usuario.tipo === tipo
                );
            }
            
            this.paginaAtual = 1;
            this.exibirUsuarios();
        } catch (error) {
            console.error('❌ Erro ao filtrar por tipo:', error);
        }
    }

    atualizarPaginacao() {
        try {
            const totalPaginas = Math.ceil(this.usuariosFiltrados.length / this.itensPorPagina);
            const prevButton = document.getElementById('prevPage');
            const nextButton = document.getElementById('nextPage');
            const pageInfo = document.getElementById('pageInfo');

            if (prevButton && nextButton && pageInfo) {
                prevButton.disabled = this.paginaAtual <= 1;
                nextButton.disabled = this.paginaAtual >= totalPaginas;
                
                pageInfo.textContent = `Página ${this.paginaAtual} de ${totalPaginas || 1}`;

                prevButton.onclick = () => this.mudarPagina(this.paginaAtual - 1);
                nextButton.onclick = () => this.mudarPagina(this.paginaAtual + 1);
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar paginação:', error);
        }
    }

    mudarPagina(novaPagina) {
        this.paginaAtual = novaPagina;
        this.exibirUsuarios();
    }

    async editarUsuario(usuarioId) {
        try {
            const usuario = this.usuarios.find(u => u.id === usuarioId);
            if (!usuario) {
                throw new Error('Usuário não encontrado');
            }

            this.usuarioEditando = usuario;

            document.getElementById('editUserId').value = usuario.id;
            document.getElementById('editUserName').value = usuario.nome || '';
            document.getElementById('editUserEmail').value = usuario.email || '';
            document.getElementById('editUserMatricula').value = usuario.matricula || '';
            document.getElementById('editUserType').value = usuario.tipo || 'aluno';
            document.getElementById('editUserCurso').value = usuario.curso || '';
            document.getElementById('editUserPeriodo').value = usuario.periodo || '';

            document.getElementById('editUserModal').style.display = 'flex';
        } catch (error) {
            console.error('❌ Erro ao abrir edição:', error);
            this.showNotification('Erro ao carregar dados do usuário', 'error');
        }
    }

    fecharModal() {
        document.getElementById('editUserModal').style.display = 'none';
        this.usuarioEditando = null;
        document.getElementById('editUserForm').reset();
    }

    async salvarEdicao() {
        try {
            const usuarioId = document.getElementById('editUserId').value;
            const dadosAtualizados = {
                nome: document.getElementById('editUserName').value,
                email: document.getElementById('editUserEmail').value,
                matricula: document.getElementById('editUserMatricula').value,
                tipo: document.getElementById('editUserType').value,
                curso: document.getElementById('editUserCurso').value,
                periodo: document.getElementById('editUserPeriodo').value
            };

            const response = await this.makeRequest(`/usuarios/${usuarioId}`, {
                method: 'PUT',
                body: JSON.stringify(dadosAtualizados)
            });
            
            if (response.success) {
                this.showNotification('Usuário atualizado com sucesso!', 'success');
                this.fecharModal();
                await this.carregarUsuarios();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('❌ Erro ao salvar edição:', error);
            this.showNotification('Erro ao atualizar usuário: ' + error.message, 'error');
        }
    }

    async alterarTipo(usuarioId, tipoAtual) {
        const tipos = ['aluno', 'professor', 'admin'];
        const tipoIndex = tipos.indexOf(tipoAtual);
        const novoTipo = tipos[(tipoIndex + 1) % tipos.length];

        if (confirm(`Deseja alterar o tipo deste usuário para ${this.formatarTipo(novoTipo)}?`)) {
            try {
                const dadosAtualizados = { tipo: novoTipo };
                
                if (novoTipo === 'professor') {
                    dadosAtualizados.matricula = '';
                    dadosAtualizados.periodo = null;
                }

                const response = await this.makeRequest(`/usuarios/${usuarioId}/tipo`, {
                    method: 'PUT',
                    body: JSON.stringify(dadosAtualizados)
                });

                if (response.success) {
                    this.limparCacheUsuario(usuarioId);
                    this.showNotification(response.message, 'success');
                    await this.carregarUsuarios();
                } else {
                    throw new Error(response.error);
                }
            } catch (error) {
                console.error('❌ Erro ao alterar tipo:', error);
                this.showNotification('Erro ao alterar tipo: ' + error.message, 'error');
            }
        }
    }

    async excluirUsuario(usuarioId) {
        if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const response = await this.makeRequest(`/usuarios/${usuarioId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.showNotification('Usuário excluído com sucesso!', 'success');
                await this.carregarUsuarios();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('❌ Erro ao excluir usuário:', error);
            this.showNotification('Erro ao excluir usuário: ' + error.message, 'error');
        }
    }

    limparCacheUsuario(usuarioId) {
        const usuarioLogado = JSON.parse(localStorage.getItem('userData') || '{}');
        
        if (usuarioLogado.id == usuarioId) {
            this.showNotification(
                'Tipo de usuário alterado. Faça login novamente para aplicar as mudanças.', 
                'warning',
                7000
            );
        }
    }

    formatarTipo(tipo) {
        const tipos = {
            'aluno': 'Aluno',
            'professor': 'Professor',
            'admin': 'Administrador'
        };
        return tipos[tipo] || tipo;
    }

    formatarData(dataString) {
        if (!dataString) return 'N/A';
        try {
            const data = new Date(dataString);
            return data.toLocaleDateString('pt-BR');
        } catch (error) {
            return 'N/A';
        }
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return 'N/A';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showNotification(message, type = 'info', duration = 5000) {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10000;
                background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, duration);
        }
    }

    setupEventListeners() {
        console.log('✅ Event listeners configurados para usuários');
        
        const searchInput = document.getElementById('searchUsers');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filtrarUsuarios(e.target.value);
            });
        }

        const tipoFilter = document.getElementById('tipoFilter');
        if (tipoFilter) {
            tipoFilter.addEventListener('change', (e) => {
                this.filtrarPorTipo(e.target.value);
            });
        }

        const editUserForm = document.getElementById('editUserForm');
        if (editUserForm) {
            editUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarEdicao();
            });
        }
    }
}

// Instância global
const adminUsuarios = new AdminUsuarios();

// INICIALIZAÇÃO AUTOMÁTICA quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Carregado - Inicializando AdminUsuarios...');
    
    setTimeout(async () => {
        try {
            await adminUsuarios.init();
            console.log('✅ AdminUsuarios inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização do AdminUsuarios:', error);
        }
    }, 100);
});

// EXPORTAÇÃO PARA USO GLOBAL
window.AdminUsuarios = AdminUsuarios;
window.adminUsuarios = adminUsuarios;