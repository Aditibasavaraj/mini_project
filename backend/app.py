
from pathlib import Path
import json
import math
import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from typing import Literal

# File paths
BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "fruitguard_model.pkl"
METADATA_PATH = BASE_DIR / "fruitguard_metadata.json"

# Load trained model
model = joblib.load(MODEL_PATH)

with open(METADATA_PATH, "r") as file:
    metadata = json.load(file)

app = FastAPI(
    title="FruitGuard ML API",
    description="Fruit quality prediction using MQ4 and MQ135 sensors",
    version="1.0.0"
)


# Incoming sensor data
class FruitReading(BaseModel):
    fruit_type: Literal["banana", "mango", "tomato"]
    MQ4: float
    MQ135: float

    @field_validator("MQ4", "MQ135")
    @classmethod
    def validate_sensor_reading(cls, value):
        if not math.isfinite(value):
            raise ValueError("Sensor readings must be finite numbers")
        return value


@app.get("/")
def home():
    return {
        "message": "Welcome to FruitGuard ML API",
        "status": "running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": True,
        "model_name": "Random Forest",
        "accuracy": metadata["accuracy"],
        "supported_fruits": ["banana", "mango", "tomato"]
    }


@app.post("/predict")
def predict(reading: FruitReading):

    try:
        input_data = pd.DataFrame([{
            "fruit_type": reading.fruit_type,
            "MQ4": reading.MQ4,
            "MQ135": reading.MQ135
        }])

        prediction = model.predict(input_data)[0]

        probabilities = model.predict_proba(input_data)[0]

        classes = model.classes_

        confidence = float(max(probabilities))

        class_probabilities = {
            str(label): round(float(probability), 4)
            for label, probability in zip(classes, probabilities)
        }

        return {
            "fruit_type": reading.fruit_type,
            "prediction": str(prediction),
            "confidence": round(confidence, 4),
            "class_probabilities": class_probabilities
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )
