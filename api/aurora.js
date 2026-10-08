const https = require('https');

function getData(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 8000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return getData(res.headers.location).then(resolve);
            }
            if (res.statusCode !== 200) return resolve(null);

            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(rawData)); } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// Pomocná funkce pro bezpečné převedení hodnoty na platné číslo
function parseValidNumber(val) {
    if (val === null || val === undefined) return null;
    const num = parseFloat(val);
    if (isNaN(num) || num <= -900) return null; // Filtruje NOAA chybové kódy jako -999.0
    return num;
}

module.exports = async function handler(req, res) {
    try {
        const [magData, windData, kpData] = await Promise.all([
            getData('https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json'),
            getData('https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json'),
            getData('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json')
        ]);

        let bz = 0;
        let speed = 0;
        let density = 0;
        let kp = '2.0';

        // 1. Získání Bz z rtsw_mag_1m.json
        if (Array.isArray(magData)) {
            for (let i = magData.length - 1; i >= 0; i--) {
                const item = magData[i];
                const parsedBz = parseValidNumber(item.bz_gsm !== undefined ? item.bz_gsm : item.bz);
                if (parsedBz !== null) {
                    bz = parsedBz;
                    break;
                }
            }
        }

        // 2. Získání Rychlosti a Hustoty z rtsw_wind_1m.json
        if (Array.isArray(windData)) {
            for (let i = windData.length - 1; i >= 0; i--) {
                const item = windData[i];
                
                // Rychlost bývá v rtsw_wind označená jako 'spf', 'prop_speed' nebo 'speed'
                if (speed === 0) {
                    const parsedSpeed = parseValidNumber(item.spf ?? item.prop_speed ?? item.speed);
                    if (parsedSpeed !== null && parsedSpeed > 0) {
                        speed = parsedSpeed;
                    }
                }

                // Hustota bývá označená jako 'density' nebo 'n'
                if (density === 0) {
                    const parsedDensity = parseValidNumber(item.density ?? item.n);
                    if (parsedDensity !== null && parsedDensity > 0) {
                        density = parsedDensity;
                    }
                }

                if (speed > 0 && density > 0) break;
            }
        }

        // 3. Získání Kp indexu
        if (Array.isArray(kpData)) {
            for (let i = kpData.length - 1; i >= 0; i--) {
                const item = kpData[i];
                const parsedKp = parseValidNumber(item.kp_index !== undefined ? item.kp_index : (Array.isArray(item) ? item[1] : null));
                if (parsedKp !== null) {
                    kp = parsedKp.toFixed(1);
                    break;
                }
            }
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

        return res.status(200).json({ bz, speed, density, kp });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to parse NOAA data' });
    }
};