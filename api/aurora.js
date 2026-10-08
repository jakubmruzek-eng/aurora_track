export default async function handler(req, res) {
    // 1. Povolení CORS pro všechny domény (GitHub Pages, localhost)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. Absolutní zákaz kešování na úrovni Vercel Edge i prohlížeče
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Ošetření CORS preflight dotazu
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Načtení živých dat z NOAA SWPC (Mag & Solar Wind)
        const [magRes, plasmaRes, kpRes] = await Promise.all([
            fetch('https://services.swpc.noaa.gov/products/summary/10-minute-normal-mag.json', { cache: 'no-store' }),
            fetch('https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json', { cache: 'no-store' }),
            fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { cache: 'no-store' })
        ]);

        let bzVal = 0;
        let speedVal = 0;
        let densityVal = 0;
        let kpVal = "0.0";

        // Parsování Bz
        if (magRes.ok) {
            const magData = await magRes.json();
            if (magData && magData.Bz !== undefined) {
                bzVal = parseFloat(magData.Bz);
            }
        }

        // Parsování Rychlosti a Hustoty
        if (plasmaRes.ok) {
            const plasmaData = await plasmaRes.json();
            if (plasmaData) {
                if (plasmaData.WindSpeed !== undefined) speedVal = parseFloat(plasmaData.WindSpeed);
                if (plasmaData.Density !== undefined) densityVal = parseFloat(plasmaData.Density);
            }
        }

        // Parsování Kp Indexu
        if (kpRes.ok) {
            const kpData = await kpRes.json();
            if (Array.isArray(kpData) && kpData.length > 0) {
                const lastEntry = kpData[kpData.length - 1];
                kpVal = String(lastEntry[1] || "0.0");
            }
        }

        // Vrácení živého JSONu
        return res.status(200).json({
            bz: bzVal,
            speed: speedVal,
            density: densityVal,
            kp: kpVal
        });

    } catch (error) {
        console.error("Chyba při načítání NOAA dat:", error);
        return res.status(500).json({ 
            error: 'Failed to fetch aurora data',
            bz: 0,
            speed: 0,
            density: 0,
            kp: "0.0"
        });
    }
}