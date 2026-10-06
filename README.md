# Laptop Price Predictor — Flask Front End

A Flask front end for the laptop price predictor model (originally a Streamlit app).
Same trained pipeline (pipe.pkl / df.pkl), new interface: a blueprint/spec-sheet
themed configurator with a step wizard, a live-updating spec summary, and a small
JSON API behind it.

## Run it

    cd flask_app
    python -m venv venv
    source venv/bin/activate        # venv\Scripts\activate on Windows
    pip install -r requirements.txt
    python app.py

Open http://127.0.0.1:5000

## Structure

    flask_app/
    |-- app.py                  Flask app + /api/options and /api/predict
    |-- model/
    |   |-- pipe.pkl            trained sklearn/xgboost pipeline
    |   `-- df.pkl              reference dataframe (dropdown values)
    |-- templates/
    |   |-- base.html           nav, footer, blueprint grid backdrop
    |   |-- index.html          home page
    |   |-- predict.html        step-wizard configurator
    |   `-- about.html          model / dataset writeup
    `-- static/
        |-- css/style.css
        |-- js/main.js          mobile nav toggle
        `-- js/wizard.js        step logic, live spec sheet, fetch to /api/predict

## API

GET /api/options - dropdown choices sourced from the training dataframe.

POST /api/predict - body:

    {
      "company": "Dell", "typeName": "Notebook", "os": "Windows",
      "cpu": "Intel Core i5", "gpu": "Intel", "ram": 8,
      "hdd": 0, "ssd": 256, "weight": 1.8,
      "touchscreen": false, "ips": false,
      "screenSize": 15.6, "resolution": "1920x1080"
    }

Returns {"price": 62345, "currency": "INR", "ppi": 141.2}
