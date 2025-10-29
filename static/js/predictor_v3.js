// static/js/predictor_v3.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Get Elements ---
    const predictForm = document.getElementById('predict-form');
    const predictionResultArea = document.getElementById('prediction-result-area'); // Container for all results
    const predictionResultText = document.getElementById('prediction-result'); // Text part
    const predictBtn = predictForm ? predictForm.querySelector('button[type="submit"]') : null;
    const predictBtnText = document.getElementById('predict-btn-text');
    const predictSpinner = document.getElementById('predict-spinner');
    const useCurrentDataBtn = document.getElementById('use-current-data-btn');
    const geolocateIcon = document.getElementById('geolocate-icon');
    const geolocateSpinner = document.getElementById('geolocate-spinner');
    const geolocateText = document.getElementById('geolocate-text');

    // Chart instances
    let resultGaugeChart = null;
    let contributionChart = null;

    // --- Chart Drawing Functions ---

    // Copied gaugeTextPlugin from dashboard.js - make sure getAqiCategoryInfo is available
    const gaugeTextPlugin = {
        id: 'gaugeText',
        beforeDraw: (chart) => {
            if (chart.config.type !== 'doughnut' || chart.canvas.id !== 'resultGaugeChart') return; // Target new ID
            const { ctx, width, height } = chart;
            const aqi = chart.config.data.datasets?.[0]?.data?.[0];
            if (aqi === undefined || aqi === null) return;
            const categoryInfo = getAqiCategoryInfo(aqi); // Assumes this function is available
            ctx.restore();
            const fontSizeTitle = (height / 114).toFixed(2); const fontSizeCategory = (height / 220).toFixed(2);
            // Color mapping needed if using Tailwind classes in categoryInfo
            const colorMap = {'text-green-400':'#34d399','text-yellow-400':'#f59e0b','text-orange-400':'#f97316','text-red-400':'#ef4444','text-purple-400':'#a855f7','text-rose-700':'#be123c','text-slate-400':'#9ca3af'};
            ctx.font = `bold ${fontSizeTitle}rem Poppins, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
            ctx.fillStyle = colorMap[categoryInfo.textColor] || '#9ca3af'; // Use mapped color or default
            ctx.fillText(aqi, width / 2, height / 2 - 10);
            ctx.font = `600 ${fontSizeCategory}rem Poppins, sans-serif`; ctx.fillStyle = '#9ca3af';
            ctx.fillText("AQI", width / 2, height / 2 + 20); // Always show AQI label here
            ctx.save();
        }
    };
    // Register plugin safely
    if (typeof Chart !== 'undefined' && Chart.register) {
         try {
             Chart.register(gaugeTextPlugin);
         } catch (e) {
             console.warn("Could not register gaugeText plugin, might already be registered.", e);
         }
    } else {
         console.error("Chart.js not loaded or register function unavailable.");
    }


    function drawResultGauge(aqiValue) {
        const gaugeCtx = document.getElementById('resultGaugeChart')?.getContext('2d');
        if (!gaugeCtx) {
            console.error("Result Gauge Chart canvas not found.");
            return;
        }

        if (resultGaugeChart) resultGaugeChart.destroy(); // Clear previous instance

        // Handle N/A or invalid AQI for gauge display
        let displayAqi = 0;
        let categoryInfo = getAqiCategoryInfo(-1); // Default to N/A category
        if (aqiValue !== null && aqiValue !== undefined && !isNaN(aqiValue)){
            displayAqi = parseInt(aqiValue); // Ensure integer for gauge
            categoryInfo = getAqiCategoryInfo(displayAqi);
        } else {
             // If AQI is invalid, show an empty gauge or specific state
             console.warn("Drawing gauge with N/A value.");
             // Optional: Display "N/A" text using a different method if needed
        }


        resultGaugeChart = new Chart(gaugeCtx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    // Max value assumed 500 for visualization consistency
                    data: [displayAqi, Math.max(0, 500 - displayAqi)],
                    backgroundColor: [categoryInfo.chartColor, 'rgba(255, 255, 255, 0.1)'],
                    borderWidth: 0,
                    // circumference: 180, // Make it a half-circle
                    // rotation: -90,     // Start at the bottom
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                // rotation: -90,      // For half circle
                // circumference: 180, // For half circle
                cutout: '80%',      // Doughnut thickness
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                    gaugeText: {} // Enable the custom plugin
                }
            }
        });
    }

    function drawContributionChart(subindices) {
        const contribCtx = document.getElementById('contributionChart')?.getContext('2d');
        if (!contribCtx) {
            console.error("Contribution Chart canvas not found.");
            return;
        }

        if (contributionChart) contributionChart.destroy(); // Clear previous instance

        // Filter out zero/null/undefined and sort subindices for charting
        const chartData = Object.entries(subindices || {})
                              .filter(([key, value]) => value && value > 0) // Only show pollutants with contribution > 0
                              .sort(([, a], [, b]) => b - a); // Sort descending by value

        if (chartData.length === 0) {
            console.log("No contributing subindices found to draw chart.");
            // Optionally display a message on the canvas
            contribCtx.clearRect(0,0, contribCtx.canvas.width, contribCtx.canvas.height);
            contribCtx.fillStyle = '#9ca3af'; contribCtx.textAlign = 'center';
            contribCtx.fillText('No significant pollutant contribution detected', contribCtx.canvas.width / 2, contribCtx.canvas.height / 2);
            return;
        }

        const labels = chartData.map(([key]) => key); // Pollutant names (e.g., PM2.5, O3)
        const values = chartData.map(([, value]) => value); // Sub-index values

         // Define consistent colors or map dynamically if needed
        const backgroundColors = ['#38bdf8', '#8b5cf6', '#f97316', '#ef4444', '#eab308', '#22c55e', '#6366f1'].slice(0, labels.length);

        contributionChart = new Chart(contribCtx, {
            type: 'bar', // Use vertical bars
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
                // indexAxis: 'y', // Switch back to vertical bars if preferred
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false }
                },
                scales: {
                    // x: { grid: { display: false } }, // Hide x-axis grid lines if vertical
                    y: { title: { display: true, text: 'Calculated Sub-Index' }, beginAtZero: true } // Y-axis is value if vertical
                }
            }
        });
    }

    // --- Geolocation and Data Filling ---
    async function fillWithCurrentData() {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by this browser.", true);
            return;
        }

        // Show loading state on button
        if (!useCurrentDataBtn || !geolocateIcon || !geolocateSpinner || !geolocateText) {
             console.error("Geolocation button elements missing.");
             return; // Prevent errors if elements aren't found
        }
        useCurrentDataBtn.disabled = true;
        geolocateIcon.classList.add('hidden');
        geolocateSpinner.classList.remove('hidden');
        geolocateText.textContent = 'Getting Location...';

        try {
            // Get position with timeout
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 // 5 min cache
                 });
            });

            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            geolocateText.textContent = 'Fetching Pollutants...';
            console.log(`Geolocation acquired: ${lat}, ${lon}`);

            // Fetch pollutant data from backend
            const response = await fetch(`/api/current_pollutants?lat=${lat}&lon=${lon}`);
            if (!response.ok) {
                let errorMsg = `Failed to fetch pollutant data: ${response.statusText}`;
                 try { const errorData = await response.json(); if (errorData.error) errorMsg = errorData.error; } catch(e){}
                throw new Error(errorMsg);
            }
            const data = await response.json();

            if (data.error) throw new Error(data.error); // Handle errors returned in JSON body

            console.log("Fetched current pollutant data:", data);

            // Fill the form fields
            const featuresToFill = ['PM2.5', 'PM10', 'NO', 'NO2', 'NOx', 'NH3', 'CO', 'SO2', 'O3', 'Benzene', 'Toluene', 'Xylene'];
            let filledCount = 0;
            featuresToFill.forEach(feature => {
                const input = predictForm.elements[feature]; // Access form elements by name
                if (input) {
                    const value = data[feature];
                    // Use empty string for null/undefined, otherwise format number if it's numeric
                    if (value === null || value === undefined) {
                        input.value = '';
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
                } else {
                    console.warn(`Input field for ${feature} not found in form.`);
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
    } else {
        console.warn("Button 'use-current-data-btn' not found.");
    }


    // --- Current AQI Prediction Form Submission Logic ---
    if (predictForm && predictBtn && predictBtnText && predictSpinner && predictionResultText && predictionResultArea) {
        console.log("Predict form elements found. Adding submit listener.");

        predictForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default page reload
            console.log("Predict form submitted.");

            // Validation
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
            if (!isValid) {
                showToast('Please fill all fields with valid numbers.', true);
                return;
            }
            console.log("Validation passed.");

            // UI state: loading
            predictBtn.disabled = true; predictBtnText.classList.add('hidden');
            predictSpinner.classList.remove('hidden'); predictionResultArea.classList.add('hidden');

            try {
                // Collect data
                const formData = new FormData(predictForm); const dataObject = {};
                const features = ['PM2.5', 'PM10', 'NO', 'NO2', 'NOx', 'NH3', 'CO', 'SO2', 'O3', 'Benzene', 'Toluene', 'Xylene'];
                features.forEach(feature => { dataObject[feature] = formData.get(feature); });
                console.log("Sending data for prediction:", dataObject);

                // Fetch prediction AND subindices
                const response = await fetch('/api/predict_aqi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataObject) });
                const data = await response.json();
                if (!response.ok || !data.success) { throw new Error(data.error || 'Prediction request failed.'); }

                // Display results
                const aqi = data.predicted_aqi;
                const categoryInfo = data.category_info;
                const subindices = data.subindices;

                // Update text result
                predictionResultText.innerHTML = `<span class="text-2xl font-semibold ${categoryInfo.textColor}">${categoryInfo.category}</span><br><span class="text-sm text-slate-400">${categoryInfo.description}</span>`;
                predictionResultText.className = `mt-4 text-center p-4 rounded-lg border-t-4 ${categoryInfo.borderColor} ${categoryInfo.bgColor}`;

                // Draw Charts
                drawResultGauge(aqi);
                drawContributionChart(subindices);

                predictionResultArea.classList.remove('hidden'); // Show results area
                console.log("Prediction successful:", data);

            } catch (error) {
                 console.error("Prediction submit error:", error);
                 predictionResultText.textContent = `Error: ${error.message}`;
                 predictionResultText.className = 'mt-4 text-center p-4 rounded-lg border-l-4 bg-red-500/20 text-red-300 border-red-500';
                 predictionResultArea.classList.remove('hidden'); // Show error area
                 // Destroy charts on error
                 if (resultGaugeChart) resultGaugeChart.destroy(); resultGaugeChart = null;
                 if (contributionChart) contributionChart.destroy(); contributionChart = null;
                 // Clear canvases explicitly
                 const gaugeCanvas = document.getElementById('resultGaugeChart');
                 const contribCanvas = document.getElementById('contributionChart');
                 if(gaugeCanvas) gaugeCanvas.getContext('2d').clearRect(0,0, gaugeCanvas.width, gaugeCanvas.height);
                 if(contribCanvas) contribCanvas.getContext('2d').clearRect(0,0, contribCanvas.width, contribCanvas.height);

            } finally {
                 predictBtn.disabled = false; predictBtnText.classList.remove('hidden');
                 predictSpinner.classList.add('hidden');
                 console.log("Prediction process finished.");
            }
        }); // End event listener

    } else {
         console.warn("Could not initialize prediction form listener. Check element IDs:", {
             predictForm: !!predictForm, predictBtn: !!predictBtn, predictBtnText: !!predictBtnText,
             predictSpinner: !!predictSpinner, predictionResultText: !!predictionResultText, predictionResultArea: !!predictionResultArea
         });
    }

    // --- Ensure necessary functions/variables are available ---
    // Make sure getAqiCategoryInfo is available (should be from ml_handler via template or global scope)
    if (typeof getAqiCategoryInfo === 'undefined') {
        console.error('getAqiCategoryInfo function is not defined. Ensure it is available globally.');
        // Define a minimal fallback if absolutely necessary
        window.getAqiCategoryInfo = (aqi) => ({ category: 'N/A', description: '', textColor: 'text-slate-400', borderColor: 'border-slate-500', bgColor: 'bg-slate-500/10', chartColor: '#64748b' });
    }
    // Make sure showToast is available (should be from main.js)
    if (typeof showToast === 'undefined') {
        console.warn('showToast function is not defined. Ensure main.js is loaded before predictor_v3.js.');
        window.showToast = (message, isError = false) => {
            alert(`Toast (${isError ? 'Error' : 'Info'}): ${message}`);
        };
    }

}); // End DOMContentLoaded