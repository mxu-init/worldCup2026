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
    grupos["THIRD_PLACE"] = []; // partido por el tercer puesto, aparte del árbol principal

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

function createThirdPlaceHTML(partido) {
    return `
        <div class="bracket-third-place">
            <h3 class="bracket-round-title">Tercer y cuarto puesto</h3>
            ${createMatchHTML(partido)}
        </div>
    `;
}

function displayBracket(grupos) {
    const footballSection = document.getElementById('footballSection');

    // Solo mostramos las rondas que realmente tienen partidos.
    // Si una ronda esperada aparece vacía, revisa el console.log de "Etapas recibidas"
    const rondasConPartidos = RONDAS.filter(ronda => grupos[ronda.key].length > 0);

    const roundsHTML = rondasConPartidos
        .map(ronda => createRoundHTML(ronda, grupos[ronda.key]))
        .join('');

    const tercerPuestoHTML = grupos.THIRD_PLACE.length > 0
        ? createThirdPlaceHTML(grupos.THIRD_PLACE[0])
        : '';

    footballSection.innerHTML = `
        <div class="bracket-wrapper">
            <div class="bracket" id="bracket">
                ${roundsHTML}
                <svg id="bracketLines" class="bracket-lines"></svg>
            </div>
            ${tercerPuestoHTML}
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

// Suma la altura REAL de cada partido de la primera ronda (por si algún
// nombre ocupa dos líneas) para que el bracket tenga sitio de sobra
function ajustarAlturaBracket() {
    const bracket = document.getElementById('bracket');
    const primeraRonda = bracket.querySelector('.bracket-round-matches');

    if (!primeraRonda) return;

    const partidos = primeraRonda.querySelectorAll('.bracket-match');
    if (partidos.length === 0) return;

    let alturaTotal = 0;
    partidos.forEach(partido => {
        alturaTotal += partido.getBoundingClientRect().height + 16;
    });

    bracket.style.minHeight = `${alturaTotal}px`;
}

// Dibuja las líneas que conectan cada partido con el siguiente,
// midiendo la posición real de cada tarjeta en pantalla
function dibujarConectores() {
    const svg = document.getElementById('bracketLines');
    const bracket = document.getElementById('bracket');

    if (!svg || !bracket) return;

    svg.innerHTML = '';

    const bracketRect = bracket.getBoundingClientRect();
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

            const equipos = [...partido.querySelectorAll('.bracket-team')].map(e => e.dataset.team);
            linea.dataset.equipos = equipos.join('|');

            svg.appendChild(linea);
        });
    }
}

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
        // DIAGNÓSTICO: compara esto con las claves de RONDAS más arriba.
        // Si ves un nombre distinto (ej. "ROUND_OF_16" en vez de "LAST_16"),
        // cambia esa clave en el array RONDAS.
        const etapasEncontradas = [...new Set(footballData.matches.map(p => p.stage))];
        console.log('Etapas recibidas de la API:', etapasEncontradas);

        const grupos = agruparPorRonda(footballData.matches);
        displayBracket(grupos);
    } else {
        console.error('No se han encontrado datos de los partidos');
    }
}

iniciarBracket();