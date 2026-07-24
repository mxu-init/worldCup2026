const ESTAMOS_EN_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_KEY = "4ae71e0fd15c4aa88600049cc862830a"; // solo se usa en local, ver fetchFootballJson

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

function agruparPorRonda(partidos) {
    const grupos = {
        LAST_32: [], LAST_16: [], QUARTER_FINALS: [],
        SEMI_FINALS: [], FINAL: [], THIRD_PLACE: [],
    };

    partidos.forEach(partido => {
        if (grupos[partido.stage]) grupos[partido.stage].push(partido);
    });

    Object.keys(grupos).forEach(key => grupos[key].sort((a, b) => a.id - b.id));

    return grupos;
}

function encontrarSiguientePartido(partido, siguienteRondaPartidos) {
    const equiposOrigen = [partido.homeTeam?.name, partido.awayTeam?.name].filter(Boolean);
    return siguienteRondaPartidos.find(candidato => {
        const equiposDestino = [candidato.homeTeam?.name, candidato.awayTeam?.name];
        return equiposOrigen.some(nombre => equiposDestino.includes(nombre));
    });
}

// Reordena cada ronda para que el orden visual coincida con el orden
// real de sus enfrentamientos anteriores (solo estético, evita cruces)
function ordenarPorEmparejamiento(grupos) {
    const cadena = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

    for (let i = 1; i < cadena.length; i++) {
        const anterior = grupos[cadena[i - 1]];
        const actual = grupos[cadena[i]];
        const ordenados = [];

        anterior.forEach(pAnt => {
            const equipos = [pAnt.homeTeam?.name, pAnt.awayTeam?.name].filter(Boolean);
            const siguiente = actual.find(p =>
                !ordenados.includes(p) &&
                equipos.some(n => p.homeTeam?.name === n || p.awayTeam?.name === n)
            );
            if (siguiente) ordenados.push(siguiente);
        });

        actual.forEach(p => { if (!ordenados.includes(p)) ordenados.push(p); });
        grupos[cadena[i]] = ordenados;
    }

    return grupos;
}

// Marca cada partido (menos la Final) con .lado, según a qué semifinal
// conduce. Se usa solo para decidir en qué mitad de la pantalla pintarlo
function dividirEnMitades(grupos) {
    if (grupos.SEMI_FINALS.length < 2) return false;

    grupos.SEMI_FINALS[0].lado = 'izquierda';
    grupos.SEMI_FINALS[1].lado = 'derecha';

    let rondaSiguiente = grupos.SEMI_FINALS;
    ["QUARTER_FINALS", "LAST_16", "LAST_32"].forEach(clave => {
        grupos[clave].forEach(partido => {
            const siguiente = encontrarSiguientePartido(partido, rondaSiguiente);
            partido.lado = siguiente?.lado ?? 'izquierda';
        });
        rondaSiguiente = grupos[clave];
    });

    return true;
}

// Calcula, para cada partido, el ID real del partido al que avanza
// (siguienteId) y, para las semifinales, el ID del partido por el
// tercer puesto (terceroPuestoId). Esto es lo que usan las líneas
// para conectar: nunca se basan en posiciones, solo en estos IDs
function calcularConexiones(grupos) {
    const cadena = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

    for (let i = 0; i < cadena.length - 1; i++) {
        grupos[cadena[i]].forEach(partido => {
            const siguiente = encontrarSiguientePartido(partido, grupos[cadena[i + 1]]);
            partido.siguienteId = siguiente?.id ?? null;
        });
    }

    if (grupos.THIRD_PLACE.length > 0) {
        const idBronce = grupos.THIRD_PLACE[0].id;
        grupos.SEMI_FINALS.forEach(semi => { semi.terceroPuestoId = idBronce; });
    }

    return grupos;
}

function nombreEquipo(equipo) {
    return equipo?.name ?? "Por definir";
}

function codigoEquipo(equipo) {
    if (!equipo) return "TBD";
    return equipo.tla ?? equipo.name?.slice(0, 3).toUpperCase() ?? "TBD";
}

