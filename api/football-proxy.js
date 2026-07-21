export default async function handler(req, res) {
  const { path } = req.query; // ej: "competitions/WC/scorers?limit=5"

  if (!path) {
    res.status(400).json({ error: "Falta el parámetro 'path'" });
    return;
  }

  try {
    const url = `https://api.football-data.org/v4/${path}`;

    const respuesta = await fetch(url, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_API_KEY },
    });

    const datos = await respuesta.json();
    res.status(respuesta.status).json(datos);
  } catch (error) {
    res.status(500).json({ error: "Error al contactar con football-data.org" });
  }
}

