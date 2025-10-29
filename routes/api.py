# routes/api.py

from flask import Blueprint, request, jsonify, session, url_for, current_app
from models import db, User, Favorite, Tip
from .utils import (
    fetch_aqi, fetch_weather, fetch_forecast, fetch_historical_aqi,
    get_relevant_tips, get_coords_from_city
)
from ml_handler import predict_current_aqi, get_aqi_category, calculate_all_subindices
import logging
import requests # Necessary for the autocomplete and reverse geocoding

api_bp = Blueprint('api', __name__, url_prefix='/api')
logger = logging.getLogger(__name__) # Use standard logging


# --- AUTHENTICATION ROUTES ---
@api_bp.route('/signup', methods=['POST'])
def api_signup():
    # Handles user registration and database commit
    data = request.form
    full_name = data.get('full_name')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')

    if not all([full_name, email, password, confirm_password]):
        return jsonify({'success': False, 'error': 'All fields are required.'}), 400
    if password != confirm_password:
        return jsonify({'success': False, 'error': 'Passwords do not match.'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'error': 'Email already registered.'}), 409

    try:
        new_user = User(full_name=full_name, email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        logger.info(f"New user registered: {email}")
        return jsonify({'success': True, 'message': 'Registration successful! Please log in.', 'redirect': url_for('auth.login')})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Signup Error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred during registration.'}), 500

@api_bp.route('/login', methods=['POST'])
def api_login():
    # Handles user login and session creation
    data = request.form
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        session['user_id'] = user.id
        session['full_name'] = user.full_name
        session['city'] = user.preferred_city
        logger.info(f"User '{user.email}' logged in successfully.")
        return jsonify({'success': True, 'message': 'Login successful!', 'redirect': url_for('main.dashboard')})
    logger.warning(f"Failed login attempt for email: {email}")
    return jsonify({'success': False, 'error': 'Invalid email or password.'}), 401


# --- DASHBOARD DATA ROUTES ---
@api_bp.route('/aqi/<city>')
def get_aqi(city):
    # Fetches real-time AQI data for a given city
    coords = get_coords_from_city(city)
    if 'error' in coords: return jsonify({'error': coords['error']}), 404
    data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
    return jsonify(data)

@api_bp.route('/weather/<city>')
def get_weather(city):
    # Fetches real-time weather data for a given city
    coords = get_coords_from_city(city)
    if 'error' in coords: return jsonify({'error': coords['error']}), 404
    data = fetch_weather(coords['lat'], coords['lon'], coords['name'])
    return jsonify(data)

@api_bp.route('/forecast/<city>')
def get_forecast(city):
    # Fetches 5-day weather forecast (daily summary and hourly slice)
    coords = get_coords_from_city(city)
    if 'error' in coords:
        logger.error(f"[get_forecast] Geocoding failed for {city}: {coords['error']}")
        return jsonify({'error': coords['error'], 'daily': [], 'hourly': []}), 404
    daily_summary, hourly_slice = fetch_forecast(coords['lat'], coords['lon'])
    return jsonify({'daily': daily_summary, 'hourly': hourly_slice})

@api_bp.route('/historical/<city>')
def get_historical(city):
    # Fetches 24-hour historical AQI data
    coords = get_coords_from_city(city)
    if 'error' in coords: return jsonify({'error': coords['error']}), 404
    data = fetch_historical_aqi(coords['lat'], coords['lon'])
    return jsonify(data)

@api_bp.route('/tips', methods=['POST'])
def get_dynamic_tips():
    # Fetches health tips dynamically based on current AQI and context
    data = request.json
    city = data.get('city'); context = data.get('context')
    if not city or not context: return jsonify({'error': 'City and context are required'}), 400
    coords = get_coords_from_city(city)
    if 'error' in coords: return jsonify({'error': coords['error']}), 404
    aqi_data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
    relevant_tips = get_relevant_tips(aqi_data, context)
    tips_json = [{
        'title': tip.title, 'description': tip.description, 'pollutants_targeted': tip.pollutants_targeted
    } for tip in relevant_tips]
    return jsonify({'tips': tips_json})


# --- AQI PREDICTOR ENDPOINTS ---

# --- Endpoint to get current pollutant components for pre-filling ---
@api_bp.route('/current_pollutants', strict_slashes=False) # <--- ADDED FIX: strict_slashes=False
def get_current_pollutants():
    # Fetches raw pollutant data based on user coordinates (for predictor pre-fill button)
    lat = request.args.get('lat'); lon = request.args.get('lon')
    if not lat or not lon: return jsonify({"error": "Latitude and Longitude required."}), 400

    api_key = current_app.config.get('OPENWEATHER_API_KEY'); url = "http://api.openweathermap.org/data/2.5/air_pollution"
    if not api_key: logger.error("Pollutants fetch failed: API KEY missing."); return jsonify({"error": "Server configuration error"}), 500

    params = {'lat': lat, 'lon': lon, 'appid': api_key}; components = {}; error_msg = None

    try:
        response = requests.get(url, params=params, timeout=10); response.raise_for_status()
        data_list = response.json().get('list', [])
        if data_list: components = data_list[0].get('components', {})
        else: error_msg = "No pollutant data found for location."
    except requests.exceptions.Timeout: error_msg = "Pollutant data service timed out."; logger.warning(f"Timeout fetching pollutants for ({lat}, {lon})")
    except requests.exceptions.RequestException as e: error_msg = f"Could not connect to pollutant service: {e}"; logger.error(f"Error fetching pollutants: {e}", exc_info=True)
    except Exception as e: error_msg = "An unexpected error occurred."; logger.exception(f"Unexpected error in get_current_pollutants: {e}")

    if error_msg: return jsonify({"error": error_msg}), 503

    # Map API keys (e.g., pm2_5) to Model keys (e.g., PM2.5)
    form_data = {
        "PM2.5": components.get('pm2_5'), "PM10": components.get('pm10'), "NO": components.get('no'),
        "NO2": components.get('no2'), "CO": components.get('co'), "SO2": components.get('so2'),
        "O3": components.get('o3'), "NH3": components.get('nh3'),
        "NOx": None, "Benzene": None, "Toluene": None, "Xylene": None, # These are often unavailable via this API
    }
    logger.info(f"Returning current pollutants for ({lat},{lon}): {form_data}")
    return jsonify(form_data)


@api_bp.route('/predict_aqi', methods=['POST'])
def handle_predict_aqi():
    # Handles prediction request from the ML model page
    if 'user_id' not in session: return jsonify({'success': False, 'error': 'Login required'}), 401
    try:
        data = request.get_json()
        if not data: return jsonify({'success': False, 'error': 'Invalid JSON payload.'}), 400

        required_keys = ["PM2.5", "PM10", "NO", "NO2", "NOx", "NH3", "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene"]
        for key in required_keys:
            if key not in data or data[key] is None:
                logger.error(f"Predict missing/null field '{key}'"); return jsonify({'success': False, 'error': f'Missing required field: {key}'}), 400
            try: float(data[key])
            except (ValueError, TypeError):
                 logger.error(f"Predict invalid value '{data[key]}' for '{key}'."); return jsonify({'success': False, 'error': f'Invalid value for {key}. Must be a number.'}), 400

        predicted_aqi = predict_current_aqi(data)
        if predicted_aqi is not None:
            category_info = get_aqi_category(predicted_aqi); subindices = calculate_all_subindices(data)
            logger.info(f"Prediction OK. AQI: {predicted_aqi}. Subindices: {subindices}")
            return jsonify({"success": True, "predicted_aqi": predicted_aqi, "category_info": category_info, "subindices": subindices})
        else:
             from ml_handler import AQI_PREDICTOR_MODEL
             if not AQI_PREDICTOR_MODEL: logger.error("Predict failed: Model not loaded."); return jsonify({'success': False, 'error': 'Prediction model not loaded.'}), 500
             logger.error(f"Predict function returned None for data: {data}"); return jsonify({'success': False, 'error': 'Prediction failed. Check logs.'}), 500

    except Exception as e: logger.exception(f"Unexpected error in /predict_aqi: {e}"); return jsonify({'success': False, 'error': 'Internal server error.'}), 500


# --- USER PREFERENCE ROUTES ---
@api_bp.route('/update_city', methods=['POST'])
def update_city():
    # Updates the user's preferred city in the database
    if 'user_id' not in session: return jsonify({'success': False, 'error': 'Not logged in'}), 401
    city = request.json.get('city')
    if not city or len(city.strip()) == 0: return jsonify({'success': False, 'error': 'City name cannot be empty.'}), 400
    if len(city) > 50: return jsonify({'success': False, 'error': 'City name too long (max 50 chars).'}), 400
    user = db.session.get(User, session['user_id'])
    if user:
        user.preferred_city = city.strip()
        try:
            db.session.commit(); session['city'] = user.preferred_city
            logger.info(f"User {user.id} updated preferred city to {user.preferred_city}")
            return jsonify({'success': True, 'city': user.preferred_city})
        except Exception as e: db.session.rollback(); logger.error(f"DB error updating city for user {user.id}: {e}", exc_info=True); return jsonify({'success': False, 'error': 'Database error.'}), 500
    return jsonify({'success': False, 'error': 'User not found'}), 404

@api_bp.route('/add_favorite', methods=['POST'])
def add_favorite():
    # Adds a city to the user's favorite list
    if 'user_id' not in session: return jsonify({'success': False, 'error': 'Login required'}), 401
    city = request.json.get('city'); user_id = session['user_id']
    if not city or len(city.strip()) == 0: return jsonify({'success': False, 'error': 'City name cannot be empty.'}), 400
    if len(city) > 50: return jsonify({'success': False, 'error': 'City name too long (max 50 chars).'}), 400
    city_cleaned = city.strip()
    if Favorite.query.filter_by(user_id=user_id, city=city_cleaned).first(): return jsonify({'success': True, 'message': f'{city_cleaned} is already in favorites.'})
    fav = Favorite(user_id=user_id, city=city_cleaned)
    try: db.session.add(fav); db.session.commit(); logger.info(f"User {user_id} added favorite: {city_cleaned}"); return jsonify({'success': True, 'message': f'{city_cleaned} added to favorites.'})
    except Exception as e: db.session.rollback(); logger.error(f"DB error adding favorite for user {user_id}: {e}", exc_info=True); return jsonify({'success': False, 'error': 'Database error.'}), 500

@api_bp.route('/remove_favorite', methods=['POST'])
def remove_favorite():
    # Removes a city from the user's favorite list
    if 'user_id' not in session: return jsonify({'success': False, 'error': 'Login required'}), 401
    city = request.json.get('city'); user_id = session['user_id']
    if not city: return jsonify({'success': False, 'error': 'City name required.'}), 400
    fav = Favorite.query.filter_by(user_id=user_id, city=city).first()
    if fav:
        try: db.session.delete(fav); db.session.commit(); logger.info(f"User {user_id} removed favorite: {city}"); return jsonify({'success': True, 'message': f'{city} removed from favorites.'})
        except Exception as e: db.session.rollback(); logger.error(f"DB error removing favorite for user {user_id}: {e}", exc_info=True); return jsonify({'success': False, 'error': 'Database error.'}), 500
    else: return jsonify({'success': True, 'message': f'{city} was not in favorites.'})


# --- TOP CITIES AQI ENDPOINT ---
@api_bp.route('/top_cities_aqi')
def top_cities_aqi():
    # Fetches and returns a sorted list of AQI for major Indian and World cities
    indian_cities = ["Delhi", "Mumbai", "Kolkata", "Chennai", "Bangalore", "Hyderabad", "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Patna", "Indore", "Thane"]
    world_cities = ["Beijing", "New York", "London", "Tokyo", "Paris", "Los Angeles", "Mexico City", "Sao Paulo", "Cairo", "Moscow", "Jakarta", "Seoul", "Sydney", "Berlin", "Rome"]
    top_cities_data = {'india': [], 'world': []}

    # Fetch Indian cities
    for city_name in indian_cities:
        coords = get_coords_from_city(city_name)
        if 'error' in coords: logger.warning(f"Skipping Indian city {city_name} (geocoding error)"); continue
        aqi_data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
        if 'error' not in aqi_data: top_cities_data['india'].append({'city': aqi_data.get('city'), 'aqi': aqi_data.get('aqi'), 'category': get_aqi_category(aqi_data.get('aqi', -1))})
        else: logger.warning(f"Skipping Indian city {city_name} (AQI fetch error)")

    # Fetch World cities
    for city_name in world_cities:
        coords = get_coords_from_city(city_name)
        if 'error' in coords: logger.warning(f"Skipping World city {city_name} (geocoding error)"); continue
        aqi_data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
        if 'error' not in aqi_data: top_cities_data['world'].append({'city': aqi_data.get('city'), 'aqi': aqi_data.get('aqi'), 'category': get_aqi_category(aqi_data.get('aqi', -1))})
        else: logger.warning(f"Skipping World city {city_name} (AQI fetch error)")

    # Sort lists by AQI (descending - worst first)
    top_cities_data['india'].sort(key=lambda x: int(x.get('aqi', -1)), reverse=True)
    top_cities_data['world'].sort(key=lambda x: int(x.get('aqi', -1)), reverse=True)

    logger.info("Successfully compiled top cities AQI data.")
    return jsonify(top_cities_data)


# --- MAP DATA ROUTES ---
@api_bp.route('/map_cities_data')
def map_cities_data():
    # Fetches AQI/Weather data for default map markers
    cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'New York', 'London', 'Tokyo', 'Beijing', 'Sydney']
    data = []
    for city in cities:
        coords = get_coords_from_city(city)
        if 'error' in coords: logger.warning(f"Skipping map city {city} (geocoding error): {coords['error']}"); continue
        aqi_data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
        weather_data = fetch_weather(coords['lat'], coords['lon'], coords['name'])
        if 'error' not in aqi_data: aqi_data['weather'] = weather_data; data.append(aqi_data)
        else: logger.warning(f"Skipping map city {city} (AQI error): {aqi_data.get('error')}")
    return jsonify(data)

