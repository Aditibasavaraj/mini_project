
import joblib
import json
import sklearn
import pandas as pd

print("Loading FruitGuard model...")

model = joblib.load("fruitguard_model.pkl")

with open("fruitguard_metadata.json", "r") as file:
    metadata = json.load(file)

print("\nModel loaded successfully!")
print("Scikit-learn version:", sklearn.__version__)
print("Model type:", type(model).__name__)

# Test input as a DataFrame
sample = pd.DataFrame([{
    "fruit_type": "banana",
    "MQ4": 0.106,
    "MQ135": 0.188
}])

prediction = model.predict(sample)

print("\nTest prediction:", prediction[0])
print("Available classes:", metadata["classes"])
