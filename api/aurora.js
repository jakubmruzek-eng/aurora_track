export default async function handler(req, res) {
    // CORS a zákazy kešování
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 1. Načtení magnetického pole (Bz) - NOAA 1-minutová řada
        let bzVal = 0;
        const magRes = await fetch('https://services.swpc.noaa.gov/json/ace/mag/ace_mag_1m.json', { cache: 'no-store' });
        if (magRes.ok) {
            const magData = await magRes.json();
            if (Array.isArray(magData) && magData.length > 0) {
                const lastMag = magData[magData.length - 1];
                bzVal = parseFloat(lastMag.bz) || 0;
            }
        }

        // 2. Načtení slunečního větru (Speed + Density) - NOAA 1-minutová řada
        let speedVal = 0;
        let densityVal = 0;
        const plasmaRes = await fetch('https://services.swpc.noaa.gov/json/ace/swpam/ace_swpam_1m.json', { cache: 'no-store' });
        if (plasmaRes.ok) {
            const plasmaData = await plasmaRes.json();
            if (Array.isArray(plasmaData) && plasmaData.length > 0) {
                // Hledáme poslední platný záznam (často bývají v datech záporná chybová čísla jako -999.9)
                for (let i = plasmaData.length - 1; i >= 0; i--) {
                    const row = plasmaData[i];
                    if (row.speed > 0 && row.density > 0) {
                        speedVal = parseFloat(row.speed);
                        densityVal = parseFloat(row.density);
                        break;
                    }
                }
            }
        }

        // 3. Načtení Kp Indexu - NOAA Kp 1-denní přehled
        let kpVal = "0.0";
        const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { cache: 'no-store' });
        if (kpRes.ok) {
            const kpData = await kpRes.json();
            if (Array.isArray(kpData) && kpData.length > 1) {
                // Poslední řádek obsahuje nejnovější Kp hodnocení
                const lastKp = kpData[kpData.length - 1];
                kpVal = String(lastKp[1] || "0.0");
            }
        }

        // Výstupní JSON v přesně požadovaném tvaru
        return res.status(200).json({
            bz: bzVal,
            speed: speedVal,
            density: densityVal,
            kp: kpVal
        });

    } catch (error) {
        console.error("NOAA Fetch Error:", error);
        return res.status(500).json({ error: 'Internal server error fetching NOAA data' });
    }
}