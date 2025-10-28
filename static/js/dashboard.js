// Chart.js Global Configuration
let currentDashboardData = {};
Chart.defaults.color = '#9ca3af';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.plugins.legend.position = 'bottom';

const pollutantIcons = {
    pm25: '<i class="fas fa-smog text-slate-400"></i>',
    pm10: '<i class="fas fa-smog text-slate-500"></i>',
    no2: '<i class="fas fa-industry text-orange-400"></i>',
    so2: '<i class="fas fa-flask text-yellow-400"></i>',
    co: '<i class="fas fa-fire-alt text-red-500"></i>',
    o3: '<i class="fas fa-sun text-blue-400"></i>',
    nh3: '<i class="fas fa-leaf text-green-400"></i>'
};

const pollutantInfo = {
    pm25: { name: 'PM2.5', unit: 'µg/m³', info: '...'},
    pm10: { name: 'PM10', unit: 'µg/m³', info: '...'},
    no2: { name: 'NO₂', unit: 'µg/m³', info: '...'},
    so2: { name: 'SO₂', unit: 'µg/m³', info: '...'},
    co: { name: 'CO', unit: 'µg/m³', info: '...'},
    o3: { name: 'O₃', unit: 'µg/m³', info: '...'},
    nh3: { name: 'NH₃', unit: 'µg/m³', info: '...'}
};

function getAqiCategoryInfo(aqi) {
    if (aqi === 'N/A') return { category: 'N/A', description: 'Data not available.', textColor: 'text-slate-400', borderColor: 'border-slate-500', chartColor: '#64748b' };
    const aqiNum = parseInt(aqi);
    if (aqiNum > 400) return { category: 'Severe', description: 'Serious health effects.', textColor: 'text-rose-700', borderColor: 'border-rose-700', chartColor: '#be123c' };
    if (aqiNum > 300) return { category: 'Very Poor', description: 'Respiratory illness on prolonged exposure.', textColor: 'text-purple-400', borderColor: 'border-purple-500', chartColor: '#a855f7' };
    if (aqiNum > 200) return { category: 'Poor', description: 'Breathing discomfort to most people.', textColor: 'text-red-400', borderColor: 'border-red-500', chartColor: '#ef4444' };
    if (aqiNum > 100) return { category: 'Moderate', description: 'Discomfort to sensitive groups.', textColor: 'text-orange-400', borderColor: 'border-orange-500', chartColor: '#f97316' };
    if (aqiNum > 50) return { category: 'Satisfactory', description: 'Minor breathing discomfort.', textColor: 'text-yellow-400', borderColor: 'border-yellow-500', chartColor: '#f59e0b' };
    return { category: 'Good', description: 'Minimal impact.', textColor: 'text-green-400', borderColor: 'border-green-500', chartColor: '#34d399' };
}

function getAqiColor(aqi) {
    const aqiNum = parseInt(aqi);
    if (aqiNum > 200) return 'border-purple-500';
    if (aqiNum > 150) return 'border-red-500';
    if (aqiNum > 100) return 'border-orange-500';
    if (aqiNum > 50) return 'border-yellow-500';
    return 'border-green-500';
}

function updatePollutants(data) {
    const container = document.getElementById('aqi-section');
    container.innerHTML = '';
    const aqiValue = data.aqi !== 'N/A' ? parseInt(data.aqi) : 0;
    const categoryInfo = getAqiCategoryInfo(aqiValue);
    
    const mainPollutantCard = `
        <div class="col-span-2 md:col-span-3 lg:col-span-6 glass-card p-4 flex items-center justify-center gap-6 text-center border-t-4 ${categoryInfo.borderColor}">
             <div class="text-7xl font-bold ${categoryInfo.textColor}">${data.aqi}</div>
             <div>
                 <div class="text-3xl font-semibold ${categoryInfo.textColor}">${categoryInfo.category}</div>
                 <div class="text-sm text-slate-400 mt-1">${data.city}</div>
             </div>
        </div>
    `;
    container.innerHTML += mainPollutantCard;

    Object.keys(pollutantIcons).forEach(key => {
        const value = data[key];
        if (value === 'N/A' || value === undefined) return;
        const info = pollutantInfo[key];
        const card = `
            <div class="glass-card p-4 text-center space-y-1">
                <div class="text-lg font-bold text-white">${info.name}</div>
                <div class="text-2xl font-semibold text-teal-300">${value}</div>
                <div class="text-xs text-slate-400">${info.unit}</div>
            </div>
        `;
        container.innerHTML += card;
    });
}

