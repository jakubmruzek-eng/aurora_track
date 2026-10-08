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
    try {
        // 1. Přímé načtení dat o slunečním větru z NOAA SWPC
        const solarRes = await fetch('https://services.swpc.noaa.gov/products/summary/10-minute-solar-wind.json');
        if (!solarRes.ok) throw new Error('Chyba při načítání dat slunečního větru');
        
        const solarData = await solarRes.json();

        let bz = null, speed = null, density = null;

        if (Array.isArray(solarData) && solarData.length > 0) {
            const lastRow = solarData[solarData.length - 1];
            bz = parseFloat(lastRow[1]);
            density = parseFloat(lastRow[2]);
            speed = parseFloat(lastRow[3]);
        } else if (typeof solarData === 'object' && solarData !== null) {
            bz = parseFloat(solarData.Bz);
            speed = parseFloat(solarData.Velocity);
            density = parseFloat(solarData.Density);
        }

        // 2. Přímé načtení Kp indexu
        let kp = '2.0';
        try {
            const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
            if (kpRes.ok) {
                const kpData = await kpRes.json();
                if (Array.isArray(kpData) && kpData.length > 1) {
                    const lastKp = kpData[kpData.length - 1];
                    kp = parseFloat(lastKp[1]).toFixed(1);
                }
            }
        } catch (kpErr) {
            console.warn('Kp data fallback:', kpErr);
        }

        if (isNaN(bz) || isNaN(speed) || isNaN(density)) {
            throw new Error('Chybějící číselná data');
        }

        updateAuroraUI({ bz, speed, density, kp });

    } catch (error) {
        console.error('Chyba při načítání živých dat:', error);
        document.getElementById('activityLevel').innerText = "DATA OFFLINE";
        document.getElementById('activityDesc').innerText = "Nepodařilo se připojit k NOAA satelitu. Zkuste obnovit stránku.";
    }

    // 3. Načtení 3denní Kp předpovědi
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
        if (!forecastRes.ok) return;

        const rawData = await forecastRes.json();
        if (Array.isArray(rawData) && rawData.length > 1) {
            const forecastItems = rawData.slice(1, 9).map(row => ({
                time: row[0] ? row[0].substring(11, 16) + ' UTC' : '--:--',
                kp: parseFloat(row[1]).toFixed(1)
            }));
            renderForecastTimeline(forecastItems);
        }
    } catch (e) {
        console.warn('Chyba předpovědi:', e);
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

fetchAuroraData();
setInterval(fetchAuroraData, REFRESH_INTERVAL);