function createMatchHTML(partido) {
    const local = partido.homeTeam;
    const visitante = partido.awayTeam;
    const golesLocal = partido.score?.fullTime?.home ?? "";
    const golesVisitante = partido.score?.fullTime?.away ?? "";

    // Si ya hay un ganador claro, lo guardamos aparte. Sirve para que
    // la línea de esta ronda solo "recuerde" al equipo que avanza
    // de verdad, no a los dos (importante para el hover)
    let ganador = "", perdedor = "";
    const resultado = partido.score?.winner; // más fiable que comparar goles: contempla penaltis

    if (resultado === "HOME_TEAM") {
        ganador = nombreEquipo(local); perdedor = nombreEquipo(visitante);
    } else if (resultado === "AWAY_TEAM") {
        ganador = nombreEquipo(visitante); perdedor = nombreEquipo(local);
    } else if (partido.status === "FINISHED" && golesLocal !== "" && golesVisitante !== "" && golesLocal !== golesVisitante) {
        if (golesLocal > golesVisitante) { ganador = nombreEquipo(local); perdedor = nombreEquipo(visitante); }
        else { ganador = nombreEquipo(visitante); perdedor = nombreEquipo(local); }
    }

    const filaEquipo = (equipo, goles) => `
        <div class="bracket-team" data-team="${nombreEquipo(equipo)}">
            ${equipo?.crest
                ? `<img class="bracket-flag" src="${equipo.crest}" alt="${nombreEquipo(equipo)}">`
                : `<span class="bracket-flag bracket-flag-vacia"></span>`}
            <span class="bracket-team-code">${codigoEquipo(equipo)}</span>
            <span class="bracket-team-score">${goles}</span>
        </div>`;

    return `
        <div class="bracket-match"
             data-match-id="${partido.id}"
             data-siguiente-id="${partido.siguienteId ?? ''}"
             data-tercero-id="${partido.terceroPuestoId ?? ''}"
             data-ganador="${ganador}"
             data-perdedor="${perdedor}">
            ${filaEquipo(local, golesLocal)}
            ${filaEquipo(visitante, golesVisitante)}
        </div>
    `;
}

function createRoundHTML(nombreRonda, partidos, tituloPorPartido = false) {
    if (tituloPorPartido) {
        const matches = partidos.map(p => `
            <div class="bracket-match-block">
                <h4 class="bracket-match-title">${nombreRonda}</h4>
                ${createMatchHTML(p)}
            </div>
        `).join('');

        return `<div class="bracket-round"><div class="bracket-round-matches">${matches}</div></div>`;
    }

    const matches = partidos.map(createMatchHTML).join('');

    return `
        <div class="bracket-round">
            <h3 class="bracket-round-title">${nombreRonda}</h3>
            <div class="bracket-round-matches">${matches}</div>
        </div>
    `;
}

// Bloque central: Final arriba, las dos semifinales en fila,
// y el tercer y cuarto puesto debajo. Todo en un mismo bloque compacto
function createCentroHTML(grupos) {
    const semiIzq = grupos.SEMI_FINALS.find(p => p.lado === 'izquierda');
    const semiDer = grupos.SEMI_FINALS.find(p => p.lado === 'derecha');
    const finalPartido = grupos.FINAL[0];
    const bronce = grupos.THIRD_PLACE[0];

    return `
        <div class="bracket-round bracket-center">
            ${finalPartido ? `
                <div class="bracket-match-block">
                    <h4 class="bracket-match-title">Final</h4>
                    ${createMatchHTML(finalPartido)}
                </div>` : ''}
            <div class="bracket-semis-row">
                ${semiIzq ? `<div class="bracket-match-block"><h4 class="bracket-match-title">Semifinal</h4>${createMatchHTML(semiIzq)}</div>` : ''}
                ${semiDer ? `<div class="bracket-match-block"><h4 class="bracket-match-title">Semifinal</h4>${createMatchHTML(semiDer)}</div>` : ''}
            </div>
            ${bronce ? `
                <div class="bracket-match-block">
                    <h4 class="bracket-match-title">Tercer y cuarto puesto</h4>
                    ${createMatchHTML(bronce)}
                </div>` : ''}
        </div>
    `;
}

function construirBracketEnEspejo(grupos) {
    const filtrarLado = (clave, lado) => grupos[clave].filter(p => p.lado === lado);

    const columnasIzquierda = [
        createRoundHTML("Dieciseisavos", filtrarLado("LAST_32", 'izquierda')),
        createRoundHTML("Octavos", filtrarLado("LAST_16", 'izquierda')),
        createRoundHTML("Cuartos", filtrarLado("QUARTER_FINALS", 'izquierda')),
    ].join('');

    const columnasDerecha = [
        createRoundHTML("Cuartos", filtrarLado("QUARTER_FINALS", 'derecha')),
        createRoundHTML("Octavos", filtrarLado("LAST_16", 'derecha')),
        createRoundHTML("Dieciseisavos", filtrarLado("LAST_32", 'derecha')),
    ].join('');

    return columnasIzquierda + createCentroHTML(grupos) + columnasDerecha;
}

// Diseño de respaldo, en fila, por si aún no hay datos de semifinales
// para poder dividir el cuadro en dos mitades
function construirBracketLineal(grupos) {
    const rondas = [
        ["Dieciseisavos", grupos.LAST_32],
        ["Octavos", grupos.LAST_16],
        ["Cuartos", grupos.QUARTER_FINALS],
        ["Semifinal", grupos.SEMI_FINALS, true],
    ].filter(([, partidos]) => partidos.length > 0);

    const roundsHTML = rondas
        .map(([nombre, partidos, porPartido]) => createRoundHTML(nombre, partidos, porPartido))
        .join('');

    const finalPartido = grupos.FINAL[0];
    const bronce = grupos.THIRD_PLACE[0];

    const columnaFinal = `
        <div class="bracket-round bracket-final-column">
            ${finalPartido ? `<div class="bracket-match-block"><h4 class="bracket-match-title">Final</h4>${createMatchHTML(finalPartido)}</div>` : ''}
            ${bronce ? `<div class="bracket-match-block"><h4 class="bracket-match-title">Tercer y cuarto puesto</h4>${createMatchHTML(bronce)}</div>` : ''}
        </div>
    `;

    return roundsHTML + columnaFinal;
}

