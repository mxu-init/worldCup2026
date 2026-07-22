"use strict";

const API_KEY = "7ae1f82c23a24e4e9638397fe6b29b8c";

/*
  WC = FIFA World Cup
  season=2026 = edición del Mundial de 2026
*/
const requestURL =
    "https://api.football-data.org/v4/competitions/WC/matches?season=2026";

/*
  Referencias a los elementos del HTML.
*/
const contenedorPartidos = document.querySelector("#partidos");
const mensaje = document.querySelector("#mensaje");

/*
  Función principal:
  realiza la petición y recibe los datos.
*/
async function obtenerPartidos() {
    mostrarMensaje("Cargando todos los partidos del Mundial de Futbol 2026...");

    try {
        const respuesta = await fetch(requestURL, {
            method: "GET",

            headers: {
                "X-Auth-Token": API_KEY,
            },
        });

        /*
              fetch no genera automáticamente un error con respuestas
              401, 403, 404 o 500. Por eso comprobamos respuesta.ok.
            */
        if (!respuesta.ok) {
            const detalleError = await respuesta.text();

            throw new Error(`Error HTTP ${respuesta.status}: ${detalleError}`);
        }

        const datos = await respuesta.json();

        /*
              Esto permite estudiar la respuesta completa desde
              la consola del navegador.
            */
        console.log("Respuesta completa de la API:", datos);
        console.log("Partidos recibidos:", datos.matches);

        const partidos = datos.matches ?? [];

        if (partidos.length === 0) {
            mostrarMensaje(
                "La API respondió correctamente, pero no devolvió partidos.",
            );

            return;
        }

        /*
              Creamos una copia del array y ordenamos los partidos
              desde el más antiguo hasta el más reciente.
            */
        const partidosOrdenados = [...partidos].sort((partidoA, partidoB) => {
            const fechaA = new Date(partidoA.utcDate);
            const fechaB = new Date(partidoB.utcDate);

            return fechaA - fechaB;
        });

        ocultarMensaje();
        mostrarPartidos(partidosOrdenados);
    } catch (error) {
        console.error("No fue posible cargar los partidos:", error);

        mostrarMensaje(
            `No fue posible cargar los partidos. ${error.message}`,
            true,
        );
    }
}

/*
  Recorre todos los partidos y crea las tarjetas.

  También añade un título nuevo cada vez que cambia la fecha.
*/
function mostrarPartidos(partidos) {
    contenedorPartidos.innerHTML = "";

    let fechaAnterior = "";

    partidos.forEach((partido) => {
        const fechaActual = obtenerClaveFecha(partido.utcDate);

        if (fechaActual !== fechaAnterior) {
            const tituloFecha = document.createElement("h2");

            tituloFecha.className = "fecha-partidos";
            tituloFecha.textContent = formatearFecha(partido.utcDate);

            contenedorPartidos.appendChild(tituloFecha);

            fechaAnterior = fechaActual;
        }

        const tarjeta = crearTarjetaPartido(partido);

        contenedorPartidos.appendChild(tarjeta);
    });
}

/*
  Crea una única tarjeta de partido.
*/
function crearTarjetaPartido(partido) {
    const tarjeta = document.createElement("article");

    tarjeta.className = "partido";

    const equipoLocal = crearEquipo(partido.homeTeam, "equipo-local", true);

    const informacion = crearInformacionPartido(partido);

    const equipoVisitante = crearEquipo(
        partido.awayTeam,
        "equipo-visitante",
        false,
    );

    tarjeta.append(equipoLocal, informacion, equipoVisitante);

    return tarjeta;
}

/*
  Crea el bloque de una selección:
  nombre + escudo o bandera.
*/
function crearEquipo(equipo, claseAdicional, imagenAlFinal) {
    const bloqueEquipo = document.createElement("div");

    bloqueEquipo.className = `equipo ${claseAdicional}`;

    const nombre = document.createElement("span");

    nombre.className = "equipo-nombre";
    nombre.textContent = equipo?.shortName || equipo?.name || "Por definir";

    const imagen = document.createElement("img");

    imagen.className = "equipo-escudo";
    imagen.alt = equipo?.name
        ? `Escudo o bandera de ${equipo.name}`
        : "Selección por definir";

    if (equipo?.crest) {
        imagen.src = equipo.crest;
    } else {
        /*
              Ocultamos la imagen cuando la API todavía
              no ha definido el equipo.
            */
        imagen.hidden = true;
    }

    /*
        Si una imagen no se carga, evitamos mostrar
        el pequeño icono de imagen rota.
      */
    imagen.addEventListener("error", () => {
        imagen.hidden = true;
    });

    if (imagenAlFinal) {
        bloqueEquipo.append(nombre, imagen);
    } else {
        bloqueEquipo.append(imagen, nombre);
    }

    return bloqueEquipo;
}

