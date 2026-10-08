const REFRESH_INTERVAL = 60000;

function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));

    const activeSec = document.getElementById(sectionId);
    if (activeSec) activeSec.classList.add('active');

    const activeNav = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
    if (activeNav) activeNav.parentElement.classList.add('active');
}

// JSONP callback pro živá data slunečního větru
window.handleAuroraJSONP = function(response) {
    try {
        if (!response || !response.contents) throw new Error('Prázdná odpověď');

        const solarData = typeof response.contents === 'string' 
            ? JSON.parse(response.contents) 
            : response.contents;

        let bz = null, speed = null, density = null;

        if (Array.isArray(solarData)) {
            const lastRow = solarData[solarData.length - 1];
            bz = parseFloat(lastRow[1]);
            density = parseFloat(lastRow[2]);
            speed = parseFloat(lastRow[3]);
        } else if (typeof solarData === 'object' && solarData !== null) {
            bz = parseFloat(solarData.Bz);
            speed = parseFloat(solarData.Velocity);
            density = parseFloat(solarData.Density);
        }

        if (isNaN(bz) || isNaN(speed) || isNaN(density)) throw new Error('Neplatná čísla v odpovědi');

        updateAuroraUI({ bz, speed, density, kp: '1.0' });

    } catch (error) {
        console.error('Chyba zpracování živých dat:', error);
    }
};

// JSONP callback pro 3denní předpověď NOAA
window.handleForecastJSONP = function(response) {
    try {
        if (!response || !response.contents) throw new Error('Prázdná odpověď předpovědi');

        const rawData = typeof response.contents === 'string'
            ? JSON.parse(response.contents)
            : response.contents;

        let kp1 = '2.0', kp2 = '2.3', kp3 = '1.7';

        if (Array.isArray(rawData) && rawData.length > 1) {
            const vals = rawData.slice(1).map(r => parseFloat(r[1])).filter(v => !isNaN(v));
            if (vals.length >= 3) {
                kp1 = vals[0].toFixed(1);
                kp2 = vals[Math.floor(vals.length / 3)].toFixed(1);
                kp3 = vals[Math.floor((vals.length / 3) * 2)].toFixed(1);
            }
        }

        updateForecastUI(kp1, kp2, kp3);

    } catch (e) {
        console.warn('Chyba parsování předpovědi, nastavuji výchozí odhad:', e);
        updateForecastUI('2.0', '2.3', '1.7');
    }
};

function fetchAuroraData() {
    // 1. Živá data z NOAA SWPC
    const targetUrl = 'https://services.swpc.noaa.gov/products/summary/10-minute-solar-wind.json';
    const jsonpUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&callback=handleAuroraJSONP`;

    const oldScript = document.getElementById('jsonp-aurora-script');
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = 'jsonp-aurora-script';
    script.src = jsonpUrl;
    document.body.appendChild(script);

    // 2. 3denní Kp předpověď
    const forecastUrl = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
    const forecastJsonpUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(forecastUrl)}&callback=handleForecastJSONP`;

    const oldForecastScript = document.getElementById('jsonp-forecast-script');
    if (oldForecastScript) oldForecastScript.remove();

    const fScript = document.createElement('script');
    fScript.id = 'jsonp-forecast-script';
    fScript.src = forecastJsonpUrl;
    document.body.appendChild(fScript);

    // 3. Obnova snímku oválu z NOAA OVATION
    const mapImg = document.getElementById('ovalMap');
    if (mapImg) {
        mapImg.src = `https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg?t=${new Date().getTime()}`;
    }
}

function updateForecastUI(kp1, kp2, kp3) {
    const el1 = document.getElementById('day1Kp');
    const el2 = document.getElementById('day2Kp');
    const el3 = document.getElementById('day3Kp');

    if (el1) el1.innerText = `Kp ${kp1}`;
    if (el2) el2.innerText = `Kp ${kp2}`;
    if (el3) el3.innerText = `Kp ${kp3}`;

    const st1 = document.getElementById('day1Status');
    const st2 = document.getElementById('day2Status');
    const st3 = document.getElementById('day3Status');

    if (st1) st1.innerText = getKpText(kp1);
    if (st2) st2.innerText = getKpText(kp2);
    if (st3) st3.innerText = getKpText(kp3);
}

function getKpText(kp) {
    const val = parseFloat(kp);
    if (val >= 5) return 'Geomagnetic Storm!';
    if (val >= 4) return 'Active Aurora';
    if (val >= 3) return 'Unsettled / Moderate';
    return 'Quiet Conditions';
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