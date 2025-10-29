# ml_handler.py
import pickle
import pandas as pd
from datetime import datetime, timedelta
import logging

# Set up logger basic config if not already configured elsewhere
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s:%(name)s:%(message)s')

MODEL_FEATURES = ['PM2.5', 'PM10', 'NO', 'NO2', 'NOx', 'NH3', 'CO', 'SO2','O3', 'Benzene', 'Toluene', 'Xylene']

AQI_PREDICTOR_MODEL = None

try:
    model_path = 'ml_models/random_forest_model.pkl'
    with open(model_path, 'rb') as f:
        AQI_PREDICTOR_MODEL = pickle.load(f)
    logging.info(f"✅ AQI Predictor Model ({model_path}) loaded successfully.")
except FileNotFoundError:
    logging.error(f"❌ Error: {model_path} not found. AQI predictor will not work.")
except Exception as e:
    logging.error(f"❌ Error loading {model_path}: {e}", exc_info=True)


def get_aqi_category(aqi):
    """Classifies the AQI value and returns a category, description, and color code."""
    try:
        aqi_val = float(aqi)
    except (ValueError, TypeError):
         return {
            "category": "N/A", "description": "AQI data invalid.",
            "color_class": "bg-slate-500/20 text-slate-300 border-slate-500",
            "chartColor": "#64748b" # Add chart color
        }
    # Use the Indian AQI buckets
    if aqi_val <= 50: return {"category": "Good", "description": "Minimal impact.", "color_class": "bg-green-500/20 text-green-300 border-green-500", "chartColor": "#34d399"}
    elif aqi_val <= 100: return {"category": "Satisfactory", "description": "Minor breathing discomfort.", "color_class": "bg-yellow-500/20 text-yellow-300 border-yellow-500", "chartColor": "#f59e0b"}
    elif aqi_val <= 200: return {"category": "Moderate", "description": "Breathing discomfort to sensitive groups.", "color_class": "bg-orange-500/20 text-orange-300 border-orange-500", "chartColor": "#f97316"}
    elif aqi_val <= 300: return {"category": "Poor", "description": "Breathing discomfort to most people.", "color_class": "bg-red-500/20 text-red-300 border-red-500", "chartColor": "#ef4444"}
    elif aqi_val <= 400: return {"category": "Very Poor", "description": "Respiratory illness on prolonged exposure.", "color_class": "bg-purple-500/20 text-purple-300 border-purple-500", "chartColor": "#a855f7"}
    else: return {"category": "Severe", "description": "Serious health effects.", "color_class": "bg-rose-800/20 text-rose-400 border-rose-700", "chartColor": "#be123c"}


def predict_current_aqi(data):
    """ Predicts AQI using the loaded Random Forest model. """
    if not AQI_PREDICTOR_MODEL: logging.error("AQI prediction failed: Model not loaded."); return None
    try:
        input_values = {}
        missing_features, invalid_features = [], []
        for feature in MODEL_FEATURES:
            if feature not in data: missing_features.append(feature); continue
            try: input_values[feature] = [float(data[feature])]
            except (ValueError, TypeError): invalid_features.append(feature)
        if missing_features: logging.error(f"Prediction failed: Missing features: {missing_features}"); return None
        if invalid_features: logging.error(f"Prediction failed: Invalid features: {invalid_features}"); return None
        input_df = pd.DataFrame(input_values, columns=MODEL_FEATURES)
        logging.debug(f"Input DataFrame for prediction:\n{input_df}")
        prediction = AQI_PREDICTOR_MODEL.predict(input_df)
        logging.info(f"Raw prediction: {prediction}")
        predicted_aqi = round(float(prediction[0]), 2)
        logging.info(f"Predicted AQI: {predicted_aqi}")
        return predicted_aqi
    except Exception as e: logging.error(f"!!! Unexpected Error during AQI prediction: {e}", exc_info=True); return None


# --- START: Functions to calculate individual sub-indices ---
# (Based on the logic from your notebook)

def get_pm25_subindex(x):
    try: x = float(x)
    except (ValueError, TypeError): return 0
    if x <= 30: return x * 50 / 30
    elif x <= 60: return 50 + (x - 30) * 50 / 30
    elif x <= 90: return 100 + (x - 60) * 100 / 30
    elif x <= 120: return 200 + (x - 90) * 100 / 30
    elif x <= 250: return 300 + (x - 120) * 100 / 130
    elif x > 250: return 400 + (x - 250) * 100 / 130
    else: return 0