@api_bp.route('/city_data/<city_from_url>')
def get_city_data(city_from_url):
    # Fetches AQI and Weather for a single city searched on the map/dashboard
    logger.info(f"--- [get_city_data] Received request for city: '{city_from_url}' ---")
    coords = get_coords_from_city(city_from_url)
    if 'error' in coords: logger.error(f"[get_city_data] Geocoding failed for '{city_from_url}': {coords['error']}"); return jsonify({'error': coords['error']}), 404
    logger.info(f"[get_city_data] Coords received for '{city_from_url}': {coords}")
    official_city_name = coords.get('name', city_from_url)
    aqi_data = fetch_aqi(coords['lat'], coords['lon'], official_city_name)
    weather_data = fetch_weather(coords['lat'], coords['lon'], official_city_name)
    logger.info(f"AQI data fetched: {aqi_data}")
    logger.info(f"Weather data fetched: {weather_data}")
    if 'error' in aqi_data: logger.error(f"[get_city_data] AQI fetch failed for '{official_city_name}': {aqi_data['error']}"); return jsonify({'error': f'Could not find AQI data for {official_city_name}'}), 404
    aqi_data['weather'] = weather_data.copy() if isinstance(weather_data, dict) else weather_data # Combine data
    logger.info(f"Final combined data for '{official_city_name}': {aqi_data}")
    return jsonify(aqi_data)


