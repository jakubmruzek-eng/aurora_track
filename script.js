const REFRESH_INTERVAL = 60000;

function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));

    const activeSec = document.getElementById(sectionId);
    if (activeSec) activeSec.classList.add('active');

    const activeNav = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
    if (activeNav) activeNav.parentElement.classList.add('active');
}

async function fetchAuroraData() {
    let bz = 0, speed = 400, density = 1.0, kp = '2.0';
    let dataLoaded = false;

    // 1. Přímé načtení slunečního větru z NOAA SWPC
    try {
        const solarRes = await fetch('https://services.swpc.noaa.gov/products/summary/10-minute-solar-wind.json');
        if (solarRes.ok) {
            const solarData = await solarRes.json();
            if (Array.isArray(solarData) && solarData.length > 0) {
                const lastRow = solarData[solarData.length - 1];
                bz = parseFloat(lastRow[1]) || 0;
                density = parseFloat(lastRow[2]) || 0;
                speed = parseFloat(lastRow[3]) || 0;
                dataLoaded = true;
            } else if (typeof solarData === 'object' && solarData !== null) {
                bz = parseFloat(solarData.Bz) || 0;
                speed = parseFloat(solarData.Velocity) || 0;
                density = parseFloat(solarData.Density) || 0;
                dataLoaded = true;
            }
        }
    } catch (e) {
        console.warn('Chyba načítání slunečního větru z NOAA:', e);
    }

    // 2. Přímé načtení Kp indexu z NOAA SWPC
    try {
        const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        if (kpRes.ok) {
            const kpData = await kpRes.json();
            if (Array.isArray(kpData) && kpData.length > 1) {
                const lastKp = kpData[kpData.length - 1];
                kp = parseFloat(lastKp[1]).toFixed(1);
            }
        }
    } catch (e) {
        console.warn('Chyba načítání Kp indexu:', e);
    }

    // Vykreslení dat na stránce
    if (dataLoaded) {
        updateAuroraUI({ bz, speed, density, kp });
    } else {
        document.getElementById('activityLevel').innerText = "DATA OFFLINE";
        document.getElementById('activityDesc').innerText = "Satelitní data NOAA jsou dočasně nedostupná. Obnovte stránku za chvíli.";
    }

    // 3. Načtení předpovědi
    fetchForecastData();

    // 4. Obnova snímku oválu polární záře
    const mapImg = document.getElementById('ovalMap');
    if (mapImg) {
        mapImg.src = `https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg?t=${new Date().getTime()}`;
    }
}

async function fetchForecastData() {
    try {
        const forecastRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
        if (forecastRes.ok) {
            const rawData = await forecastRes.json();
            if (Array.isArray(rawData) && rawData.length > 1) {
                const forecastItems = rawData.slice(1, 9).map(row => ({
                    time: row[0] ? row[0].substring(11, 16) + ' UTC' : '--:--',
                    kp: parseFloat(row[1]).toFixed(1)
                }));
                renderForecastTimeline(forecastItems);
                return;
            }
        }
    } catch (e) {
        console.warn('Chyba předpovědi:', e);
    }

    // Náhradní rozpis, pokud API neodpoví
    renderForecastTimeline([
        { time: '00:00 UTC', kp: '2.0' },
        { time: '03:00 UTC', kp: '2.3' },
        { time: '06:00 UTC', kp: '1.7' },
        { time: '09:00 UTC', kp: '2.0' },
        { time: '12:00 UTC', kp: '2.7' },
        { time: '15:00 UTC', kp: '3.0' },
        { time: '18:00 UTC', kp: '2.3' },
        { time: '21:00 UTC', kp: '1.7' }
    ]);
}

function renderForecastTimeline(items) {
    const container = document.getElementById('forecastTimeline');
    if (!container) return;

    container.innerHTML = items.map(item => `
        <div class="timeline-block">
            <span class="time-label">${item.time}</span>
            <div class="kp-mini-badge">Kp ${item.kp}</div>
        </div>
    `).join('');
}

function updateAuroraUI({ bz, speed, density, kp }) {
    const formattedBz = (bz > 0 ? '+' : '') + Number(bz).toFixed(1);
    const formattedDensity = Number(density).toFixed(1);

    document.getElementById('bzVal').innerText = `${formattedBz} nT`;
    document.getElementById('speedVal').innerText = `${Math.round(speed)} km/s`;
    document.getElementById('densityVal').innerText = `${formattedDensity} p/cm³`;
    document.getElementById('kpVal').innerText = `${kp}`;

    const statusCard = document.getElementById('statusCard');
    const levelEl = document.getElementById('activityLevel');
    const descEl = document.getElementById('activityDesc');

    statusCard.className = 'status-card';

    if (bz < -7 && speed > 480) {
        statusCard.classList.add('status-extreme');
        levelEl.innerText = "AURORA IS ACTIVE!";
        descEl.innerText = "High geomagnetic disturbance. Bright auroras visible overhead in Lapland.";
    } else if (bz < -3 || speed > 430 || parseFloat(kp) >= 3.0) {
        statusCard.classList.add('status-high');
        levelEl.innerText = "GOOD CHANCE";
        descEl.innerText = "Moderate activity. Visible to the naked eye away from streetlights.";
    } else if (bz < 0) {
        statusCard.classList.add('status-moderate');
        levelEl.innerText = "LOW / CAMERA ONLY";
        descEl.innerText = "Faint green arcs on the northern horizon, mostly visible on long exposures.";
    } else {
        statusCard.classList.add('status-low');
        levelEl.innerText = "QUIET CONDITIONS";
        descEl.innerText = "Geomagnetic field is calm. Very low chance of visible aurora right now.";
    }

    const now = new Date();
    document.getElementById('lastUpdate').innerText = now.toLocaleTimeString();
}

// Spuštění načítání
fetchAuroraData();
setInterval(fetchAuroraData, REFRESH_INTERVAL);