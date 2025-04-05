
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
        
        # Get prediction from model
        prediction = model.predict(processed_image)
        
        # Get class with highest probability
        predicted_class_idx = np.argmax(prediction[0])
        confidence = float(prediction[0][predicted_class_idx])
        predicted_class = class_labels[predicted_class_idx]
        
        # Create single detected cell
        cell = {
            "type": predicted_class,
            "confidence": confidence,
            "boundingBox": {
                "x": 120,  # Center of image
                "y": 120,
                "width": 120,
                "height": 120
            }
        }
        
        # Initialize cell counts with zeros
        cell_counts = {label: 0 for label in class_labels}
        
        # Set count to 1 for the detected cell type
        cell_counts[predicted_class] = 1
        
        # Create response with single detected cell
        result = {
            'detectedCells': [cell],
            'cellCounts': cell_counts,
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