# --- AUTOCOMPLETE ENDPOINT ---
@api_bp.route('/autocomplete_city')
def autocomplete_city():
    # Provides city suggestions based on partial query input
    query = request.args.get('query', '').strip()
    limit = request.args.get('limit', 5, type=int)

    if not query or len(query) < 2: return jsonify([])

    api_key = current_app.config.get('OPENWEATHER_API_KEY')
    url = current_app.config.get('GEOCODING_API_URL', "http://api.openweathermap.org/geo/1.0/direct")

    if not api_key:
        logger.error("Autocomplete failed: OPENWEATHER_API_KEY missing.")
        return jsonify({"error": "Server configuration error"}), 500

    params = {'q': query, 'limit': limit, 'appid': api_key}
    suggestions = []; unique_names = set()

    try:
        response = requests.get(url, params=params, timeout=3); response.raise_for_status()
        data = response.json()

        for item in data:
            parts = [item.get('name')];
            if item.get('state'): parts.append(item.get('state'))
            if item.get('country'): parts.append(item.get('country'))
            full_name = ", ".join(filter(None, parts))
            city_name_lower = item.get('name', '').lower()

            if city_name_lower and city_name_lower not in unique_names: # Prevent primary name duplicates
                suggestions.append(full_name)
                unique_names.add(city_name_lower)

    except requests.exceptions.Timeout: logging.warning(f"Autocomplete request timed out for query: {query}"); return jsonify([])
    except requests.exceptions.RequestException as e: logging.error(f"Autocomplete API request error for query '{query}': {e}"); return jsonify([])
    except Exception as e: logging.exception(f"Unexpected error in autocomplete_city for query '{query}': {e}"); return jsonify({"error": "Autocomplete service error"}), 500

    return jsonify(suggestions)


