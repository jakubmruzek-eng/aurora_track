const REFRESH_INTERVAL = 60000;

function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    document.querySelectorAll('.nav-links li').forEach(li => {
        li.classList.remove('active');
    });

    const activeSec = document.getElementById(sectionId);
    if (activeSec) {
        activeSec.classList.add('active');
        activeSec.style.display = 'flex';
    }

    const activeNavLi = document.getElementById(`nav-${sectionId}`);
    if (activeNavLi) {
        activeNavLi.classList.add('active');
    }
}

async function fetchAuroraData() {
    try {
        // Volání naší nové Vercel serverless funkce
        const response = await fetch('/api/aurora');
        if (response.ok) {
            const data = await response.json();
            
            // Aktualizace hlavních metrik reálnými daty z NOAA
            updateAuroraUI({
                bz: data.bz,
                speed: data.speed,
                density: data.density,
                kp: data.kp
            });

            // Pokud máš na webu připravený element pro predikci, můžeme s ní pracovat
            if (data.forecast) {
                console.3denniPredikce = data.forecast;
            }
        } else {
            throw new Error('API response not ok');
        }
    } catch (e) {
        console.warn('Nepodařilo se načíst reálná data, použijí se záložní hodnoty', e);
        // Fallback hodnoty, kdyby API výjimečně selhalo
        updateAuroraUI({ bz: -2.1, speed: 430, density: 4.5, kp: '3.0' });
    }

    initLocationAndWeather();
    updateMoonPhase();

    const timestamp = Date.now();

    // 1. Ovál polární záře
    const mapImg = document.getElementById('ovalMap');
    if (mapImg) {
        mapImg.src = `https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg?t=${timestamp}`;
    }

    // 2. Sluneční skvrny (SUVI 171)
    const sunspotsImg = document.getElementById('sunspotsImg');
    if (sunspotsImg) {
        sunspotsImg.src = `https://services.swpc.noaa.gov/images/animations/suvi/primary/171/latest.png?t=${timestamp}`;
    }

    // 3. Korónové díry (SUVI 195)
    const coronalHolesImg = document.getElementById('coronalHolesImg');
    if (coronalHolesImg) {
        coronalHolesImg.src = `https://services.swpc.noaa.gov/images/animations/suvi/primary/195/latest.png?t=${timestamp}`;
    }
}

function initLocationAndWeather() {
    const defaultLat = 66.5039;
    const defaultLon = 25.7294;
    const defaultName = "Rovaniemi, Finland";

    if (navigator.geolocation && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeatherAndLocation(position.coords.latitude, position.coords.longitude);
            },
            () => {
                fetchWeatherAndLocation(defaultLat, defaultLon, defaultName);
            },
            { timeout: 10000 }
        );
    } else {
        fetchWeatherAndLocation(defaultLat, defaultLon, defaultName);
    }
}

