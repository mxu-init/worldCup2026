const COMPETICION = "WC"; 

const NUM_FILAS = 10; 



// Datos de respaldo por si la API falla o no hay conexión
const DATOS_EJEMPLO = {
  goleadores: [
    { nombre: "Jugador de ejemplo 1", equipo: "Selección A", goles: 8 },
    { nombre: "Jugador de ejemplo 2", equipo: "Selección B", goles: 7 },
    { nombre: "Jugador de ejemplo 3", equipo: "Selección C", goles: 6 },
  ],
  equiposGoleadores: [
    { equipo: "Selección A", goles: 15 },
    { equipo: "Selección B", goles: 13 },
    { equipo: "Selección C", goles: 11 },
  ],
  equiposEncajados: [
    { equipo: "Selección X", goles: 9 },
    { equipo: "Selección Y", goles: 7 },
    { equipo: "Selección Z", goles: 6 },
  ],
};

document.addEventListener("DOMContentLoaded", cargarEstadisticas);

async function cargarEstadisticas() {
  try {
    const [goleadores, tablaEquipos] = await Promise.all([
      obtenerMaximosGoleadores(),
      obtenerTablaClasificacion(),
    ]);

    pintarGoleadores(goleadores);
    pintarEquiposGoleadores(tablaEquipos);
    pintarEquiposEncajados(tablaEquipos);
  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
    mostrarAviso(
      "No se han podido cargar los datos en directo (posible bloqueo CORS o límite de peticiones). Mostrando datos de ejemplo."
    );
    pintarGoleadores(DATOS_EJEMPLO.goleadores.map((g, i) => ({
      posicion: i + 1,
      nombre: g.nombre,
      equipo: g.equipo,
      goles: g.goles,
    })));
    pintarEquiposDesdeEjemplo();
  }
}


async function obtenerDatosAPI(path) {
  let requestURL;
  let opciones = { method: "GET" };

  if (ESTAMOS_EN_LOCAL) {
    const apiURL = API_URL_BASE + path;
    requestURL = "https://corsproxy.io/?url=" + encodeURIComponent(apiURL);
    opciones.headers = { "X-Auth-Token": API_KEY };
  } else {
    requestURL = `/api/football-proxy?path=${encodeURIComponent(path)}`;
  }

  const respuesta = await fetch(requestURL, opciones);

  if (!respuesta.ok) {
    throw new Error(`Error ${respuesta.status} al pedir ${path}`);
  }

  return respuesta.json();
}

async function obtenerMaximosGoleadores() {
  const path = `competitions/${COMPETICION}/scorers?limit=${NUM_FILAS}`;
  const datos = await obtenerDatosAPI(path);

  return datos.scorers.map((item, indice) => ({
    posicion: indice + 1,
    nombre: item.player.name,
    equipo: item.team.name,
    escudo: item.team.crest,
    goles: item.goals,
  }));
}

async function obtenerTablaClasificacion() {
  const path = `competitions/${COMPETICION}/matches`;
  const datos = await obtenerDatosAPI(path);

  const golesPorEquipo = {}; // acumulador: { "Germany": { golesFavor, golesContra, escudo } }

  datos.matches
    .filter((partido) => partido.status === "FINISHED")
    .forEach((partido) => {
      const local = partido.homeTeam;
      const visitante = partido.awayTeam;
      const golesLocal = partido.score.fullTime.home;
      const golesVisitante = partido.score.fullTime.away;

      if (!golesPorEquipo[local.name]) {
        golesPorEquipo[local.name] = { equipo: local.name, escudo: local.crest, golesFavor: 0, golesContra: 0 };
      }
      if (!golesPorEquipo[visitante.name]) {
        golesPorEquipo[visitante.name] = { equipo: visitante.name, escudo: visitante.crest, golesFavor: 0, golesContra: 0 };
      }

      golesPorEquipo[local.name].golesFavor += golesLocal;
      golesPorEquipo[local.name].golesContra += golesVisitante;

      golesPorEquipo[visitante.name].golesFavor += golesVisitante;
      golesPorEquipo[visitante.name].golesContra += golesLocal;
    });

  return Object.values(golesPorEquipo);
}

function pintarGoleadores(lista) {
  const cuerpo = document.getElementById("tabla-goleadores");
  cuerpo.innerHTML = lista
    .map(
      (fila) => `
      <tr>
        <td>${fila.posicion}</td>
        <td>${fila.nombre}</td>
        <td>
  <img class="stat-flag"
       src="${fila.escudo}"
       alt="${fila.equipo}">
  ${fila.equipo}
</td>
        <td>${fila.goles}</td>
      </tr>`
    )
    .join("");
}

function pintarEquiposGoleadores(equipos) {
  const ranking = [...equipos]
    .sort((a, b) => b.golesFavor - a.golesFavor)
    .slice(0, NUM_FILAS);

  const cuerpo = document.getElementById("tabla-equipos-goleadores");
  cuerpo.innerHTML = ranking
    .map(
      (fila, indice) => `
      <tr>
        <td>${indice + 1}</td>
        <td>
  <img class="stat-flag"
       src="${fila.escudo}"
       alt="${fila.equipo}">
  ${fila.equipo}
</td>
        <td>${fila.golesFavor}</td>
      </tr>`
    )
    .join("");
}

function pintarEquiposEncajados(equipos) {
  const ranking = [...equipos]
    .sort((a, b) => b.golesContra - a.golesContra)
    .slice(0, NUM_FILAS);

  const cuerpo = document.getElementById("tabla-equipos-encajados");
  cuerpo.innerHTML = ranking
    .map(
      (fila, indice) => `
      <tr>
        <td>${indice + 1}</td>
        <td>
  <img class="stat-flag"
       src="${fila.escudo}"
       alt="${fila.equipo}">
  ${fila.equipo}
</td>
        <td>${fila.golesContra}</td>
      </tr>`
    )
    .join("");
}

function pintarEquiposDesdeEjemplo() {
  const cuerpoGoleadores = document.getElementById("tabla-equipos-goleadores");
  cuerpoGoleadores.innerHTML = DATOS_EJEMPLO.equiposGoleadores
    .map(
      (fila, indice) => `
      <tr>
        <td>${indice + 1}</td>
        <td>${fila.equipo}</td>
        <td>${fila.goles}</td>
      </tr>`
    )
    .join("");

  const cuerpoEncajados = document.getElementById("tabla-equipos-encajados");
  cuerpoEncajados.innerHTML = DATOS_EJEMPLO.equiposEncajados
    .map(
      (fila, indice) => `
      <tr>
        <td>${indice + 1}</td>
        <td>${fila.equipo}</td>
        <td>${fila.goles}</td>
      </tr>`
    )
    .join("");
}

function mostrarAviso(texto) {
  const aviso = document.getElementById("mensaje-estado");
  aviso.textContent = texto;
  aviso.classList.remove("d-none");
}
