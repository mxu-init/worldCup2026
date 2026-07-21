async function getMundialGroups() {
    try {
        console.log("Conectando con la API...");
        const response = await fetch('/api/football-proxy?path=competitions/WC/standings');

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        if (data.standings && data.standings.length > 0) {
            data.standings.forEach(stage => {
                // Solo nos interesa la fase de grupos
                if (stage.type === 'TOTAL') {
                    const letra = stage.group.trim().slice(-1).toUpperCase();
                    const tbody = document.getElementById(`group${letra}`);

                if (tbody) {
                    tbody.innerHTML = '';
                    stage.table.forEach(pos => {
                        console.log(pos.team);
                        const row = document.createElement('tr');
                        row.innerHTML = `
                        <td>
                            <span class="team-name" title="${pos.team.name}">
                                <img src="${pos.team.crest}" alt="${pos.team.name}" class="flag">
                                <span class="team-label">${pos.team.name}</span>
                            </span>
                        </td>
                        <td>${pos.playedGames}</td>
                        <td>${pos.won}</td>
                        <td>${pos.draw}</td>
                        <td>${pos.lost}</td>
                        <td>${pos.goalsFor}</td>
                        <td>${pos.goalsAgainst}</td>
                        <td>${pos.goalDifference}</td>
                        <td>${pos.points}</td>
                        `;
                                                
                        tbody.appendChild(row);
                    });
            } else {
            console.warn(` No se encontró tbody para el grupo ${letra} `);
        }
    }
    });
} else {
    console.log("No se encontraron datos de clasificación para este torneo.");
}

} catch (error) {
    console.error("Error al obtener los datos de la API:", error);
    }
}
function esperarElemento(id, callback, intentos = 30) {
    const el = document.getElementById(id);
    if (el) {
        callback();
    } else if (intentos > 0) {
        setTimeout(() => esperarElemento(id, callback, intentos - 1), 300);
    } else {
        console.error(`No se pudo encontar #${id}. después de varios intentos. `);
    }
}
esperarElemento('groupA', getMundialGroups);
