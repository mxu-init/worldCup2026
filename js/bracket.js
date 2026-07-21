// URL real de la API de football-data.org
const apiURL = "https://api.football-data.org/v4/competitions/WC/matches";

// Proxy público que evita el bloqueo de CORS
const requestURL = "https://corsproxy.io/?url=" + encodeURIComponent(apiURL);
const API_KEY = "4ae71e0fd15c4aa88600049cc862830a";


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
        const response = await fetch (requestURL, {
            method: 'GET', // tipo de petición (GET = pedir datos)
            headers: {
                'X-Auth-Token': API_KEY // aquí va la API key, en la cabecera que pide esta API en concreto
            }
        });
        if (!response.ok) {
            throw new Error('Error de la solicitud: ' + response.status);
        }
        return response.json(); //Si retorna un 200 es que todo bien, que perfe
    }
    catch (error) {
        console.error('Error al obtener los datos: ', error);
        return null;    
    }
}


async function displayMatches () {
    const footballSection = document.getElementById('footballSection'); //Dónde lo quiero imprimir
    const footballData = await fetchFootballJson(); //Función de "ve a buscar los datos". Mete el JSON en footballData

    if (footballData && footballData.matches) { //Si existe footballData y si existe la sección "items" dentro del JSON
        //Si llegan los datos, los imprimimos en pantalla
        const matchCards = footballData.matches.map(createMatchCard).join(''); 
        //Join es añade uno más uno más uno más uno, no sustituyas, sino que los va "sumando", encadenando
        footballSection.innerHTML = matchCards;

    } else {
        console.error('No has encontrado datos de los partidos');
    }
}




displayMatches();