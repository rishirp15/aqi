import os

class Config:
    SECRET_KEY = '1234567890qwertyuiop'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///airwatch.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # NEW: Your API key for all OpenWeather APIs
    OPENWEATHER_API_KEY = '42690799400e95247b14c9231694b419'
    
    # NEW: Geocoding API endpoint
    GEOCODING_API_URL = "http://api.openweathermap.org/geo/1.0/direct"