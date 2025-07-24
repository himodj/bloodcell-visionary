
#!/usr/bin/env python3
"""
Blood Cell Analysis Model Server
Handles H5 model loading and image prediction using the latest TensorFlow/Keras versions.
"""

import os
import sys
import logging
import tempfile
import json
import base64
from io import BytesIO
from PIL import Image
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global variables
model = None
model_path = None
model_loaded = False

# Class labels in the correct order
CLASS_LABELS = [
    'IG Immature White Cell',
    'Basophil', 
    'Eosinophil',
    'Erythroblast',
    'Lymphocyte',
    'Monocyte',
    'Neutrophil',
    'Platelet'
]

def load_model_with_latest_versions(model_file_path):
    """Load H5 model using latest TensorFlow/Keras versions."""
    global model, model_path, model_loaded
    
    logger.info(f"Loading model from: {model_file_path}")
    
    try:
        import tensorflow as tf
        from tensorflow import keras
        
        logger.info(f"TensorFlow version: {tf.__version__}")
        logger.info(f"Keras version: {keras.__version__}")
        
        # Load the model directly - should work with latest TF/Keras
        model = keras.models.load_model(model_file_path)
        
        model_path = model_file_path
        model_loaded = True
        
        logger.info(f"Model loaded successfully!")
        logger.info(f"Model input shape: {model.input_shape}")
        logger.info(f"Model output shape: {model.output_shape}")
        logger.info(f"Number of layers: {len(model.layers)}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        model_loaded = False
        return False

def preprocess_image(image_data_url, target_size=(224, 224)):
    """Preprocess image for model prediction."""
    try:
        # Remove data URL prefix
        if 'base64,' in image_data_url:
            image_data = image_data_url.split('base64,')[1]
        else:
            image_data = image_data_url
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        logger.info(f"Original image size: {image.size}")
        logger.info(f"Resizing image to: {target_size}")
        
        # Resize image
        image = image.resize(target_size, Image.Resampling.LANCZOS)
        
        # Convert to numpy array and normalize
        image_array = np.array(image, dtype=np.float32)
        image_array = image_array / 255.0
        
        # Add batch dimension
        image_batch = np.expand_dims(image_array, axis=0)
        
        logger.info(f"Final image batch shape: {image_batch.shape}")
        return image_batch
        
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    if model_loaded and model is not None:
        return jsonify({
            'status': 'healthy',
            'model_loaded': True,
            'model_path': model_path
        }), 200
    else:
        return jsonify({
            'status': 'unhealthy',
            'model_loaded': False,
            'error': 'Model not loaded'
        }), 503

@app.route('/load_model', methods=['POST'])
def load_model_endpoint():
    """Load model endpoint."""
    global model_loaded
    
    if model_loaded:
        logger.info("Model already loaded")
        return jsonify({
            'success': True,
            'loaded': True,
            'path': model_path,
            'message': 'Model already loaded'
        })
    
    try:
        data = request.get_json()
        model_file_path = data.get('model_path')
        
        if not model_file_path or not os.path.exists(model_file_path):
            return jsonify({
                'success': False,
                'error': f'Model file not found: {model_file_path}'
            }), 400
        
        success = load_model_with_latest_versions(model_file_path)
        
        if success:
            return jsonify({
                'success': True,
                'loaded': True,
                'path': model_file_path
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to load model'
            }), 500
            
    except Exception as e:
        logger.error(f"Error in load_model endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Prediction endpoint."""
    if not model_loaded or model is None:
        return jsonify({
            'error': 'Model not loaded'
        }), 500
    
    try:
        data = request.get_json()
        image_data_url = data.get('image')
        
        if not image_data_url:
            return jsonify({
                'error': 'No image data provided'
            }), 400
        
        # Preprocess image
        logger.info(f"Model expects input shape: {model.input_shape}")
        image_batch = preprocess_image(image_data_url)
        
        # Make prediction
        predictions = model.predict(image_batch, verbose=0)
        
        # Get the predicted class and confidence
        predicted_class_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class_idx])
        predicted_class = CLASS_LABELS[predicted_class_idx]
        
        logger.info(f"Prediction: {predicted_class} with confidence: {confidence:.4f}")
        
        return jsonify({
            'cell_type': predicted_class,
            'confidence': confidence,
            'all_probabilities': predictions[0].tolist(),
            'class_labels': CLASS_LABELS
        })
        
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}")
        return jsonify({
            'error': f'Prediction failed: {str(e)}'
        }), 500

if __name__ == '__main__':
    logger.info("Starting model server...")
    logger.info(f"Class labels order: {', '.join(CLASS_LABELS)}")
    
    # Try to load model from environment variable
    default_model_path = os.environ.get('MODEL_PATH')
    if default_model_path and os.path.exists(default_model_path):
        logger.info(f"Attempting to load model from environment: {default_model_path}")
        load_model_with_latest_versions(default_model_path)
    
    # Print environment info
    try:
        import tensorflow as tf
        import keras
        import numpy as np
        import h5py
        
        logger.info(f"Python version: {sys.version}")
        logger.info(f"Tensorflow version: {tf.__version__}")
        logger.info(f"Keras version: {keras.__version__}")
        logger.info(f"Numpy version: {np.__version__}")
        logger.info(f"H5py version: {h5py.__version__}")
    except ImportError as e:
        logger.error(f"Import error: {e}")
    
    logger.info(f"Initial model loading result: {model_loaded}")
    logger.info(f"Model path: {model_path}")
    logger.info(f"Current working directory: {os.getcwd()}")
    
    logger.info("Starting Flask server on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
