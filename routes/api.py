from flask import Blueprint, request, jsonify, session, url_for, current_app
from models import db, User, Favorite, Tip
from .utils import (
    fetch_aqi, fetch_weather, fetch_forecast, fetch_historical_aqi, 
    get_relevant_tips, get_coords_from_city
)
from ml_handler import predict_current_aqi, forecast_next_7_days, get_aqi_category
import logging

api_bp = Blueprint('api', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)


# --- AUTHENTICATION ROUTES ---

@api_bp.route('/signup', methods=['POST'])
def api_signup():
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
        return jsonify({
            'success': True, 
            'message': 'Registration successful! Please log in.', 
            'redirect': url_for('auth.login')
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Signup Error: {e}")
        return jsonify({'success': False, 'error': 'An internal error occurred.'}), 500

@api_bp.route('/login', methods=['POST'])
def api_login():
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
        return jsonify({
            'success': True, 
            'message': 'Login successful!', 
            'redirect': url_for('main.dashboard')
        })
    return jsonify({'success': False, 'error': 'Invalid email or password.'}), 401


# --- DASHBOARD DATA ROUTES ---

@api_bp.route('/aqi/<city>')
def get_aqi(city):
    coords = get_coords_from_city(city)
    if 'error' in coords:
        return jsonify({'error': coords['error']}), 404
    data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
    return jsonify(data)

@api_bp.route('/weather/<city>')
def get_weather(city):
    coords = get_coords_from_city(city)
    if 'error' in coords:
        return jsonify({'error': coords['error']}), 404
    data = fetch_weather(coords['lat'], coords['lon'], coords['name'])
    return jsonify(data)
    
@api_bp.route('/forecast/<city>')
def get_forecast(city):
    coords = get_coords_from_city(city)
    if 'error' in coords:
        return jsonify({'error': coords['error']}), 404
    data = fetch_forecast(coords['lat'], coords['lon'])
    return jsonify(data)

@api_bp.route('/historical/<city>')
def get_historical(city):
    coords = get_coords_from_city(city)
    if 'error' in coords:
        return jsonify({'error': coords['error']}), 404
    data = fetch_historical_aqi(coords['lat'], coords['lon'])
    return jsonify(data)

@api_bp.route('/tips', methods=['POST'])
def get_dynamic_tips():
    data = request.json
    city = data.get('city')
    context = data.get('context')
    
    if not city or not context:
        return jsonify({'error': 'City and context are required'}), 400
        
    coords = get_coords_from_city(city)
    if 'error' in coords:
        return jsonify({'error': coords['error']}), 404
    
    aqi_data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
    if 'error' in aqi_data:
        return jsonify({'error': aqi_data['error']}), 404
        
    relevant_tips = get_relevant_tips(aqi_data, context)
    
    tips_json = [{
        'title': tip.title,
        'description': tip.description,
        'pollutants_targeted': tip.pollutants_targeted
    } for tip in relevant_tips]
    
    return jsonify({'tips': tips_json})


# --- AQI PREDICTOR ROUTES ---

@api_bp.route('/predict_aqi', methods=['POST'])
def handle_predict_aqi():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Login required'}), 401
    
    try:
        data = request.get_json()
        if not data:
             return jsonify({'success': False, 'error': 'Invalid JSON payload.'}), 400
        
        predicted_aqi = predict_current_aqi(data)
        
        if predicted_aqi is not None:
            category_info = get_aqi_category(predicted_aqi)
            return jsonify({'success': True, 'predicted_aqi': predicted_aqi, 'category_info': category_info})
        else:
            return jsonify({'success': False, 'error': 'Prediction failed. Check server logs.'}), 500
            
    except Exception as e:
        logger.error(f"Prediction endpoint error: {e}")
        return jsonify({'success': False, 'error': 'An internal server error occurred.'}), 500

@api_bp.route('/forecast_aqi', methods=['POST'])
def handle_forecast_aqi():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Login required'}), 401

    try:
        form_data = request.get_json()
        
        required_lags = [f'lag_{i}' for i in range(1, 8)]
        if not all(lag in form_data for lag in required_lags):
            return jsonify({'success': False, 'error': 'All 7 historical AQI values are required.'}), 400

        forecast_result = forecast_next_7_days(form_data)
        
        if "error" in forecast_result:
             return jsonify({'success': False, 'error': forecast_result['error']}), 400

        for day in forecast_result.get('forecasts', []):
            day['category_info'] = get_aqi_category(day['forecast_aqi'])

        return jsonify({'success': True, 'forecast': forecast_result.get('forecasts')})

    except Exception as e:
        logger.error(f"Forecast endpoint error: {e}")
        return jsonify({'success': False, 'error': 'An internal server error occurred.'}), 500


# --- USER PREFERENCE ROUTES ---

@api_bp.route('/update_city', methods=['POST'])
def update_city():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    
    city = request.json.get('city')
    if not city:
        return jsonify({'success': False, 'error': 'City is required'}), 400
        
    user = db.session.get(User, session['user_id'])
    if user:
        user.preferred_city = city
        db.session.commit()
        session['city'] = city
        return jsonify({'success': True, 'city': city})
    return jsonify({'success': False, 'error': 'User not found'}), 404

@api_bp.route('/add_favorite', methods=['POST'])
def add_favorite():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Login required'}), 401
    
    city = request.json.get('city')
    if not city:
        return jsonify({'success': False, 'error': 'City name required.'}), 400
        
    user_id = session['user_id']
    if not Favorite.query.filter_by(user_id=user_id, city=city).first():
        fav = Favorite(user_id=user_id, city=city)
        db.session.add(fav)
        db.session.commit()
        
    return jsonify({'success': True, 'message': f'{city} added to favorites.'})

@api_bp.route('/remove_favorite', methods=['POST'])
def remove_favorite():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Login required'}), 401
        
    city = request.json.get('city')
    user_id = session['user_id']
    fav = Favorite.query.filter_by(user_id=user_id, city=city).first()
    if fav:
        db.session.delete(fav)
        db.session.commit()
        
    return jsonify({'success': True, 'message': f'{city} removed from favorites.'})


# --- MAP DATA ROUTES ---

@api_bp.route('/map_cities_data')
def map_cities_data():
    cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'New York', 'London', 'Tokyo', 'Beijing', 'Sydney']
    data = []
    for city in cities:
        coords = get_coords_from_city(city)
        if 'error' in coords:
            continue
        
        aqi_data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
        weather_data = fetch_weather(coords['lat'], coords['lon'], coords['name'])
        
        if 'error' not in aqi_data:
            aqi_data['weather'] = weather_data
            data.append(aqi_data)
    return jsonify(data)

@api_bp.route('/city_data/<city>')
def get_city_data(city):
    coords = get_coords_from_city(city)
    if 'error' in coords:
        return jsonify({'error': coords['error']}), 404

    aqi_data = fetch_aqi(coords['lat'], coords['lon'], coords['name'])
    weather_data = fetch_weather(coords['lat'], coords['lon'], coords['name'])
    
    if 'error' in aqi_data:
        return jsonify({'error': f'Could not find data for {city}'}), 404
    
    aqi_data['weather'] = weather_data
    return jsonify(aqi_data)