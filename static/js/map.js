document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return; // Exit if not on the map page

    // Initialize Leaflet map centered on India
    const map = L.map('map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Store markers to update them instead of recreating
    const markers = {};

    // Helper function to get marker style based on AQI
    function getAqiStyle(aqi) {
        const categoryInfo = getAqiCategoryInfo(aqi); // Assumes getAqiCategoryInfo is available
        // Map chartColor hex to Leaflet style
        const colorMap = {
            '#34d399': '#22c55e', // Good (Green)
            '#f59e0b': '#eab308', // Satisfactory (Yellow)
            '#f97316': '#f97316', // Moderate (Orange)
            '#ef4444': '#ef4444', // Poor (Red)
            '#a855f7': '#a855f7', // Very Poor (Purple)
            '#be123c': '#be123c', // Severe (Dark Red/Rose)
            '#64748b': '#64748b'  // N/A (Slate)
        };
        const color = colorMap[categoryInfo.chartColor] || '#64748b'; // Default to Slate
        return { color: color, fillColor: color };
    }

    // --- addCityMarker with Key/Update Logging ---
    function addCityMarker(cityData) {
        console.log("[addCityMarker] Data received:", JSON.stringify(cityData, null, 2));

        if (!cityData || cityData.aqi === 'N/A' || !cityData.geo || !cityData.geo[0]) {
             console.warn("[addCityMarker] Skipping: Invalid primary data (AQI/Geo).");
             return;
        }

        let aqi = 'N/A';
        try {
            if (typeof cityData.aqi === 'number') aqi = cityData.aqi;
            else if (typeof cityData.aqi === 'string') aqi = parseInt(cityData.aqi);
            else throw new Error("AQI not number or string");
            if (isNaN(aqi)) aqi = -1;
        } catch (e) { aqi = -1; console.warn(`[addCityMarker] AQI parse error: ${e}.`); }

        const coords = cityData.geo;
        const style = getAqiStyle(aqi);
        const weather = cityData.weather;
        const officialCityName = cityData.city || 'Unknown City'; // Use the name from the API response

        console.log(`[addCityMarker] Processing data for: ${officialCityName}`);
        console.log("[addCityMarker] Weather object:", JSON.stringify(weather, null, 2));

        // Weather Handling
        let weatherContent;
        if (weather && !weather.error) {
            const temp = weather.temp !== undefined ? `${weather.temp}°C` : 'N/A';
            const description = weather.description || 'N/A';
            const humidity = weather.humidity !== undefined ? `${weather.humidity}%` : 'N/A';
            const wind = weather.wind_speed !== undefined ? `${weather.wind_speed} km/h` : 'N/A';
            weatherContent = `<p><b>Weather:</b> ${description}</p><p><b>Temp:</b> ${temp}</p><p><b>Humidity:</b> ${humidity}</p><p><b>Wind:</b> ${wind}</p>`;
        } else {
            weatherContent = `<p class="text-slate-400 italic">Weather data unavailable.</p>`;
             if (weather && weather.error) console.warn(`[addCityMarker] Weather error: ${weather.error}`);
        }

        const popupContent = `
            <div class="p-1 text-sm">
                <h3 class="font-bold text-base mb-1">${officialCityName}</h3>
                <p><b>AQI:</b> <span class="font-bold text-lg" style="color:${style.color};">${cityData.aqi}</span> (${getAqiCategoryInfo(aqi).category})</p>
                <hr class="my-1 border-slate-600">
                ${weatherContent}
            </div>
        `;

        // Calculate radius
        let displayAqiNum = (typeof aqi === 'number' && aqi >= 0) ? aqi : 50;
        let radius = 6 + (displayAqiNum / 25);
        radius = Math.max(6, Math.min(radius, 20));

        const markerOptions = { ...style, radius: radius, weight: 1, opacity: 1, fillOpacity: 0.7 };

        // --- Marker Update/Add Logic ---
        // ** CRITICAL: Use the OFFICIAL city name from the response for the key **
        const cityNameKey = officialCityName.toLowerCase();
        console.log(`[addCityMarker] Using key: "${cityNameKey}"`); // Log the key being used

        const existingMarkerData = markers[cityNameKey];
        console.log(`[addCityMarker] Looked for existing marker with key "${cityNameKey}". Found:`, existingMarkerData ? 'Yes' : 'No');

        if (existingMarkerData && existingMarkerData.marker) {
            console.log(`[addCityMarker] Attempting to update existing marker for "${cityNameKey}".`);
            try {
                existingMarkerData.marker.setLatLng(coords);
                existingMarkerData.marker.setStyle(markerOptions);
                if (typeof existingMarkerData.marker.setRadius === 'function') {
                    existingMarkerData.marker.setRadius(radius);
                }
                existingMarkerData.marker.setPopupContent(popupContent);
                console.log(`[addCityMarker] Successfully updated marker for "${cityNameKey}".`);
                 // Open popup after successful update when searched
                 // existingMarkerData.marker.openPopup();
            } catch (updateError) {
                 console.error(`[addCityMarker] Error updating marker for "${cityNameKey}":`, updateError);
            }
        } else {
            // If it exists in 'markers' but marker is somehow null/undefined, remove bad entry
            if(existingMarkerData) {
                console.warn(`[addCityMarker] Found entry for "${cityNameKey}" but marker object was invalid. Removing entry.`);
                delete markers[cityNameKey];
            }

            console.log(`[addCityMarker] Creating new marker for "${cityNameKey}".`);
            try {
                const marker = L.circleMarker(coords, markerOptions).addTo(map);
                marker.bindPopup(popupContent);

                marker.on('mouseover', function (e) { this.openPopup(); this.setStyle({ weight: 3 }); });
                marker.on('mouseout', function (e) { this.closePopup(); this.setStyle({ weight: 1 }); });

                markers[cityNameKey] = { marker, coords }; // Store the new marker
                console.log(`[addCityMarker] Successfully created new marker for "${cityNameKey}".`);
                 // Open popup immediately after creating from search
                 // marker.openPopup();
            } catch (createError) {
                 console.error(`[addCityMarker] Error creating marker for "${cityNameKey}":`, createError);
            }
        }
    } // --- End addCityMarker ---


    // --- Load initial cities ---
    async function loadInitialCities() {
        try {
            const response = await fetch('/api/map_cities_data');
             if (!response.ok) {
                 let errorMsg = `Failed to fetch initial map data: ${response.status} ${response.statusText}`;
                 try {
                     const errorData = await response.json();
                     if (errorData && errorData.error) {
                         errorMsg = `Failed to load initial data: ${errorData.error}`;
                     }
                 } catch (e) { /* Ignore if response is not JSON */ }
                 throw new Error(errorMsg);
            }
            const cities = await response.json();
             if (!Array.isArray(cities)) {
                 throw new Error("Invalid format received for initial map data.");
             }
             if (cities.length === 0) {
                 console.warn("Initial map data fetch returned an empty list.");
                 if (typeof showToast !== 'undefined') {
                    showToast("No initial city data found.", false);
                 }
             } else {
                 cities.forEach(addCityMarker); // Add markers for each city received
             }
        } catch (error) {
            console.error('Error in loadInitialCities:', error);
             if (typeof showToast !== 'undefined') {
                showToast(error.message || "Could not load initial city data.", true);
             }
        }
    }

    // --- Ensure getAqiCategoryInfo is available ---
    // (Copy this from dashboard.js if dashboard.js isn't loaded globally before map.js)
     function getAqiCategoryInfo(aqi) {
         // This function MUST match the one in dashboard.js for consistency
         if (aqi === 'N/A' || aqi === null || aqi === undefined || aqi < 0) return { category: 'N/A', chartColor: '#64748b' };
         // Ensure aqi is treated as a number here too
         const aqiNum = parseInt(aqi);
          if (isNaN(aqiNum)) return { category: 'N/A', chartColor: '#64748b' }; // Handle parse failure

         if (aqiNum <= 50) return { category: 'Good', chartColor: '#34d399' };
         if (aqiNum <= 100) return { category: 'Satisfactory', chartColor: '#f59e0b' };
         if (aqiNum <= 200) return { category: 'Moderate', chartColor: '#f97316' };
         if (aqiNum <= 300) return { category: 'Poor', chartColor: '#ef4444' };
         if (aqiNum <= 400) return { category: 'Very Poor', chartColor: '#a855f7' };
         return { category: 'Severe', chartColor: '#be123c' };
    }
    // --- End getAqiCategoryInfo ---

    // --- Search Logic ---
    const searchInput = document.getElementById('mapSearchInput');
    // ** IMPORTANT: Add id="mapSearchButton" to your search icon/button in map.html **
    const searchButton = document.getElementById('mapSearchButton');

     const performSearch = async () => {
        console.log("performSearch started..."); // <-- Log start
        const cityName = searchInput.value.trim();
        if (!cityName) {
            console.log("City name is empty, exiting search."); // <-- Log empty input
            return;
        }

        searchInput.disabled = true;
        if (searchButton) searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            console.log(`Fetching data for: ${cityName}`); // <-- Log city being fetched
            const response = await fetch(`/api/city_data/${encodeURIComponent(cityName)}`);
            console.log(`Fetch response status: ${response.status}`); // <-- Log response status

            // Try to parse JSON regardless of status for potential error messages
            let cityData;
            try {
                cityData = await response.json();
                console.log("Parsed JSON response:", JSON.stringify(cityData, null, 2)); // <-- Log PARSED data
            } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonError);
                 throw new Error(`Invalid response from server: ${response.statusText}`);
            }


            if (!response.ok || cityData.error) {
                 console.error("Response not OK or contains error property."); // <-- Log error condition
                 // Throw error from JSON body if available, otherwise use status text
                 throw new Error(cityData.error || `Data fetch failed: ${response.statusText}`);
            }

            console.log("Fetch successful, calling addCityMarker..."); // <-- Log before calling addCityMarker
            addCityMarker(cityData); // Add or update the marker

            if (cityData.geo) {
                console.log("Flying to coordinates:", cityData.geo); // <-- Log flying action
                map.flyTo(cityData.geo, 10); // Fly to the location
            }
            // Optional: showToast(`Showing data for ${cityData.city}`);

        } catch (error) {
            // This catch block handles errors thrown above or network errors
            console.error("Error during performSearch:", error); // <-- Log the caught error
            if (typeof showToast !== 'undefined') {
                showToast(error.message || `Could not find data for "${cityName}".`, true);
            }
            // Fallback: Try to fly to location even if data fails, using geocoding
            try {
                 if (!window.OPENWEATHER_API_KEY) {
                     console.warn("OpenWeather API key not found for geocoding fallback.");
                     return;
                 }
                 const geoResponse = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${window.OPENWEATHER_API_KEY}`);
                 if (geoResponse.ok) {
                     const geoData = await geoResponse.json();
                     if (geoData && geoData.length > 0) {
                         map.flyTo([geoData[0].lat, geoData[0].lon], 10);
                     }
                 }
            } catch (geoError) {
                 console.error("Geocoding fallback failed:", geoError);
            }
        } finally {
             console.log("performSearch finished."); // <-- Log end
             // Reset loading indicator
            searchInput.disabled = false;
             if (searchButton) searchButton.innerHTML = '<i class="fas fa-search"></i>';
        }
    };


    // --- Event Listeners ---
    if (searchInput) {
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                 e.preventDefault();
                 await performSearch();
            }
        });
    }
    if (searchButton) {
        searchButton.addEventListener('click', async (e) => {
             e.preventDefault();
             await performSearch();
        });
    }

    // --- Initial Load ---
    // Ensure API Key is available before loading initial cities (needed for search fallback)
    // Add this script tag in map.html BEFORE loading map.js:
    // <script> window.OPENWEATHER_API_KEY = "{{ config.OPENWEATHER_API_KEY }}"; </script>
    if (!window.OPENWEATHER_API_KEY) {
         console.error("OpenWeather API key is missing. Add it to window.OPENWEATHER_API_KEY in the template.");
         if (typeof showToast !== 'undefined') {
            showToast("Configuration error: API key missing.", true);
         }
    } else {
         console.log("API Key found in window object."); // Log success
    }


    // Make sure showToast is available (should be from main.js)
    if (typeof showToast === 'undefined') {
        console.error('showToast function is not defined. Ensure main.js is loaded before map.js.');
        // Define a fallback showToast if needed for testing
        window.showToast = (message, isError = false) => {
            console.log(`Toast (${isError ? 'Error' : 'Info'}): ${message}`);
            // alert(`Toast (${isError ? 'Error' : 'Info'}): ${message}`); // Simple fallback
        };
    }

    loadInitialCities(); // Load initial data when DOM is ready
});