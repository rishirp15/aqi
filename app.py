from flask import Flask
from flask_cors import CORS
from extensions import db, cache
from config import Config

cors = CORS()

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config.from_object(Config)

    # Add Cache Config
    cache_config = {
        "CACHE_TYPE": "SimpleCache", # Uses in-memory cache
        "CACHE_DEFAULT_TIMEOUT": 300 # Cache for 5 minutes (300 seconds)
    }
    app.config.from_mapping(cache_config)

    # Initialize extensions with app
    db.init_app(app)
    cache.init_app(app)
    cors.init_app(app)

    # Import and register blueprints
    from routes.main import main_bp
    from routes.auth import auth_bp
    from routes.api import api_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    with app.app_context():
        # This is where models are safe to import and use
        from models import Tip
        db.create_all()
        seed_tips(db)

    return app

def seed_tips(database):
    """Seed the database with an expanded list of tips if it's empty."""
    from models import Tip
    if database.session.query(Tip).count() == 0:
        tips_data = [
            # --- Home/Indoor Tips ---
            {'title': 'Run HEPA Air Purifiers', 'description': 'HEPA filters capture 99.97% of fine particles (PM2.5), dust, and allergens. Run them in frequently used rooms like bedrooms and living areas.', 'category': 'home', 'difficulty': 'medium', 'impact': 'high', 'pollutants_targeted': 'PM2.5, PM10, Allergens', 'related_diseases': 'Asthma, Allergies, Lung Irritation'},
            {'title': 'Keep Windows Closed on High AQI Days', 'description': 'Prevent polluted outdoor air from entering your home. This is especially important during peak pollution hours.', 'category': 'home', 'difficulty': 'easy', 'impact': 'high', 'pollutants_targeted': 'PM2.5, O₃, NO₂, SO₂', 'related_diseases': 'Respiratory Issues'},
            {'title': 'Use Kitchen Exhaust Fans', 'description': 'Cooking, especially frying or using a gas stove, produces high levels of PM2.5 and NO₂. Always ventilate by using a chimney or exhaust fan.', 'category': 'home', 'difficulty': 'easy', 'impact': 'medium', 'pollutants_targeted': 'PM2.5, NO₂, CO', 'related_diseases': 'Eye/Throat Irritation'},
            {'title': 'Avoid Burning Incense or Candles', 'description': 'These items release smoke and fine particulate matter directly into your indoor air, worsening the quality.', 'category': 'home', 'difficulty': 'easy', 'impact': 'medium', 'pollutants_targeted': 'PM2.5, CO', 'related_diseases': 'Headaches, Respiratory Distress'},
            {'title': 'Clean with a HEPA Vacuum', 'description': 'Regular vacuums can kick dust and allergens back into the air. A HEPA filter vacuum traps these particles effectively.', 'category': 'home', 'difficulty': 'medium', 'impact': 'medium', 'pollutants_targeted': 'PM10, Dust, Allergens', 'related_diseases': 'Allergies'},
            {'title': 'Add Indoor Plants', 'description': 'Plants like Snake Plant, Spider Plant, and Peace Lily can help filter certain indoor air pollutants like formaldehyde and benzene.', 'category': 'home', 'difficulty': 'easy', 'impact': 'low', 'pollutants_targeted': 'VOCs', 'related_diseases': 'Sick Building Syndrome'},

            # --- Personal/Outdoor Tips ---
            {'title': 'Wear a Well-Fitted N95/FFP2 Mask', 'description': 'When outdoors on high AQI days, a certified N95 or FFP2 mask is highly effective at filtering out harmful PM2.5 particles.', 'category': 'personal', 'difficulty': 'easy', 'impact': 'high', 'pollutants_targeted': 'PM2.5, Viruses, Dust', 'related_diseases': 'Lung Damage, Viral Infections'},
            {'title': 'Avoid Outdoor Exercise on Bad Air Days', 'description': 'During exercise, you breathe more deeply, drawing pollutants further into your lungs. Postpone or move your workout indoors when AQI is high.', 'category': 'personal', 'difficulty': 'easy', 'impact': 'high', 'pollutants_targeted': 'O₃, PM2.5, NO₂', 'related_diseases': 'Asthma Attacks, Cardiovascular Strain'},
            {'title': 'Stay Hydrated', 'description': 'Drinking plenty of water helps your body flush out toxins and keeps your respiratory system moist, which can help reduce irritation from pollution.', 'category': 'personal', 'difficulty': 'easy', 'impact': 'low', 'pollutants_targeted': 'General', 'related_diseases': 'Dehydration, Throat Irritation'},
            {'title': 'Check AQI Before Going Out', 'description': 'Make it a habit to check the real-time AQI for your area. Plan your outdoor activities for times when the air quality is better.', 'category': 'personal', 'difficulty': 'easy', 'impact': 'medium', 'pollutants_targeted': 'All', 'related_diseases': 'All Pollution-Related Illnesses'},

            # --- Commuting/Transport Tips ---
            {'title': 'Use Car AC in Recirculation Mode', 'description': 'When driving, set your car’s air conditioning to recirculation mode. This prevents pulling in polluted air from outside and filters the air already in the cabin.', 'category': 'transport', 'difficulty': 'easy', 'impact': 'high', 'pollutants_targeted': 'PM2.5, CO, NO₂', 'related_diseases': 'Headaches, Respiratory Issues'},
            {'title': 'Keep Car Windows Closed in Traffic', 'description': 'Vehicle emissions are highly concentrated in heavy traffic. Keep your windows rolled up to minimize exposure.', 'category': 'transport', 'difficulty': 'easy', 'impact': 'medium', 'pollutants_targeted': 'CO, NO₂, PM2.5', 'related_diseases': 'Cardiovascular Disease'},
            {'title': 'Consider Public Transport', 'description': 'Reducing the number of individual cars on the road helps lower overall emissions. It\'s a community-level action with personal benefits.', 'category': 'transport', 'difficulty': 'medium', 'impact': 'low', 'pollutants_targeted': 'NO₂, CO, PM2.5', 'related_diseases': 'Community Health'},
        
            # --- Community Tips ---
            {'title': 'Advocate for Green Spaces', 'description': 'Support local initiatives for more parks and urban forests. Trees are natural air filters that absorb CO₂ and capture particulate matter.', 'category': 'community', 'difficulty': 'hard', 'impact': 'high', 'pollutants_targeted': 'CO₂, NO₂, PM10', 'related_diseases': 'Stress, Cardiovascular Disease'},
            {'title': 'Support Clean Energy Policies', 'description': 'Advocate for a transition to renewable energy sources like solar and wind to reduce pollution from fossil fuel power plants.', 'category': 'community', 'difficulty': 'hard', 'impact': 'high', 'pollutants_targeted': 'SO₂, NO₂, PM2.5', 'related_diseases': 'Acid Rain, Respiratory Disease'},
        ]
        for t_data in tips_data:
            tip = Tip(**t_data)
            database.session.add(tip)
        database.session.commit()
        print("✅ Seeded expanded tips data into the database.")


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)