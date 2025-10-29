// Chart.js Global Configuration
let currentDashboardData = {};
Chart.defaults.color = '#9ca3af';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.plugins.legend.position = 'bottom';

// ADDED 'no'
const pollutantInfo = {
    pm25: { name: 'PM2.5', unit: 'µg/m³', info: 'Fine particulate matter'},
    pm10: { name: 'PM10', unit: 'µg/m³', info: 'Coarse particulate matter'},
    no: { name: 'NO', unit: 'µg/m³', info: 'Nitrogen Monoxide'},
    no2: { name: 'NO₂', unit: 'µg/m³', info: 'Nitrogen Dioxide'},
    so2: { name: 'SO₂', unit: 'µg/m³', info: 'Sulphur Dioxide'},
    co: { name: 'CO', unit: 'µg/m³', info: 'Carbon Monoxide'},
    o3: { name: 'O₃', unit: 'µg/m³', info: 'Ozone'},
    nh3: { name: 'NH₃', unit: 'µg/m³', info: 'Ammonia'}
};

// Uses Indian AQI scale categories defined in backend ml_handler.py
function getAqiCategoryInfo(aqi) {
    if (aqi === 'N/A' || aqi === null || aqi === undefined || aqi < 0) {
        return {
            category: 'N/A',
            description: 'Data not available.',
            textColor: 'text-slate-400',
            borderColor: 'border-slate-500',
            bgColor: 'bg-slate-500/10',
            chartColor: '#64748b'
        };
    }
    const aqiNum = parseInt(aqi);
    if (aqiNum <= 50) return {
        category: 'Good',
        description: 'Minimal impact.',
        textColor: 'text-green-400',
        borderColor: 'border-green-500',
        bgColor: 'bg-green-500/10',
        chartColor: '#34d399'
    };
    if (aqiNum <= 100) return {
        category: 'Satisfactory',
        description: 'Minor breathing discomfort.',
        textColor: 'text-yellow-400',
        borderColor: 'border-yellow-500',
        bgColor: 'bg-yellow-500/10',
        chartColor: '#f59e0b'
    };
    if (aqiNum <= 200) return {
        category: 'Moderate',
        description: 'Discomfort to sensitive groups.',
        textColor: 'text-orange-400',
        borderColor: 'border-orange-500',
        bgColor: 'bg-orange-500/10',
        chartColor: '#f97316'
    };
    if (aqiNum <= 300) return {
        category: 'Poor',
        description: 'Breathing discomfort to most people.',
        textColor: 'text-red-400',
        borderColor: 'border-red-500',
        bgColor: 'bg-red-500/10',
        chartColor: '#ef4444'
    };
    if (aqiNum <= 400) return {
        category: 'Very Poor',
        description: 'Respiratory illness on prolonged exposure.',
        textColor: 'text-purple-400',
        borderColor: 'border-purple-500',
        bgColor: 'bg-purple-500/10',
        chartColor: '#a855f7'
    };
    // > 400
    return {
        category: 'Severe',
        description: 'Serious health effects.',
        textColor: 'text-rose-700',
        borderColor: 'border-rose-700',
        bgColor: 'bg-rose-800/20',
        chartColor: '#be123c'
    };
}

// --- START OF FIX ---
// Removed the main AQI card generation from this function
function updatePollutants(data) {
    const container = document.getElementById('aqi-section');
    if (!container) return; // Exit if element not found
    container.innerHTML = ''; // Clear previous content

    // --- REMOVED THIS BLOCK ---
    // const aqiValue = (data && data.aqi !== 'N/A') ? data.aqi : 'N/A';
    // const categoryInfo = getAqiCategoryInfo(aqiValue);
    // const cityName = (data && data.city) ? data.city : 'Loading...';
    // const mainPollutantCard = ` ... `; // The big card definition was here
    // container.innerHTML += mainPollutantCard;
    // --- END OF REMOVED BLOCK ---


    // Define the order and iterate - KEEP THIS PART
    const pollutantKeys = ['pm25', 'pm10', 'no', 'no2', 'so2', 'co', 'o3', 'nh3'];
    pollutantKeys.forEach(key => {
        const value = (data && data[key] !== undefined && data[key] !== 'N/A') ? data[key] : 'N/A';
        const info = pollutantInfo[key];
        if (!info) return; // Should not happen if pollutantInfo is complete

        // Display N/A gracefully
        const displayValue = value === 'N/A' ? value : parseFloat(value).toFixed(2); // Format numbers
        const valueColor = value === 'N/A' ? 'text-slate-400' : 'text-teal-300';

        const card = `
            <div class="glass-card p-4 text-center space-y-1">
                <div class="text-lg font-bold text-white">${info.name}</div>
                <div class="text-2xl font-semibold ${valueColor}">${displayValue}</div>
                <div class="text-xs text-slate-400">${value !== 'N/A' ? info.unit : ''}</div>
            </div>
        `;
        container.innerHTML += card;
    });
}
// --- END OF FIX ---


