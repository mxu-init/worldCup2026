const ESTAMOS_EN_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_KEY = "4ae71e0fd15c4aa88600049cc862830a"; // solo se usa en local, ver fetchFootballJson

// Orden de las rondas eliminatorias, tal y como las nombra la API.
// tituloPorPartido: true -> el título sale encima de cada enfrentamiento
// en vez de una sola vez arriba de toda la columna (para rondas con pocos partidos)
const RONDAS = [
    { key: "LAST_32", nombre: "Dieciseisavos" },
    { key: "LAST_16", nombre: "Octavos" },
    { key: "QUARTER_FINALS", nombre: "Cuartos" },
    { key: "SEMI_FINALS", nombre: "Semifinal", tituloPorPartido: true },
    { key: "FINAL", nombre: "Final", tituloPorPartido: true },
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

// Agrupa los partidos por ronda. El orden inicial (por id) solo importa
// de verdad para la primera ronda; el resto se reordena después
function agruparPorRonda(partidos) {
    const grupos = {};

    RONDAS.forEach(ronda => grupos[ronda.key] = []);
    grupos["THIRD_PLACE"] = [];

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

// Reordena cada ronda para que el orden visual (de arriba a abajo)
// coincida con el orden real de sus enfrentamientos anteriores.
// Esto es solo estético: evita que las líneas se crucen de forma rara.
// La conexión REAL (quién enlaza con quién) la decide dibujarConectores,
// comparando nombres de equipo, no posiciones.
function ordenarPorEmparejamiento(grupos) {
    const rondasConDatos = RONDAS.filter(ronda => grupos[ronda.key].length > 0);

    for (let i = 1; i < rondasConDatos.length; i++) {
        const rondaAnterior = grupos[rondasConDatos[i - 1].key];
        const claveActual = rondasConDatos[i].key;
        const rondaActual = grupos[claveActual];

        const ordenados = [];

        rondaAnterior.forEach(partidoAnterior => {
            const equipos = [partidoAnterior.homeTeam?.name, partidoAnterior.awayTeam?.name]
                .filter(Boolean);

            const siguiente = rondaActual.find(p =>
                !ordenados.includes(p) &&
                equipos.some(nombre => p.homeTeam?.name === nombre || p.awayTeam?.name === nombre)
            );

            if (siguiente) ordenados.push(siguiente);
        });

        // Cualquier partido que no hayamos podido emparejar (equipos aún
        // no definidos) se añade al final, sin descartarlo
        rondaActual.forEach(p => {
            if (!ordenados.includes(p)) ordenados.push(p);
        });

        grupos[claveActual] = ordenados;
    }

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

function createRoundHTML(ronda, partidos, extraHTML = '') {
    if (ronda.tituloPorPartido) {
        const matches = partidos.map(partido => `
            <div class="bracket-match-block">
                <h4 class="bracket-match-title">${ronda.nombre}</h4>
                ${createMatchHTML(partido)}
            </div>
        `).join('');

        return `
            <div class="bracket-round" data-round="${ronda.key}">
                <div class="bracket-round-matches">
                    ${matches}
                </div>
                ${extraHTML}
            </div>
        `;
    }

    const matches = partidos.map(createMatchHTML).join('');

    return `
        <div class="bracket-round" data-round="${ronda.key}">
            <h3 class="bracket-round-title">${ronda.nombre}</h3>
            <div class="bracket-round-matches">
                ${matches}
            </div>
            ${extraHTML}
        </div>
    `;
}

function createThirdPlaceHTML(partido) {
    return `
        <div class="bracket-third-place">
            <h4 class="bracket-match-title">Tercer y cuarto puesto</h4>
            ${createMatchHTML(partido)}
        </div>
    `;
}

function displayBracket(grupos) {
    const footballSection = document.getElementById('footballSection');

    const rondasConPartidos = RONDAS.filter(ronda => grupos[ronda.key].length > 0);

    const roundsHTML = rondasConPartidos.map(ronda => {
        const esColumnaFinal = ronda.key === "FINAL";
        const extra = (esColumnaFinal && grupos.THIRD_PLACE.length > 0)
            ? createThirdPlaceHTML(grupos.THIRD_PLACE[0])
            : '';

        return createRoundHTML(ronda, grupos[ronda.key], extra);
    }).join('');

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

// Dibuja las líneas conectando cada partido con el partido REAL de la
// siguiente ronda en el que aparece alguno de sus dos equipos.
// Ya no se asume ninguna posición ni orden: se comprueba el dato en sí.
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

        partidosActuales.forEach(partido => {
            const equiposOrigen = [...partido.querySelectorAll('.bracket-team')]
                .map(e => e.dataset.team)
                .filter(nombre => nombre && nombre !== "Por definir");

            // Buscamos en qué partido de la siguiente ronda aparece de
            // verdad alguno de estos dos equipos: ese es el destino real
            const partidoSiguiente = partidosSiguientes.find(candidato => {
                const equiposDestino = [...candidato.querySelectorAll('.bracket-team')]
                    .map(e => e.dataset.team);
                return equiposOrigen.some(nombre => equiposDestino.includes(nombre));
            });

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
        const etapasEncontradas = [...new Set(footballData.matches.map(p => p.stage))];
        console.log('Etapas recibidas de la API:', etapasEncontradas);

        const grupos = ordenarPorEmparejamiento(agruparPorRonda(footballData.matches));
        displayBracket(grupos);
    } else {
        console.error('No se han encontrado datos de los partidos');
    }
}

iniciarBracket();