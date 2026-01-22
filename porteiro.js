// ========== CONFIGURAÇÃO FIREBASE ==========
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set, push, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// SUBSTITUA PELAS SUAS CREDENCIAIS DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDvvW3MMxvVNb7PyhYbaR3mdsygfcy0Ghw",
    authDomain: "oraculo-v1.firebaseapp.com",
    projectId: "oraculo-v1",
    storageBucket: "oraculo-v1.firebasestorage.app",
    messagingSenderId: "1052381946693",
    appId: "1:1052381946693:web:50f57501024c28e8f3142c",
    measurementId: "G-K2DQPQEPSC"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const CONDOMINIO_ID = "cond_eucaliptos";
const LIMIAR_MS = 100;
const OFFLINE_SE_ULTIMO_UPDATE_MAIOR_QUE = 120;

// ========== VARIÁVEIS GLOBAIS ==========
let allDevices = {};
let setores = {};
let locais = {};
let equipamentos = {};
let subequipamentos = {};
let chamadosAbertos = {};

let setorSelecionado = null;
let localSelecionado = null;
let tipoAcessoSelecionado = null;
let equipamentoSelecionado = null;
let problemasReportados = [];
let cliqueDirectoNoLocal = false; // NOVO

// ========== PARTÍCULAS ==========
tsParticles.load("tsparticles", {
    particles: {
        number: { value: 60, density: { enable: true, value_area: 800 } },
        color: { value: "#7c8cff" },
        shape: { type: "circle" },
        opacity: { value: 0.3, random: true },
        size: { value: 3, random: true },
        line_linked: {
            enable: true,
            distance: 150,
            color: "#7c8cff",
            opacity: 0.2,
            width: 1
        },
        move: {
            enable: true,
            speed: 1,
            direction: "none",
            random: false,
            straight: false,
            out_mode: "out",
            bounce: false
        }
    },
    interactivity: {
        detect_on: "canvas",
        events: {
            onhover: { enable: true, mode: "grab" },
            resize: true
        },
        modes: {
            grab: { distance: 140, line_linked: { opacity: 0.5 } }
        }
    },
    retina_detect: true
});

// ========== FUNÇÕES AUXILIARES ==========
function secondsNow() {
    return Math.floor(Date.now() / 1000);
}

function computeEffectiveOnline(device) {
    const now = secondsNow();
    const lastUpdate = device.last_update || 0;
    const deltaSeconds = now - lastUpdate;

    if (deltaSeconds > OFFLINE_SE_ULTIMO_UPDATE_MAIOR_QUE) {
        return 'offline';
    }

    if (device.status === 'offline') {
        return 'offline';
    }

    const lat = parseFloat(device.lat) || 0;
    if (lat > LIMIAR_MS) {
        return 'alerta';
    }

    return 'online';
}

function mudarEtapa(etapaId) {
    document.querySelectorAll('.etapa').forEach(e => e.classList.remove('active'));
    document.getElementById(etapaId).classList.add('active');
}

// ========== LISTENERS FIREBASE ==========
function iniciarListeners() {
    onValue(ref(db, `monitoramento/${CONDOMINIO_ID}/stats/dispositivos`), (snapshot) => {
        allDevices = {};
        const data = snapshot.val();

        if (data) {
            Object.keys(data).forEach(key => {
                allDevices[key] = {
                    nome: key,
                    ...data[key]
                };
            });
        }

        atualizarResumo();
        renderSetores();
    });

    onValue(ref(db, `catalogo/${CONDOMINIO_ID}/setores`), (snapshot) => {
        setores = snapshot.val() || {};
        renderSetores();
    });

    onValue(ref(db, `catalogo/${CONDOMINIO_ID}/locais`), (snapshot) => {
        locais = snapshot.val() || {};
        renderSetores();
    });

    onValue(ref(db, `catalogo/${CONDOMINIO_ID}/equipamentos`), (snapshot) => {
        equipamentos = snapshot.val() || {};
        renderSetores();
    });

    onValue(ref(db, `catalogo/${CONDOMINIO_ID}/subequipamentos`), (snapshot) => {
        subequipamentos = snapshot.val() || {};
    });

    onValue(ref(db, `chamados/abertos`), (snapshot) => {
        chamadosAbertos = snapshot.val() || {};
        renderSetores();
    });
}

// ========== ATUALIZAR RESUMO ==========
function atualizarResumo() {
    let total = 0, online = 0, alerta = 0, offline = 0;

    Object.values(allDevices).forEach(device => {
        total++;
        const status = computeEffectiveOnline(device);
        if (status === 'online') online++;
        else if (status === 'alerta') alerta++;
        else offline++;
    });

    document.getElementById('total').textContent = total;
    document.getElementById('online').textContent = online;
    document.getElementById('alerta').textContent = alerta;
    document.getElementById('offline').textContent = offline;
}

