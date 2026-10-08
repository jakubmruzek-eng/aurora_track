export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const [plasmaRes, magRes, kpRes, forecastRes] = await Promise.all([
            fetch('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json'),
            fetch('https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json'),
            fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
            fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json')
        ]);

        const plasma = await plasmaRes.json();
        const mag = await magRes.json();
        const kp = await kpRes.json();
        const forecast = await forecastRes.json();

        const latestPlasma = plasma[plasma.length - 1];
        const latestMag = mag[mag.length - 1];
        const latestKp = kp[kp.length - 1];

        res.status(200).json({
            density: parseFloat(latestPlasma[1]) || 0,
            speed: parseFloat(latestPlasma[2]) || 0,
            bz: parseFloat(latestMag[3]) || 0,
            kp: latestKp[1] || '0',
            forecast: forecast
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch NOAA data' });
    }
}