function displayBracket(grupos) {
    const footballSection = document.getElementById('footballSection');
    const hayDosMitades = dividirEnMitades(grupos);

    const bracketHTML = hayDosMitades
        ? construirBracketEnEspejo(grupos)
        : construirBracketLineal(grupos);

    footballSection.innerHTML = `
        <div class="bracket-wrapper">
            <div class="bracket" id="bracket">
                ${bracketHTML}
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
    const rondas = [...bracket.querySelectorAll('.bracket-round-matches')];
    if (rondas.length === 0) return;

    let maxAltura = 0;
    rondas.forEach(ronda => {
        let altura = 0;
        ronda.querySelectorAll('.bracket-match').forEach(el => {
            altura += el.getBoundingClientRect().height + 16;
        });
        if (altura > maxAltura) maxAltura = altura;
    });

    bracket.style.minHeight = `${maxAltura}px`;
}

// Dibuja una línea entre dos partidos ya colocados en pantalla.
// vertical = null -> conector horizontal normal (detecta solo si va
// hacia la izquierda o la derecha según la posición real en pantalla)
// vertical = 'arriba' / 'abajo' -> conector vertical (para el bloque central)
function dibujarLinea(origenEl, destinoEl, equipoConocido, vertical) {
    const bracket = document.getElementById('bracket');
    const bracketRect = bracket.getBoundingClientRect();
    const origenRect = origenEl.getBoundingClientRect();
    const destinoRect = destinoEl.getBoundingClientRect();

    const linea = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    if (vertical === 'arriba' || vertical === 'abajo') {
        const x1 = origenRect.left + origenRect.width / 2 - bracketRect.left;
        const x2 = destinoRect.left + destinoRect.width / 2 - bracketRect.left;
        const y1 = (vertical === 'arriba' ? origenRect.top : origenRect.bottom) - bracketRect.top;
        const y2 = (vertical === 'arriba' ? destinoRect.bottom : destinoRect.top) - bracketRect.top;
        const yMedio = (y1 + y2) / 2;
        linea.setAttribute('d', `M ${x1} ${y1} V ${yMedio} H ${x2} V ${y2}`);
    } else {
        const vaHaciaLaDerecha = destinoRect.left >= origenRect.right;
        const x1 = (vaHaciaLaDerecha ? origenRect.right : origenRect.left) - bracketRect.left;
        const x2 = (vaHaciaLaDerecha ? destinoRect.left : destinoRect.right) - bracketRect.left;
        const y1 = origenRect.top + origenRect.height / 2 - bracketRect.top;
        const y2 = destinoRect.top + destinoRect.height / 2 - bracketRect.top;
        const xMedio = (x1 + x2) / 2;
        linea.setAttribute('d', `M ${x1} ${y1} H ${xMedio} V ${y2} H ${x2}`);
    }

    linea.classList.add('bracket-connector');
    const equipos = equipoConocido
        ? [equipoConocido]
        : [...origenEl.querySelectorAll('.bracket-team')].map(e => e.dataset.team);
    linea.dataset.equipos = equipos.join('|');

    document.getElementById('bracketLines').appendChild(linea);
}

// Recorre TODOS los partidos en pantalla y, para cada uno, busca por su
// ID real el partido al que conecta. Ya no depende de en qué posición
// del array esté cada cosa: por eso ya no puede desincronizarse
function dibujarConectores() {
    const svg = document.getElementById('bracketLines');
    const bracket = document.getElementById('bracket');
    if (!svg || !bracket) return;

    svg.innerHTML = '';

    const todosLosPartidos = [...bracket.querySelectorAll('.bracket-match')];
    const buscarPorId = (id) => todosLosPartidos.find(el => el.dataset.matchId === id);

    todosLosPartidos.forEach(origen => {
        const idSiguiente = origen.dataset.siguienteId;
        if (idSiguiente) {
            const destino = buscarPorId(idSiguiente);
            if (destino) {
                const esConexionCentral = origen.closest('.bracket-center') && destino.closest('.bracket-center');
                dibujarLinea(origen, destino, origen.dataset.ganador, esConexionCentral ? 'arriba' : null);
            }
        }

        const idTercero = origen.dataset.terceroId;
        if (idTercero) {
            const destino = buscarPorId(idTercero);
            const esConexionCentral = destino && origen.closest('.bracket-center') && destino.closest('.bracket-center');
            if (esConexionCentral) {
                dibujarLinea(origen, destino, origen.dataset.perdedor, 'abajo');
            }
        }
    });
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
        const grupos = ordenarPorEmparejamiento(agruparPorRonda(footballData.matches));
        calcularConexiones(grupos);
        displayBracket(grupos);
    } else {
        console.error('No se han encontrado datos de los partidos');
    }
}

iniciarBracket();