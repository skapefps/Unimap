// mapa.js - Versão completa e corrigida
class MapaManager {
    constructor() {
        this.salas = [];
        this.salasPorPagina = 20;
        this.paginaAtual = 1;
        this.filtroTipo = 'todas';
        this.carregando = false;
        this.init();
    }

    async init() {
        console.log('🗺️ Inicializando MapaManager...');
        await this.carregarSalas();
        console.log('✅ MapaManager pronto!');
    }

    async carregarSalas() {
        if (this.carregando) {
            console.log('⏳ Já está carregando salas...');
            return;
        }
        
        this.carregando = true;
        
        try {
            console.log('📡 Carregando salas da API...');
            
            const response = await fetch('/api/salas');
            
            if (response.ok) {
                this.salas = await response.json();
                console.log(`✅ ${this.salas.length} salas carregadas do banco`);
                
                // ✅ DEBUG: Mostrar resumo das salas
                this.mostrarResumoSalas();
                
            } else {
                console.error('❌ Erro na API:', response.status);
                this.usarDadosExemplo();
            }
        } catch (error) {
            console.error('❌ Erro de conexão:', error);
            this.usarDadosExemplo();
        } finally {
            this.carregando = false;
        }
    }

    mostrarResumoSalas() {
        console.log('📊 RESUMO DAS SALAS CARREGADAS:');
        const blocos = ['A', 'B', 'C', 'D'];
        blocos.forEach(bloco => {
            const salasBloco = this.salas.filter(s => s.bloco === bloco);
            console.log(`   Bloco ${bloco}: ${salasBloco.length} salas`);
            
            // Mostrar por andar também
            const andares = [...new Set(salasBloco.map(s => s.andar))].sort();
            andares.forEach(andar => {
                const salasAndar = salasBloco.filter(s => s.andar === andar);
                if (salasAndar.length > 0) {
                    console.log(`     Andar ${andar}: ${salasAndar.length} salas`);
                }
            });
        });
    }

    usarDadosExemplo() {
        console.log('🔄 Usando dados de exemplo...');
        this.salas = [
            { id: 1, numero: '101', bloco: 'A', andar: 1, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor, Quadro', ativa: 1 },
            { id: 2, numero: '102', bloco: 'A', andar: 1, tipo: 'Sala de Aula', capacidade: 35, recursos: 'Projetor, Quadro', ativa: 1 },
            { id: 3, numero: '201', bloco: 'A', andar: 2, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor, Quadro, Ar-condicionado', ativa: 1 },
            { id: 4, numero: 'LAB1', bloco: 'B', andar: 1, tipo: 'Laboratório', capacidade: 25, recursos: 'Computadores, Projetor', ativa: 1 }
        ];
    }

    async mostrarSalas(bloco, andar) {
        console.log(`🏫 Buscando salas: Bloco ${bloco}, Andar ${andar}`);
        
        // Salvar andar selecionado para paginação
        sessionStorage.setItem('andarSelecionado', andar);
        
        const andarNumero = parseInt(andar);
        const salasFiltradas = this.salas.filter(sala => 
            sala.bloco === bloco && sala.andar === andarNumero
        );

        console.log(`🔍 Encontradas ${salasFiltradas.length} salas no Bloco ${bloco}, Andar ${andar}`);
        
        this.renderizarSalas(salasFiltradas, bloco, andar);
    }

    renderizarSalas(salas, bloco, andar) {
        const container = document.querySelector('#mapa-salas .salas-grid');
        const title = document.getElementById('sala-title');
        
        if (!container) {
            console.error('❌ Container .salas-grid não encontrado!');
            return;
        }

        if (!title) {
            console.error('❌ Elemento sala-title não encontrado!');
            return;
        }

        // ✅ ATUALIZAR TÍTULO COM CONTADOR
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

        // ✅ FILTROS RÁPIDOS
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

        // ✅ APLICAR FILTRO ATUAL
        let salasFiltradas = salas;
        if (this.filtroTipo !== 'todas') {
            salasFiltradas = salas.filter(s => s.tipo === this.filtroTipo);
        }

        // ✅ PAGINAÇÃO
        const inicio = (this.paginaAtual - 1) * this.salasPorPagina;
        const fim = inicio + this.salasPorPagina;
        const salasPagina = salasFiltradas.slice(inicio, fim);
        const totalPaginas = Math.ceil(salasFiltradas.length / this.salasPorPagina);

        // ✅ RENDERIZAR SALAS
        const salasHTML = salasPagina.map(sala => `
            <div class="sala-card" data-sala-id="${sala.id}">
                <h4>Sala ${sala.numero}</h4>
                <p><strong>Tipo:</strong> ${sala.tipo}</p>
                <p><strong>Capacidade:</strong> ${sala.capacidade} pessoas</p>
                <p><strong>Recursos:</strong> ${sala.recursos || 'Nenhum'}</p>
                <div class="sala-status disponivel">
                    🟢 Disponível
                </div>
            </div>
        `).join('');

        // ✅ PAGINAÇÃO (se necessário)
        let paginacaoHTML = '';
        if (totalPaginas > 1) {
            paginacaoHTML = this.criarPaginacao(totalPaginas);
        }

        container.innerHTML = filtrosHTML + salasHTML + paginacaoHTML;

        console.log(`✅ ${salasPagina.length} salas renderizadas (página ${this.paginaAtual} de ${totalPaginas})`);
    }

    filtrarSalas(tipo) {
        console.log(`🎯 Filtrando salas por: ${tipo}`);
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

    mudarPagina(novaPagina) {
        console.log(`📄 Mudando para página: ${novaPagina}`);
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

    // 🔧 MÉTODO PARA FORÇAR RECARREGAMENTO
    async forcarRecarregamento() {
        console.log('🔄 Forçando recarregamento de salas...');
        this.salas = [];
        this.paginaAtual = 1;
        this.filtroTipo = 'todas';
        await this.carregarSalas();
    }
}

// ✅ INICIALIZAR IMEDIATAMENTE
console.log('🚀 Criando MapaManager...');
const mapaManager = new MapaManager();

// 🔧 FUNÇÕES GLOBAIS PARA DEBUG E CONTROLE
window.debugMapa = function() {
    console.log('🔍 DEBUG MapaManager:');
    console.log('- Total de salas:', mapaManager.salas.length);
    console.log('- Carregando:', mapaManager.carregando);
    console.log('- Página atual:', mapaManager.paginaAtual);
    console.log('- Filtro atual:', mapaManager.filtroTipo);
    console.log('- Bloco selecionado:', sessionStorage.getItem('blocoSelecionado'));
    console.log('- Andar selecionado:', sessionStorage.getItem('andarSelecionado'));
};

window.recarregarMapa = function() {
    console.log('🔄 Recarregando mapa...');
    mapaManager.forcarRecarregamento();
};

window.testarBloco = function(bloco = 'A', andar = 1) {
    console.log(`🧪 Testando: Bloco ${bloco}, Andar ${andar}`);
    mapaManager.mostrarSalas(bloco, andar);
};

window.mapaManager = mapaManager; // ✅ Torna global para acesso fácil