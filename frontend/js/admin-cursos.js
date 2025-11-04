// js/admin-cursos.js
class AdminCursos {
    constructor() {
        this.cursos = [];
        this.API_BASE = 'http://localhost:3000/api';
    }

    init() {
        console.log('🎯 Inicializando Admin Cursos...');
        this.verificarAutenticacao();
        this.carregarTodosCursos();
        this.setupEventListeners();
    }

    verificarAutenticacao() {
        this.token = localStorage.getItem('authToken') || localStorage.getItem('unimap_token');
        if (!this.token) {
            console.error('❌ Token não encontrado!');
            this.showNotification('Usuário não autenticado. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }
        console.log('✅ Token encontrado');
        return true;
    }

    setupEventListeners() {
        document.getElementById('cursoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarCurso();
        });
    }

    async carregarTodosCursos() {
        if (!this.verificarAutenticacao()) return;

        try {
            this.showLoading(true);
            console.log('📚 Carregando TODOS os cursos...');

            const response = await fetch(`${this.API_BASE}/cursos/todos`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }

            this.cursos = await response.json();
            console.log(`✅ ${this.cursos.length} cursos carregados (ativos + inativos)`);

            // Ordenar por ID
            this.cursos.sort((a, b) => a.id - b.id);

            this.renderizarCursos();
            this.atualizarEstatisticas();

        } catch (error) {
            console.error('❌ Erro ao carregar cursos:', error);
            this.showNotification('Erro ao carregar cursos: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderizarCursos() {
        const tbody = document.getElementById('cursos-body');

        if (this.cursos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum curso cadastrado</td></tr>';
            return;
        }

        tbody.innerHTML = this.cursos.map(curso => {
            const isAtivo = curso.ativo === 1;

            return `
            <tr>
                <td><strong>${curso.id}</strong></td>
                <td>
                    <div class="curso-info">
                        <div class="curso-nome">${curso.nome}</div>
                        <small class="curso-detalhes">
                            ${curso.turno ? `${curso.turno}` : ''}
                            ${curso.total_periodos ? ` • ${curso.total_periodos} períodos` : ''}
                        </small>
                    </div>
                </td>
                <td>${curso.total_periodos || '-'} períodos</td>
                <td>${curso.turno || '-'}</td>
                <td>
                    <span class="status-badge ${isAtivo ? 'status-ativo' : 'status-inativo'}">
                        ${isAtivo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="actions-cell">
                    <!-- Botão Editar -->
                    <button class="btn-action btn-edit" onclick="adminCursos.editarCurso(${curso.id})" title="Editar Curso">
                        <i class="fas fa-edit"></i>
                    </button>
                    
                    <!-- Botão Ver Disciplinas -->
                    <button class="btn-action btn-view" onclick="adminCursos.verDisciplinas(${curso.id})" title="Ver Disciplinas">
                        <i class="fas fa-book"></i>
                    </button>
                    
                    <!-- Botão Ativar/Desativar -->
                    <button class="btn-action ${isAtivo ? 'btn-deactivate' : 'btn-activate'}" 
                            onclick="adminCursos.${isAtivo ? 'desativarCurso' : 'ativarCurso'}(${curso.id})" 
                            title="${isAtivo ? 'Desativar Curso' : 'Ativar Curso'}">
                        <i class="fas ${isAtivo ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    
                    <!-- Botão Excluir Permanentemente -->
                    <button class="btn-action btn-delete-permanent" 
                            onclick="adminCursos.excluirPermanentemente(${curso.id})" 
                            title="Excluir Permanentemente"
                            ${isAtivo ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    atualizarEstatisticas() {
        const totalCursos = this.cursos.length;
        const cursosAtivos = this.cursos.filter(curso => curso.ativo === 1).length;
        const cursosInativos = totalCursos - cursosAtivos;

        console.log(`📊 Estatísticas: Total=${totalCursos}, Ativos=${cursosAtivos}, Inativos=${cursosInativos}`);

        document.getElementById('total-cursos').textContent = totalCursos;
        document.getElementById('cursos-ativos').textContent = cursosAtivos;
        document.getElementById('cursos-inativos').textContent = cursosInativos;
    }

    abrirModalCriarCurso() {
        if (!this.verificarAutenticacao()) return;
        this.limparFormulario();
        document.getElementById('cursoModalTitle').textContent = 'Novo Curso';
        document.getElementById('cursoModal').style.display = 'block';
    }

    abrirModalEditarCurso(cursoId) {
        if (!this.verificarAutenticacao()) return;

        const curso = this.cursos.find(c => c.id === cursoId);
        if (!curso) {
            this.showNotification('Curso não encontrado', 'error');
            return;
        }

        document.getElementById('cursoModalTitle').textContent = 'Editar Curso';
        document.getElementById('cursoId').value = cursoId;
        document.getElementById('cursoNome').value = curso.nome;
        document.getElementById('cursoTurno').value = curso.turno;
        document.getElementById('cursoPeriodos').value = curso.total_periodos;

        const isAtivo = curso.ativo === 1;
        document.getElementById('cursoAtivo').value = isAtivo ? 'true' : 'false';

        document.getElementById('cursoModal').style.display = 'block';
    }

    fecharModalCurso() {
        document.getElementById('cursoModal').style.display = 'none';
        this.limparFormulario();
    }

    limparFormulario() {
        document.getElementById('cursoForm').reset();
        document.getElementById('cursoId').value = '';
    }

    async salvarCurso() {
        if (!this.verificarAutenticacao()) return;

        const formData = this.getFormData();

        // Apenas validação básica
        if (!formData.nome || formData.nome.trim() === '') {
            this.showNotification('Nome do curso é obrigatório', 'error');
            return;
        }

        if (!formData.turno) {
            this.showNotification('Turno é obrigatório', 'error');
            return;
        }

        try {
            this.showLoading(true);
            const submitBtn = document.querySelector('#cursoForm button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

            console.log('💾 Enviando dados do curso:', formData);

            let response;
            let url = `${this.API_BASE}/cursos`;
            let method = 'POST';
            let requestBody = {
                nome: formData.nome,
                duracao: formData.total_periodos,
                turno: formData.turno,
                total_periodos: formData.total_periodos,
                ativo: true
            };

            if (formData.id) {
                url = `${this.API_BASE}/cursos/${formData.id}`;
                method = 'PUT';
                requestBody.ativo = formData.ativo;
                console.log(`✏️ Editando curso ID: ${formData.id}`);
            } else {
                console.log('🆕 Criando novo curso');
            }

            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📨 Status da resposta:', response.status);

            // Primeiro verificar se a resposta é bem-sucedida
            if (response.ok) {
                const responseData = await response.json();
                console.log('📨 Resposta de sucesso:', responseData);

                this.fecharModalCurso();
                await this.carregarTodosCursos();
                this.showNotification(responseData.message || 'Curso salvo com sucesso!', 'success');
            } else {
                // Só mostrar erro se realmente houver erro
                const responseData = await response.json();
                console.log('📨 Resposta de erro:', responseData);

                throw new Error(responseData.error || `Erro ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Erro ao salvar curso:', error);
            this.showNotification('Erro ao salvar curso: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
            const submitBtn = document.querySelector('#cursoForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Curso';
            }
        }
    }

    getFormData() {
        const id = document.getElementById('cursoId').value;
        return {
            id: id ? parseInt(id) : null,
            nome: document.getElementById('cursoNome').value.trim(),
            turno: document.getElementById('cursoTurno').value,
            total_periodos: document.getElementById('cursoPeriodos').value ? parseInt(document.getElementById('cursoPeriodos').value) : 10,
            ativo: document.getElementById('cursoAtivo').value === 'true'
        };
    }

    async desativarCurso(cursoId) {
        if (!this.verificarAutenticacao()) return;

        const curso = this.cursos.find(c => c.id === cursoId);
        if (!curso) {
            this.showNotification('Curso não encontrado', 'error');
            return;
        }

        if (!confirm(`Tem certeza que deseja DESATIVAR o curso "${curso.nome}"?\n\nO curso ficará invisível para os usuários mas poderá ser reativado depois.`)) {
            return;
        }

        try {
            this.showLoading(true);

            console.log(`⏸️ Desativando curso ID: ${cursoId}`);

            // Usar a rota DELETE existente (soft delete)
            const response = await fetch(`${this.API_BASE}/cursos/${cursoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('📨 Status da desativação:', response.status);
            const responseData = await response.json();
            console.log('📨 Resposta da desativação:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || `Erro ${response.status}`);
            }

            await this.carregarTodosCursos();
            this.showNotification(responseData.message || 'Curso desativado com sucesso!', 'success');

        } catch (error) {
            console.error('❌ Erro ao desativar curso:', error);
            this.showNotification('Erro ao desativar curso: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async ativarCurso(cursoId) {
        if (!this.verificarAutenticacao()) return;

        const curso = this.cursos.find(c => c.id === cursoId);
        if (!curso) {
            this.showNotification('Curso não encontrado', 'error');
            return;
        }

        if (!confirm(`Tem certeza que deseja ATIVAR o curso "${curso.nome}"?`)) {
            return;
        }

        try {
            this.showLoading(true);

            console.log(`▶️ Ativando curso ID: ${cursoId}`);

            const response = await fetch(`${this.API_BASE}/cursos/${cursoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    nome: curso.nome,
                    duracao: curso.total_periodos,
                    turno: curso.turno,
                    total_periodos: curso.total_periodos,
                    ativo: true
                })
            });

            console.log('📨 Status da ativação:', response.status);
            const responseData = await response.json();
            console.log('📨 Resposta da ativação:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || `Erro ${response.status}`);
            }

            await this.carregarTodosCursos();
            this.showNotification(responseData.message || 'Curso ativado com sucesso!', 'success');

        } catch (error) {
            console.error('❌ Erro ao ativar curso:', error);
            this.showNotification('Erro ao ativar curso: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async excluirPermanentemente(cursoId) {
        if (!this.verificarAutenticacao()) return;

        const curso = this.cursos.find(c => c.id === cursoId);
        if (!curso) {
            this.showNotification('Curso não encontrado', 'error');
            return;
        }

        // Verificar se o curso está ativo
        if (curso.ativo === 1) {
            this.showNotification('Não é possível excluir permanentemente um curso ativo. Desative o curso primeiro.', 'error');
            return;
        }

        if (!confirm(`⚠️ ATENÇÃO: Esta ação não pode ser desfeita!\n\nTem certeza que deseja EXCLUIR PERMANENTEMENTE o curso "${curso.nome}"?\n\nTodos os dados relacionados a este curso serão perdidos.`)) {
            return;
        }

        try {
            this.showLoading(true);

            console.log(`🗑️ Excluindo permanentemente curso ID: ${cursoId}`);

            // Usar a rota correta do routes
            const response = await fetch(`${this.API_BASE}/cursos/admin/excluir-permanentemente/${cursoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('📨 Status da exclusão:', response.status);
            const responseData = await response.json();
            console.log('📨 Resposta da exclusão:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || `Erro ${response.status}`);
            }

            await this.carregarTodosCursos();
            this.showNotification(responseData.message || 'Curso excluído permanentemente com sucesso!', 'success');

        } catch (error) {
            console.error('❌ Erro ao excluir curso:', error);
            this.showNotification('Erro ao excluir curso: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    verDisciplinas(cursoId) {
        const curso = this.cursos.find(c => c.id === cursoId);
        if (curso) {
            const status = curso.ativo === 1 ? 'Ativo' : 'Inativo';
            alert(`📚 Disciplinas vinculadas ao curso: ${curso.nome}\n📊 Status: ${status}\n\n🔧 Funcionalidade em desenvolvimento\n\nA vinculação de disciplinas aos cursos ainda está sendo implementada no banco de dados.`);
        }
    }

    editarCurso(cursoId) {
        this.abrirModalEditarCurso(cursoId);
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
        // Criar notificação simples sem alert()
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
            padding: 12px 20px;
            border-radius: 4px;
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
            z-index: 10000;
            font-size: 14px;
            max-width: 400px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remover após 4 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 4000);
    }

    // Métodos auxiliares para debug
    carregarCursos() {
        this.carregarTodosCursos();
    }

    exportarCursos() {
        const dataStr = JSON.stringify(this.cursos, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cursos_unimap.json';
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('Lista de cursos exportada com sucesso!', 'success');
    }
}

// Inicializar automaticamente
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 DOM carregado, inicializando Admin Cursos...');
    window.adminCursos = new AdminCursos();
    adminCursos.init();
});