/*
  Construye la columna central:
  estado, hora o marcador, fase y estadio.
*/
function crearInformacionPartido(partido) {
    const informacion = document.createElement("div");

    informacion.className = "informacion-partido";

    const estado = document.createElement("span");

    estado.className = `estado ${obtenerClaseEstado(partido.status)}`;

    estado.textContent = traducirEstado(partido.status);

    const resultadoHora = document.createElement("div");

    resultadoHora.className = "resultado-hora";
    resultadoHora.textContent = obtenerResultadoOHora(partido);

    const detalles = document.createElement("p");

    detalles.className = "detalles";
    detalles.textContent = crearTextoDetalles(partido);

    informacion.append(estado, resultadoHora, detalles);

    return informacion;
}

/*
  Decide si debemos mostrar el marcador o la hora.

  - Partido terminado: muestra marcador.
  - Partido en vivo: muestra marcador.
  - Partido futuro: muestra la hora.
*/
function obtenerResultadoOHora(partido) {
    const estadosConResultado = ["IN_PLAY", "PAUSED", "FINISHED", "AWARDED"];

    if (estadosConResultado.includes(partido.status)) {
        return obtenerMarcador(partido);
    }

    return formatearHora(partido.utcDate);
}

/*
  Obtiene los goles del objeto score.

  El operador ?? permite utilizar "-" cuando
  el valor sea null o undefined.
*/
function obtenerMarcador(partido) {
    const golesLocal =
        partido.score?.fullTime?.home ?? partido.score?.halfTime?.home ?? "-";

    const golesVisitante =
        partido.score?.fullTime?.away ?? partido.score?.halfTime?.away ?? "-";

    return `${golesLocal} - ${golesVisitante}`;
}

/*
  Ejemplo de resultado:
  "Cuartos de final · MetLife Stadium"
*/
function crearTextoDetalles(partido) {
    const detalles = [];

    const fase = traducirFase(partido.stage);

    if (fase) {
        detalles.push(fase);
    }

    if (partido.group) {
        detalles.push(traducirGrupo(partido.group));
    }

    if (partido.venue) {
        detalles.push(partido.venue);
    }

    return detalles.join(" · ");
}

/*
  Traducción de los estados utilizados por la API.
*/
function traducirEstado(estado) {
    const traducciones = {
        SCHEDULED: "Programado",
        TIMED: "Programado",
        IN_PLAY: "En vivo",
        PAUSED: "Descanso",
        FINISHED: "Finalizado",
        SUSPENDED: "Suspendido",
        POSTPONED: "Aplazado",
        CANCELLED: "Cancelado",
        AWARDED: "Resultado adjudicado",
    };

    return traducciones[estado] ?? estado;
}

/*
  Devuelve una clase CSS dependiendo del estado.
*/
function obtenerClaseEstado(estado) {
    if (estado === "IN_PLAY" || estado === "PAUSED") {
        return "estado-en-vivo";
    }

    if (estado === "SCHEDULED" || estado === "TIMED") {
        return "estado-programado";
    }

    if (estado === "FINISHED" || estado === "AWARDED") {
        return "estado-finalizado";
    }

    return "estado-otro";
}

/*
  Traduce las diferentes fases del Mundial.
*/
function traducirFase(fase) {
    const fases = {
        GROUP_STAGE: "Fase de grupos",
        LAST_64: "Ronda de 64",
        LAST_32: "Dieciseisavos de final",
        LAST_16: "Octavos de final",
        QUARTER_FINALS: "Cuartos de final",
        SEMI_FINALS: "Semifinal",
        THIRD_PLACE: "Tercer puesto",
        FINAL: "Final",
    };

    return fases[fase] ?? fase ?? "";
}

/*
  GROUP_A se convierte en Grupo A.
*/
function traducirGrupo(grupo) {
    return grupo.replace("GROUP_", "Grupo ");
}

/*
  Convierte una fecha UTC de la API en una fecha legible.

  El navegador adapta automáticamente la fecha
  a la zona horaria del usuario.
*/
function formatearFecha(fechaUTC) {
    const fecha = new Date(fechaUTC);

    return new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(fecha);
}

/*
  Convierte la fecha UTC en una hora local.

  Ejemplo:
  22:00
*/
function formatearHora(fechaUTC) {
    const fecha = new Date(fechaUTC);

    return new Intl.DateTimeFormat("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(fecha);
}

/*
  Produce una clave sencilla para saber cuándo cambia el día.
*/
function obtenerClaveFecha(fechaUTC) {
    const fecha = new Date(fechaUTC);

    return [fecha.getFullYear(), fecha.getMonth(), fecha.getDate()].join("-");
}

/*
  Funciones para controlar el mensaje superior.
*/
function mostrarMensaje(texto, esError = false) {
    mensaje.hidden = false;
    mensaje.textContent = texto;
    mensaje.classList.toggle("error", esError);
}

function ocultarMensaje() {
    mensaje.hidden = true;
    mensaje.textContent = "";
    mensaje.classList.remove("error");
}

/*
  Iniciamos la aplicación.
*/
obtenerPartidos();
