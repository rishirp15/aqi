import pandas as pd
import json

def create_forecast_starter_file():
    """
    Reads the large city_day.csv, calculates the last known set of lag features,
    and saves it to a small, fast-loading JSON file.
    """
    try:
        df = pd.read_csv("data/city_day.csv", parse_dates=["Date"]).sort_values("Date")
        df = df[["Date", "AQI"]].dropna()

        # Recreate lag features on the fly
        for lag in range(1, 8):
            df[f"lag_{lag}"] = df["AQI"].shift(lag)
        df = df.dropna()
        
        # Get the last valid row
        last_row = df.iloc[-1]

        # Prepare the data for saving
        starter_data = {
            "last_date": last_row["Date"].strftime("%Y-%m-%d"),
            "last_known_lags": {
                "lag_1": last_row["lag_1"],
                "lag_2": last_row["lag_2"],
                "lag_3": last_row["lag_3"],
                "lag_4": last_row["lag_4"],
                "lag_5": last_row["lag_5"],
                "lag_6": last_row["lag_6"],
                "lag_7": last_row["lag_7"],
            }
        }

        # Save to a JSON file
        with open("data/forecast_starter.json", "w") as f:
            json.dump(starter_data, f)
        
        print("✅ Successfully created forecast_starter.json!")

    except FileNotFoundError:
        print("❌ Error: data/city_day.csv not found. Please add the file.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    create_forecast_starter_file()