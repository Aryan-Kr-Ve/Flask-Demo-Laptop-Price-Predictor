import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

warnings.filterwarnings("ignore")  # silence sklearn version-mismatch chatter

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"

app = Flask(__name__)

pipe = None
df = None
MODEL_LOAD_ERROR = None

try:
    pipe = pickle.load(open(MODEL_DIR / "pipe.pkl", "rb"))
    df = pickle.load(open(MODEL_DIR / "df.pkl", "rb"))
except Exception as exc:  # keep the app alive so /api/health can explain what's wrong
    MODEL_LOAD_ERROR = f"{type(exc).__name__}: {exc}"
    print("!! Failed to load model files on startup:", MODEL_LOAD_ERROR)

EXCLUDED_TYPES = {"2 in 1 Convertible", "Netbook"}

RAM_OPTIONS = [2, 4, 6, 8, 12, 16, 24, 32, 64]
HDD_OPTIONS = [0, 128, 256, 512, 1024, 2048]
SSD_OPTIONS = [0, 8, 128, 256, 512, 1024]
RESOLUTION_OPTIONS = [
    "1366x768",
    "1600x900",
    "1920x1080",
    "2304x1440",
    "2560x1440",
    "2560x1600",
    "2880x1800",
    "3200x1800",
    "3840x2160",
]


def get_options():
    """Dropdown option lists sourced straight from the training data."""
    if df is None:
        return {
            "company": [], "typeName": [], "cpu": [], "gpu": [], "os": [],
            "ram": RAM_OPTIONS, "hdd": HDD_OPTIONS, "ssd": SSD_OPTIONS,
            "resolution": RESOLUTION_OPTIONS,
        }
    type_names = [t for t in df["TypeName"].unique().tolist() if t not in EXCLUDED_TYPES]
    return {
        "company": sorted(df["Company"].unique().tolist()),
        "typeName": sorted(type_names),
        "cpu": sorted(df["Cpu brand"].unique().tolist()),
        "gpu": sorted(df["Gpu brand"].unique().tolist()),
        "os": sorted(df["os"].unique().tolist()),
        "ram": RAM_OPTIONS,
        "hdd": HDD_OPTIONS,
        "ssd": SSD_OPTIONS,
        "resolution": RESOLUTION_OPTIONS,
    }


@app.route("/")
def index():
    return render_template("index.html", active="home")


@app.route("/predict")
def predict_page():
    return render_template("predict.html", active="predict", options=get_options())


@app.route("/about")
def about():
    return render_template("about.html", active="about")


@app.route("/api/options")
def api_options():
    return jsonify(get_options())


@app.route("/api/health")
def api_health():
    ok = MODEL_LOAD_ERROR is None
    return jsonify({"ok": ok, "error": MODEL_LOAD_ERROR}), (200 if ok else 500)


@app.route("/api/predict", methods=["POST"])
def api_predict():
    if MODEL_LOAD_ERROR is not None:
        return jsonify({
            "error": "The model failed to load when the server started, so predictions are unavailable.",
            "detail": MODEL_LOAD_ERROR,
        }), 500

    payload = request.get_json(silent=True) or {}

    required = [
        "company", "typeName", "ram", "weight", "touchscreen", "ips",
        "screenSize", "resolution", "cpu", "hdd", "ssd", "gpu", "os",
    ]
    missing = [field for field in required if field not in payload]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        company = str(payload["company"])
        type_name = str(payload["typeName"])
        ram = int(payload["ram"])
        weight = float(payload["weight"])
        touchscreen = 1 if str(payload["touchscreen"]).lower() in ("1", "true", "yes") else 0
        ips = 1 if str(payload["ips"]).lower() in ("1", "true", "yes") else 0
        screen_size = float(payload["screenSize"])
        resolution = str(payload["resolution"])
        cpu = str(payload["cpu"])
        hdd = int(payload["hdd"])
        ssd = int(payload["ssd"])
        gpu = str(payload["gpu"])
        os_name = str(payload["os"])

        x_res, y_res = (int(v) for v in resolution.lower().split("x"))
        if screen_size <= 0:
            raise ValueError("screenSize must be greater than 0")
        ppi = ((x_res ** 2 + y_res ** 2) ** 0.5) / screen_size

        query = pd.DataFrame({
            "Company": [company],
            "TypeName": [type_name],
            "Ram": [ram],
            "Weight": [weight],
            "Touchscreen": [touchscreen],
            "Ips": [ips],
            "ppi": [ppi],
            "Cpu brand": [cpu],
            "HDD": [hdd],
            "SSD": [ssd],
            "Gpu brand": [gpu],
            "os": [os_name],
        })

        log_price = pipe.predict(query)[0]
        price = int(round(np.exp(log_price)))

    except (ValueError, KeyError, IndexError) as exc:
        return jsonify({"error": f"Could not read that configuration: {exc}"}), 400
    except Exception as exc:  # model or data error
        return jsonify({"error": "Prediction failed on the server.", "detail": str(exc)}), 500

    return jsonify({
        "price": price,
        "currency": "INR",
        "ppi": round(ppi, 1),
    })


if __name__ == "__main__":
    if MODEL_LOAD_ERROR:
        print("Starting anyway — pages will load, but /api/predict will return an error until this is fixed.")
    app.run(host="127.0.0.1", debug=True, use_reloader=False, port=5000)
