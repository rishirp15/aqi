import requests
from flask import current_app
from datetime import datetime, timedelta
import math
from models import db, Tip
from extensions import cache
from sqlalchemy import or_
import time
from collections import defaultdict

# --- CPCB AQI Calculation (from your provided info) ---

def calculate_indian_aqi(components):
    # Extract values, default to 0 if missing
    pm25 = components.get("pm2_5", 0)
    pm10 = components.get("pm10", 0)
    no2 = components.get("no2", 0)
    so2 = components.get("so2", 0)
    o3 = components.get("o3", 0)
    co = components.get("co", 0) / 1000  # Convert µg/m³ to mg/m³
    
    def get_sub_index(c, breakpoints):
        if c < breakpoints[0][0]: return breakpoints[0][1]
        if c > breakpoints[-1][0]: return breakpoints[-1][1]
        for i in range(len(breakpoints)-1):
            if breakpoints[i][0] <= c <= breakpoints[i+1][0]:
                c_low, i_low = breakpoints[i]
                c_high, i_high = breakpoints[i+1]
                if (c_high - c_low) == 0: return i_low
                return ((i_high - i_low)/(c_high - c_low)) * (c - c_low) + i_low
        return breakpoints[-1][1]
    
    PM25_bp = [(0,0),(30,50),(60,100),(90,200),(120,300),(250,400),(500,500)]
    PM10_bp = [(0,0),(50,50),(100,100),(250,200),(350,300),(430,400),(600,500)]
    NO2_bp  = [(0,0),(40,50),(80,100),(180,200),(280,300),(400,400),(600,500)]
    SO2_bp  = [(0,0),(40,50),(80,100),(380,200),(800,300),(1600,400),(2000,500)]
    O3_bp   = [(0,0),(50,50),(100,100),(168,200),(208,300),(748,400),(1000,500)]
    CO_bp   = [(0,0),(1,50),(2,100),(10,200),(17,300),(34,400),(50,500)]
    
    indices = {
        "PM2.5": get_sub_index(pm25, PM25_bp),
        "PM10": get_sub_index(pm10, PM10_bp),
        "NO2": get_sub_index(no2, NO2_bp),
        "SO2": get_sub_index(so2, SO2_bp),
        "O3": get_sub_index(o3, O3_bp),
        "CO": get_sub_index(co, CO_bp)
    }
    
    valid_indices = {k: v for k, v in indices.items() if v is not None}
    if not valid_indices:
        return 'N/A', 'N/A'

    max_pollutant = max(valid_indices, key=valid_indices.get)
    aqi = valid_indices[max_pollutant]
    
    return round(aqi), max_pollutant

# --- API Fetching Functions ---

@cache.cached(timeout=3600, key_prefix='coords_%s')
def get_coords_from_city(city_name):
    api_key = current_app.config['OPENWEATHER_API_KEY']
    url = current_app.config['GEOCODING_API_URL']
    params = {'q': city_name, 'limit': 1, 'appid': api_key}
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        if not data:
            return {'error': f'City "{city_name}" not found.'}
        return {'lat': data[0]['lat'], 'lon': data[0]['lon'], 'name': data[0]['name']}
    except requests.exceptions.RequestException as e:
        return {'error': f'Geocoding API error: {e}'}

@cache.cached(timeout=300)
def fetch_aqi(lat, lon, city_name_display):
    api_key = current_app.config['OPENWEATHER_API_KEY']
    url = "http://api.openweathermap.org/data/2.5/air_pollution"
    params = {'lat': lat, 'lon': lon, 'appid': api_key}
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json().get('list', [])[0]
        comp = data.get('components', {})
        aqi_value, main_pollutant = calculate_indian_aqi(comp)
        
        return {
            'aqi': aqi_value,
            'main_pollutant': main_pollutant,
            'city': city_name_display,
            'geo': [lat, lon],
            'pm25': comp.get('pm2_5', 'N/A'),
            'pm10': comp.get('pm10', 'N/A'),
            'no2': comp.get('no2', 'N/A'),
            'so2': comp.get('so2', 'N/A'),
            'co': comp.get('co', 'N/A'),
            'o3': comp.get('o3', 'N/A'),
            'nh3': comp.get('nh3', 'N/A'),
            'updated': datetime.fromtimestamp(data.get('dt')).strftime('%d %b %Y, %I:%M %p')
        }
    except requests.exceptions.RequestException as e:
        return {'error': f'Air Pollution API error: {e}'}

@cache.cached(timeout=900)
def fetch_weather(lat, lon, city_name_display):
    api_key = current_app.config['OPENWEATHER_API_KEY']
    url = "http://api.openweathermap.org/data/2.5/weather"
    params = {'lat': lat, 'lon': lon, 'appid': api_key, 'units': 'metric'}
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return {
            'temp': round(data['main']['temp']),
            'humidity': data['main']['humidity'],
            'wind_speed': round(data['wind']['speed'] * 3.6, 1),
            'description': data['weather'][0]['description'].title()
        }
    except requests.exceptions.RequestException as e:
        return {'error': f'Weather data unavailable for {city_name_display}'}