async function fetchWeatherAndLocation(lat, lon, customName = null) {
    try {
        let locationName = customName;
        if (!locationName) {
            const revRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            if (revRes.ok) {
                const revData = await revRes.json();
                const city = revData.city || revData.locality || "Current Location";
                const country = revData.countryName || "";
                locationName = country ? `${city}, ${country}` : city;
            }
        }

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,cloud_cover,wind_speed_10m&hourly=temperature_2m,cloud_cover,wind_speed_10m&forecast_days=1`);
        if (weatherRes.ok) {
            const data = await weatherRes.json();
            const temp = data.current.temperature_2m;
            const clouds = data.current.cloud_cover;
            const wind = data.current.wind_speed_10m;

            document.getElementById('weatherInfo').innerHTML = `📍 ${locationName} | 🌡️ ${temp}°C | ☁️ ${clouds}% clouds | 💨 ${wind} km/h`;
            
            document.getElementById('tempVal').innerText = `${temp} °C`;
            document.getElementById('cloudVal').innerText = `${clouds} %`;
            document.getElementById('dewVal').innerText = `${(temp - 2).toFixed(1)} °C`;
            
            document.getElementById('yrLocationTitle').innerText = `Hourly forecast for ${locationName}`;

            if (data.hourly && data.hourly.time) {
                renderHourlyWeather(data.hourly.time, data.hourly.cloud_cover, data.hourly.temperature_2m, data.hourly.wind_speed_10m);
            }
        }
    } catch (e) {
        console.warn('Počasí nedostupné', e);
    }
}

function renderHourlyWeather(times, clouds, temps, winds) {
    const container = document.getElementById('yrIframe');
    if (!container) return;

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; max-height: 350px; overflow-y: auto;">`;
    
    const nowHour = new Date().getHours();
    let count = 0;

    for (let i = 0; i < times.length && count < 16; i++) {
        const timeStr = times[i];
        const hour = parseInt(timeStr.substring(11, 13));

        if (hour >= nowHour || i === 0) {
            const timeLabel = timeStr.substring(11, 16);
            const cloud = clouds[i];
            const temp = temps[i];
            const wind = winds[i];

            let cloudIcon = '☀️';
            if (cloud > 20 && cloud <= 70) cloudIcon = '⛅';
            else if (cloud > 70) cloudIcon = '☁️';

            html += `
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 0.8rem; color: #a0aec0; font-weight: 600;">${timeLabel}</div>
                    <div style="font-size: 1.3rem; margin: 4px 0;">${cloudIcon}</div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #fff;">${temp}°C</div>
                    <div style="font-size: 0.75rem; color: #4ef0c6; margin-top: 2px;">☁️ ${cloud}%</div>
                    <div style="font-size: 0.7rem; color: #a0aec0;">💨 ${wind} m/s</div>
                </div>
            `;
            count++;
        }
    }
    html += `</div>`;
    container.innerHTML = html;
}

function updateMoonPhase() {
    const d = new Date();
    let year = d.getFullYear();
    let month = d.getMonth() + 1;
    const day = d.getDate();

    let c = 0, e = 0, jd = 0;
    if (month < 3) { year--; month += 12; }
    ++month;
    c = 365.25 * year;
    e = 30.6 * month;
    jd = c + e + day - 694039.0;
    jd /= 29.53058867;
    let phase = jd - Math.floor(jd);
    phase = phase * 100;

    let phaseName = "New Moon";
    if (phase > 1 && phase < 49) phaseName = "Waxing Crescent";
    else if (phase >= 49 && phase <= 51) phaseName = "First Quarter";
    else if (phase > 51 && phase < 99) phaseName = "Waxing Gibbous";
    else if (phase >= 99 || phase <= 1) phaseName = "Full Moon";
    else phaseName = "Waning Crescent";
    
    let illumination = Math.round(phase <= 50 ? phase * 2 : (100 - phase) * 2);
    if (illumination < 0) illumination = 0;

    const moonEl = document.getElementById('moonInfo');
    if (moonEl) {
        moonEl.innerHTML = `🟣 ${phaseName} — ${illumination}% illuminated`;
    }
}

function updateAuroraUI({ bz, speed, density, kp }) {
    const formattedBz = (bz > 0 ? '+' : '') + Number(bz).toFixed(1);

    document.getElementById('bzVal').innerText = `${formattedBz} nT`;
    document.getElementById('speedVal').innerText = `${Math.round(speed)} km/s`;
    document.getElementById('densityVal').innerText = `${Number(density).toFixed(1)} p/cm³`;
    document.getElementById('kpVal').innerText = `${kp}`;

    const statusCard = document.getElementById('statusCard');
    const levelEl = document.getElementById('activityLevel');
    const descEl = document.getElementById('activityDesc');

    statusCard.className = 'status-card';

    if (bz < -10 || speed > 600 || parseFloat(kp) >= 6.0) {
        statusCard.classList.add('status-masakr');
        levelEl.innerText = "🚨 AURORA MASAKR!";
        levelEl.style.color = "#f56565";
        descEl.innerText = "Extreme geomagnetic storm! Spectacular auroras overhead.";
    } else if (bz < -5 || speed > 480 || parseFloat(kp) >= 4.0) {
        statusCard.classList.add('status-better');
        levelEl.innerText = "⚡ BETTER CONDITIONS";
        levelEl.style.color = "#ecc94b";
        descEl.innerText = "Elevated activity. Very good chance of bright auroras.";
    } else if (bz < -2 || speed > 410 || parseFloat(kp) >= 2.5) {
        statusCard.classList.add('status-good');
        levelEl.innerText = "🟢 GOOD CHANCE";
        levelEl.style.color = "#48bb78";
        descEl.innerText = "Moderate conditions. Visible away from city lights.";
    } else {
        statusCard.classList.add('status-quiet');
        levelEl.innerText = "QUIET CONDITIONS";
        levelEl.style.color = "#cbd5e0";
        descEl.innerText = "Geomagnetic field is calm. Low chance right now.";
    }

    document.getElementById('lastUpdate').innerText = new Date().toLocaleTimeString();
}

document.addEventListener("DOMContentLoaded", () => {
    showSection('aurora');
});

fetchAuroraData();
setInterval(fetchAuroraData, REFRESH_INTERVAL);