function updateWeather(data) {
    // Target the specific new card divs
    const cardTemp = document.getElementById('weather-card-temp');
    const cardWind = document.getElementById('weather-card-wind');
    const cardMisc = document.getElementById('weather-card-misc');
    const cardSun = document.getElementById('weather-card-sun');

    // Ensure all target elements exist
    if (!cardTemp || !cardWind || !cardMisc || !cardSun) {
        console.error("One or more weather card elements not found in HTML.");
        // Attempt to clear any existing invalid content
        if(cardTemp) cardTemp.innerHTML = '<p class="text-red-400">UI Error</p>';
        if(cardWind) cardWind.innerHTML = '<p class="text-red-400">UI Error</p>';
        if(cardMisc) cardMisc.innerHTML = '<p class="text-red-400">UI Error</p>';
        if(cardSun) cardSun.innerHTML = '<p class="text-red-400">UI Error</p>';
        return;
    }

    if (!data || data.error) {
        const errorMsg = data?.error || 'Weather data unavailable.';
        cardTemp.innerHTML = `<p class="text-red-400 text-center col-span-full">${errorMsg}</p>`;
        cardWind.innerHTML = ''; // Clear other cards on error
        cardMisc.innerHTML = '';
        cardSun.innerHTML = '';
        return;
    }

    // --- Card 1: Temperature / Feels Like / Description ---
    cardTemp.innerHTML = `
        <div class="flex items-center gap-3">
            <img src="http://openweathermap.org/img/wn/${data.icon || '01d'}@2x.png" alt="${data.description || ''}" class="w-16 h-16 -ml-2 -mt-2">
            <div>
                <div class="text-4xl font-bold text-white">${data.temp !== undefined ? data.temp + '°C' : 'N/A'}</div>
                <div class="text-sky-300 capitalize">${data.description || 'N/A'}</div>
            </div>
        </div>
        <div class="text-sm mt-2 pt-2 border-t border-slate-700/50">
             <div class="flex items-center justify-between">
                <span class="text-slate-400"><i class="fas fa-temperature-low w-5 text-center mr-1"></i> Feels Like</span>
                <span class="font-bold text-white">${data.feels_like !== undefined ? data.feels_like + '°C' : 'N/A'}</span>
            </div>
        </div>
    `;

    // --- Card 2: Wind / Pressure ---
     cardWind.innerHTML = `
        <div class="text-lg font-semibold text-white mb-2"><i class="fas fa-wind mr-2 text-blue-300"></i>Atmosphere</div>
        <div class="space-y-1 text-sm">
             <div class="flex items-center justify-between">
                <span class="text-slate-400">Wind</span>
                <span class="font-bold text-white">${data.wind_speed !== undefined ? data.wind_speed + ' km/h' : 'N/A'}</span>
            </div>
             <div class="flex items-center justify-between">
                <span class="text-slate-400">Pressure</span>
                <span class="font-bold text-white">${data.pressure !== undefined ? data.pressure + ' hPa' : 'N/A'}</span>
            </div>
        </div>
    `;

    // --- Card 3: Humidity / Visibility ---
     cardMisc.innerHTML = `
        <div class="text-lg font-semibold text-white mb-2"><i class="fas fa-smog mr-2 text-slate-400"></i>Conditions</div>
        <div class="space-y-1 text-sm">
            <div class="flex items-center justify-between">
                <span class="text-slate-400"><i class="fas fa-tint w-5 text-center mr-1 text-blue-400"></i> Humidity</span>
                <span class="font-bold text-white">${data.humidity !== undefined ? data.humidity + '%' : 'N/A'}</span>
            </div>
             <div class="flex items-center justify-between">
                <span class="text-slate-400"><i class="fas fa-eye w-5 text-center mr-1 text-gray-300"></i> Visibility</span>
                <span class="font-bold text-white">${data.visibility !== undefined ? data.visibility + ' km' : 'N/A'}</span>
            </div>
        </div>
    `;

    // --- Card 4: Sunrise / Sunset ---
    cardSun.innerHTML = `
         <div class="text-lg font-semibold text-white mb-2"><i class="far fa-sun mr-2 text-yellow-300"></i>Daylight</div>
         <div class="space-y-1 text-sm">
             <div class="flex items-center justify-between">
                 <span class="text-slate-400"><i class="fas fa-sunrise w-5 text-center mr-1 text-yellow-400"></i> Sunrise</span>
                 <span class="font-bold text-white">${data.sunrise || 'N/A'}</span>
            </div>
             <div class="flex items-center justify-between">
                <span class="text-slate-400"><i class="fas fa-sunset w-5 text-center mr-1 text-orange-400"></i> Sunset</span>
                <span class="font-bold text-white">${data.sunset || 'N/A'}</span>
            </div>
        </div>
    `;
}

function updateForecast(forecastData) { // forecastData is now the 'daily' array
    const container = document.getElementById('forecast-section');
     if (!container) return;
    container.innerHTML = ''; // Clear previous

    // Check if forecastData is valid (should be the 'daily' array)
    if (!forecastData || !Array.isArray(forecastData) || forecastData.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center col-span-full p-4">5-Day forecast unavailable.</p>';
        return;
    }

    forecastData.forEach(f => {
        // Provide defaults for potentially missing forecast data points
        const day = f.day || 'N/A';
        const icon = f.icon || '01d';
        const desc = f.desc || 'N/A';
        const temp_max = f.temp_max !== undefined ? `${f.temp_max}°` : 'N/A';
        const temp_min = f.temp_min !== undefined ? `${f.temp_min}°C` : '';
        const max_pop = f.max_pop !== undefined ? `${f.max_pop}%` : 'N/A';

        container.innerHTML += `
            <div class="glass-card p-3 text-center space-y-2 bg-slate-800/50">
                <div class="text-sm font-semibold text-slate-300">${day}</div>
                <img src="http://openweathermap.org/img/wn/${icon}.png" alt="${desc}" class="mx-auto w-10 h-10">
                <div class="text-lg font-bold text-white">${temp_max} / ${temp_min}</div>
                <div class="text-xs text-sky-300 capitalize">${desc}</div>
                <div class="text-xs text-blue-300"><i class="fas fa-cloud-rain mr-1"></i> ${max_pop} chance</div>
            </div>
        `;
    });
}
// --- END REPLACE updateForecast ---

