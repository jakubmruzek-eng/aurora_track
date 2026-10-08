const https = require('https');

function getData(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            },
            timeout: 8000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return getData(res.headers.location).then(resolve);
            }

            if (res.statusCode !== 200) {
                return resolve(null);
            }

            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(rawData));
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

module.exports = async function handler(req, res) {
    try {
        const [magData, plasmaData, kpData] = await Promise.all([
            getData('https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json'),
            getData('https://services.swpc.noaa.gov/json/rtsw/rtsw_plasma_1m.json'),
            getData('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json')
        ]);

        let bz = 0;
        let speed = 0;
        let density = 0;
        let kp = '2.0';

        // 1. Najdeme nejnovější platný záznam pro Bz
        if (Array.isArray(magData)) {
            for (let i = magData.length - 1; i >= 0; i--) {
                const item = magData[i];
                const val = item.bz_gsm !== undefined ? item.bz_gsm : (Array.isArray(item) ? item[3] : null);
                if (val !== null && val !== undefined && !isNaN(parseFloat(val))) {
                    bz = parseFloat(val);
                    break;
                }
            }
        }

        // 2. Najdeme nejnovější platný záznam pro Plasmu (speed & density)
        if (Array.isArray(plasmaData)) {
            for (let i = plasmaData.length - 1; i >= 0; i--) {
                const item = plasmaData[i];
                
                // Rychlost
                const sVal = item.speed !== undefined ? item.speed : (Array.isArray(item) ? item[2] : null);
                if (speed === 0 && sVal !== null && sVal !== undefined && !isNaN(parseFloat(sVal))) {
                    speed = parseFloat(sVal);
                }

                // Hustota
                const dVal = item.density !== undefined ? item.density : (Array.isArray(item) ? item[1] : null);
                if (density === 0 && dVal !== null && dVal !== undefined && !isNaN(parseFloat(dVal))) {
                    density = parseFloat(dVal);
                }

                if (speed !== 0 && density !== 0) break;
            }
        }

        // 3. Najdeme nejnovější platný Kp index
        if (Array.isArray(kpData)) {
            for (let i = kpData.length - 1; i >= 0; i--) {
                const item = kpData[i];
                const kVal = item.kp_index !== undefined ? item.kp_index : (Array.isArray(item) ? item[1] : null);
                if (kVal !== null && kVal !== undefined && !isNaN(parseFloat(kVal))) {
                    kp = parseFloat(kVal).toFixed(1);
                    break;
                }
            }
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

        return res.status(200).json({ bz, speed, density, kp });
    } catch (error) {
        return res.status(500).json({ 
            error: 'Failed to fetch NOAA data', 
            details: error.message 
        });
    }
};