
from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64
import os
import datetime

app = Flask(__name__)

# Load model once at startup
model = None
try:
    model_path = os.environ.get('MODEL_PATH', 'model.h5')
    model = tf.keras.models.load_model(model_path)
    print(f"Model loaded successfully from {model_path}")
except Exception as e:
    print(f"Error loading model: {e}")

# Class labels (update with your actual classes)
class_labels = [
    'Basophil', 'Eosinophil', 'Erythroblast', 'IGImmatureWhiteCell',
    'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet', 'RBC'
]

def preprocess_image(image_data):
    """
    Preprocess image exactly as during training:
    1. Decode base64 to image
    2. Center crop to square
    3. Resize to 360x360
    4. Normalize pixel values
    """
    # Decode base64 image
    img = Image.open(io.BytesIO(base64.b64decode(image_data.split(',')[1])))
    
    # Get dimensions for center crop
    width, height = img.size
    new_dim = min(width, height)
    
    # Calculate crop coordinates
    left = (width - new_dim) // 2
    top = (height - new_dim) // 2
    right = left + new_dim
    bottom = top + new_dim
    
    # Crop and resize
    img = img.crop((left, top, right, bottom))
    img = img.resize((360, 360), Image.LANCZOS)
    
    # Convert to numpy array and normalize
    img_array = np.array(img) / 255.0
    
    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    if 'image' not in request.json:
        return jsonify({'error': 'No image provided'}), 400
        
    try:
        # Get image from request
        image_data = request.json['image']
        
        # Preprocess image
        processed_image = preprocess_image(image_data)
        
        # Make prediction
        prediction = model.predict(processed_image)
        
        # Get class index with highest probability
        class_idx = np.argmax(prediction[0])
        confidence = float(prediction[0][class_idx])
        predicted_class = class_labels[class_idx]
        
        # Create response
        result = {
            'predictedClass': predicted_class,
            'confidence': confidence,
            'timestamp': str(datetime.datetime.now())
        }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error processing request: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run on port 5000 by default
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
