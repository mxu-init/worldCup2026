const ESTAMOS_EN_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_KEY = "4ae71e0fd15c4aa88600049cc862830a"; // solo se usa en local, ver fetchFootballJson

// Orden de las rondas eliminatorias, tal y como las nombra la API
const RONDAS = [
    { key: "LAST_32", nombre: "Dieciseisavos" },
    { key: "LAST_16", nombre: "Octavos" },
    { key: "QUARTER_FINALS", nombre: "Cuartos" },
    { key: "SEMI_FINALS", nombre: "Semifinal" },
    { key: "FINAL", nombre: "Final" },
];

async function fetchFootballJson () {
    try{
        const path = "competitions/WC/matches";

        let requestURL;
        let opciones = { method: "GET" };

        if (ESTAMOS_EN_LOCAL) {
            const apiURL = "https://api.football-data.org/v4/" + path;
            requestURL = "https://corsproxy.io/?url=" + encodeURIComponent(apiURL);
            opciones.headers = { "X-Auth-Token": API_KEY };
        } else {
            requestURL = `/api/football-proxy?path=${encodeURIComponent(path)}`;
        }

        const response = await fetch(requestURL, opciones);

        if (!response.ok) {
            throw new Error('Error de la solicitud: ' + response.status);
        }
        return response.json();
    }
    catch (error) {
        console.error('Error al obtener los datos: ', error);
        return null;    
    }
}

// Agrupa los partidos por ronda. Dentro de cada ronda los ordena por id,
// asumiendo que la API los devuelve en orden de enfrentamiento
function agruparPorRonda(partidos) {
    const grupos = {};

    RONDAS.forEach(ronda => grupos[ronda.key] = []);

    partidos.forEach(partido => {
        if (grupos[partido.stage]) {
            grupos[partido.stage].push(partido);
        }
    });

    Object.keys(grupos).forEach(key => {
        grupos[key].sort((a, b) => a.id - b.id);
    });

    return grupos;
}

function nombreEquipo(equipo) {
    return equipo?.name ?? "Por definir";
}

function createMatchHTML(partido) {
    const local = nombreEquipo(partido.homeTeam);
    const visitante = nombreEquipo(partido.awayTeam);
    const golesLocal = partido.score?.fullTime?.home ?? "";
    const golesVisitante = partido.score?.fullTime?.away ?? "";

    return `
        <div class="bracket-match" data-match-id="${partido.id}">
            <div class="bracket-team" data-team="${local}">
                <span class="bracket-team-name">${local}</span>
                <span class="bracket-team-score">${golesLocal}</span>
            </div>
            <div class="bracket-team" data-team="${visitante}">
                <span class="bracket-team-name">${visitante}</span>
                <span class="bracket-team-score">${golesVisitante}</span>
            </div>
        </div>
    `;
}

function createRoundHTML(ronda, partidos) {
    const matches = partidos.map(createMatchHTML).join('');

    return `
        <div class="bracket-round" data-round="${ronda.key}">
            <h3 class="bracket-round-title">${ronda.nombre}</h3>
            <div class="bracket-round-matches">
                ${matches}
            </div>
        </div>
    `;
}

function displayBracket(grupos) {
    const footballSection = document.getElementById('footballSection');

    const roundsHTML = RONDAS
        .map(ronda => createRoundHTML(ronda, grupos[ronda.key]))
        .join('');

    footballSection.innerHTML = `
        <div class="bracket-wrapper">
            <div class="bracket" id="bracket">
                ${roundsHTML}
                <svg id="bracketLines" class="bracket-lines"></svg>
            </div>
        </div>
    `;

    ajustarAlturaBracket();
    dibujarConectores();
    activarHover();

    window.addEventListener('resize', () => {
        ajustarAlturaBracket();
        dibujarConectores();
    });
}

// Calcula cuánto espacio vertical necesita el bracket entero,
// según la altura real de un partido y cuántos hay en la primera ronda
function ajustarAlturaBracket() {
    const bracket = document.getElementById('bracket');
    const primeraRonda = bracket.querySelector('.bracket-round-matches');

    if (!primeraRonda) return;

    const partidos = primeraRonda.querySelectorAll('.bracket-match');
    if (partidos.length === 0) return;

    const alturaPartido = partidos[0].getBoundingClientRect().height;
    bracket.style.minHeight = `${partidos.length * alturaPartido * 1.8}px`;
}

// Dibuja las líneas que conectan cada partido con el siguiente,
// midiendo la posición real de cada tarjeta en pantalla
function dibujarConectores() {
    const svg = document.getElementById('bracketLines');
    const bracket = document.getElementById('bracket');

    if (!svg || !bracket) return;

    svg.innerHTML = '';

    const bracketRect = bracket.getBoundingClientRect();
    svg.setAttribute('width', bracketRect.width);
    svg.setAttribute('height', bracketRect.height);

    const rounds = [...bracket.querySelectorAll('.bracket-round-matches')];

    for (let r = 0; r < rounds.length - 1; r++) {
        const partidosActuales = [...rounds[r].querySelectorAll('.bracket-match')];
        const partidosSiguientes = [...rounds[r + 1].querySelectorAll('.bracket-match')];

        partidosActuales.forEach((partido, indice) => {
            const partidoSiguiente = partidosSiguientes[Math.floor(indice / 2)];
            if (!partidoSiguiente) return;

            const origenRect = partido.getBoundingClientRect();
            const destinoRect = partidoSiguiente.getBoundingClientRect();

            const x1 = origenRect.right - bracketRect.left;
            const y1 = origenRect.top + origenRect.height / 2 - bracketRect.top;
            const x2 = destinoRect.left - bracketRect.left;
            const y2 = destinoRect.top + destinoRect.height / 2 - bracketRect.top;
            const xMedio = (x1 + x2) / 2;

            const linea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            linea.setAttribute('d', `M ${x1} ${y1} H ${xMedio} V ${y2} H ${x2}`);
            linea.classList.add('bracket-connector');

            // Guardamos qué equipos pasan por esta línea, para poder iluminarla al hacer hover
            const equipos = [...partido.querySelectorAll('.bracket-team')].map(e => e.dataset.team);
            linea.dataset.equipos = equipos.join('|');

            svg.appendChild(linea);
        });
    }
}

// Al pasar el ratón sobre un equipo, buscamos todas las líneas
// donde aparece ese equipo y las marcamos como activas
function activarHover() {
    document.querySelectorAll('.bracket-team').forEach(equipoEl => {
        equipoEl.addEventListener('mouseenter', () => {
            const nombre = equipoEl.dataset.team;
            if (!nombre || nombre === "Por definir") return;

            document.querySelectorAll(`.bracket-team[data-team="${CSS.escape(nombre)}"]`)
                .forEach(el => el.classList.add('bracket-team-active'));

            document.querySelectorAll('.bracket-connector').forEach(linea => {
                if (linea.dataset.equipos.split('|').includes(nombre)) {
                    linea.classList.add('bracket-connector-active');
                }
            });
        });

        equipoEl.addEventListener('mouseleave', () => {
            document.querySelectorAll('.bracket-team-active')
                .forEach(el => el.classList.remove('bracket-team-active'));
            document.querySelectorAll('.bracket-connector-active')
                .forEach(el => el.classList.remove('bracket-connector-active'));
        });
    });
}

async function iniciarBracket() {
    const footballData = await fetchFootballJson();

    if (footballData && footballData.matches) {
        const grupos = agruparPorRonda(footballData.matches);
        displayBracket(grupos);
    } else {
        console.error('No se han encontrado datos de los partidos');
    }
}

iniciarBracket();