function updateWeather(data) {
    const container = document.getElementById('weather-section');
    if (data.error) {
        container.innerHTML = `<p class="text-red-400">${data.error}</p>`;
        return;
    }
    container.innerHTML = `
        <div class="flex items-center justify-between"><span class="text-slate-400">Temperature</span> <span class="font-bold text-white">${data.temp}°C</span></div>
        <div class="flex items-center justify-between"><span class="text-slate-400">Humidity</span> <span class="font-bold text-white">${data.humidity}%</span></div>
        <div class="flex items-center justify-between"><span class="text-slate-400">Wind Speed</span> <span class="font-bold text-white">${data.wind_speed} km/h</span></div>
        <div class="text-center text-sm text-sky-300 capitalize pt-2">${data.description}</div>
    `;
}

// --- MODIFIED FUNCTION ---
function updateForecast(data) {
    const container = document.getElementById('forecast-section');
    container.innerHTML = '';
    if (!data.length) {
        container.innerHTML = '<p class="text-slate-400 text-center col-span-full">5-Day forecast unavailable.</p>';
        return;
    }
    data.forEach(f => {
        container.innerHTML += `
            <div class="glass-card p-3 text-center space-y-2 bg-slate-800/50">
                <div class="text-sm font-semibold text-slate-300">${f.day}</div>
                <img src="http://openweathermap.org/img/wn/${f.icon}.png" alt="${f.desc}" class="mx-auto w-10 h-10">
                <div class="text-lg font-bold text-white">${f.temp_max}° / ${f.temp_min}°C</div>
                <div class="text-xs text-sky-300 capitalize">${f.desc}</div>
            </div>
        `;
    });
}
// --- END MODIFIED FUNCTION ---

function updateHealthSummary(aqiData) {
    // ... (This function remains the same) ...
    const summaryCard = document.getElementById('health-summary-card');
    const summaryContent = document.getElementById('summary-content');
    const summaryCityName = document.getElementById('summary-city-name');
    if (aqiData.error || aqiData.aqi === 'N/A') {
        summaryCard.classList.add('hidden');
        return;
    }
    const aqi = parseInt(aqiData.aqi);
    const categoryInfo = getAqiCategoryInfo(aqi);
    summaryCityName.textContent = aqiData.city.split(',')[0];
    summaryContent.innerHTML = `
        <div class="text-6xl font-bold ${categoryInfo.textColor}">${aqi}</div>
        <div>
            <div class="text-2xl font-semibold ${categoryInfo.textColor}">${categoryInfo.category}</div>
            <p class="text-slate-400 text-sm mt-1">${categoryInfo.description}</p>
        </div>
    `;
    summaryCard.className = `glass-card p-6 text-center animate-fade-in border-t-4 ${categoryInfo.borderColor}`;
    summaryCard.classList.remove('hidden');
}


let chartInstances = {};

function destroyCharts() {
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};
}

const gaugeTextPlugin = {
    id: 'gaugeText',
    beforeDraw: (chart) => {
        if (chart.config.type !== 'doughnut' || chart.canvas.id !== 'gaugeChart') return;
        const { ctx, width, height } = chart;
        const aqi = chart.config.data.datasets[0].data[0];
        const categoryInfo = getAqiCategoryInfo(aqi);
        ctx.restore();
        const fontSizeTitle = (height / 114).toFixed(2);
        ctx.font = `bold ${fontSizeTitle}rem Poppins`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = categoryInfo.textColor.replace('text-', '#');
        ctx.fillText(aqi, width / 2, height / 2 - 10);
        const fontSizeCategory = (height / 220).toFixed(2);
        ctx.font = `600 ${fontSizeCategory}rem Poppins`;
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(categoryInfo.category, width / 2, height / 2 + 20);
        ctx.save();
    }
};
Chart.register(gaugeTextPlugin);