// ========== RENDER SETORES (TELA INICIAL) ==========
function renderSetores() {
    const container = document.getElementById('lista-portarias');
    container.innerHTML = '';

    if (Object.keys(setores).length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#a0aec0;font-size:1.25rem;">Nenhum setor cadastrado</p>';
        return;
    }

    const locaisPorSetor = {};
    Object.entries(locais).forEach(([localId, local]) => {
        const setorId = local.setorId;
        if (!locaisPorSetor[setorId]) {
            locaisPorSetor[setorId] = [];
        }
        locaisPorSetor[setorId].push({ id: localId, ...local });
    });

    const equipamentosPorLocal = {};
    Object.values(equipamentos).forEach(equip => {
        const localId = equip.localId;
        if (!equipamentosPorLocal[localId]) {
            equipamentosPorLocal[localId] = [];
        }
        equipamentosPorLocal[localId].push(equip);
    });

    Object.entries(setores).forEach(([setorId, setor]) => {
        const locaisDoSetor = locaisPorSetor[setorId] || [];

        if (locaisDoSetor.length === 0) return;

        let statusGeral = 'online';
        let countOffline = 0;
        let temChamadoAberto = false;

        locaisDoSetor.forEach(local => {
            const equipsDoLocal = equipamentosPorLocal[local.id] || [];

            equipsDoLocal.forEach(equip => {
                const device = allDevices[equip.nome];
                if (device) {
                    const status = computeEffectiveOnline(device);
                    if (status === 'offline') {
                        countOffline++;
                        statusGeral = 'offline';
                    } else if (status === 'alerta' && statusGeral !== 'offline') {
                        statusGeral = 'alerta';
                    }
                }

                if (chamadosAbertos[equip.nome]) {
                    temChamadoAberto = true;
                }
            });
        });

        const card = document.createElement('div');
        card.className = `card-portaria ${statusGeral}`;

        let iconClass = 'fa-check-circle';
        let statusText = '✓ Tudo Funcionando';

        if (statusGeral === 'offline') {
            iconClass = 'fa-exclamation-triangle';
            statusText = `▲ ${countOffline} Equipamento${countOffline > 1 ? 's' : ''} Offline`;
        } else if (statusGeral === 'alerta') {
            iconClass = 'fa-exclamation-circle';
            statusText = '⚠ Alerta de Latência';
        }

        card.innerHTML = `
            <div class="card-header">
                <div class="status-icon">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div>
                    <div class="card-title">${setor.nome}</div>
                    <div class="card-status">${statusText}</div>
                    ${temChamadoAberto ? '<div class="card-chamado">Com chamado já Aberto</div>' : ''}
                </div>
            </div>
            ${statusGeral === 'online'
                ? `<button class="btn-card btn-ver-detalhes" onclick="selecionarSetor('${setorId}')">Ver Detalhes</button>`
                : `<button class="btn-card btn-abrir-chamado" onclick="selecionarSetor('${setorId}')"><i class="fa-solid fa-wrench"></i> Abrir Chamado</button>`
            }
        `;

        container.appendChild(card);
    });
}

// ========== SELECIONAR SETOR ==========
window.selecionarSetor = function (setorId) {
    setorSelecionado = setorId;
    cliqueDirectoNoLocal = false;
    renderLocais();
    mudarEtapa('etapa-tipo-acesso');

    document.querySelector('#etapa-tipo-acesso .etapa-title').textContent = 'Selecione o Local:';
};

// ========== RENDER LOCAIS ==========
function renderLocais() {
    const container = document.querySelector('#etapa-tipo-acesso .grid-acesso');
    container.innerHTML = '';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';

    const locaisDoSetor = Object.entries(locais).filter(([id, local]) => local.setorId === setorSelecionado);

    locaisDoSetor.forEach(([localId, local]) => {
        const btn = document.createElement('button');
        btn.className = 'btn-acesso';
        btn.onclick = () => selecionarLocal(localId);

        btn.innerHTML = `
            <i class="fa-solid fa-map-marker-alt"></i>
            <span>${local.nome}</span>
        `;

        container.appendChild(btn);
    });
}

// ========== SELECIONAR LOCAL ==========
window.selecionarLocal = function (localId) {
    localSelecionado = localId;

    // PULA TIPO DE ACESSO E VAI DIRETO PARA EQUIPAMENTOS
    renderEquipamentosDirecto();
    mudarEtapa('etapa-equipamentos');
};