function updateHealthSummary(aqiData) {
    const summaryCard = document.getElementById('health-summary-card');
    const summaryContent = document.getElementById('summary-content');
    const summaryCityName = document.getElementById('summary-city-name'); // Although hidden, keep for potential future use

    if (!summaryCard || !summaryContent || !summaryCityName) {
         console.error("Health summary elements missing!");
         return;
     }

    if (!aqiData || aqiData.error || aqiData.aqi === 'N/A') {
        summaryCard.classList.add('hidden'); // Hide the card if data is invalid
        return;
    }

    // Ensure AQI is parsed correctly, default to -1 for category check if invalid
    let aqi = 'N/A';
    try {
        if(typeof aqiData.aqi === 'number') aqi = aqiData.aqi;
        else if (typeof aqiData.aqi === 'string') aqi = parseInt(aqiData.aqi);
        else throw new Error("AQI not number or string");
        if(isNaN(aqi)) aqi = -1;
    } catch(e) { aqi = -1; }

    const categoryInfo = getAqiCategoryInfo(aqi);
    const cityName = aqiData.city ? aqiData.city.split(',')[0] : 'Selected City';

    // Update hidden span if needed
    summaryCityName.textContent = cityName;

    // --- REMOVED COMMENTS ---
    summaryContent.innerHTML = `
        <div class="text-center">
             <div class="text-7xl font-bold ${categoryInfo.textColor}">${aqiData.aqi}</div>
             <div class="text-sm font-semibold text-slate-400 -mt-1">AQI</div>
        </div>
        <div class="text-left">
            <div class="text-2xl font-semibold ${categoryInfo.textColor}">${categoryInfo.category}</div>
             <p class="text-slate-400 text-sm mt-1">(${cityName})</p>
            <p class="text-slate-400 text-sm mt-1">${categoryInfo.description}</p>
        </div>
    `;
    // --- END REMOVED COMMENTS ---

    // Ensure correct classes are applied (overwriting previous state)
    summaryCard.className = `glass-card p-6 flex items-center justify-center gap-6 text-center animate-fade-in border-t-4 ${categoryInfo.borderColor}`;
    summaryCard.classList.remove('hidden'); // Make sure it's visible
}

let chartInstances = {};

function destroyCharts() {
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key] && typeof chartInstances[key].destroy === 'function') {
            chartInstances[key].destroy();
        }
        chartInstances[key] = null; // Clear reference
    });
    // No need to reset chartInstances = {} here, just nullify existing ones
}
// --- END REPLACE destroyCharts ---

