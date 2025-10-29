from flask import Blueprint, render_template, session, redirect, url_for, request, flash
from models import db, User, Favorite, Tip
from .utils import fetch_aqi, get_relevant_tips, get_coords_from_city

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    
    city_name = request.args.get('city', session.get('city', 'Delhi'))
    session['city'] = city_name
    
    user = db.session.get(User, session['user_id'])
    session['full_name'] = user.full_name if user else 'User'

    # --- FIX: Get coordinates first ---
    coords = get_coords_from_city(city_name)
    if 'error' in coords:
        flash(coords['error'], 'error')
        # Render the dashboard with an error state
        return render_template('dashboard.html', city=city_name, tips=[], aqi_data={'error': coords['error']})
    
    # Use the coordinates and the corrected name to fetch data
    city_display_name = coords['name']
    aqi_data = fetch_aqi(coords['lat'], coords['lon'], city_display_name)
    
    # Also update the session and city variable to the "official" name
    session['city'] = city_display_name
    # --- END OF FIX ---
    
    if 'error' in aqi_data:
         flash(aqi_data['error'], 'error')
    
    relevant_tips = get_relevant_tips(aqi_data, context='home')
    
    return render_template('dashboard.html', city=city_display_name, tips=relevant_tips)

@main_bp.route('/profile', methods=['GET', 'POST'])
def profile():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    
    user = db.session.get(User, session['user_id'])
    if not user:
        return redirect(url_for('auth.logout'))

    if request.method == 'POST':
        new_city = request.form.get('preferred_city')
        if new_city:
            user.preferred_city = new_city
            db.session.commit()
            session['city'] = new_city
            flash('Profile updated successfully!', 'success')
            return redirect(url_for('main.profile'))

    favorites = Favorite.query.filter_by(user_id=user.id).all()
    return render_template('profile.html', user=user, favorites=[f.city for f in favorites])

@main_bp.route('/tips')
def tips():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    tips_data = Tip.query.order_by(Tip.category, Tip.impact.desc()).all()
    return render_template('tips.html', tips=tips_data)

@main_bp.route('/map')
def map_view():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    return render_template('map.html')

@main_bp.route('/predictor')
def predictor():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    return render_template('predictor.html')

@main_bp.route('/about-aqi')
def about_aqi():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    return render_template('about_aqi.html')

@main_bp.route('/pollutant-guide')
def pollutant_guide():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    return render_template('pollutant_guide.html')

