// professor-mapa.js - Versão corrigida para as classes CSS do professor
class ProfessorMapaManager {
    constructor() {
        this.salas = [];
        this.blocoAtual = '';
        this.andarAtual = '';
        this.carregando = false;
        this.init();
    }

    async init() {
        console.log('🗺️ ProfessorMapaManager inicializando...');
        await this.carregarSalasDoBanco();
        this.configurarEventListeners();
        console.log('✅ ProfessorMapaManager pronto');
    }

    // 🔧 CARREGAR SALAS DO BANCO
    async carregarSalasDoBanco() {
        console.log('📦 Carregando salas do banco...');
        
        try {
            // Tenta carregar da API
            const response = await fetch('/api/salas');
            if (response.ok) {
                this.salas = await response.json();
                console.log(`✅ ${this.salas.length} salas carregadas da API`);
            } else {
                throw new Error('API não disponível');
            }
        } catch (error) {
            console.log('⚠️ Usando dados de exemplo (API indisponível)');
            this.usarDadosExemplo();
        }
        
        this.mostrarResumoSalas();
    }

    // 🔧 DADOS DE EXEMPLO
    usarDadosExemplo() {
        console.log('🔄 Usando dados de exemplo...');
        this.salas = [
            { id: 1, numero: '101', bloco: 'A', andar: 1, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor, Quadro', telefone: '(34) 3210-1001', email: 'blocoa@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 2, numero: '102', bloco: 'A', andar: 1, tipo: 'Sala de Aula', capacidade: 35, recursos: 'Projetor, Quadro', telefone: '(34) 3210-1002', email: 'blocoa@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 3, numero: '201', bloco: 'A', andar: 2, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor, Quadro, Ar-condicionado', telefone: '(34) 3210-1003', email: 'blocoa@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 4, numero: 'LAB1', bloco: 'B', andar: 1, tipo: 'Laboratório', capacidade: 25, recursos: 'Computadores, Projetor', telefone: '(34) 3210-2001', email: 'lab.b@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 5, numero: '202', bloco: 'A', andar: 2, tipo: 'Sala de Aula', capacidade: 30, recursos: 'Projetor', telefone: '(34) 3210-1004', email: 'blocoa@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 6, numero: '301', bloco: 'A', andar: 3, tipo: 'Auditório', capacidade: 100, recursos: 'Projetor, Som, Ar-condicionado', telefone: '(34) 3210-1005', email: 'auditorio.a@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 7, numero: '103', bloco: 'A', andar: 1, tipo: 'Laboratório', capacidade: 20, recursos: 'Computadores', telefone: '(34) 3210-1006', email: 'lab.a@unipam.edu.br', campus: 'Principal', ativa: 1 },
            // Blocos E até N
            { id: 8, numero: 'E101', bloco: 'E', andar: 1, tipo: 'Sala de Aula', capacidade: 40, recursos: 'Projetor, Ar-condicionado', telefone: '(34) 3210-5001', email: 'blocoe@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 9, numero: 'F101', bloco: 'F', andar: 1, tipo: 'Auditório', capacidade: 100, recursos: 'Projetor, Som, Ar-condicionado', telefone: '(34) 3210-6001', email: 'auditorio.f@unipam.edu.br', campus: 'Principal', ativa: 1 },
            { id: 10, numero: 'G101', bloco: 'G', andar: 1, tipo: 'Laboratório', capacidade: 30, recursos: 'Computadores, Software especializado', telefone: '(34) 3210-7001', email: 'lab.g@unipam.edu.br', campus: 'Principal', ativa: 1 }
        ];
    }

    // 🔧 MOSTRAR RESUMO DAS SALAS
    mostrarResumoSalas() {
        console.log('📊 RESUMO DAS SALAS CARREGADAS:');
        const blocos = [...new Set(this.salas.map(s => s.bloco))].sort();
        
        blocos.forEach(bloco => {
            const salasBloco = this.salas.filter(s => s.bloco === bloco);
            console.log(`   Bloco ${bloco}: ${salasBloco.length} salas`);
            
            const andares = [...new Set(salasBloco.map(s => s.andar))].sort();
            andares.forEach(andar => {
                const salasAndar = salasBloco.filter(s => s.andar === andar);
                if (salasAndar.length > 0) {
                    console.log(`     Andar ${andar}: ${salasAndar.length} salas`);
                }
            });
        });
    }

    // 🔧 CONFIGURAR EVENT LISTENERS
    configurarEventListeners() {
        document.addEventListener('click', (e) => {
            // Blocos - usando as classes corretas do professor
            const blocoCard = e.target.closest('.professor-bloco-card');
            if (blocoCard) {
                const bloco = this.getBlocoFromCard(blocoCard);
                if (bloco) {
                    this.showAndares(bloco);
                }
            }

            // Andares - usando as classes corretas do professor
            const andarCard = e.target.closest('.professor-andar-card');
            if (andarCard) {
                const andar = this.getAndarFromCard(andarCard);
                if (andar) {
                    this.showSalas(andar);
                }
            }

            // Salas - usando as classes corretas do professor
            const salaCard = e.target.closest('.professor-sala-card');
            if (salaCard) {
                const salaId = salaCard.getAttribute('data-sala-id');
                const salaNumero = salaCard.querySelector('h4')?.textContent.replace('Sala ', '');
                if (salaId && salaNumero) {
                    this.selecionarSala(salaId, salaNumero);
                }
            }
        });

        // Botões de voltar - usando as classes corretas
        const voltarBlocosBtn = document.querySelector('.professor-btn-voltar-andar');
        if (voltarBlocosBtn) {
            voltarBlocosBtn.addEventListener('click', () => this.voltarParaBlocos());
        }

        const voltarAndaresBtn = document.querySelector('.professor-btn-voltar-sala');
        if (voltarAndaresBtn) {
            voltarAndaresBtn.addEventListener('click', () => this.voltarParaAndares());
        }

        this.configurarFiltros();
    }

    // 🔧 OBTER BLOCO DO CARD
    getBlocoFromCard(blocoCard) {
        const h3 = blocoCard.querySelector('h3');
        if (h3) {
            return h3.textContent.replace('Bloco ', '').trim();
        }
        return null;
    }

    // 🔧 OBTER ANDAR DO CARD
    getAndarFromCard(andarCard) {
        const h4 = andarCard.querySelector('h4');
        if (h4) {
            return h4.textContent.trim();
        }
        return null;
    }

    // 🔧 MOSTRAR ANDARES DO BLOCO
    showAndares(bloco) {
        console.log('🏢 Mostrando andares do bloco:', bloco);
        this.blocoAtual = bloco;
        
        // Esconder blocos, mostrar andares - usando classes corretas
        const blocosGrid = document.querySelector('.professor-blocos-grid');
        if (blocosGrid) {
            blocosGrid.style.display = 'none';
        }
        
        const andaresSection = document.getElementById('andares-section');
        if (andaresSection) {
            andaresSection.style.display = 'block';
        }
        
        // Atualizar título
        const blocoTitle = document.getElementById('bloco-selecionado-title');
        if (blocoTitle) {
            blocoTitle.textContent = `Bloco ${bloco} - Selecione o Andar`;
        }
        
        // Carregar andares
        this.carregarAndares(bloco);
    }

    // 🔧 VOLTAR PARA BLOCOS
    voltarParaBlocos() {
        // Usando classes corretas
        const blocosGrid = document.querySelector('.professor-blocos-grid');
        const andaresSection = document.getElementById('andares-section');
        const salasSection = document.getElementById('salas-section');
        
        if (blocosGrid) blocosGrid.style.display = 'grid';
        if (andaresSection) andaresSection.style.display = 'none';
        if (salasSection) salasSection.style.display = 'none';
        
        this.blocoAtual = '';
        this.andarAtual = '';
    }

    // 🔧 VOLTAR PARA ANDARES
    voltarParaAndares() {
        const andaresSection = document.getElementById('andares-section');
        const salasSection = document.getElementById('salas-section');
        
        if (andaresSection) andaresSection.style.display = 'block';
        if (salasSection) salasSection.style.display = 'none';
        
        this.andarAtual = '';
    }

    // 🔧 CARREGAR ANDARES DO BLOCO
    carregarAndares(bloco) {
        const andaresGrid = document.getElementById('andares-grid');
        if (!andaresGrid) {
            console.error('❌ Elemento andares-grid não encontrado');
            return;
        }
        
        const salasBloco = this.salas.filter(sala => sala.bloco === bloco);
        const andares = [...new Set(salasBloco.map(sala => sala.andar))].sort();
        
        console.log(`📊 Andares encontrados para Bloco ${bloco}:`, andares);
        
        if (andares.length === 0) {
            andaresGrid.innerHTML = `
                <div class="professor-empty-state">
                    <i class="fas fa-door-closed"></i>
                    <p>Nenhuma sala cadastrada neste bloco</p>
                </div>
            `;
            return;
        }
        
        // Usando classes corretas do professor
        andaresGrid.innerHTML = andares.map(andar => {
            const salasAndar = salasBloco.filter(sala => sala.andar === andar);
            const andarTexto = andar === 0 ? 'Térreo' : `${andar}º Andar`;
            
            return `
                <div class="professor-andar-card" data-andar="${andar}">
                    <div class="professor-andar-icon">
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <h4>${andarTexto}</h4>
                    <p>Bloco ${bloco}</p>
                    <div class="professor-andar-stats">
                        <span class="professor-stat">${salasAndar.length} salas</span>
                        <span class="professor-status professor-disponivel">Disponível</span>
                    </div>
                </div>
            `;
        }).join('');

        console.log('✅ Andares carregados:', andares);
    }

    // 🔧 MOSTRAR SALAS DO ANDAR
    showSalas(andar) {
        console.log('🚪 Mostrando salas do andar:', andar);
        this.andarAtual = andar;
        
        // Esconder andares, mostrar salas
        const andaresSection = document.getElementById('andares-section');
        if (andaresSection) {
            andaresSection.style.display = 'none';
        }
        
        const salasSection = document.getElementById('salas-section');
        if (salasSection) {
            salasSection.style.display = 'block';
        }
        
        // Atualizar título
        const andarTitle = document.getElementById('andar-selecionado-title');
        if (andarTitle) {
            const andarTexto = andar === '0' ? 'Térreo' : `${andar}º Andar`;
            andarTitle.textContent = `Bloco ${this.blocoAtual} - ${andarTexto}`;
        }
        
        // Carregar salas
        this.carregarSalasMapa(this.blocoAtual, andar);
    }

    // 🔧 CARREGAR SALAS DO ANDAR
    async carregarSalasMapa(bloco, andar) {
        const salasGrid = document.getElementById('salas-grid');
        if (!salasGrid) {
            console.error('❌ Elemento salas-grid não encontrado');
            return;
        }
        
        try {
            const andarNumero = parseInt(andar);
            const salasFiltradas = this.salas.filter(sala => 
                sala.bloco === bloco && sala.andar === andarNumero
            );
            
            console.log(`📊 Salas encontradas: Bloco ${bloco}, Andar ${andar}:`, salasFiltradas.length);
            
            if (salasFiltradas.length === 0) {
                salasGrid.innerHTML = `
                    <div class="professor-empty-state">
                        <i class="fas fa-door-closed fa-3x"></i>
                        <p>Nenhuma sala encontrada neste andar</p>
                        <p class="professor-empty-subtitle">Bloco ${bloco}, ${andar}º Andar</p>
                    </div>
                `;
                return;
            }
            
            // Renderizar salas com classes corretas
            salasGrid.innerHTML = `
                <div class="professor-salas-filters">
                    <button class="professor-filter-btn professor-active" onclick="professorMapaManager.filtrarSalasPorTipo('todas')">
                        Todas (${salasFiltradas.length})
                    </button>
                    ${[...new Set(salasFiltradas.map(s => s.tipo))].map(tipo => {
                        const count = salasFiltradas.filter(s => s.tipo === tipo).length;
                        return `
                            <button class="professor-filter-btn" onclick="professorMapaManager.filtrarSalasPorTipo('${tipo}')">
                                ${tipo} (${count})
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="professor-salas-grid" id="salas-cards-container">
                    ${salasFiltradas.map(sala => `
                        <div class="professor-sala-card" data-sala-id="${sala.id}">
                            <div class="professor-sala-header">
                                <h4>Sala ${sala.numero}</h4>
                                <span class="professor-sala-status professor-disponivel">
                                    🟢 Disponível
                                </span>
                            </div>
                            <div class="professor-sala-info">
                                <p><strong>Tipo:</strong> ${sala.tipo}</p>
                                <p><strong>Capacidade:</strong> ${sala.capacidade} pessoas</p>
                                ${sala.campus ? `<p><strong>Campus:</strong> Campus ${sala.campus}</p>` : ''}
                                ${sala.recursos ? `<p><strong>Recursos:</strong> ${sala.recursos}</p>` : ''}
                                ${sala.telefone ? `<p><strong>Telefone:</strong> ${sala.telefone}</p>` : ''}
                                ${sala.email ? `<p><strong>Email:</strong> ${sala.email}</p>` : ''}
                            </div>
                            <div class="professor-sala-horario">
                                <p><strong>Status:</strong> Disponível para reserva</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            console.log('✅ Salas carregadas com CSS do professor:', salasFiltradas.length);
            
        } catch (error) {
            console.error('❌ Erro ao carregar salas:', error);
            // Fallback com dados mock
            this.carregarSalasMock(bloco, andar);
        }
    }

    // 🔧 FALLBACK - DADOS MOCK
    carregarSalasMock(bloco, andar) {
        const salasGrid = document.getElementById('salas-grid');
        const salas = this.gerarSalasMock(bloco, andar);
        
        salasGrid.innerHTML = `
            <div class="professor-salas-filters">
                <button class="professor-filter-btn professor-active" onclick="professorMapaManager.filtrarSalasPorTipo('todas')">
                    Todas (${salas.length})
                </button>
                ${[...new Set(salas.map(s => s.tipo))].map(tipo => {
                    const count = salas.filter(s => s.tipo === tipo).length;
                    return `
                        <button class="professor-filter-btn" onclick="professorMapaManager.filtrarSalasPorTipo('${tipo}')">
                            ${tipo} (${count})
                        </button>
                    `;
                }).join('')}
            </div>
            <div class="professor-salas-grid" id="salas-cards-container">
                ${salas.map(sala => `
                    <div class="professor-sala-card" data-sala-id="${sala.id}">
                        <div class="professor-sala-header">
                            <h4>Sala ${sala.numero}</h4>
                            <span class="professor-sala-status professor-disponivel">
                                🟢 Disponível
                            </span>
                        </div>
                        <div class="professor-sala-info">
                            <p><strong>Tipo:</strong> ${sala.tipo}</p>
                            <p><strong>Capacidade:</strong> ${sala.capacidade} pessoas</p>
                            <p><strong>Recursos:</strong> ${sala.recursos}</p>
                            <p><strong>Telefone:</strong> ${sala.telefone}</p>
                            <p><strong>Email:</strong> ${sala.email}</p>
                            <p><strong>Campus:</strong> ${sala.campus}</p>
                        </div>
                        <div class="professor-sala-horario">
                            <p><strong>Status:</strong> Disponível para reserva</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 🔧 GERAR DADOS MOCK
    gerarSalasMock(bloco, andar) {
        const tipos = ['Sala de Aula', 'Laboratório', 'Auditório', 'Sala de Reunião'];
        const recursos = ['Projetor, Ar-condicionado', 'Computadores, Internet', 'Lousa digital', 'Video conferência'];
        const telefones = ['(34) 3210-1001', '(34) 3210-1002', '(34) 3210-1003', '(34) 3210-1004'];
        const emails = [
            `bloco${bloco.toLowerCase()}@unipam.edu.br`,
            `lab.${bloco.toLowerCase()}@unipam.edu.br`,
            `admin.${bloco.toLowerCase()}@unipam.edu.br`
        ];
        
        let prefixo = '';
        if (andar === 'Térreo' || andar === 0) prefixo = '0';
        else if (andar === '1º Andar' || andar === 1) prefixo = '1';
        else if (andar === '2º Andar' || andar === 2) prefixo = '2';
        else if (andar === '3º Andar' || andar === 3) prefixo = '3';
        
        const salas = [];
        const numSalas = Math.floor(Math.random() * 8) + 4;
        
        for (let i = 1; i <= numSalas; i++) {
            const numeroSala = `${bloco}${prefixo}${i < 10 ? '0' + i : i}`;
            const tipo = tipos[Math.floor(Math.random() * tipos.length)];
            const ativa = Math.random() > 0.2; // 80% das salas ativas
            
            salas.push({
                id: `sala-${bloco}-${prefixo}${i}`,
                numero: numeroSala,
                tipo: tipo,
                capacidade: Math.floor(Math.random() * 40) + 20,
                recursos: recursos[Math.floor(Math.random() * recursos.length)],
                telefone: telefones[Math.floor(Math.random() * telefones.length)],
                email: emails[Math.floor(Math.random() * emails.length)],
                campus: 'Campus Principal',
                ativa: ativa
            });
        }
        
        return salas;
    }

    // 🔧 FILTRAR SALAS POR TIPO
    filtrarSalasPorTipo(tipo) {
        const container = document.getElementById('salas-cards-container');
        const filterBtns = document.querySelectorAll('.professor-filter-btn');
        
        if (!container) return;
        
        // Atualizar botões ativos
        filterBtns.forEach(btn => btn.classList.remove('professor-active'));
        event.target.classList.add('professor-active');
        
        const salas = container.querySelectorAll('.professor-sala-card');
        salas.forEach(sala => {
            const tipoSala = sala.querySelector('p:nth-child(1)')?.textContent.replace('Tipo: ', '');
            if (tipo === 'todas' || tipoSala === tipo) {
                sala.style.display = 'block';
            } else {
                sala.style.display = 'none';
            }
        });
    }

    // 🔧 CONFIGURAR FILTROS
    configurarFiltros() {
        const searchInput = document.getElementById('searchSalaMapa');
        const tipoSelect = document.getElementById('filterTipoSala');
        
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filtrarSalas());
        }
        
        if (tipoSelect) {
            tipoSelect.addEventListener('change', () => this.filtrarSalas());
        }
    }

    // 🔧 FILTRAR SALAS
    filtrarSalas() {
        const searchTerm = document.getElementById('searchSalaMapa')?.value.toLowerCase() || '';
        const tipoFiltro = document.getElementById('filterTipoSala')?.value || '';
        const salas = document.querySelectorAll('.professor-sala-card');
        
        salas.forEach(sala => {
            const numero = sala.querySelector('h4')?.textContent.toLowerCase() || '';
            const tipoElement = sala.querySelector('strong');
            const tipo = tipoElement ? tipoElement.nextSibling.textContent.toLowerCase() : '';
            const recursosElements = sala.querySelectorAll('p');
            const recursos = recursosElements.length > 2 ? recursosElements[2].textContent.toLowerCase() : '';
            
            const matchSearch = numero.includes(searchTerm) || recursos.includes(searchTerm);
            const matchTipo = !tipoFiltro || tipo.includes(tipoFiltro);
            
            sala.style.display = matchSearch && matchTipo ? 'block' : 'none';
        });
    }

    // 🔧 SELECIONAR SALA
    selecionarSala(salaId, salaNumero) {
        console.log('✅ Sala selecionada:', salaId, salaNumero);
        
        this.showNotification(`Sala ${salaNumero} selecionada - Você pode usar esta sala para criar uma aula`, 'info');
        
        setTimeout(() => {
            if (confirm(`Deseja usar a sala ${salaNumero} para criar uma nova aula?`)) {
                this.voltarParaBlocos();
                window.showSection('criar-aula');
                
                const salaSelect = document.getElementById('salaSelect');
                if (salaSelect) {
                    for (let option of salaSelect.options) {
                        if (option.textContent.includes(salaNumero)) {
                            salaSelect.value = option.value;
                            break;
                        }
                    }
                }
            }
        }, 1000);
    }

    // 🔧 MOSTRAR NOTIFICAÇÃO
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    // 🔧 FORÇAR RECARREGAMENTO
    async forcarRecarregamento() {
        console.log('🔄 Forçando recarregamento de salas...');
        this.salas = [];
        await this.carregarSalasDoBanco();
    }
}

// 🔧 INICIALIZAÇÃO GLOBAL
let professorMapaManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🗺️ Inicializando Mapa do Professor...');
    professorMapaManager = new ProfessorMapaManager();
    
    // Funções globais para compatibilidade
    window.showAndares = (bloco) => {
        if (professorMapaManager) {
            professorMapaManager.showAndares(bloco);
        }
    };
    
    window.showSalas = (andar) => {
        if (professorMapaManager) {
            professorMapaManager.showSalas(andar);
        }
    };
    
    window.voltarParaBlocos = () => {
        if (professorMapaManager) {
            professorMapaManager.voltarParaBlocos();
        }
    };
    
    window.voltarParaAndares = () => {
        if (professorMapaManager) {
            professorMapaManager.voltarParaAndares();
        }
    };
    
    window.selecionarSala = (salaId, salaNumero) => {
        if (professorMapaManager) {
            professorMapaManager.selecionarSala(salaId, salaNumero);
        }
    };

    // Funções de debug
    window.debugProfessorMapa = function() {
        if (!professorMapaManager) {
            console.log('❌ ProfessorMapaManager não inicializado');
            return;
        }
        
        console.log('🔍 DEBUG ProfessorMapaManager:');
        console.log('- Total de salas:', professorMapaManager.salas.length);
        console.log('- Carregando:', professorMapaManager.carregando);
        console.log('- Bloco atual:', professorMapaManager.blocoAtual);
        console.log('- Andar atual:', professorMapaManager.andarAtual);
        console.log('- Salas carregadas:', professorMapaManager.salas);
    };

    window.recarregarProfessorMapa = function() {
        if (!professorMapaManager) {
            console.log('❌ ProfessorMapaManager não inicializado');
            return;
        }
        console.log('🔄 Recarregando mapa do professor...');
        professorMapaManager.forcarRecarregamento();
    };

    window.testarBlocoProfessor = function(bloco = 'A', andar = 1) {
        if (!professorMapaManager) {
            console.log('❌ ProfessorMapaManager não inicializado');
            return;
        }
        console.log(`🧪 Testando: Bloco ${bloco}, Andar ${andar}`);
        professorMapaManager.showAndares(bloco);
        setTimeout(() => {
            professorMapaManager.showSalas(`${andar}`);
        }, 500);
    };
});