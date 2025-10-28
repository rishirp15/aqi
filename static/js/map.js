document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return; // Exit if not on the map page

    const map = L.map('map').setView([20.5937, 78.9629], 5); // Centered on India
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const markers = {};

    function getAqiStyle(aqi) {
        if (aqi > 150) return { color: '#ef4444', fillColor: '#ef4444' };
        if (aqi > 100) return { color: '#f97316', fillColor: '#f97316' };
        if (aqi > 50) return { color: '#eab308', fillColor: '#eab308' };
        return { color: '#22c55e', fillColor: '#22c55e' };
    }

    function addCityMarker(cityData) {
        if (cityData.aqi === 'N/A' || !cityData.geo || !cityData.geo[0]) return;

        const aqi = parseInt(cityData.aqi);
        const coords = cityData.geo;
        const style = getAqiStyle(aqi);
        const weather = cityData.weather;

        const popupContent = `
            <div class="p-1">
                <h3 class="font-bold text-lg">${cityData.city}</h3>
                <p class="text-base"><b>AQI:</b> <span class="font-bold" style="color:${style.color};">${aqi}</span></p>
                ${weather && !weather.error ? `
                <hr class="my-1">
                <p class="text-sm"><b>Weather:</b> ${weather.temp}°C, ${weather.description}</p>
                <p class="text-sm"><b>Humidity:</b> ${weather.humidity}%</p>
                ` : ''}
            </div>
        `;
        
        const marker = L.circleMarker(coords, {
            ...style,
            radius: 8 + (aqi / 30),
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        }).addTo(map);
        
        marker.bindPopup(popupContent);

        marker.on('mouseover', function (e) {
            this.openPopup();
        });
        marker.on('mouseout', function (e) {
            this.closePopup();
        });

        markers[cityData.city.toLowerCase()] = { marker, coords };
        return marker;
    }

    async function loadInitialCities() {
        try {
            const response = await fetch('/api/map_cities_data');
            const cities = await response.json();
            cities.forEach(addCityMarker);
        } catch (error) {
            console.error('Failed to fetch initial map data:', error);
        }
    }

    const searchInput = document.getElementById('mapSearchInput');
    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const cityName = searchInput.value.trim();
            if (!cityName) return;

            try {
                const response = await fetch(`/api/city_data/${encodeURIComponent(cityName)}`);
                if (!response.ok) {
                    throw new Error('City not found');
                }
                const cityData = await response.json();
                
                addCityMarker(cityData);
                if (cityData.geo) {
                    map.flyTo(cityData.geo, 10); 
                }
                showToast(`Found data for ${cityData.city}`);

            } catch (error) {
                showToast(`Could not find data for "${cityName}".`, true);
            }
        }
    });

    loadInitialCities();
});