// ========== RENDER EQUIPAMENTOS DIRETO ==========
function renderEquipamentosDirecto() {
    const etapaEquipamentos = document.getElementById('etapa-equipamentos');
    etapaEquipamentos.innerHTML = `
        <h2 class="etapa-title">Selecione o Equipamento:</h2>
        <div id="lista-equipamentos-dinamica" class="grid-equipamentos"></div>
    `;

    const container = document.getElementById('lista-equipamentos-dinamica');
    container.innerHTML = '';

    const equipsDoLocal = Object.values(equipamentos).filter(e => e.localId === localSelecionado);

    if (equipsDoLocal.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#a0aec0;">Nenhum equipamento cadastrado neste local</p>';
        return;
    }

    equipsDoLocal.forEach(equip => {
        const device = allDevices[equip.nome];
        const status = device ? computeEffectiveOnline(device) : 'offline';

        const card = document.createElement('div');
        card.className = `card-equipamento ${status}`;
        card.onclick = () => selecionarEquipamento(equip);

        const statusText = status === 'online' ? 'Online' : status === 'alerta' ? 'Alerta' : 'Offline';
        const statusColor = status === 'online' ? '#10b981' : status === 'alerta' ? '#facc15' : '#ef4444';

        const subs = Object.values(subequipamentos).filter(s => s.equipamentoId === Object.keys(equipamentos).find(k => equipamentos[k].nome === equip.nome));
        const controlaText = subs.length > 0 ? `Controla: ${subs.map(s => s.nome).join(', ')}` : 'Sem sub-equipamentos';

        card.innerHTML = `
            <div class="equip-nome">${equip.nome}</div>
            <div class="equip-status">Status: <span style="color:${statusColor};font-weight:700;">${statusText}</span></div>
            <div class="equip-controla">${controlaText}</div>
        `;

        container.appendChild(card);
    });
}

// ========== SELECIONAR EQUIPAMENTO ==========
function selecionarEquipamento(equip) {
    equipamentoSelecionado = equip;

    const etapaSubequipamentos = document.getElementById('etapa-subequipamentos');
    etapaSubequipamentos.innerHTML = `
        <h2 class="etapa-title">O Equipamento <span id="nome-equipamento-selecionado">(${equip.nome})</span></h2>
        <p class="etapa-subtitle">Aciona os seguintes dispositivos<br>Marque quais não estão respondendo:</p>
        <div id="lista-subequipamentos" class="lista-checks"></div>
        <button class="btn-primary" onclick="avancarParaReset()">Continuar</button>
    `;

    renderSubequipamentos();
    mudarEtapa('etapa-subequipamentos');
}

// ========== RENDER SUB-EQUIPAMENTOS ==========
function renderSubequipamentos() {
    const container = document.getElementById('lista-subequipamentos');
    if (!container) return;

    container.innerHTML = '';

    const equipId = Object.keys(equipamentos).find(k => equipamentos[k].nome === equipamentoSelecionado.nome);
    const subs = Object.entries(subequipamentos).filter(([id, s]) => s.equipamentoId === equipId);

    if (subs.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#a0aec0;">Nenhum sub-equipamento cadastrado</p>';
        return;
    }

    subs.forEach(([subId, sub]) => {
        const group = document.createElement('div');
        group.className = 'check-group';

        group.innerHTML = `
            <div class="check-group-title">${sub.nome}</div>
            <div class="check-item">
                <input type="checkbox" id="check-${subId}-1" value="${sub.nome}:Não responde">
                <label for="check-${subId}-1">Não responde</label>
            </div>
            <div class="check-item">
                <input type="checkbox" id="check-${subId}-2" value="${sub.nome}:Resposta lenta">
                <label for="check-${subId}-2">Resposta lenta</label>
            </div>
        `;

        container.appendChild(group);
    });
}

// ========== AVANÇAR PARA RESET ==========
window.avancarParaReset = function () {
    problemasReportados = [];

    document.querySelectorAll('#lista-subequipamentos input[type="checkbox"]:checked').forEach(checkbox => {
        problemasReportados.push(checkbox.value);
    });

    if (problemasReportados.length === 0) {
        alert('Selecione pelo menos um problema!');
        return;
    }

    mudarEtapa('etapa-reset');
};

// ========== RESET FUNCIONOU ==========
window.resetFuncionou = function () {
    alert('Ótimo! O equipamento voltou a funcionar.');
    voltarInicio();
};

// ========== ABRIR CHAMADO ==========
window.abrirChamado = async function () {
    try {
        const now = new Date();
        const dataHora = now.toLocaleString('pt-BR');
        const numeroChamado = Math.floor(10000 + Math.random() * 90000);

        const chamadoData = {
            numero: numeroChamado,
            equipamento: equipamentoSelecionado.nome,
            setor: setores[setorSelecionado].nome,
            local: locais[localSelecionado].nome,
            problemas: problemasReportados,
            dataHora: dataHora,
            timestamp: secondsNow(),
            resetRealizado: true,
            status: 'aberto'
        };

        await push(ref(db, `chamados/historico`), chamadoData);
        await set(ref(db, `chamados/abertos/${equipamentoSelecionado.nome}`), chamadoData);

        document.getElementById('chamado-data').textContent = dataHora;
        document.getElementById('chamado-numero').textContent = numeroChamado;
        document.getElementById('chamado-equipamento').textContent = equipamentoSelecionado.nome;
        document.getElementById('chamado-problema').textContent = problemasReportados.join(', ');

        mudarEtapa('etapa-sucesso');
    } catch (error) {
        alert('Erro ao abrir chamado: ' + error.message);
    }
};

// ========== VOLTAR INÍCIO ==========
window.voltarInicio = function () {
    location.reload();
};

// ========== INICIAR ==========
iniciarListeners();