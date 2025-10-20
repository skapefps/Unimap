// js/admin-usuarios.js
class AdminUsuarios {
    constructor() {
        this.usuarios = [];
        this.usuariosFiltrados = [];
        this.paginaAtual = 1;
        this.itensPorPagina = 10;
        this.usuarioEditando = null;
    }

    // Fazer requisições autenticadas
    async makeRequest(endpoint, options = {}) {
        const token = authManager.getToken();
        
        if (!token) {
            showNotification('Usuário não autenticado', 'error');
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
            const data = await response.json();
            
            console.log(`📡 API Response [${endpoint}]:`, data);

            if (!response.ok) {
                throw new Error(data.error || `Erro ${response.status}`);
            }

            return {
                success: true,
                data: data,
                message: data.message
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
        try {
            console.log('📥 Carregando usuários...');
            
            const response = await this.makeRequest('/usuarios');
            
            if (response.success) {
                this.usuarios = response.data;
                this.usuariosFiltrados = [...this.usuarios];
                this.atualizarEstatisticas();
                this.exibirUsuarios();
                showNotification(`Carregados ${this.usuarios.length} usuários`, 'success');
            } else {
                throw new Error(response.error || 'Erro ao carregar usuários');
            }
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            showNotification('Erro ao carregar usuários: ' + error.message, 'error');
        }
    }

    // Resto do código permanece igual...
    atualizarEstatisticas() {
        const totalUsuarios = this.usuarios.length;
        const totalAlunos = this.usuarios.filter(u => u.tipo === 'aluno').length;
        const totalProfessores = this.usuarios.filter(u => u.tipo === 'professor').length;
        const totalAdmins = this.usuarios.filter(u => u.tipo === 'admin').length;

        const totalUsuariosEl = document.getElementById('totalUsuarios');
        const totalAlunosEl = document.getElementById('totalAlunos');
        const totalProfessoresEl = document.getElementById('totalProfessores');
        const totalAdminsEl = document.getElementById('totalAdmins');

        if (totalUsuariosEl) totalUsuariosEl.textContent = totalUsuarios;
        if (totalAlunosEl) totalAlunosEl.textContent = totalAlunos;
        if (totalProfessoresEl) totalProfessoresEl.textContent = totalProfessores;
        if (totalAdminsEl) totalAdminsEl.textContent = totalAdmins;
    }

    exibirUsuarios() {
        const tbody = document.getElementById('usuarios-body');
        if (!tbody) return;

        const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
        const fim = inicio + this.itensPorPagina;
        const usuariosPagina = this.usuariosFiltrados.slice(inicio, fim);

        if (usuariosPagina.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum usuário encontrado</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = usuariosPagina.map(usuario => `
                <tr>
                    <td><strong>${usuario.nome}</strong></td>
                    <td>${usuario.email}</td>
                    <td>${usuario.matricula || 'N/A'}</td>
                    <td>
                        <span class="badge ${usuario.tipo}">
                            ${this.formatarTipo(usuario.tipo)}
                        </span>
                    </td>
                    <td>${usuario.curso || 'N/A'}</td>
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
                    </td>
                </tr>
            `).join('');
        }

        this.atualizarPaginacao();
    }

    // ... (mantenha o restante dos métodos como estava)
    filtrarUsuarios(termo) {
        if (!termo) {
            this.usuariosFiltrados = [...this.usuarios];
        } else {
            const termoLower = termo.toLowerCase();
            this.usuariosFiltrados = this.usuarios.filter(usuario =>
                usuario.nome.toLowerCase().includes(termoLower) ||
                usuario.email.toLowerCase().includes(termoLower) ||
                (usuario.matricula && usuario.matricula.toLowerCase().includes(termoLower)) ||
                (usuario.curso && usuario.curso.toLowerCase().includes(termoLower))
            );
        }
        
        this.paginaAtual = 1;
        this.exibirUsuarios();
    }

    filtrarPorTipo(tipo) {
        if (!tipo) {
            this.usuariosFiltrados = [...this.usuarios];
        } else {
            this.usuariosFiltrados = this.usuarios.filter(usuario => usuario.tipo === tipo);
        }
        
        this.paginaAtual = 1;
        this.exibirUsuarios();
    }

    atualizarPaginacao() {
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
            document.getElementById('editUserName').value = usuario.nome;
            document.getElementById('editUserEmail').value = usuario.email;
            document.getElementById('editUserMatricula').value = usuario.matricula || '';
            document.getElementById('editUserType').value = usuario.tipo;
            document.getElementById('editUserCurso').value = usuario.curso || '';
            document.getElementById('editUserPeriodo').value = usuario.periodo || '';

            document.getElementById('editUserModal').style.display = 'flex';
        } catch (error) {
            console.error('Erro ao abrir edição:', error);
            showNotification('Erro ao carregar dados do usuário', 'error');
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
                showNotification('Usuário atualizado com sucesso!', 'success');
                this.fecharModal();
                this.carregarUsuarios();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            showNotification('Erro ao atualizar usuário: ' + error.message, 'error');
        }
    }

    async alterarTipo(usuarioId, tipoAtual) {
        const tipos = ['aluno', 'professor', 'admin'];
        const tipoIndex = tipos.indexOf(tipoAtual);
        const novoTipo = tipos[(tipoIndex + 1) % tipos.length];

        if (confirm(`Deseja alterar o tipo deste usuário para ${this.formatarTipo(novoTipo)}?`)) {
            try {
                const response = await this.makeRequest(`/usuarios/${usuarioId}/tipo`, {
                    method: 'PUT',
                    body: JSON.stringify({ tipo: novoTipo })
                });

                if (response.success) {
                    showNotification(response.message, 'success');
                    this.carregarUsuarios();
                } else {
                    throw new Error(response.error);
                }
            } catch (error) {
                console.error('Erro ao alterar tipo:', error);
                showNotification('Erro ao alterar tipo: ' + error.message, 'error');
            }
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
        const data = new Date(dataString);
        return data.toLocaleDateString('pt-BR');
    }
    // js/admin-usuarios.js - Adicione esta função
limparCamposProfessor() {
    document.getElementById('editUserMatricula').value = '';
    document.getElementById('editUserCurso').value = '';
    document.getElementById('editUserPeriodo').value = '';
}

// E modifique a função alterarTipo para limpar automaticamente
async alterarTipo(usuarioId, tipoAtual) {
    const tipos = ['aluno', 'professor', 'admin'];
    const tipoIndex = tipos.indexOf(tipoAtual);
    const novoTipo = tipos[(tipoIndex + 1) % tipos.length];

    if (confirm(`Deseja alterar o tipo deste usuário para ${this.formatarTipo(novoTipo)}?`)) {
        try {
            const dadosAtualizados = { tipo: novoTipo };
            
            // Se está mudando para professor, limpa matrícula e período
            if (novoTipo === 'professor') {
                dadosAtualizados.matricula = '';
                dadosAtualizados.periodo = null;
                // Opcional: limpar curso também
                // dadosAtualizados.curso = '';
            }

            const response = await this.makeRequest(`/usuarios/${usuarioId}/tipo`, {
                method: 'PUT',
                body: JSON.stringify(dadosAtualizados)
            });

            if (response.success) {
                showNotification(response.message, 'success');
                this.carregarUsuarios();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao alterar tipo:', error);
            showNotification('Erro ao alterar tipo: ' + error.message, 'error');
        }
    }
}
// js/admin-usuarios.js - Adicione esta função
async alterarTipo(usuarioId, tipoAtual) {
    const tipos = ['aluno', 'professor', 'admin'];
    const tipoIndex = tipos.indexOf(tipoAtual);
    const novoTipo = tipos[(tipoIndex + 1) % tipos.length];

    if (confirm(`Deseja alterar o tipo deste usuário para ${this.formatarTipo(novoTipo)}?`)) {
        try {
            const dadosAtualizados = { tipo: novoTipo };
            
            // Se está mudando para professor, limpa matrícula e período
            if (novoTipo === 'professor') {
                dadosAtualizados.matricula = '';
                dadosAtualizados.periodo = null;
            }

            const response = await this.makeRequest(`/usuarios/${usuarioId}/tipo`, {
                method: 'PUT',
                body: JSON.stringify(dadosAtualizados)
            });

            if (response.success) {
                // 🔥 NOVO: Limpar cache do usuário se ele estiver logado
                this.limparCacheUsuario(usuarioId);
                
                showNotification(response.message, 'success');
                this.carregarUsuarios();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Erro ao alterar tipo:', error);
            showNotification('Erro ao alterar tipo: ' + error.message, 'error');
        }
    }
}

// 🔥 NOVA FUNÇÃO: Limpar cache do usuário se estiver logado
limparCacheUsuario(usuarioId) {
    const usuarioLogado = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (usuarioLogado.id == usuarioId) {
        // Se o usuário que está sendo modificado é o mesmo que está logado
        showNotification(
            'Tipo de usuário alterado. Faça login novamente para aplicar as mudanças.', 
            'warning',
            7000
        );
        
        // Opcional: fazer logout automático
        // authManager.logout();
    }
}
}

// Instância global
const adminUsuarios = new AdminUsuarios();