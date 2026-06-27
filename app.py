import os
import sys
import types
import tempfile
import concurrent.futures
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# MOCK inference_sdk (for Python 3.14 compatibility)
# -----------------------------------------------------------------------------
mock_module = types.ModuleType("inference_sdk")

class InferenceHTTPClient:
    def __init__(self, api_url, api_key):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key

    def infer(self, image_path, model_id):
        import base64
        import requests
        
        with open(image_path, "rb") as f:
            base64_str = base64.b64encode(f.read()).decode("utf-8")
            
        url = f"{self.api_url}/{model_id}?api_key={self.api_key}"
        response = requests.post(
            url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=base64_str
        )
        
        if response.status_code != 200:
            raise Exception(f"Roboflow API error {response.status_code}: {response.text}")
            
        return response.json()

mock_module.InferenceHTTPClient = InferenceHTTPClient
sys.modules["inference_sdk"] = mock_module

# -----------------------------------------------------------------------------
# FLASK SETUP
# -----------------------------------------------------------------------------
load_dotenv()

app = Flask(__name__)
CORS(app)

from inference_sdk import InferenceHTTPClient

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")

CLIENT = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=ROBOFLOW_API_KEY
)

THRESHOLD = 0.5

# -----------------------------------------------------------------------------
# ROOT ROUTE (FIXES YOUR 404)
# -----------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "Backend is running 🚀",
        "endpoint": "/analyze-image (POST)"
    })

# -----------------------------------------------------------------------------
# HELPER
# -----------------------------------------------------------------------------
def run_model_inference(model_id, image_path):
    try:
        return CLIENT.infer(image_path, model_id=model_id)
    except Exception as e:
        print(f"[Backend] Error calling model {model_id}: {str(e)}")
        return {"predictions": []}

# -----------------------------------------------------------------------------
# CORE LOGIC
# -----------------------------------------------------------------------------
def analyze_image(image_path):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_pothole = executor.submit(run_model_inference, "pothole-detection-i00zy/2", image_path)
        future_garbage = executor.submit(run_model_inference, "garbage-can-overflow/1", image_path)
        
        pothole_result = future_pothole.result()
        garbage_result = future_garbage.result()

    pothole_predictions = pothole_result.get("predictions", [])
    pothole_confidence = max([p.get("confidence", 0) for p in pothole_predictions]) if pothole_predictions else 0.0

    garbage_predictions = garbage_result.get("predictions", [])
    garbage_confidence = max([g.get("confidence", 0) for g in garbage_predictions]) if garbage_predictions else 0.0

    print(f"[Backend] Pothole confidence: {pothole_confidence}")
    print(f"[Backend] Garbage confidence: {garbage_confidence}")

    max_confidence = max(pothole_confidence, garbage_confidence)

    if pothole_confidence < THRESHOLD and garbage_confidence < THRESHOLD:
        return {
            "label": "unknown",
            "confidence": max_confidence
        }

    if pothole_confidence > garbage_confidence:
        return {
            "label": "pothole",
            "confidence": pothole_confidence
        }
    else:
        return {
            "label": "garbage_overflow",
            "confidence": garbage_confidence
        }

# -----------------------------------------------------------------------------
# API ENDPOINT
# -----------------------------------------------------------------------------
@app.route("/analyze-image", methods=["POST"])
def analyze_image_endpoint():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400
        
    file = request.files["image"]
    
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
        
    temp_path = os.path.join(tempfile.gettempdir(), file.filename)
    file.save(temp_path)
    
    try:
        result = analyze_image(temp_path)
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return jsonify(result)
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------------------
# LOCAL RUN (not used in Render)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
