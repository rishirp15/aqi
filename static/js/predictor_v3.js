document.addEventListener('DOMContentLoaded', () => {
    const predictForm = document.getElementById('predict-form');
    const predictionResult = document.getElementById('prediction-result');
    const predictBtn = predictForm.querySelector('button[type="submit"]');
    const predictBtnText = document.getElementById('predict-btn-text');
    const predictSpinner = document.getElementById('predict-spinner');

    const forecastForm = document.getElementById('forecast-form');
    const forecastTableContainer = document.getElementById('forecast-table-container');
    const forecastTableBody = document.getElementById('forecast-table-body');
    const forecastSpinner = document.getElementById('forecast-spinner');
    const forecastChartCanvas = document.getElementById('forecastChart');
    let forecastChart = null; 

    // --- Current AQI Prediction Logic ---
    if (predictForm) {
        predictForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            predictBtn.disabled = true;
            predictBtnText.classList.add('hidden');
            predictSpinner.classList.remove('hidden');
            predictionResult.classList.add('hidden');

            try {
                // Use bracket notation for keys with '.'
                const dataObject = {
                    "City": predictForm.elements['City'].value,
                    "PM2.5": predictForm.elements['PM2.5'].value,
                    "PM10": predictForm.elements['PM10'].value,
                    "NO": predictForm.elements['NO'].value,
                    "NO2": predictForm.elements['NO2'].value,
                    "NOx": predictForm.elements['NOx'].value,
                    "NH3": predictForm.elements['NH3'].value,
                    "CO": predictForm.elements['CO'].value,
                    "SO2": predictForm.elements['SO2'].value,
                    "Toluene": predictForm.elements['Toluene'].value
                };
                
                const response = await fetch('/api/predict_aqi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataObject)
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Prediction request failed.');
                }

                const aqi = data.predicted_aqi;
                const categoryInfo = data.category_info;

                predictionResult.innerHTML = `Predicted AQI: <strong>${aqi} (${categoryInfo.category})</strong>`;
                predictionResult.className = `mt-4 text-center p-4 rounded-lg border-l-4 ${categoryInfo.color_class}`;
                predictionResult.classList.remove('hidden');

            } catch (error) {
                predictionResult.textContent = error.message;
                predictionResult.className = 'mt-4 text-center p-4 rounded-lg bg-red-500/20 text-red-300 border-red-500';
                predictionResult.classList.remove('hidden');
            } finally {
                predictBtn.disabled = false;
                predictBtnText.classList.remove('hidden');
                predictSpinner.classList.add('hidden');
            }
        });
    }

    // --- Forecast by Lag Values Logic ---
    if (forecastForm) {
        forecastForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            forecastSpinner.classList.remove('hidden');
            forecastTableContainer.classList.add('hidden');
            if (forecastChart) forecastChart.destroy();

            try {
                const formData = new FormData(forecastForm);
                const dataObject = Object.fromEntries(formData.entries());

                const response = await fetch('/api/forecast_aqi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataObject)
                });
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to fetch forecast.');
                }

                const forecastData = data.forecast;

                if (forecastData && forecastData.length > 0) {
                    forecastTableBody.innerHTML = '';
                    forecastData.forEach(item => {
                        const categoryBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full ${item.category_info.color_class}">${item.category_info.category}</span>`;
                        const row = `<tr>
                                        <td class="p-2">${item.date}</td>
                                        <td class="p-2">${item.forecast_aqi}</td>
                                        <td class="p-2">${categoryBadge}</td>
                                     </tr>`;
                        forecastTableBody.innerHTML += row;
                    });
                    forecastTableContainer.classList.remove('hidden');
                    drawForecastChart(forecastData);
                } else {
                    showToast('Forecast data could not be generated.', true);
                }

            } catch (error) {
                showToast(error.message, true);
            } finally {
                forecastSpinner.classList.add('hidden');
            }
        });
    }

    // --- Chart Drawing Function ---
    function drawForecastChart(data) {
        const ctx = forecastChartCanvas.getContext('2d');
        const labels = data.map(item => item.date);
        const values = data.map(item => item.forecast_aqi);
        
        const pointColors = data.map(item => {
            const colorClass = item.category_info.color_class;
            if (colorClass.includes('green')) return '#34d399';
            if (colorClass.includes('yellow')) return '#f59e0b';
            if (colorClass.includes('orange')) return '#f97316';
            if (colorClass.includes('red')) return '#ef4444';
            if (colorClass.includes('purple')) return '#a855f7';
            return '#f43f5e'; // Hazardous
        });

        forecastChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Forecasted AQI',
                    data: values,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167, 139, 250, 0.2)',
                    pointBackgroundColor: pointColors,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: false, title: { display: true, text: "AQI" } },
                    x: { title: { display: true, text: "Date" } }
                }
            }
        });
    }
});