const gaugeTextPlugin = {
    id: 'gaugeText',
    beforeDraw: (chart) => {
        if (chart.config.type !== 'doughnut' || chart.canvas.id !== 'gaugeChart') return;

        const { ctx, width, height } = chart;
        // Ensure data exists before trying to access it
        const aqi = chart.config.data.datasets?.[0]?.data?.[0];
        if (aqi === undefined || aqi === null) return; // Don't draw if no AQI

        const categoryInfo = getAqiCategoryInfo(aqi);

        ctx.restore(); // Restore context state

        // Calculate font sizes relative to canvas height
        const fontSizeTitle = (height / 114).toFixed(2);
        const fontSizeCategory = (height / 220).toFixed(2);

        // Map Tailwind text color classes to hex codes for Canvas
        const colorMap = {
            'text-green-400': '#34d399',
            'text-yellow-400': '#f59e0b',
            'text-orange-400': '#f97316',
            'text-red-400': '#ef4444',
            'text-purple-400': '#a855f7',
            'text-rose-700': '#be123c',
            'text-slate-400': '#9ca3af'
        };
        const titleColor = colorMap[categoryInfo.textColor] || '#9ca3af'; // Default color

        // Draw AQI value
        ctx.font = `bold ${fontSizeTitle}rem Poppins, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = titleColor;
        ctx.fillText(aqi, width / 2, height / 2 - 10); // Adjust vertical position slightly

        // Draw Category text
        ctx.font = `600 ${fontSizeCategory}rem Poppins, sans-serif`;
        ctx.fillStyle = '#9ca3af'; // Use a standard color for the category text
        ctx.fillText(categoryInfo.category, width / 2, height / 2 + 20); // Adjust vertical position

        ctx.save(); // Save context state
    }
};
Chart.register(gaugeTextPlugin);

// --- REPLACE drawCharts ---
function drawCharts(aqiData, historicalData, hourlyForecastData) { // Added hourlyForecastData
    destroyCharts(); // Clear previous charts

    // --- Check Data Validity ---
    const hasValidAqi = aqiData && !aqiData.error;
    const hasValidHistorical = historicalData && historicalData.length > 0;
    const hasValidHourly = hourlyForecastData && hourlyForecastData.length > 0;

    // --- Prepare Pollutant Data (only if AQI data is valid) ---
    let pollutants = [], pollutantValues = [], pollutantLabels = [], chartColors = [];
    if (hasValidAqi) {
        pollutants = ['pm25', 'pm10', 'no', 'no2', 'so2', 'co', 'o3', 'nh3'];
        pollutantValues = pollutants.map(p => (aqiData[p] !== 'N/A' && aqiData[p] !== undefined) ? parseFloat(aqiData[p]) : 0);
        pollutantLabels = pollutants.map(p => pollutantInfo[p] ? pollutantInfo[p].name : p.toUpperCase());
        chartColors = ['#38bdf8', '#6366f1', '#f87171', '#f97316', '#eab308', '#ef4444', '#8b5cf6', '#22c55e'].slice(0, pollutants.length);
    }
    const aqiValue = hasValidAqi && aqiData.aqi !== 'N/A' ? parseInt(aqiData.aqi) : 0;
    const categoryInfo = getAqiCategoryInfo(aqiValue);


    // --- 1. Line Chart (AQI Trend) ---
    const lineCtx = document.getElementById('lineChart')?.getContext('2d');
    if (lineCtx) {
        if (hasValidHistorical) {
            const historicalLabels = historicalData.map(h => h.hour);
            const historicalValues = historicalData.map(h => h.aqi === 'N/A' ? null : parseInt(h.aqi));
            const gradient = lineCtx.createLinearGradient(0, 0, 0, 350);
            gradient.addColorStop(0, 'rgba(20, 184, 166, 0.4)');
            gradient.addColorStop(1, 'rgba(20, 184, 166, 0.0)');
            chartInstances.line = new Chart(lineCtx, { /* ... options as before ... */
                type: 'line', data: { labels: historicalLabels, datasets: [{ label: 'AQI Trend (24h)', data: historicalValues, borderColor: '#14b8a6', backgroundColor: gradient, fill: true, tension: 0.4, spanGaps: true }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'AQI' }, beginAtZero: false }, x: { title: { display: true, text: 'Hour (Last 24h)'}}} }
            });
        } else { // Show message if no data
            lineCtx.clearRect(0,0, lineCtx.canvas.width, lineCtx.canvas.height); lineCtx.fillStyle = '#9ca3af'; lineCtx.textAlign = 'center'; lineCtx.fillText('Historical data unavailable', lineCtx.canvas.width / 2, lineCtx.canvas.height / 2);
        }
    }

    // --- 2. Bar Chart (Pollutant Levels) ---
    const barCtx = document.getElementById('barChart')?.getContext('2d');
    if (barCtx) {
        if (hasValidAqi) {
            chartInstances.bar = new Chart(barCtx, { /* ... options as before ... */
               type: 'bar', data: { labels: pollutantLabels, datasets: [{ label: 'Pollutant Levels (µg/m³)', data: pollutantValues, backgroundColor: chartColors }] },
               options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'Concentration (µg/m³)' }, beginAtZero: true } } }
            });
        } else { // Show message if no data
             barCtx.clearRect(0,0, barCtx.canvas.width, barCtx.canvas.height); barCtx.fillStyle = '#9ca3af'; barCtx.textAlign = 'center'; barCtx.fillText('Pollutant data unavailable', barCtx.canvas.width / 2, barCtx.canvas.height / 2);
        }
    }

    // --- 3. Doughnut Chart (Pollutant Composition) ---
    const pieCtx = document.getElementById('pieChart')?.getContext('2d');
     if (pieCtx) {
         if (hasValidAqi && pollutantValues.some(v => v > 0)) { // Only draw if there are values > 0
            chartInstances.pie = new Chart(pieCtx, { /* ... options as before ... */
                 type: 'doughnut', data: { labels: pollutantLabels, datasets: [{ label: 'Pollutant Levels', data: pollutantValues, backgroundColor: chartColors, borderWidth: 0 }] },
                 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { const pollutantKey = pollutants[context.dataIndex]; const unit = pollutantInfo[pollutantKey]?.unit || ''; label += context.parsed.toFixed(2) + (unit ? ` ${unit}` : ''); } return label; } } } } }
             });
         } else { // Show message if no data
             pieCtx.clearRect(0,0, pieCtx.canvas.width, pieCtx.canvas.height); pieCtx.fillStyle = '#9ca3af'; pieCtx.textAlign = 'center'; pieCtx.fillText('Composition unavailable', pieCtx.canvas.width / 2, pieCtx.canvas.height / 2);
         }
    }

    // --- 4. Gauge Chart (AQI Value) ---
    const gaugeCtx = document.getElementById('gaugeChart')?.getContext('2d');
    if (gaugeCtx) {
         if (hasValidAqi && aqiData.aqi !== 'N/A') {
            chartInstances.gauge = new Chart(gaugeCtx, { /* ... options as before ... */
                 type: 'doughnut', data: { datasets: [{ data: [aqiValue, Math.max(0, 500 - aqiValue)], backgroundColor: [categoryInfo.chartColor, 'rgba(255, 255, 255, 0.1)'], borderWidth: 0, circumference: 360, cutout: '80%' }] },
                 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false }, gaugeText: {} } }
             });
         } else { // Show message if no data
             gaugeCtx.clearRect(0,0, gaugeCtx.canvas.width, gaugeCtx.canvas.height); gaugeCtx.fillStyle = '#9ca3af'; gaugeCtx.textAlign = 'center'; gaugeCtx.fillText('AQI unavailable', gaugeCtx.canvas.width / 2, gaugeCtx.canvas.height / 2);
         }
    }

    // --- 5. NEW Hourly Forecast Chart ---
    // Called separately using the hourlyForecastData
    if (hasValidHourly) {
        drawHourlyForecastChart(hourlyForecastData); // Call the new function
    } else {
         // Clear or show message on the hourly chart canvas if needed
         const hourlyCtx = document.getElementById('hourlyForecastChart')?.getContext('2d');
         if(hourlyCtx) {
             hourlyCtx.clearRect(0,0, hourlyCtx.canvas.width, hourlyCtx.canvas.height); hourlyCtx.fillStyle = '#9ca3af'; hourlyCtx.textAlign = 'center'; hourlyCtx.fillText('Hourly data unavailable', hourlyCtx.canvas.width / 2, hourlyCtx.canvas.height / 2);
         }
    }

    // --- REMOVED Radar Chart ---
    // const radarCtx = document.getElementById('radarChart')?.getContext('2d');
    // if (radarCtx) { ... }
}
// --- END REPLACE drawCharts ---


async function changeCity() {
    const cityInput = document.getElementById('cityInput');
    const city = cityInput?.value?.trim(); // Use optional chaining
    if (!city) {
        showToast('Please enter a city name.', true);
        return;
    }
    // Update URL and trigger dashboard update
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('city', city);
    window.history.pushState({ path: currentUrl.href }, '', currentUrl.href); // Update URL without reloading
    await updateDashboard(city); // Fetch new data
}

async function savePreferredCity() {
    const cityInput = document.getElementById('cityInput');
    const city = cityInput?.value?.trim();
    if (!city) {
        showToast('Please enter a city name to save.', true);
        return;
    }
    try {
        const response = await fetch('/api/update_city', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save preferred city.');
        showToast(`Preferred city updated to ${data.city}!`);
        // No need to reload, just confirmation
    } catch (err) {
        showToast(err.message, true);
        console.error("Error saving preferred city:", err);
    }
}

async function updateTips(context = 'home') { // Default context to 'home'
    const cityDisplayElement = document.getElementById('dashboard-city-name');
    const city = cityDisplayElement?.textContent?.trim();
    const tipsSection = document.getElementById('tips-section');

    if (!city || !tipsSection) {
        console.warn("Cannot update tips: City name or tips section not found.");
        if (tipsSection) tipsSection.innerHTML = '<p class="text-slate-400 text-sm">Could not load city information for tips.</p>';
        return;
    }

    tipsSection.innerHTML = '<div class="text-slate-400 text-sm text-center py-4">Loading tips...</div>'; // Loading indicator

    try {
        const response = await fetch('/api/tips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, context })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch tips.');

        let tipsHtml = '';
        if (data.tips && data.tips.length > 0) {
            data.tips.forEach(tip => {
                tipsHtml += `
                    <div class="p-3 rounded-lg border-l-4 border-emerald-500 bg-emerald-500/10 animate-fade-in mb-2 last:mb-0">
                        <h4 class="font-semibold text-white text-sm">${tip.title}</h4>
                        <p class="text-xs text-slate-300 mt-1">${tip.description}</p>
                        ${tip.pollutants_targeted ? `<p class="text-xs text-sky-300 mt-1"><i class="fas fa-smog mr-1"></i> Targets: ${tip.pollutants_targeted}</p>` : ''}
                    </div>`;
            });
        } else {
            tipsHtml = '<p class="text-slate-400 text-sm text-center py-4">No specific tips available for these conditions.</p>';
        }
        tipsSection.innerHTML = tipsHtml;

    } catch (e) {
        console.error('Failed to update tips:', e);
        tipsSection.innerHTML = `<p class="text-red-400 text-sm text-center py-4">Could not load tips. ${e.message}</p>`;
    }
}

function initContextSelector() {
    const contextSelector = document.getElementById('context-selector');
    if (!contextSelector) return;

    contextSelector.addEventListener('click', (e) => {
        const button = e.target.closest('.context-btn');
        if (!button || button.classList.contains('active')) return; // Ignore clicks outside buttons or on active button

        // Remove active class from all buttons
        contextSelector.querySelectorAll('.context-btn').forEach(btn => btn.classList.remove('active'));
        // Add active class to the clicked button
        button.classList.add('active');

        const context = button.dataset.context;
        updateTips(context); // Update tips for the new context
    });

     // Set initial active state based on default context (e.g., 'home')
    const initialActiveButton = contextSelector.querySelector('.context-btn[data-context="home"]');
    if (initialActiveButton) {
        initialActiveButton.classList.add('active');
    }
}

async function updateDashboard(city) {
    const loadingEl = document.getElementById('loading');
    const errorMsgEl = document.getElementById('error-msg');
    const contentEl = document.getElementById('dashboard-content');
    const summaryCard = document.getElementById('health-summary-card');
    const updateBtn = document.getElementById('updateBtn');
    const cityInput = document.getElementById('cityInput');
    const dashboardCityTitle = document.getElementById('dashboard-city-name');
    const tipsCityTitle = document.getElementById('tips-heading-city-name'); // <-- Get the tips heading element

    // Ensure elements exist before manipulating
    if (!loadingEl || !errorMsgEl || !contentEl || !cityInput || !dashboardCityTitle || !tipsCityTitle) { // <-- Added tips title check
        console.error("Dashboard elements missing from the DOM.");
        return;
    }

    // Show loading state
    loadingEl.classList.remove('hidden');
    errorMsgEl.classList.add('hidden');
    contentEl.classList.add('hidden');
    if (summaryCard) summaryCard.classList.add('hidden');
    if (updateBtn) {
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Updating...';
        updateBtn.disabled = true;
    }
    dashboardCityTitle.textContent = 'Loading...';
    tipsCityTitle.textContent = 'Loading...'; // <-- Update tips title state

    try {
        // Fetch all data concurrently
        const [aqiRes, weatherRes, forecastRes, historicalRes] = await Promise.all([
            fetch(`/api/aqi/${encodeURIComponent(city)}`),
            fetch(`/api/weather/${encodeURIComponent(city)}`),
            fetch(`/api/forecast/${encodeURIComponent(city)}`),
            fetch(`/api/historical/${encodeURIComponent(city)}`),
        ]);

        // Process responses
        const aqi = aqiRes.ok ? await aqiRes.json() : { error: `AQI request failed: ${aqiRes.statusText}` };
        const weather = weatherRes.ok ? await weatherRes.json() : { error: `Weather request failed: ${weatherRes.statusText}` };
        const forecastData = forecastRes.ok ? await forecastRes.json() : { error: `Forecast request failed: ${forecastRes.statusText}`, daily: [], hourly: [] };
        const historical = historicalRes.ok ? await historicalRes.json() : { error: `Historical AQI request failed: ${historicalRes.statusText}` };

        if (aqi.error) { throw new Error(aqi.error); }

        currentDashboardData = { aqi, weather };

        // --- Update UI Elements ---
        const officialCityName = aqi.city || city; // Use official name from AQI data if available
        cityInput.value = officialCityName;
        dashboardCityTitle.textContent = officialCityName;
        tipsCityTitle.textContent = officialCityName; // <-- UPDATE THE TIPS TITLE HERE

        if (summaryCard) updateHealthSummary(aqi);
        updatePollutants(aqi);
        updateWeather(weather);
        updateForecast(forecastData.daily || []);
        updateHourlyWeatherCards(forecastData.hourly || []);

        // Update tips (now uses the updated city name implicitly via updateTips logic)
        document.querySelectorAll('.context-btn').forEach(btn => btn.classList.remove('active'));
        const homeBtn = document.querySelector('.context-btn[data-context="home"]');
        if (homeBtn) homeBtn.classList.add('active');
        updateTips('home'); // Fetch tips for the default context

        // Draw charts
        drawCharts(aqi, historical && !historical.error ? historical : [], forecastData.hourly || []);

        contentEl.classList.remove('hidden');

    } catch (e) {
        console.error('Dashboard update failed:', e);
        // Use the originally searched city name in titles on error
        dashboardCityTitle.textContent = city;
        tipsCityTitle.textContent = city; // <-- Update tips title on error too
        errorMsgEl.textContent = `Error loading data for ${city}: ${e.message}. Please try again or check console.`;
        errorMsgEl.classList.remove('hidden');
        // Clear UI state on major error
        updatePollutants({ city: city, aqi: 'N/A' }); updateWeather({ error: 'Data loading failed.' });
        updateForecast([]);
        updateHourlyWeatherCards([]);
        destroyCharts(); if (summaryCard) updateHealthSummary({error: true});
    } finally {
        loadingEl.classList.add('hidden');
        if (updateBtn) { updateBtn.innerHTML = '<i class="fas fa-search"></i>'; updateBtn.disabled = false; }
    }
}
// --- END MODIFY updateDashboard ---

function exportData() {
    if (!currentDashboardData.aqi || currentDashboardData.aqi.error) {
        showToast('No current data available to export.', true);
        return;
    }

    const aqi = currentDashboardData.aqi;
    const weather = currentDashboardData.weather || {}; // Use empty object if weather failed
    const city = aqi.city ? aqi.city.split(',')[0] : 'UnknownCity'; // Handle missing city name

    let csvContent = "data:text/csv;charset=utf-8,";
    // Include all pollutants from pollutantInfo keys
    const pollutantKeys = Object.keys(pollutantInfo);
    const headers = [
        "City", "AQI",
        ...pollutantKeys.map(k => pollutantInfo[k].name), // Use formatted names
        "Temperature_C", "FeelsLike_C", "Humidity_%", "Pressure_hPa", "Visibility_km", "Wind_Speed_kmh", "Weather_Description"
    ];
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\r\n"; // Quote headers

    const aqiValues = pollutantKeys.map(k => aqi[k] !== undefined && aqi[k] !== 'N/A' ? aqi[k] : ''); // Use empty string for N/A in CSV

    const row = [
        `"${city.replace(/"/g, '""')}"`, // Quote city name
        aqi.aqi !== 'N/A' ? aqi.aqi : '',
        ...aqiValues,
        weather.temp !== undefined ? weather.temp : '',
        weather.feels_like !== undefined ? weather.feels_like : '',
        weather.humidity !== undefined ? weather.humidity : '',
        weather.pressure !== undefined ? weather.pressure : '',
        weather.visibility !== undefined ? weather.visibility : '',
        weather.wind_speed !== undefined ? weather.wind_speed : '',
        weather.description ? `"${weather.description.replace(/"/g, '""')}"` : '' // Quote description
    ];
    csvContent += row.map(val => `${val}`).join(",") + "\r\n"; // Basic join, could be improved for edge cases

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    // Sanitize city name for filename
    const safeCity = city.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute("download", `airwatch_data_${safeCity}.csv`);
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);

    showToast('Data exported successfully!');
}

