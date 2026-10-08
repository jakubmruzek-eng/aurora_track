async function fetchAuroraData() {
    try {
        const response = await fetch(`https://auroratrack-rho.vercel.app/api/aurora?t=${Date.now()}`, {
            cache: 'no-store'
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        
        // Pokud by z API přišly nuly kvůli výpadku NOAA, nebudeme přepisovat chybně UI
        if (data.speed !== undefined && data.bz !== undefined) {
            updateAuroraUI({
                bz: parseFloat(data.bz),
                speed: parseFloat(data.speed),
                density: parseFloat(data.density),
                kp: parseFloat(data.kp)
            });
        }
    } catch (e) {
        console.warn('Problém s načtením API z Vercelu', e);
    }

    initLocationAndWeather();
    updateMoonPhase();

    const timestamp = Date.now();
    const mapImg = document.getElementById('ovalMap');
    if (mapImg) mapImg.src = `https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg?t=${timestamp}`;

    const sunspotsImg = document.getElementById('sunspotsImg');
    if (sunspotsImg) sunspotsImg.src = `https://services.swpc.noaa.gov/images/animations/suvi/primary/171/latest.png?t=${timestamp}`;

    const coronalHolesImg = document.getElementById('coronalHolesImg');
    if (coronalHolesImg) coronalHolesImg.src = `https://services.swpc.noaa.gov/images/animations/suvi/primary/195/latest.png?t=${timestamp}`;
}