# --- NEW HELPER FUNCTION ---
def _process_daily_forecast(forecast_list):
    """Processes 40 timestamps into a 5-day forecast summary."""
    daily_data = defaultdict(lambda: {'temps': [], 'icons': [], 'descs': []})

    # Group data by day
    for entry in forecast_list:
        day = datetime.fromtimestamp(entry['dt']).strftime('%Y-%m-%d')
        daily_data[day]['temps'].append(entry['main']['temp'])
        
        # Store icon and description, favoring midday (12:00) for representation
        hour = datetime.fromtimestamp(entry['dt']).hour
        if hour == 12:
            daily_data[day]['icons'].insert(0, entry['weather'][0]['icon'])
            daily_data[day]['descs'].insert(0, entry['weather'][0]['description'].title())
        else:
            daily_data[day]['icons'].append(entry['weather'][0]['icon'])
            daily_data[day]['descs'].append(entry['weather'][0]['description'].title())

    processed_forecast = []
    # Sort by day and get min/max for the first 5 days
    for day_str, data in sorted(daily_data.items())[:5]:
        day_dt = datetime.strptime(day_str, '%Y-%m-%d')
        processed_forecast.append({
            'day': day_dt.strftime('%a, %b %d'), # Format as "Wed, Oct 29"
            'temp_min': round(min(data['temps'])),
            'temp_max': round(max(data['temps'])),
            'icon': data['icons'][0] if data['icons'] else '01d', # Default icon
            'desc': data['descs'][0] if data['descs'] else 'Clear Sky' # Default desc
        })
    return processed_forecast

@cache.cached(timeout=1800) # Cache forecast data for 30 minutes
def fetch_forecast(lat, lon):
    """
    Fetches 5-day / 3-hour Weather Forecast data and processes it into a daily summary.
    """
    api_key = current_app.config['OPENWEATHER_API_KEY']
    url = "http://api.openweathermap.org/data/2.5/forecast"
    params = {
        'lat': lat,
        'lon': lon,
        'appid': api_key,
        'units': 'metric',
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        full_forecast_list = response.json()['list']
        
        # Process the full list into a 5-day summary
        daily_summary = _process_daily_forecast(full_forecast_list)
        return daily_summary
        
    except Exception as e:
        print(f"Forecast error: {e}")
        return []

def fetch_historical_aqi(lat, lon):
    # ... (This function remains the same as the previous version) ...
    api_key = current_app.config['OPENWEATHER_API_KEY']
    url = "http://api.openweathermap.org/data/2.5/air_pollution/history"
    end_time = int(time.time())
    start_time = end_time - (24 * 3600)
    params = {'lat': lat, 'lon': lon, 'start': start_time, 'end': end_time, 'appid': api_key}
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json().get('list', [])
        historical = []
        for entry in data:
            aqi_value, _ = calculate_indian_aqi(entry.get('components', {}))
            historical.append({'hour': datetime.fromtimestamp(entry['dt']).strftime('%H:00'), 'aqi': aqi_value})
        if len(historical) < 24:
             return _simulate_historical_if_needed(historical)
        return historical
    except Exception as e:
        print(f"Historical AQI error: {e}")
        return _simulate_historical_if_needed([])

def _simulate_historical_if_needed(data):
    # ... (This function remains the same as the previous version) ...
    base_aqi = 50 
    if data:
        last_aqi = data[-1]['aqi']
        if last_aqi != 'N/A': base_aqi = int(last_aqi)
    historical = []
    now = datetime.now()
    for i in range(24):
        hour = now - timedelta(hours=i)
        variation = 15 * math.sin(i * math.pi / 12) + (5 * math.sin(i * math.pi / 4))
        simulated_aqi = max(10, int(base_aqi + variation))
        historical.append({'hour': hour.strftime('%H:00'), 'aqi': simulated_aqi})
    return historical[::-1]

def get_relevant_tips(aqi_data, context='home'):
    # ... (This function remains the same as the previous version) ...
    if 'error' in aqi_data or aqi_data.get('aqi') == 'N/A': return []
    aqi_value = int(aqi_data['aqi'])
    category_map = {'home': ['home'], 'outdoors': ['personal', 'community'], 'commuting': ['transport']}
    target_categories = category_map.get(context, ['home'])
    query = Tip.query.filter(Tip.category.in_(target_categories))
    if aqi_value > 200:
        tips = query.filter(Tip.impact == 'high').limit(3).all()
    elif aqi_value > 100:
        tips = query.filter(Tip.difficulty == 'easy').limit(3).all()
    else:
        tips = query.filter(Tip.category == 'personal').limit(3).all()
    return tips