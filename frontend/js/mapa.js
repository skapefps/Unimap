// mapa.js - Versão corrigida com autenticação
class MapaManager {
    constructor() {
        this.salas = [];
        this.salasPorPagina = 20;
        this.aulasAtivas = [];
        this.paginaAtual = 1;
        this.filtroTipo = 'todas';
        this.carregando = false;
        this.init();
    }

    async init() {
        console.log(' Inicializando MapaManager...');
        await this.carregarSalas();
        console.log(' MapaManager pronto!');
    }

    async carregarSalas() {
        if (this.carregando) {
            console.log('⏳ Já está carregando salas...');
            return;
        }
        
        this.carregando = true;
        
        try {
            console.log(' Carregando salas da API...');
            
 // USAR A NOVA API COM AUTENTICAÇÃO
            const result = await api.getSalas();
            
            if (result && result.success) {
                this.salas = result.data;
                console.log(` ${this.salas.length} salas carregadas do banco`);
                
                this.mostrarResumoSalas();
                
            } else {
                console.error(' Erro ao carregar salas:', result?.error);
                this.usarDadosExemplo();
            }
        } catch (error) {
            console.error(' Erro de conexão:', error);
            this.usarDadosExemplo();
        } finally {
            this.carregando = false;
        }
    }

    mostrarResumoSalas() {
        console.log(' RESUMO DAS SALAS CARREGADAS:');
        const blocos = [...new Set(this.salas.map(s => s.bloco))].sort();
        blocos.forEach(bloco => {
            const salasBloco = this.salas.filter(s => s.bloco === bloco);
            console.log(`Bloco ${bloco}: ${salasBloco.length} salas`);
            
            const andares = [...new Set(salasBloco.map(s => s.andar))].sort();
            andares.forEach(andar => {
                const salasAndar = salasBloco.filter(s => s.andar === andar);
                if (salasAndar.length > 0) {
                    console.log(`Andar ${andar}: ${salasAndar.length} salas`);
                }
            });
        });
    }

