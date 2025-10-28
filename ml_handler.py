import joblib
import pandas as pd
from datetime import datetime, timedelta
import json

# --- Load Models on Application Start ---
try:
    # Model from your prediction notebook (for current prediction)
    PREDICTOR_PIPELINE = joblib.load('ml_models/aqi_pipeline.joblib')
    print("✅ AQI Prediction Pipeline loaded successfully.")
except FileNotFoundError:
    PREDICTOR_PIPELINE = None
    print("⚠️ Warning: aqi_pipeline.joblib not found. Current predictor will not work.")

try:
    # Model from your forecasting notebook
    FORECASTER_MODEL = joblib.load('models/aqi_forecast_xgb.joblib')
    print("✅ AQI Forecast Model loaded successfully.")
except FileNotFoundError:
    FORECASTER_MODEL = None
    print("⚠️ Warning: aqi_forecast_xgb.joblib not found. Forecaster will not work.")


def get_aqi_category(aqi):
    """Classifies the AQI value and returns a category, description, and color code."""
    aqi = int(aqi)
    if 0 <= aqi <= 50:
        return {
            "category": "Good",
            "description": "Air quality is considered satisfactory, and air pollution poses little or no risk.",
            "color_class": "bg-green-500/20 text-green-300 border-green-500"
        }
    elif 51 <= aqi <= 100:
        return {
            "category": "Moderate",
            "description": "Air quality is acceptable; however, some pollutants may be a moderate health concern.",
            "color_class": "bg-yellow-500/20 text-yellow-300 border-yellow-500"
        }
    elif 101 <= aqi <= 150:
        return {
            "category": "Unhealthy for Sensitive Groups",
            "description": "Members of sensitive groups may experience health effects. The general public is not likely to be affected.",
            "color_class": "bg-orange-500/20 text-orange-300 border-orange-500"
        }
    elif 151 <= aqi <= 200:
        return {
            "category": "Unhealthy",
            "description": "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.",
            "color_class": "bg-red-500/20 text-red-300 border-red-500"
        }
    elif 201 <= aqi <= 300:
        return {
            "category": "Very Unhealthy",
            "description": "Health alert: everyone may experience more serious health effects.",
            "color_class": "bg-purple-500/20 text-purple-300 border-purple-500"
        }
    else: # aqi > 300
        return {
            "category": "Hazardous",
            "description": "Health warnings of emergency conditions. The entire population is more likely to be affected.",
            "color_class": "bg-rose-800/20 text-rose-400 border-rose-700"
        }

def predict_current_aqi(data):
    """
    Predicts AQI using the full preprocessing and model pipeline from your prediction notebook.
    """
    if not PREDICTOR_PIPELINE:
        return None
    try:
        # 1. Create a DataFrame from the user's input.
        input_df = pd.DataFrame({
            'PM2.5': [float(data['PM2.5'])],
            'PM10': [float(data['PM10'])],
            'NO': [float(data['NO'])],
            'NO2': [float(data['NO2'])],
            'NOx': [float(data['NOx'])],
            'NH3': [float(data['NH3'])],
            'CO': [float(data['CO'])],
            'SO2': [float(data['SO2'])],
            'Toluene': [float(data['Toluene'])],
            'Year': [datetime.now().year],
            'City': [data['City']]
        })
        
        # 2. The pipeline handles all preprocessing automatically.
        prediction = PREDICTOR_PIPELINE.predict(input_df)
        
        return round(float(prediction[0]), 2)
        
    except Exception as e:
        print(f"!!! Error in predict_current_aqi: {e}")
        return None


def forecast_future_rolling(model, last_known_lags, steps=7):
    """
    Helper function for the GitHub forecast model.
    """
    predictions = []
    current_lags = last_known_lags.copy()

    for _ in range(steps):
        pred = model.predict(current_lags.values.reshape(1, -1))[0]
        predictions.append(float(pred))
        current_lags = current_lags.shift(1)
        current_lags.iloc[0] = pred
        
    return predictions


def forecast_next_7_days(last_7_days_data):
    """
    Generates a 7-day AQI forecast using a rolling method based on your forecasting notebook.
    """
    if not FORECASTER_MODEL:
        return {"error": "Forecast model not available"}

    try:
        # 1. Get the last 7 days of AQI from the input data.
        history = [float(last_7_days_data[f'lag_{i}']) for i in range(1, 8)]
        
        forecasted_results = []
        today = datetime.now()

        # 2. Loop for the next 7 days to generate the forecast.
        for i in range(7):
            # 3. Format the current history into the DataFrame format the model expects.
            input_features = pd.DataFrame([history[::-1]], columns=[f'lag_{j}' for j in range(1, 8)])
            
            # 4. Predict the next day's AQI.
            next_day_prediction = FORECASTER_MODEL.predict(input_features)[0]
            
            # 5. Store the result.
            forecast_date = today + timedelta(days=i + 1)
            forecasted_results.append({
                'date': forecast_date.strftime('%Y-%m-%d'),
                'forecast_aqi': round(float(next_day_prediction), 2)
            })
            
            # 6. "Roll" the history window forward for the next iteration.
            history.pop()
            history.insert(0, next_day_prediction)
            
        return {"forecasts": forecasted_results}
        
    except Exception as e:
        print(f"!!! Error during forecasting: {e}")
        return {"error": "An unexpected error occurred during forecasting."}