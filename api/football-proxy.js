export default async function handler(req, res) {
    const{path} = req.query;
    const url = `https://api.football-data.org/v4/${path}`;
    const response = await fetch(url, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
    });
    const data = await response.json();
    res.status(response.status).json(data);
    }