    usarDadosExemplo() {
        console.log(' Usando dados de exemplo...');
        this.salas = [
            { id: 1, numero: '101', bloco: 'A', andar: 1, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor, Quadro', ativa: 1 },
            { id: 2, numero: '102', bloco: 'A', andar: 1, tipo: 'Sala de Aula', capacidade: 35, recursos: 'Projetor, Quadro', ativa: 1 },
            { id: 3, numero: '201', bloco: 'A', andar: 2, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor, Quadro, Ar-condicionado', ativa: 1 },
            { id: 4, numero: 'LAB1', bloco: 'B', andar: 1, tipo: 'Laboratório', capacidade: 25, recursos: 'Computadores, Projetor', ativa: 1 }
        ];
    }

    async mostrarSalas(bloco, andar) {
        console.log(` Buscando salas: Bloco ${bloco}, Andar ${andar}`);
        
 // Salvar andar selecionado para paginação
        sessionStorage.setItem('andarSelecionado', andar);
        
        const andarNumero = parseInt(andar);
        const salasFiltradas = this.salas.filter(sala => 
            sala.bloco === bloco && sala.andar === andarNumero
        );

        console.log(` Encontradas ${salasFiltradas.length} salas no Bloco ${bloco}, Andar ${andar}`);
        
        this.renderizarSalas(salasFiltradas, bloco, andar);
    }
    verificarStatusSala(sala) {
 // ativa = 1 → Disponível | ativa = 0 → Ocupada/Indisponível
    const estaDisponivel = sala.ativa === 1;
    
    if (!estaDisponivel) {
        return {
            professor: 'Sala Indisponível',
            disciplina: 'Manutenção/Reforma', 
            turma: 'N/A',
            horario_inicio: '--:--',
            horario_fim: '--:--',
            motivo: 'Em manutenção ou reservada'
        };
    }
    
    return null;
}

    renderizarSalas(salas, bloco, andar) {
    const container = document.querySelector('#mapa-salas .salas-grid');
    const title = document.getElementById('sala-title');
    
    if (!container) {
        console.error(' Container .salas-grid não encontrado!');
        return;
    }

    if (!title) {
        console.error(' Elemento sala-title não encontrado!');
        return;
    }

 // ATUALIZAR TÍTULO COM CONTADOR
    title.innerHTML = `
        Bloco ${bloco} > ${andar}° Andar 
        <span class="salas-counter">${salas.length} salas</span>
    `;

    if (salas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-door-closed fa-3x"></i>
                <p>Nenhuma sala encontrada neste andar</p>
                <p class="empty-subtitle">Bloco ${bloco}, ${andar}° Andar</p>
            </div>
        `;
        return;
    }

 // FILTROS RÁPIDOS
    const tipos = [...new Set(salas.map(s => s.tipo))];
    const filtrosHTML = `
        <div class="salas-filters">
            <button class="filter-btn ${this.filtroTipo === 'todas' ? 'active' : ''}" 
                    onclick="mapaManager.filtrarSalas('todas')">
                Todas (${salas.length})
            </button>
            ${tipos.map(tipo => {
                const count = salas.filter(s => s.tipo === tipo).length;
                return `
                    <button class="filter-btn ${this.filtroTipo === tipo ? 'active' : ''}" 
                            onclick="mapaManager.filtrarSalas('${tipo}')">
                        ${tipo} (${count})
                    </button>
                `;
            }).join('')}
        </div>
    `;

 // APLICAR FILTRO ATUAL
    let salasFiltradas = salas;
    if (this.filtroTipo !== 'todas') {
        salasFiltradas = salas.filter(s => s.tipo === this.filtroTipo);
    }

 // PAGINAÇÃO
    const inicio = (this.paginaAtual - 1) * this.salasPorPagina;
    const fim = inicio + this.salasPorPagina;
    const salasPagina = salasFiltradas.slice(inicio, fim); //  AGORA ESTÁ DEFINIDA
    const totalPaginas = Math.ceil(salasFiltradas.length / this.salasPorPagina);

 // RENDERIZAR SALAS COM STATUS DE OCUPAÇÃO
    const salasHTML = salasPagina.map(sala => {
 // VERIFICAR STATUS PELA COLUNA 'ativa'
        const salaOcupada = this.verificarStatusSala(sala);
        const estaDisponivel = sala.ativa === 1;
        
 // CORES: Vermelho se inativa, Verde se ativa
        const bordaCor = estaDisponivel ? '#27ae60' : '#e74c3c';
        const statusClasse = estaDisponivel ? 'disponivel' : 'ocupada';
        const statusTexto = estaDisponivel ? ' Disponível' : ' Indisponível';

        return `
            <div class="sala-card" data-sala-id="${sala.id}" 
                 style="border-left-color: ${bordaCor}">
                <h4>Sala ${sala.numero}</h4>
                <p><strong>Tipo:</strong> ${sala.tipo}</p>
                <p><strong>Capacidade:</strong> ${sala.capacidade} pessoas</p>
                
                ${sala.recursos ? `<p><strong>Recursos:</strong> ${sala.recursos}</p>` : ''}
                
                <!--  EXIBIR MOTIVO SE ESTIVER INDISPONÍVEL -->
                ${!estaDisponivel ? `
                    <div class="sala-aula-info">
                        <p style="margin: 0 0 5px 0; font-weight: 600; color: #c0392b;"> Sala Indisponível</p>
                        <p style="margin: 2px 0; font-size: 0.9em;"><strong>Motivo:</strong> Em manutenção ou reservada</p>
                        <p style="margin: 2px 0; font-size: 0.9em;"><strong>Status:</strong> Não disponível para aulas</p>
                    </div>
                ` : `
                    <div class="sala-aula-info" style="background: #e8f5e8; border-left-color: #27ae60;">
                        <p style="margin: 0 0 5px 0; font-weight: 600; color: #27ae60;"> Sala Disponível</p>
                        <p style="margin: 2px 0; font-size: 0.9em;"><strong>Status:</strong> Pronta para uso</p>
                        <p style="margin: 2px 0; font-size: 0.9em;"><strong>Disponibilidade:</strong> Livre para reserva</p>
                    </div>
                `}
                
                <div class="sala-status ${statusClasse}">
                    ${statusTexto}
                </div>
            </div>
        `;
    }).join('');
 // PAGINAÇÃO (se necessário)
        let paginacaoHTML = '';
        if (totalPaginas > 1) {
            paginacaoHTML = this.criarPaginacao(totalPaginas);
        }

        container.innerHTML = filtrosHTML + salasHTML + paginacaoHTML;

        console.log(` ${salasPagina.length} salas renderizadas (página ${this.paginaAtual} de ${totalPaginas})`);
    }

    filtrarSalas(tipo) {
        console.log(` Filtrando salas por: ${tipo}`);
        this.filtroTipo = tipo;
        this.paginaAtual = 1;
        
        const bloco = sessionStorage.getItem('blocoSelecionado') || 'A';
        const andar = sessionStorage.getItem('andarSelecionado') || 1;
        
        this.mostrarSalas(bloco, andar);
    }

    criarPaginacao(totalPaginas) {
        return `
            <div class="paginacao">
                <button ${this.paginaAtual === 1 ? 'disabled' : ''} 
                        onclick="mapaManager.mudarPagina(${this.paginaAtual - 1})"
                        class="btn-pagina">
                    ← Anterior
                </button>
                
                <span class="info-pagina">
                    Página ${this.paginaAtual} de ${totalPaginas}
                    (${this.salasPorPagina} salas por página)
                </span>
                
                <button ${this.paginaAtual === totalPaginas ? 'disabled' : ''} 
                        onclick="mapaManager.mudarPagina(${this.paginaAtual + 1})"
                        class="btn-pagina">
                    Próxima →
                </button>
            </div>
        `;
    }
    
    verificarOcupacaoSala(sala) {
    const agora = new Date();
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + 
                     agora.getMinutes().toString().padStart(2, '0');
    
    const aulaAtiva = this.aulasAtivas.find(aula => 
        aula.sala_id === sala.id && 
        aula.bloco === sala.bloco &&
        aula.andar === sala.andar &&
        horaAtual >= aula.horario_inicio && 
        horaAtual <= aula.horario_fim
    );

    return aulaAtiva || null;
}
usarAulasAtivasExemplo() {
    console.log(' Usando dados de exemplo para aulas ativas...');
    this.aulasAtivas = [
        {
            id: 1,
            sala_id: 1,
            sala_numero: '101',
            bloco: 'A',
            andar: 1,
            professor: 'Dr. Carlos Silva',
            disciplina: 'Algoritmos e Programação',
            horario_inicio: '08:00',
            horario_fim: '10:00',
            turma: 'SI3N'
        }
 // ... mais aulas de exemplo
    ];
}
// NOVO MÉTODO: Carregar aulas ativas
async carregarAulasAtivas() {
    try {
        console.log(' Carregando aulas ativas...');
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/aulas/ativas', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (response.ok) {
            this.aulasAtivas = await response.json();
            console.log(` ${this.aulasAtivas.length} aulas ativas carregadas`);
        } else {
            this.usarAulasAtivasExemplo();
        }
    } catch (error) {
        console.error(' Erro ao carregar aulas ativas:', error);
        this.usarAulasAtivasExemplo();
    }
}


    mudarPagina(novaPagina) {
        console.log(` Mudando para página: ${novaPagina}`);
        this.paginaAtual = novaPagina;
        
        const bloco = sessionStorage.getItem('blocoSelecionado') || 'A';
        const andar = sessionStorage.getItem('andarSelecionado') || 1;
        
        this.mostrarSalas(bloco, andar);
        
 // Scroll para o topo
        const container = document.querySelector('#mapa-salas .salas-grid');
        if (container) {
            container.scrollTop = 0;
        }
    }

 // MÉTODO PARA FORÇAR RECARREGAMENTO
    async forcarRecarregamento() {
        console.log(' Forçando recarregamento de salas...');
        this.salas = [];
        this.paginaAtual = 1;
        this.filtroTipo = 'todas';
        await this.carregarSalas();
    }
}

// INICIALIZAR IMEDIATAMENTE
console.log(' Criando MapaManager...');
const mapaManager = new MapaManager();

// FUNÇÕES GLOBAIS PARA DEBUG E CONTROLE
window.debugMapa = function() {
    console.log(' DEBUG MapaManager:');
    console.log('- Total de salas:', mapaManager.salas.length);
    console.log('- Carregando:', mapaManager.carregando);
    console.log('- Página atual:', mapaManager.paginaAtual);
    console.log('- Filtro atual:', mapaManager.filtroTipo);
    console.log('- Bloco selecionado:', sessionStorage.getItem('blocoSelecionado'));
    console.log('- Andar selecionado:', sessionStorage.getItem('andarSelecionado'));
    
 // VERIFICAR AUTENTICAÇÃO
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    console.log('- Token presente:', !!token);
    console.log('- User data presente:', !!userData);
    if (userData) {
        const user = JSON.parse(userData);
        console.log('- Usuário:', user.nome, '- Tipo:', user.tipo);
    }
};

window.recarregarMapa = function() {
    console.log(' Recarregando mapa...');
    mapaManager.forcarRecarregamento();
};

window.testarBloco = function(bloco = 'A', andar = 1) {
    console.log(` Testando: Bloco ${bloco}, Andar ${andar}`);
    mapaManager.mostrarSalas(bloco, andar);
};

window.mapaManager = mapaManager;