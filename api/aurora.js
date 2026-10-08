const https = require('https');

function getData(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            },
            timeout: 8000
        }, (res) => {
            // Ošetření přesměrování (HTTP 301, 302, 307)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return getData(res.headers.location).then(resolve).catch(reject);
            }

            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`NOAA HTTP Status: ${res.statusCode}`));
            }

            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(rawData);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('Chyba při parsování JSON z NOAA'));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('NOAA request timeout'));
        });
    });
}

module.exports = async function handler(req, res) {
    try {
        const [magData, plasmaData, kpData] = await Promise.all([
            getData('https://services.swpc.noaa.gov/products/solar-wind/mag-1-minute.json'),
            getData('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-minute.json'),
            getData('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')
        ]);

        // Získání posledního platného řádku (ignorujeme nultý index s hlavičkou sloupce)
        const latestMag = Array.isArray(magData) && magData.length > 1 ? magData[magData.length - 1] : null;
        const latestPlasma = Array.isArray(plasmaData) && plasmaData.length > 1 ? plasmaData[plasmaData.length - 1] : null;
        const latestKp = Array.isArray(kpData) && kpData.length > 1 ? kpData[kpData.length - 1] : null;

        const bz = latestMag && !isNaN(parseFloat(latestMag[3])) ? parseFloat(latestMag[3]) : 0;
        const speed = latestPlasma && !isNaN(parseFloat(latestPlasma[2])) ? parseFloat(latestPlasma[2]) : 0;
        const density = latestPlasma && !isNaN(parseFloat(latestPlasma[1])) ? parseFloat(latestPlasma[1]) : 0;
        const kp = latestKp && latestKp[1] !== undefined ? parseFloat(latestKp[1]).toFixed(1) : '0.0';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

        return res.status(200).json({ bz, speed, density, kp });
    } catch (error) {
        console.error('API Handler Error:', error.message);
        return res.status(500).json({ 
            error: 'Failed to fetch NOAA data', 
            details: error.message 
        });
    }
};