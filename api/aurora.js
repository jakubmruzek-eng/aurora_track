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

function parseValidNumber(val) {
    if (val === null || val === undefined) return null;
    const num = parseFloat(val);
    if (isNaN(num) || num <= -900) return null; // Odfiltruje NOAA -999 chybové hodnoty
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

        // 1. Bz z rtsw_mag_1m.json (klíč: bz_gsm)
        if (Array.isArray(magData)) {
            for (let i = magData.length - 1; i >= 0; i--) {
                const parsedBz = parseValidNumber(magData[i]?.bz_gsm);
                if (parsedBz !== null) {
                    bz = parsedBz;
                    break;
                }
            }
        }

        // 2. Speed a Density z rtsw_wind_1m.json (klíče: proton_speed, proton_density)
        if (Array.isArray(windData)) {
            for (let i = windData.length - 1; i >= 0; i--) {
                const item = windData[i];

                if (speed === 0) {
                    const parsedSpeed = parseValidNumber(item?.proton_speed);
                    if (parsedSpeed !== null && parsedSpeed > 0) speed = parsedSpeed;
                }

                if (density === 0) {
                    const parsedDensity = parseValidNumber(item?.proton_density);
                    if (parsedDensity !== null && parsedDensity > 0) density = parsedDensity;
                }

                if (speed > 0 && density > 0) break;
            }
        }

        // 3. Kp index z planetary_k_index_1m.json (klíč: kp_index)
        if (Array.isArray(kpData)) {
            for (let i = kpData.length - 1; i >= 0; i--) {
                const parsedKp = parseValidNumber(kpData[i]?.kp_index);
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
        return res.status(500).json({ error: 'Failed to parse NOAA data', details: error.message });
    }
};