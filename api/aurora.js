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
        // Správné a stabilní URL adresy NOAA SWPC
        const [magData, plasmaData, kpData] = await Promise.all([
            getData('https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json'),
            getData('https://services.swpc.noaa.gov/json/rtsw/rtsw_plasma_1m.json'),
            getData('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json')
        ]);

        let bz = 0;
        let speed = 0;
        let density = 0;
        let kp = '2.0';

        // Parsování Magnetometru (Bz)
        if (Array.isArray(magData) && magData.length > 0) {
            const latestMag = magData[magData.length - 1];
            bz = latestMag.bz_gsm !== undefined ? parseFloat(latestMag.bz_gsm) : (latestMag[3] ? parseFloat(latestMag[3]) : 0);
        }

        // Parsování Plasmy (Rychlost a Hustota)
        if (Array.isArray(plasmaData) && plasmaData.length > 0) {
            const latestPlasma = plasmaData[plasmaData.length - 1];
            speed = latestPlasma.speed !== undefined ? parseFloat(latestPlasma.speed) : (latestPlasma[2] ? parseFloat(latestPlasma[2]) : 0);
            density = latestPlasma.density !== undefined ? parseFloat(latestPlasma.density) : (latestPlasma[1] ? parseFloat(latestPlasma[1]) : 0);
        }

        // Parsování Kp indexu
        if (Array.isArray(kpData) && kpData.length > 0) {
            const latestKp = kpData[kpData.length - 1];
            kp = latestKp.kp_index !== undefined ? parseFloat(latestKp.kp_index).toFixed(1) : (latestKp[1] ? parseFloat(latestKp[1]).toFixed(1) : '2.0');
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