function drawCharts(aqiData, historicalData) {
    destroyCharts();
    
    const pollutants = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'nh3'];
    const pollutantValues = pollutants.map(p => aqiData[p] !== 'N/A' && aqiData[p] !== undefined ? aqiData[p] : 0);
    const pollutantLabels = pollutants.map(p => pollutantInfo[p] ? pollutantInfo[p].name : p);
    const chartColors = ['#38bdf8', '#6366f1', '#f97316', '#eab308', '#ef4444', '#8b5cf6', '#22c55e'];
    
    const aqiValue = aqiData.aqi !== 'N/A' ? parseInt(aqiData.aqi) : 0;
    const categoryInfo = getAqiCategoryInfo(aqiValue);

    // 1. Line Chart (AQI Trend)
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    const gradient = lineCtx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, 'rgba(20, 184, 166, 0.4)');
    gradient.addColorStop(1, 'rgba(20, 184, 166, 0.0)');
    chartInstances.line = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: historicalData.map(h => h.hour),
            datasets: [{
                label: 'AQI Trend (24h)',
                data: historicalData.map(h => h.aqi),
                borderColor: '#14b8a6',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { title: { display: true, text: 'AQI' } } }
        }
    });

    // 2. Bar Chart (Pollutant Levels)
    const barCtx = document.getElementById('barChart').getContext('2d');
    chartInstances.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: pollutantLabels,
            datasets: [{
                label: 'Pollutant Levels (µg/m³)',
                data: pollutantValues,
                backgroundColor: chartColors,
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { title: { display: true, text: 'Concentration (µg/m³)' } } }
        }
    });

    // 3. Doughnut Chart (Pollutant Contribution)
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    chartInstances.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: pollutantLabels,
            datasets: [{
                label: 'Pollutant Contribution',
                data: pollutantValues,
                backgroundColor: chartColors,
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
    
    // 4. Gauge Chart (Doughnut with Text)
    const gaugeCtx = document.getElementById('gaugeChart').getContext('2d');
    chartInstances.gauge = new Chart(gaugeCtx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [aqiValue, 500 - aqiValue], 
                backgroundColor: [categoryInfo.chartColor, 'rgba(255, 255, 255, 0.1)'],
                borderWidth: 0,
                circumference: 360,
                cutout: '80%'
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });

    // 5. Radar Chart (Pollutants)
    const radarCtx = document.getElementById('radarChart').getContext('2d');
    chartInstances.radar = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: pollutantLabels,
            datasets: [{
                label: 'Pollutant Levels (Raw)',
                data: pollutantValues,
                borderColor: '#a78bfa',
                backgroundColor: 'rgba(167, 139, 250, 0.2)',
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// initAutocomplete is no longer needed

async function changeCity() {
    const cityInput = document.getElementById('cityInput');
    const city = cityInput.value.trim();
    if (!city) {
        showToast('Please enter a city name.', true);
        return;
    }
    await updateDashboard(city);
}

async function savePreferredCity() {
    const city = document.getElementById('cityInput').value.trim();
    if (!city) {
        showToast('Please enter a city name.', true);
        return;
    }
    try {
        const response = await fetch('/api/update_city', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save.');
        showToast(`Preferred city updated to ${city}!`);
    } catch (err) {
        showToast(err.message, true);
    }
}

async function updateTips(context) {
    const city = document.getElementById('dashboard-city-name').textContent; 
    const tipsSection = document.getElementById('tips-section');
    tipsSection.innerHTML = '<div class="text-slate-400 text-sm">Loading tips...</div>';

    try {
        const response = await fetch('/api/tips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, context })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        let tipsHtml = '';
        if (data.tips && data.tips.length > 0) {
            data.tips.forEach(tip => {
                tipsHtml += `
                    <div class="p-3 rounded-lg border-l-4 border-emerald-500 bg-emerald-500/10 animate-fade-in">
                        <h4 class="font-semibold text-white text-sm">${tip.title}</h4>
                        <p class="text-xs text-slate-300">${tip.description}</p>
                    </div>`;
            });
        } else {
            tipsHtml = '<p class="text-slate-400 text-sm">No specific tips available for these conditions.</p>';
        }
        tipsSection.innerHTML = tipsHtml;

    } catch (e) {
        console.error('Failed to update tips:', e);
        tipsSection.innerHTML = `<p class="text-red-400 text-sm">Could not load tips. ${e.message}</p>`;
    }
}

function initContextSelector() {
    const contextSelector = document.getElementById('context-selector');
    if (!contextSelector) return; 

    contextSelector.addEventListener('click', (e) => {
        const button = e.target.closest('.context-btn');
        if (!button) return;

        contextSelector.querySelectorAll('.context-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const context = button.dataset.context;
        updateTips(context);
    });
}

async function updateDashboard(city) {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('error-msg').classList.add('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    
    const summaryCard = document.getElementById('health-summary-card');
    if (summaryCard) summaryCard.classList.add('hidden');

    const updateBtn = document.getElementById('updateBtn');
    if(updateBtn) {
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        updateBtn.disabled = true;
    }
    
    try {
        const [aqiRes, weatherRes, forecastRes, historicalRes] = await Promise.all([
            fetch(`/api/aqi/${encodeURIComponent(city)}`),
            fetch(`/api/weather/${encodeURIComponent(city)}`),
            fetch(`/api/forecast/${encodeURIComponent(city)}`),
            fetch(`/api/historical/${encodeURIComponent(city)}`),
        ]);

        const aqi = await aqiRes.json();
        const weather = await weatherRes.json();
        const forecast = await forecastRes.json();
        const historical = await historicalRes.json();

        currentDashboardData = { aqi, weather }; 

        if (aqi.error) {
            throw new Error(aqi.error);
        }
        if (weather.error) {
            console.warn(weather.error);
        }

        document.getElementById('dashboard-city-name').textContent = aqi.city;
        document.getElementById('cityInput').value = aqi.city;

        if (summaryCard) updateHealthSummary(aqi);
        updatePollutants(aqi);
        updateWeather(weather);
        updateForecast(forecast);
        
        document.querySelectorAll('.context-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.context-btn[data-context="home"]').classList.add('active');
        updateTips(aqi.city);

        if(historical.length > 0) {
            drawCharts(aqi, historical);
        } else {
            destroyCharts();
        }

        document.getElementById('dashboard-content').classList.remove('hidden');
    } catch (e) {
        console.error('Dashboard update failed:', e);
        const errorMsg = document.getElementById('error-msg');
        errorMsg.textContent = `${e.message}. Try a different city name.`;
        errorMsg.classList.remove('hidden');
    } finally {
        document.getElementById('loading').classList.add('hidden');
        if(updateBtn) {
            updateBtn.innerHTML = '<i class="fas fa-search"></i>';
            updateBtn.disabled = false;
        }
    }
}

function exportData() {
    if (!currentDashboardData.aqi || currentDashboardData.aqi.error) {
        showToast('No data available to export.', true);
        return;
    }

    const aqi = currentDashboardData.aqi;
    const weather = currentDashboardData.weather;
    const city = aqi.city.split(',')[0];
    
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = [
        "City", "AQI", "PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "NH3",
        "Temperature_C", "Humidity_%", "Wind_Speed_kmh", "Weather_Description"
    ];
    csvContent += headers.join(",") + "\r\n";

    const row = [
        city, aqi.aqi, aqi.pm25, aqi.pm10, aqi.no2, aqi.so2, aqi.co, aqi.o3, aqi.nh3,
        weather.temp || 'N/A', weather.humidity || 'N/A', weather.wind_speed || 'N/A', weather.description || 'N/A'
    ];
    csvContent += row.join(",") + "\r\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `airwatch_data_${city}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Data exported successfully!');
}

document.addEventListener('DOMContentLoaded', () => {
    // initAutocomplete(); // No longer needed
    initContextSelector();
});