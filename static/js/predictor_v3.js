// static/js/predictor_v3.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Get Elements (Initialization) ---
    const predictForm = document.getElementById('predict-form');
    const predictionResultArea = document.getElementById('prediction-result-area'); // Container for all results
    const predictionResultText = document.getElementById('prediction-result'); // Text part
    const predictBtn = predictForm ? predictForm.querySelector('button[type="submit"]') : null;
    const predictBtnText = document.getElementById('predict-btn-text');
    const predictSpinner = document.getElementById('predict-spinner');
    const useCurrentDataBtn = document.getElementById('use-current-data-btn'); // Geolocation fill button
    const geolocateIcon = document.getElementById('geolocate-icon');
    const geolocateSpinner = document.getElementById('geolocate-spinner');
    const geolocateText = document.getElementById('geolocate-text');

    // Chart instances
    let resultGaugeChart = null;
    let contributionChart = null;

    // --- Chart Plugin Setup (Re-used from Dashboard) ---
    const gaugeTextPlugin = {
        id: 'gaugeText',
        beforeDraw: (chart) => {
            // Draws AQI value and 'AQI' text inside the doughnut chart
            if (chart.config.type !== 'doughnut' || chart.canvas.id !== 'resultGaugeChart') return;
            const { ctx, width, height } = chart;
            const aqi = chart.config.data.datasets?.[0]?.data?.[0];
            if (aqi === undefined || aqi === null) return;
            const categoryInfo = getAqiCategoryInfo(aqi);
            ctx.restore();
            const fontSizeTitle = (height / 114).toFixed(2); const fontSizeCategory = (height / 220).toFixed(2);
            const colorMap = {'text-green-400':'#34d399','text-yellow-400':'#f59e0b','text-orange-400':'#f97316','text-red-400':'#ef4444','text-purple-400':'#a855f7','text-rose-700':'#be123c','text-slate-400':'#9ca3af'};
            ctx.font = `bold ${fontSizeTitle}rem Poppins, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
            ctx.fillStyle = colorMap[categoryInfo.textColor] || '#9ca3af';
            ctx.fillText(aqi, width / 2, height / 2 - 10);
            ctx.font = `600 ${fontSizeCategory}rem Poppins, sans-serif`; ctx.fillStyle = '#9ca3af';
            ctx.fillText("AQI", width / 2, height / 2 + 20);
            ctx.save();
        }
    };
    // Register plugin safely
    if (typeof Chart !== 'undefined' && Chart.register) {
         try { Chart.register(gaugeTextPlugin); } catch (e) { console.warn("Could not register gaugeText plugin.", e); }
    }


    // --- Chart Drawing Functions ---

    function drawResultGauge(aqiValue) {
        // Draws the circular AQI gauge chart (Doughnut chart)
        const gaugeCtx = document.getElementById('resultGaugeChart')?.getContext('2d');
        if (!gaugeCtx) { console.error("Result Gauge Chart canvas not found."); return; }
        if (resultGaugeChart) resultGaugeChart.destroy(); // Destroy previous instance

        let displayAqi = 0;
        let categoryInfo = getAqiCategoryInfo(-1);
        if (aqiValue !== null && aqiValue !== undefined && !isNaN(aqiValue)){
            displayAqi = parseInt(aqiValue);
            categoryInfo = getAqiCategoryInfo(displayAqi);
        }

        resultGaugeChart = new Chart(gaugeCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [displayAqi, Math.max(0, 500 - displayAqi)],
                    backgroundColor: [categoryInfo.chartColor, 'rgba(255, 255, 255, 0.1)'],
                    borderWidth: 0, cutout: '80%'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false }, gaugeText: {} } }
        });
    }

    function drawContributionChart(subindices) {
        // Draws the bar chart showing contribution of each pollutant (Sub-Index)
        const contribCtx = document.getElementById('contributionChart')?.getContext('2d');
        if (!contribCtx) { console.error("Contribution Chart canvas not found."); return; }
        if (contributionChart) contributionChart.destroy(); // Destroy previous instance

        // Filter out zero/null/undefined and sort subindices for charting
        const chartData = Object.entries(subindices || {})
                              .filter(([key, value]) => value && value > 0)
                              .sort(([, a], [, b]) => b - a); // Sort descending by value

        if (chartData.length === 0) { 
            console.log("No contributing subindices found to draw chart."); 
            // Display a message on the canvas if no contribution is detected
            contribCtx.clearRect(0,0, contribCtx.canvas.width, contribCtx.canvas.height);
            contribCtx.fillStyle = '#9ca3af'; contribCtx.textAlign = 'center';
            contribCtx.fillText('No significant pollutant contribution detected', contribCtx.canvas.width / 2, contribCtx.canvas.height / 2);
            return;
        }

        const labels = chartData.map(([key]) => key); // Pollutant names (e.g., PM2.5, O3)
        const values = chartData.map(([, value]) => value); // Sub-index values

        const backgroundColors = ['#38bdf8', '#8b5cf6', '#f97316', '#ef4444', '#eab308', '#22c55e', '#6366f1'].slice(0, labels.length);

        contributionChart = new Chart(contribCtx, {
            type: 'bar', // Vertical bars
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sub-Index Value',
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, title: { display: false } },
                scales: {
                    y: { title: { display: true, text: 'Calculated Sub-Index' }, beginAtZero: true } // Y-axis is value
                }
            }
        });
    }

    // --- Geolocation and Data Filling ---
    async function fillWithCurrentData() {
        // Fetches current pollutants using Geolocation and fills the form inputs
        if (!navigator.geolocation) { showToast("Geolocation is not supported by this browser.", true); return; }

        // Set button to loading state
        if (!useCurrentDataBtn || !geolocateIcon || !geolocateSpinner || !geolocateText) { console.error("Geolocation button elements missing."); return; }
        useCurrentDataBtn.disabled = true; geolocateIcon.classList.add('hidden');
        geolocateSpinner.classList.remove('hidden'); geolocateText.textContent = 'Getting Location...';

        try {
            // 1. Get coordinates
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 // 5 min cache
                 });
            });
            const lat = position.coords.latitude; const lon = position.coords.longitude;
            geolocateText.textContent = 'Fetching Pollutants...'; console.log(`Geolocation acquired: ${lat}, ${lon}`);

            // 2. Fetch pollutant data from backend
            // NOTE: The URL must be /api/current_pollutants (Flask strict_slashes=False should fix path issues)
            const response = await fetch(`/api/current_pollutants?lat=${lat}&lon=${lon}`); 
            if (!response.ok) { 
                let errorMsg = `Failed to fetch pollutant data: ${response.statusText}`;
                try { const errorData = await response.json(); if (errorData.error) errorMsg = errorData.error; } catch(e){}
                throw new Error(errorMsg);
            }
            const data = await response.json();

            if (data.error) throw new Error(data.error); // Handle errors returned in JSON body

            console.log("Fetched current pollutant data:", data);

            // 3. Fill the form fields
            const featuresToFill = ['PM2.5', 'PM10', 'NO', 'NO2', 'NOx', 'NH3', 'CO', 'SO2', 'O3', 'Benzene', 'Toluene', 'Xylene'];
            let filledCount = 0;
            featuresToFill.forEach(feature => {
                const input = predictForm.elements[feature]; // Access form elements by name
                if (input) {
                    const value = data[feature];
                    if (value === null || value === undefined) {
                        input.value = ''; // Leave blank if data is null/missing
                    } else {
                         // Attempt to format, fallback to raw value if not a number
                         try {
                             input.value = parseFloat(value).toFixed(2);
                             filledCount++;
                         } catch (e) {
                             input.value = value; // Keep original if not parsable
                         }
                    }
                    input.style.borderColor = ''; // Clear error styling
                }
            });

            if (filledCount > 0) {
                 showToast('Form filled with available location data. Some fields (e.g., NOx, Organics) may be unavailable from this source.');
            } else {
                 showToast('Could not fetch any pollutant data to fill the form for your location.', true);
            }

        } catch (error) {
            console.error("Error getting current data:", error);
            // Provide more specific error messages
            let userMessage = `Error: ${error.message}`;
            if (error.code === 1) userMessage = "Geolocation permission denied.";
            else if (error.code === 2) userMessage = "Could not determine location (position unavailable).";
            else if (error.code === 3) userMessage = "Geolocation request timed out.";
            showToast(userMessage, true);
        } finally {
            // Reset button state
            useCurrentDataBtn.disabled = false;
            geolocateIcon.classList.remove('hidden');
            geolocateSpinner.classList.add('hidden');
            geolocateText.textContent = 'Use My Location Data';
        }
    }

    // Attach listener to the geolocation button
    if (useCurrentDataBtn) {
        useCurrentDataBtn.addEventListener('click', fillWithCurrentData);
    }

    // --- Current AQI Prediction Form Submission Logic ---
    if (predictForm && predictBtn && predictionResultArea) { // Simplified element check
        
        predictForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default page reload
            console.log("Predict form submitted.");

            // 1. Validation (Check if all required fields are filled)
            let isValid = true;
            const requiredInputs = predictForm.querySelectorAll('input[type="number"][required]');
            requiredInputs.forEach((input) => {
                if (!input || typeof input.value === 'undefined' || !input.value.trim()) {
                    isValid = false;
                    if(input) input.style.borderColor = 'red';
                } else {
                    if(input) input.style.borderColor = '';
                }
            });
            if (!isValid) { showToast('Please fill all fields with valid numbers.', true); return; }
            
            // 2. UI state: loading
            predictBtn.disabled = true; predictBtnText.classList.add('hidden');
            predictSpinner.classList.remove('hidden'); predictionResultArea.classList.add('hidden');

            try {
                // 3. Collect data and send to Flask API for prediction
                const formData = new FormData(predictForm); const dataObject = {};
                const features = ['PM2.5', 'PM10', 'NO', 'NO2', 'NOx', 'NH3', 'CO', 'SO2', 'O3', 'Benzene', 'Toluene', 'Xylene'];
                features.forEach(feature => { dataObject[feature] = formData.get(feature); });

                const response = await fetch('/api/predict_aqi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataObject) });
                const data = await response.json();
                if (!response.ok || !data.success) { throw new Error(data.error || 'Prediction request failed.'); }

                // 4. Draw Results (Gauge and Contribution Chart)
                const aqi = data.predicted_aqi;
                const categoryInfo = data.category_info;
                const subindices = data.subindices;

                // Update text summary
                predictionResultText.innerHTML = `<span class="text-2xl font-semibold ${categoryInfo.textColor}">${categoryInfo.category}</span><br><span class="text-sm text-slate-400">${categoryInfo.description}</span>`;
                predictionResultText.className = `mt-4 text-center p-4 rounded-lg border-t-4 ${categoryInfo.borderColor} ${categoryInfo.bgColor}`;

                drawResultGauge(aqi);
                drawContributionChart(subindices);

                predictionResultArea.classList.remove('hidden'); // Show results area
                console.log("Prediction successful:", data);

            } catch (error) {
                 console.error("Prediction submit error:", error);
                 // Display error message and destroy charts
                 predictionResultText.textContent = `Error: ${error.message}`;
                 predictionResultText.className = 'mt-4 text-center p-4 rounded-lg border-l-4 bg-red-500/20 text-red-300 border-red-500';
                 predictionResultArea.classList.remove('hidden');
                 if (resultGaugeChart) resultGaugeChart.destroy(); resultGaugeChart = null;
                 if (contributionChart) contributionChart.destroy(); contributionChart = null;

            } finally {
                 // 5. Final state reset
                 predictBtn.disabled = false; predictBtnText.classList.remove('hidden');
                 predictSpinner.classList.add('hidden');
            }
        }); // End prediction event listener

    } else {
         console.warn("Could not initialize prediction form listener. Check HTML IDs:", {
             predictForm: !!predictForm, predictBtn: !!predictBtn, predictBtnText: !!predictBtnText,
             predictSpinner: !!predictSpinner, predictionResultText: !!predictionResultText, predictionResultArea: !!predictionResultArea
         });
    }

    // Fallback checks to ensure required global functions are present
    if (typeof getAqiCategoryInfo === 'undefined') {
        console.error('getAqiCategoryInfo function is not defined.');
        window.getAqiCategoryInfo = (aqi) => ({ category: 'N/A', description: '', textColor: 'text-slate-400', borderColor: 'border-slate-500', bgColor: 'bg-slate-500/10', chartColor: '#64748b' });
    }
    if (typeof showToast === 'undefined') {
        console.warn('showToast function is not defined. Ensure main.js is loaded.');
        window.showToast = (message, isError = false) => { alert(`Toast (${isError ? 'Error' : 'Info'}): ${message}`); };
    }

}); // End DOMContentLoaded