function drawHourlyForecastChart(hourlyData) {
     const hourlyCtx = document.getElementById('hourlyForecastChart')?.getContext('2d');
     if (!hourlyCtx || !hourlyData || hourlyData.length === 0) {
         console.warn("Cannot draw hourly forecast chart: Canvas not found or no data.");
         // Optionally clear canvas or show message
         if(hourlyCtx) {
             hourlyCtx.clearRect(0,0, hourlyCtx.canvas.width, hourlyCtx.canvas.height);
             hourlyCtx.fillStyle = '#9ca3af';
             hourlyCtx.textAlign = 'center';
             hourlyCtx.fillText('Hourly data unavailable', hourlyCtx.canvas.width / 2, hourlyCtx.canvas.height / 2);
         }
         return;
     }

     // Destroy previous instance if it exists
     if (chartInstances.hourly) {
        chartInstances.hourly.destroy();
     }

     const labels = hourlyData.map(h => h.time);
     const temps = hourlyData.map(h => h.temp);
     const pops = hourlyData.map(h => h.pop); // Precipitation probability

     chartInstances.hourly = new Chart(hourlyCtx, {
         type: 'line', // Use line chart
         data: {
             labels: labels,
             datasets: [
                 {
                     label: 'Temperature (°C)',
                     data: temps,
                     borderColor: '#f97316', // Orange for temp
                     backgroundColor: 'rgba(249, 115, 22, 0.1)',
                     yAxisID: 'yTemp', // Assign to the temperature axis
                     tension: 0.3,
                     fill: true
                 },
                 {
                     label: 'Chance of Rain (%)',
                     data: pops,
                     borderColor: '#38bdf8', // Blue for rain chance
                     backgroundColor: 'rgba(56, 189, 248, 0.1)',
                     type: 'bar', // Show rain chance as bars on secondary axis
                     yAxisID: 'yPop', // Assign to the probability axis
                     order: 1 // Draw bars behind the line
                 }
             ]
         },
         options: {
             responsive: true,
             maintainAspectRatio: false,
             interaction: { // Improve tooltip interaction
                 mode: 'index',
                 intersect: false,
             },
             plugins: {
                 legend: { display: true, position: 'top' }, // Show legend
                 tooltip: {
                     mode: 'index',
                     intersect: false,
                 }
             },
             scales: {
                 x: {
                     title: { display: true, text: 'Time' }
                 },
                 yTemp: { // Temperature axis (left)
                     type: 'linear',
                     position: 'left',
                     title: { display: true, text: 'Temperature (°C)' },
                     grid: {
                         drawOnChartArea: false, // Only draw grid for this axis if needed
                     },
                     // Suggest range slightly beyond data
                     // suggestedMin: Math.min(...temps) - 2,
                     // suggestedMax: Math.max(...temps) + 2
                 },
                 yPop: { // Precipitation Probability axis (right)
                     type: 'linear',
                     position: 'right',
                     min: 0,
                     max: 100, // Percentage axis
                     title: { display: true, text: 'Chance of Rain (%)' },
                     grid: {
                         drawOnChartArea: false // Avoid cluttering chart with right-axis grid lines
                     }
                 }
             }
         }
     });
}
// --- END ADD NEW FUNCTION ---

