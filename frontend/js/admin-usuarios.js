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
        this.cursosComPeriodos = {};
        this.cursosDisponiveis = [];
    }
async carregarCursosDoBanco() {
    try {
        console.log('📚 Carregando cursos do banco...');
        
        // 🔥 USE A ROTA CORRETA QUE JÁ EXISTE
        const response = await this.makeRequest('/cursos/com-periodos');
        
        if (response.success) {
            this.cursosComPeriodos = {};
            this.cursosDisponiveis = [];
            
            // 🔥 A ROTA /cursos/com-periodos RETORNA UM ARRAY DIRETO
            let cursosData = response.data;
            
            console.log('📊 Cursos recebidos do banco:', cursosData);
            
            if (Array.isArray(cursosData)) {
                cursosData.forEach(curso => {
                    // 🔥 ESTRUTURA: { id: 1, nome: "Curso", total_periodos: 8 }
                    const nomeCurso = curso.nome;
                    const totalPeriodos = curso.total_periodos || 8;
                    
                    if (nomeCurso) {
                        this.cursosComPeriodos[nomeCurso] = totalPeriodos;
                        this.cursosDisponiveis.push(nomeCurso);
                    }
                });
                
                console.log(`✅ ${this.cursosDisponiveis.length} cursos carregados do banco`);
                this.popularCursosNoModal();
            } else {
                throw new Error('Estrutura de dados inválida para cursos');
            }
        } else {
            throw new Error(response.error || 'Erro ao carregar cursos');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar cursos:', error);
        // Fallback para cursos padrão se der erro
        this.usarCursosFallback();
    }
}
    // Fallback caso a API falhe
    usarCursosFallback() {
        console.log('🔄 Usando cursos fallback...');
        const cursosFallback = {
            'Sistemas de Informação': 8,
            'Administração': 8,
            'Direito': 10
        };
        
        this.cursosComPeriodos = cursosFallback;
        this.cursosDisponiveis = Object.keys(cursosFallback);
        this.popularCursosNoModal();
    }


    // Inicializar
    async init() {
        if (this.inicializado) {
            console.log('✅ AdminUsuarios já foi inicializado');
            return;
        }

        try {
            console.log('🚀 Inicializando AdminUsuarios...');
            
            // 🔥 CARREGAR CURSOS PRIMEIRO
            await this.carregarCursosDoBanco();
            await this.carregarUsuarios();
            this.setupEventListeners();
            this.inicializado = true;
            console.log('✅ AdminUsuarios inicializado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro na inicialização do AdminUsuarios:', error);
            this.showNotification('Erro ao carregar dados do sistema', 'error');
        }
    }
    atualizarPeriodos(cursoSelecionado) {
        const selectPeriodo = document.getElementById('editUserPeriodo');
        if (!selectPeriodo) return;
        
        selectPeriodo.innerHTML = '<option value="">Selecione o período</option>';
        
        if (cursoSelecionado && this.cursosComPeriodos[cursoSelecionado]) {
            const totalPeriodos = this.cursosComPeriodos[cursoSelecionado];
            
            for (let i = 1; i <= totalPeriodos; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}° Período`;
                selectPeriodo.appendChild(option);
            }
            
            console.log(`✅ Gerados ${totalPeriodos} períodos para ${cursoSelecionado}`);
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

    // admin-usuarios.js - ATUALIZAR O MÉTODO editarUsuario
async editarUsuario(usuarioId) {
    try {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) {
            throw new Error('Usuário não encontrado');
        }

        this.usuarioEditando = usuario;

        // ✅ VERIFICAR SE OS ELEMENTOS DO MODAL EXISTEM
        const editUserId = document.getElementById('editUserId');
        const editUserModal = document.getElementById('editUserModal');
        
        if (!editUserId || !editUserModal) {
            this.showNotification(
                'Para editar usuários, acesse a página "Gerenciar Usuários"', 
                'info',
                5000
            );
            return;
        }

        // Só preencher os campos se o modal existir
        editUserId.value = usuario.id;
        
        const editUserName = document.getElementById('editUserName');
        const editUserEmail = document.getElementById('editUserEmail');
        const editUserMatricula = document.getElementById('editUserMatricula');
        const editUserType = document.getElementById('editUserType');
        const editUserCurso = document.getElementById('editUserCurso');
        const editUserPeriodo = document.getElementById('editUserPeriodo');

        if (editUserName) editUserName.value = usuario.nome || '';
        if (editUserEmail) editUserEmail.value = usuario.email || '';
        if (editUserMatricula) editUserMatricula.value = usuario.matricula || '';
        if (editUserType) editUserType.value = usuario.tipo || 'aluno';
        
        // 🔥 PREENCHER CURSO E PERÍODO DINAMICAMENTE
        if (editUserCurso && usuario.curso) {
            editUserCurso.value = usuario.curso;
            // Atualizar os períodos baseado no curso
            this.atualizarPeriodos(usuario.curso);
            
            // Agora preencher o período
            if (editUserPeriodo && usuario.periodo) {
                // Aguardar um pouco para garantir que os períodos foram carregados
                setTimeout(() => {
                    if (editUserPeriodo) {
                        editUserPeriodo.value = usuario.periodo;
                    }
                }, 100);
            }
        }

        editUserModal.style.display = 'flex';
    } catch (error) {
        console.error('❌ Erro ao abrir edição:', error);
        this.showNotification('Erro ao carregar dados do usuário', 'error');
    }
}
    popularCursosNoModal() {
    const selectCurso = document.getElementById('editUserCurso');
    if (!selectCurso) {
        console.log('❌ Elemento editUserCurso não encontrado');
        return;
    }
    
    console.log('📝 Populando cursos no modal...');
    selectCurso.innerHTML = '<option value="">Selecione um curso</option>';
    
    this.cursosDisponiveis.forEach(curso => {
        const option = document.createElement('option');
        option.value = curso;
        option.textContent = curso;
        selectCurso.appendChild(option);
    });
    
    console.log(`✅ ${this.cursosDisponiveis.length} cursos adicionados ao modal`);
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
    const usuario = this.usuarios.find(u => u && u.id === usuarioId);
    if (!usuario) {
        this.showNotification('Usuário não encontrado', 'error');
        return;
    }

    const tipos = ['aluno', 'professor', 'admin'];
    const tipoIndex = tipos.indexOf(tipoAtual);
    const novoTipo = tipos[(tipoIndex + 1) % tipos.length];

    if (confirm(`Deseja alterar o tipo de "${usuario.nome}" para ${this.formatarTipo(novoTipo)}?`)) {
        try {
            const dadosAtualizados = { tipo: novoTipo };
            
            if (novoTipo === 'professor') {
                dadosAtualizados.matricula = '';
                dadosAtualizados.periodo = null;
                dadosAtualizados.curso = '';
            } else if (novoTipo === 'admin') {
                dadosAtualizados.matricula = '';
                dadosAtualizados.periodo = null;
            }

            const response = await this.makeRequest(`/usuarios/${usuarioId}`, {
                method: 'PUT',
                body: JSON.stringify(dadosAtualizados)
            });

            if (response.success) {
                this.limparCacheUsuario(usuarioId);
                this.showNotification('Tipo de usuário alterado com sucesso!', 'success');
                await this.carregarUsuarios(); // Recarregar para garantir dados atualizados
            } else {
                throw new Error(response.error || 'Erro ao alterar tipo');
            }
        } catch (error) {
            console.error('❌ Erro ao alterar tipo:', error);
            
            if (error.message.includes('404') || error.message.includes('Cannot PUT')) {
                this.showNotification('Função de edição não disponível. Atualizando localmente...', 'warning');
                
                usuario.tipo = novoTipo;
                if (novoTipo === 'professor') {
                    usuario.matricula = '';
                    usuario.periodo = null;
                    usuario.curso = '';
                } else if (novoTipo === 'admin') {
                    usuario.matricula = '';
                    usuario.periodo = null;
                }
                
                this.atualizarEstatisticas();
                this.exibirUsuarios();
                this.showNotification('Alteração aplicada localmente', 'info');
            } else {
                this.showNotification('Erro ao alterar tipo: ' + error.message, 'error');
            }
        }
    }
}

    // MÉTODO EXCLUIR USUÁRIO - VERSÃO CORRIGIDA
// MÉTODO EXCLUIR USUÁRIO - VERSÃO ATUALIZADA
async excluirUsuario(usuarioId) {
    // Verificar se o usuário existe na lista local
    const usuario = this.usuarios.find(u => u && u.id === usuarioId);
    if (!usuario) {
        this.showNotification('Usuário não encontrado', 'error');
        return;
    }

    // 🔥 MENSAGEM DE CONFIRMAÇÃO ESPECÍFICA PARA PROFESSORES
    let confirmMessage = `Tem certeza que deseja excluir o usuário "${usuario.nome}"? Esta ação não pode ser desfeita.`;
    
    if (usuario.tipo === 'professor') {
        confirmMessage = `🚨 ATENÇÃO: EXCLUSÃO DE PROFESSOR\n\n` +
                        `Você está prestes a excluir o professor "${usuario.nome}".\n\n` +
                        `Esta ação irá:\n` +
                        `• Desativar o usuário\n` +
                        `• Excluir PERMANENTEMENTE o registro do professor\n` +
                        `• Remover todas as aulas associadas\n` +
                        `• Remover todos os favoritos dos alunos\n\n` +
                        `Esta ação NÃO PODE ser desfeita!\n\n` +
                        `Confirma a exclusão?`;
    }

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        console.log(`🗑️ Tentando excluir usuário ID: ${usuarioId}`);
        
        const response = await this.makeRequest(`/usuarios/${usuarioId}`, {
            method: 'DELETE'
        });

        if (response.success) {
            let mensagemSucesso = 'Usuário excluído com sucesso!';
            
            // 🔥 MENSAGEM ESPECÍFICA PARA PROFESSORES
            if (usuario.tipo === 'professor' && response.professor_excluido) {
                mensagemSucesso = `Professor "${usuario.nome}" excluído permanentemente do sistema!`;
                
                if (response.aulas_removidas > 0 || response.favoritos_removidos > 0) {
                    mensagemSucesso += `\nForam removidos automaticamente:`;
                    if (response.aulas_removidas > 0) {
                        mensagemSucesso += `\n• ${response.aulas_removidas} aula(s)`;
                    }
                    if (response.favoritos_removidos > 0) {
                        mensagemSucesso += `\n• ${response.favoritos_removidos} favorito(s)`;
                    }
                }
            }
            
            this.showNotification(mensagemSucesso, 'success');
            
            // Remover da lista local
            this.usuarios = this.usuarios.filter(u => u.id !== usuarioId);
            this.usuariosFiltrados = this.usuariosFiltrados.filter(u => u.id !== usuarioId);
            
            this.atualizarEstatisticas();
            this.exibirUsuarios();

            // 🔥 ATUALIZAR A LISTA DE PROFESSORES SE ESTIVER ABERTA
            setTimeout(() => {
                if (typeof professoresAdmin !== 'undefined' && typeof professoresAdmin.loadProfessores === 'function') {
                    console.log('🔄 Atualizando lista de professores...');
                    professoresAdmin.loadProfessores();
                }
            }, 500);

        } else {
            throw new Error(response.error || 'Erro ao excluir usuário');
        }
    } catch (error) {
        console.error('❌ Erro ao excluir usuário:', error);
        
        if (error.message.includes('404') || error.message.includes('Cannot DELETE')) {
            this.showNotification('Função de exclusão não disponível no momento. Contate o administrador do sistema.', 'warning');
        } else {
            this.showNotification('Erro ao excluir usuário: ' + error.message, 'error');
        }
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