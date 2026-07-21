const ESTAMOS_EN_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_KEY = "4ae71e0fd15c4aa88600049cc862830a"; // solo se usa en local, ver fetchFootballJson


function createMatchCard({ utcDate, status, competition, homeTeam, awayTeam, score }) { 
    // Formatear fecha
    const matchDate = new Date(utcDate).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    // Extraer goles de forma segura con ?. y ??
    const homeScore = score?.fullTime?.home ?? " ";
    const awayScore = score?.fullTime?.away ?? " ";

    // Clase dinámica de Bootstrap para el badge del estado
    const statusBadgeClass = status === 'FINISHED' ? 'bg-secondary' : 'bg-success';

    const homeName = homeTeam?.name ?? "TBD";
    const awayName = awayTeam?.name ?? "TBD";

    return ` 
        <div class="card match-card-custom"> 
            <div class="card-body">
                <h6 class="card-subtitle mb-2 text-muted">${competition.name}</h6>
                
                <p class="card-text">
                    <strong>${homeName} </strong>${homeScore} 
                    vs 
                    ${awayScore} <strong>${awayName}</strong>
                </p>
                
                <div class="card-footer bg-transparent border-top-0 text-muted">
                    <div>Estado: <span class="badge ${statusBadgeClass}">${status}</span></div>
                    <div>Hora: ${matchDate}</div>
                </div>
            </div>
        </div>
    `;
}

async function fetchFootballJson () {
    try{
        const path = "competitions/WC/matches"; // mismo endpoint que ya usabas

        let requestURL;
        let opciones = { method: "GET" };

        if (ESTAMOS_EN_LOCAL) {
            // En local seguimos usando el proxy público, porque Live Server no ejecuta la carpeta /api
            const apiURL = "https://api.football-data.org/v4/" + path;
            requestURL = "https://corsproxy.io/?url=" + encodeURIComponent(apiURL);
            opciones.headers = { "X-Auth-Token": API_KEY };
        } else {
            // En Vercel, llamamos a nuestro propio backend (api/football-proxy.js), sin problemas de CORS
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


async function displayMatches () {
    const footballSection = document.getElementById('footballSection');
    const footballData = await fetchFootballJson();

    if (footballData && footballData.matches) {
        const matchCards = footballData.matches.map(createMatchCard).join(''); 
        footballSection.innerHTML = matchCards;

    } else {
        console.error('No has encontrado datos de los partidos');
    }
}

displayMatches();