function renderTopCitiesList(containerId, citiesData) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element #${containerId} not found.`);
        return;
    }
    container.innerHTML = ''; // Clear loading message or previous content

    if (!citiesData || !Array.isArray(citiesData) || citiesData.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-sm p-4 text-center">Could not load city data.</p>`;
        return;
    }

    citiesData.forEach(cityInfo => {
        const categoryInfo = cityInfo.category || getAqiCategoryInfo(-1); // Use category from backend or fallback
        const item = `
            <div class="flex items-center justify-between p-2 rounded bg-slate-800/40 border-l-4 ${categoryInfo.borderColor}">
                <span class="font-medium text-slate-200 text-sm">${cityInfo.city || 'Unknown'}</span>
                <span class="font-bold text-lg ${categoryInfo.textColor}">${cityInfo.aqi !== undefined ? cityInfo.aqi : 'N/A'}</span>
            </div>
        `;
        container.innerHTML += item;
    });
}

async function loadAndRenderTopCities() {
    // Show loading state in both lists initially
    const indiaList = document.getElementById('top-indian-cities-list');
    const worldList = document.getElementById('top-world-cities-list');
    if (indiaList) indiaList.innerHTML = `<p class="text-slate-400 text-sm p-4 text-center">Loading Indian cities data...</p>`;
    if (worldList) worldList.innerHTML = `<p class="text-slate-400 text-sm p-4 text-center">Loading world cities data...</p>`;

    try {
        console.log("Fetching top cities AQI data...");
        const response = await fetch('/api/top_cities_aqi');
        if (!response.ok) {
            throw new Error(`Failed to fetch top cities data: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Top cities data received:", data);

        renderTopCitiesList('top-indian-cities-list', data.india || []);
        renderTopCitiesList('top-world-cities-list', data.world || []);

    } catch (error) {
        console.error("Error loading top cities AQI:", error);
        // Show error in both lists
        if (indiaList) indiaList.innerHTML = `<p class="text-red-400 text-sm p-4 text-center">Error loading data.</p>`;
        if (worldList) worldList.innerHTML = `<p class="text-red-400 text-sm p-4 text-center">Error loading data.</p>`;
        // Optionally show a toast message
        if (typeof showToast !== 'undefined') {
             showToast("Could not load top cities AQI data.", true);
        }
    }
}
// --- END NEW FUNCTIONS ---

function updateHourlyWeatherCards(hourlyData) {
    const container = document.getElementById('hourly-weather-cards-section');
    if (!container) {
        console.error("Hourly weather card container not found.");
        return;
    }
    container.innerHTML = ''; // Clear previous content or loading message

    if (!hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center p-4 w-full">Hourly weather data unavailable.</p>';
        return;
    }

    hourlyData.forEach(hour => {
        const card = `
            <div class="glass-card p-3 text-center space-y-1 min-w-[100px] flex-shrink-0">
                <div class="text-sm font-semibold text-slate-300">${hour.time || 'N/A'}</div>
                <img src="http://openweathermap.org/img/wn/${hour.icon || '01d'}.png" alt="" class="mx-auto w-10 h-10">
                <div class="text-lg font-bold text-white">${hour.temp !== undefined ? hour.temp + '°C' : 'N/A'}</div>
                <div class="text-xs text-blue-300 flex items-center justify-center gap-1">
                     <i class="fas fa-cloud-rain fa-xs"></i>
                     <span>${hour.pop !== undefined ? hour.pop + '%' : 'N/A'}</span>
                 </div>
            </div>
        `;
        container.innerHTML += card;
    });
}
// --- END ADD NEW FUNCTION ---

// --- MODIFY Initialization ---
document.addEventListener('DOMContentLoaded', async () => { // Make listener async
    initContextSelector(); // Setup context buttons

    // Add event listeners (Keep existing ones)
    const updateBtn = document.getElementById('updateBtn');
    if (updateBtn) updateBtn.addEventListener('click', changeCity);

    const cityInput = document.getElementById('cityInput');
    // Autocomplete handles Enter key, keep fallback?
    // if (cityInput) cityInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); changeCity(); } });

     const saveCityBtn = document.getElementById('saveCityBtn');
     if(saveCityBtn) saveCityBtn.addEventListener('click', savePreferredCity);

     const exportBtn = document.getElementById('exportBtn');
     if (exportBtn) exportBtn.addEventListener('click', exportData);

     // --- Initialize Autocomplete for Dashboard ---
     if (typeof initAutocomplete !== 'undefined') {
          initAutocomplete('cityInput', 'suggestionsDropdownDashboard', (selectedCity) => {
             console.log("Autocomplete selected:", selectedCity);
             updateDashboard(selectedCity); // Update dashboard on selection
         });
     } else {
         console.error("initAutocomplete function not found.");
         // Fallback if autocomplete fails
         if (updateBtn) updateBtn.addEventListener('click', changeCity);
         if (cityInput) cityInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); changeCity(); } });
     }
     // --- ---

    // --- Determine Initial City ---
    let initialCity = null;
    const urlParams = new URLSearchParams(window.location.search);

    // 1. Check URL parameter first
    if (urlParams.has('city')) {
        initialCity = urlParams.get('city');
        console.log(`Loading city from URL parameter: ${initialCity}`);
    } else {
        // 2. If no URL param, try Geolocation
        console.log("Attempting geolocation...");
        const geoCity = await getLocationAndLoadDashboard(); // Wait for geolocation/reverse geocoding
        if (geoCity) {
            initialCity = geoCity;
             console.log(`Loading city from Geolocation: ${initialCity}`);
        } else {
            // 3. Fallback to Preferred City (from session/template variable)
            if (window.PREFERRED_CITY) {
                initialCity = window.PREFERRED_CITY;
                console.log(`Loading preferred city: ${initialCity}`);
            } else {
                // 4. Final fallback to Default City
                initialCity = window.DEFAULT_CITY || 'Delhi';
                console.log(`Loading default city: ${initialCity}`);
            }
        }
    }
    // --- End Determining Initial City ---


    if (cityInput) cityInput.value = initialCity; // Pre-fill input
    await updateDashboard(initialCity); // Load data for the determined initial city
    loadAndRenderTopCities();
});
// --- END MODIFY Initialization ---

// --- NEW FUNCTION: Attempt Geolocation ---
async function getLocationAndLoadDashboard() {
    return new Promise(async (resolve) => {
        if (!navigator.geolocation) {
            console.log("Geolocation is not supported by this browser.");
            resolve(null); // Indicate failure to get location
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            console.log(`Geolocation success: Lat=${lat}, Lon=${lon}`);

            try {
                const response = await fetch(`/api/get_city_from_coords?lat=${lat}&lon=${lon}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Reverse geocoding failed: ${response.statusText}`);
                }
                const data = await response.json();
                if (data.city) {
                    console.log(`Reverse geocoded city: ${data.city}`);
                    resolve(data.city); // Return the found city name
                } else {
                    throw new Error("API returned no city name.");
                }
            } catch (error) {
                console.error("Failed to get city from coordinates:", error);
                resolve(null); // Indicate failure to get city name
            }
        }, (error) => {
            console.warn(`Geolocation error (${error.code}): ${error.message}`);
            resolve(null); // Indicate failure (permission denied or other error)
        }, {
            // Optional: Add options like timeout or accuracy
            enableHighAccuracy: false,
            timeout: 8000, // Wait max 8 seconds
            maximumAge: 600000 // Accept cached position up to 10 mins old
        });
    });
}
// --- END NEW FUNCTION ---

// Make sure DEFAULT_CITY and PREFERRED_CITY are defined in your base template or dashboard template
// Example in dashboard.html:
// <script>
//     window.DEFAULT_CITY = "{{ session.get('city', 'Delhi') }}"; // Use session's city as default
//     window.PREFERRED_CITY = "{{ session.get('city', '') }}"; // Pass preferred city if needed for logic
// </script>
// Add this before the dashboard.js script tag.