# --- NEW REVERSE GEOCODING ENDPOINT ---
@api_bp.route('/get_city_from_coords')
def get_city_from_coords():
    # Takes latitude/longitude and returns the nearest city name (used for auto-loading dashboard)
    lat = request.args.get('lat'); lon = request.args.get('lon')

    if not lat or not lon: return jsonify({"error": "Latitude and Longitude are required."}), 400

    api_key = current_app.config.get('OPENWEATHER_API_KEY')
    url = "http://api.openweathermap.org/geo/1.0/reverse" # Reverse geocoding endpoint

    if not api_key:
        logger.error("Reverse geocoding failed: OPENWEATHER_API_KEY missing.")
        return jsonify({"error": "Server configuration error"}), 500

    params = {'lat': lat, 'lon': lon, 'limit': 1, 'appid': api_key}
    city_name = None

    try:
        response = requests.get(url, params=params, timeout=5); response.raise_for_status()
        data = response.json()

        if data and isinstance(data, list) and len(data) > 0:
            city_info = data[0]; city_name = city_info.get('name')
            if not city_name: # Fallback
                 parts = [city_info.get('state'), city_info.get('country')]; city_name = ", ".join(filter(None, parts))
            if not city_name: logger.warning(f"Reverse geocoding no name: {data}"); return jsonify({"error": "Could not determine location name."}), 404
            logger.info(f"Reverse geocoded ({lat},{lon}) to: {city_name}")
            return jsonify({"city": city_name})
        else:
            logger.warning(f"Reverse geocoding no data for ({lat},{lon})."); return jsonify({"error": "Location name not found."}), 404

    except requests.exceptions.Timeout: logger.warning(f"Reverse geocoding timeout for ({lat},{lon})"); return jsonify({"error": "Reverse geocoding service timed out."}), 504
    except requests.exceptions.RequestException as e: logger.error(f"Reverse geocoding error for ({lat},{lon}): {e}", exc_info=True); return jsonify({"error": f"Could not connect to location service."}), 503
    except Exception as e: logger.exception(f"Unexpected error in get_city_from_coords ({lat},{lon}): {e}"); return jsonify({"error": "Unexpected error during reverse geocoding."}), 500
# --- END NEW REVERSE GEOCODING ENDPOINT ---