import os

class Config:
    SECRET_KEY = '1234567890qwertyuiop'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///airwatch.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # NEW: Your API key for all OpenWeather APIs
    OPENWEATHER_API_KEY = '924cd14fd135397ea93575f2d0d32709'
    
    # NEW: Geocoding API endpoint
    GEOCODING_API_URL = "http://api.openweathermap.org/geo/1.0/direct"