def get_pm10_subindex(x):
    try: x = float(x)
    except (ValueError, TypeError): return 0
    if x <= 50: return x
    elif x <= 100: return x
    elif x <= 250: return 100 + (x - 100) * 100 / 150
    elif x <= 350: return 200 + (x - 250)
    elif x <= 430: return 300 + (x - 350) * 100 / 80
    elif x > 430: return 400 + (x - 430) * 100 / 80
    else: return 0

def get_so2_subindex(x):
    try: x = float(x)
    except (ValueError, TypeError): return 0
    if x <= 40: return x * 50 / 40
    elif x <= 80: return 50 + (x - 40) * 50 / 40
    elif x <= 380: return 100 + (x - 80) * 100 / 300
    elif x <= 800: return 200 + (x - 380) * 100 / 420
    elif x <= 1600: return 300 + (x - 800) * 100 / 800
    elif x > 1600: return 400 + (x - 1600) * 100 / 800
    else: return 0

def get_nox_subindex(x):
    # Note: Your notebook used NOx for subindex, but standard AQI often uses NO2.
    # We will use the NOx calculation as per your notebook.
    try: x = float(x)
    except (ValueError, TypeError): return 0
    if x <= 40: return x * 50 / 40
    elif x <= 80: return 50 + (x - 40) * 50 / 40
    elif x <= 180: return 100 + (x - 80) * 100 / 100
    elif x <= 280: return 200 + (x - 180) * 100 / 100
    elif x <= 400: return 300 + (x - 280) * 100 / 120
    elif x > 400: return 400 + (x - 400) * 100 / 120
    else: return 0

def get_nh3_subindex(x):
    try: x = float(x)
    except (ValueError, TypeError): return 0
    if x <= 200: return x * 50 / 200
    elif x <= 400: return 50 + (x - 200) * 50 / 200
    elif x <= 800: return 100 + (x - 400) * 100 / 400
    elif x <= 1200: return 200 + (x - 800) * 100 / 400
    elif x <= 1800: return 300 + (x - 1200) * 100 / 600
    elif x > 1800: return 400 + (x - 1800) * 100 / 600
    else: return 0

def get_co_subindex(x):
    # Assumes x is already converted to mg/m³ if needed,
    # but the breakpoints in notebook look like they might expect µg/m³.
    # Let's assume input 'x' is in µg/m³ as per the form and convert here.
    try:
        x_mg = float(x) / 1000.0 # Convert µg/m³ to mg/m³ for calculation
    except (ValueError, TypeError): return 0

    if x_mg <= 1.0: return x_mg * 50 / 1.0 # Use 1.0 to ensure float division
    elif x_mg <= 2.0: return 50 + (x_mg - 1.0) * 50 / 1.0
    elif x_mg <= 10.0: return 100 + (x_mg - 2.0) * 100 / 8.0
    elif x_mg <= 17.0: return 200 + (x_mg - 10.0) * 100 / 7.0
    elif x_mg <= 34.0: return 300 + (x_mg - 17.0) * 100 / 17.0
    elif x_mg > 34.0: return 400 + (x_mg - 34.0) * 100 / 17.0 # Assuming breakpoint range continues proportionally
    else: return 0

def get_o3_subindex(x):
    try: x = float(x)
    except (ValueError, TypeError): return 0
    if x <= 50: return x * 50 / 50
    elif x <= 100: return 50 + (x - 50) * 50 / 50
    elif x <= 168: return 100 + (x - 100) * 100 / 68
    elif x <= 208: return 200 + (x - 168) * 100 / 40
    elif x <= 748: return 300 + (x - 208) * 100 / 540 # Adjusted divisor based on common scales (748-208=540)
    elif x > 748: return 400 + (x - 748) * 100 / 540 # Adjusted divisor
    else: return 0

# --- Function to calculate all sub-indices from input data ---
def calculate_all_subindices(data):
    """ Calculates all relevant sub-indices from a dictionary of pollutant values. """
    subindices = {}
    # Use standard names (matching form/API if possible) as keys
    subindices['PM2.5'] = get_pm25_subindex(data.get('PM2.5'))
    subindices['PM10'] = get_pm10_subindex(data.get('PM10'))
    subindices['SO2'] = get_so2_subindex(data.get('SO2'))
    subindices['NOx'] = get_nox_subindex(data.get('NOx')) # Using NOx as per notebook
    subindices['NH3'] = get_nh3_subindex(data.get('NH3'))
    subindices['CO'] = get_co_subindex(data.get('CO'))
    subindices['O3'] = get_o3_subindex(data.get('O3'))

    # Return only pollutants used in standard AQI calculation for contribution chart
    # (Excluding Benzene, Toluene, Xylene which don't have sub-index functions here)
    relevant_subindices = {k: round(v, 1) for k, v in subindices.items() if v is not None and v > 0}
    return relevant_subindices

# --- END: Sub-index functions ---