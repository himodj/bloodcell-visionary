
from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64
import os
import datetime
import random

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

def detect_cells_in_image(img_array):
    """
    Simulate detecting multiple cells in the image
    In a real production app, this would use a cell detection model
    For this demo, we'll simulate finding multiple cells based on 
    the primary prediction from our classification model
    """
    # Use the model to get the primary prediction
    prediction = model.predict(img_array)
    primary_class_idx = np.argmax(prediction[0])
    primary_confidence = float(prediction[0][primary_class_idx])
    primary_class = class_labels[primary_class_idx]
    
    # Now simulate finding 5-15 cells total with the primary class being most common
    num_cells = random.randint(5, 15)
    cells = []
    
    # Create regions for cells that don't overlap too much
    used_regions = []
    
    # Define the detection for the main cell with high confidence
    main_cell = {
        "type": primary_class,
        "confidence": primary_confidence,
        "boundingBox": {
            "x": 120,
            "y": 120,
            "width": 120,
            "height": 120
        }
    }
    
    cells.append(main_cell)
    used_regions.append((120, 120, 240, 240))
    
    # Add more cells of various types
    for _ in range(num_cells - 1):
        # Try to find a non-overlapping position
        for attempt in range(10):  # Limit attempts to avoid infinite loop
            # Random position within the 360x360 image, leaving margin for cell size
            cell_size = random.randint(60, 100)
            x = random.randint(10, 350 - cell_size)
            y = random.randint(10, 350 - cell_size)
            
            # Check if this region overlaps with existing ones
            overlaps = False
            for region in used_regions:
                rx, ry, rw, rh = region
                if (x < rx + rw and x + cell_size > rx and 
                    y < ry + rh and y + cell_size > ry):
                    overlaps = True
                    break
            
            if not overlaps:
                break
                
        # If we couldn't find a non-overlapping region after 10 attempts, just place it somewhere
        # In a real app, we'd use a more sophisticated approach
        
        # Randomly select a cell type, with bias toward the primary type
        if random.random() < 0.3:  # 30% chance to be the same as primary
            cell_type = primary_class
            confidence = primary_confidence * random.uniform(0.8, 1.0)
        else:
            # Pick another cell type
            other_types = [t for t in class_labels if t != primary_class]
            cell_type = random.choice(other_types)
            confidence = random.uniform(0.70, 0.99)
        
        cell = {
            "type": cell_type,
            "confidence": confidence,
            "boundingBox": {
                "x": x,
                "y": y,
                "width": cell_size,
                "height": cell_size
            }
        }
        
        cells.append(cell)
        used_regions.append((x, y, cell_size, cell_size))
    
    return cells

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
        
        # Detect cells in the image
        detected_cells = detect_cells_in_image(processed_image)
        
        # Generate cell counts
        cell_counts = {}
        for label in class_labels:
            cell_counts[label] = sum(1 for cell in detected_cells if cell["type"] == label)
        
        # Create response with all detected cells
        result = {
            'detectedCells': detected_cells,
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
