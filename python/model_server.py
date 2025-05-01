
import logging
import os
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from PIL import Image
import base64
import io
import sys

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Update class labels to match the specified order (no RBC)
class_labels = [
    'IG Immature White Cell', 'Basophil', 'Eosinophil', 'Erythroblast',  
    'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet'
]

# Log class label order for debugging
logger.info(f"Class labels order: {', '.join(class_labels)}")

app = Flask(__name__)
CORS(app)

# Initialize global variables
default_model = None
default_model_path = None
default_model_loaded = False

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Check if model is loaded
        global default_model
        if default_model is None:
            logger.error("Model not loaded when prediction was attempted")
            return jsonify({'error': 'Model not loaded'}), 500
            
        data = request.json
        if not data or 'image' not in data:
            logger.error("No image data provided in request")
            return jsonify({'error': 'No image data provided'}), 400
        
        # Get the image data from the request
        image_data = data['image'].split(',')[1] if ',' in data['image'] else data['image']
        
        try:
            # Decode the base64 image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Resize and preprocess the image
            image = image.resize((224, 224))  # Assuming model input size
            image = np.array(image) / 255.0  # Normalize to [0,1]
            
            # Add batch dimension
            image = np.expand_dims(image, axis=0)
            
            # Make prediction
            logger.info("Making prediction with model")
            predictions = default_model.predict(image)
            
            # Get the predicted class
            predicted_class_index = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_index])
            
            if predicted_class_index < len(class_labels):
                predicted_class = class_labels[predicted_class_index]
            else:
                predicted_class = f"Unknown Class {predicted_class_index}"
                logger.error(f"Predicted class index {predicted_class_index} is out of bounds for class_labels of length {len(class_labels)}")
            
            # Create a response with the top prediction
            response = {
                'cell_type': predicted_class,
                'confidence': confidence,
                'all_probabilities': predictions[0].tolist(),
                'class_labels': class_labels
            }
            
            logger.info(f"Prediction successful: {predicted_class} with confidence {confidence}")
            return jsonify(response), 200
        except Exception as img_error:
            logger.error(f"Error processing image: {img_error}")
            return jsonify({'error': f'Error processing image: {str(img_error)}'}), 500
        
    except Exception as e:
        logger.error(f"Error during prediction: {e}")
        return jsonify({'error': str(e)}), 500

def load_model(model_path=None):
    global default_model, default_model_path, default_model_loaded
    default_model_loaded = False  # Reset flag
    
    try:
        # If no model path provided, try to use default
        if model_path is None:
            if os.environ.get('MODEL_PATH'):
                model_path = os.environ.get('MODEL_PATH')
                logger.info(f"Using model path from environment: {model_path}")
            else:
                # Try to find model in the current directory
                current_dir = os.getcwd()
                model_path = os.path.join(current_dir, 'model.h5')
                logger.info(f"Trying default model path: {model_path}")
        
        if not os.path.exists(model_path):
            logger.error(f"Model file not found at: {model_path}")
            return False
            
        logger.info(f"Default model file found: {model_path}")
        
        try:
            # Load the model with error capturing
            logger.info(f"Loading model from {model_path}...")
            
            # Set memory growth to avoid OOM errors
            gpus = tf.config.experimental.list_physical_devices('GPU')
            if gpus:
                try:
                    for gpu in gpus:
                        tf.config.experimental.set_memory_growth(gpu, True)
                    logger.info(f"Set memory growth for {len(gpus)} GPUs")
                except RuntimeError as e:
                    logger.error(f"Error setting GPU memory growth: {e}")
            
            # Load model with explicit flag for allowing growth
            tf_config = tf.compat.v1.ConfigProto()
            tf_config.gpu_options.allow_growth = True
            tf.compat.v1.keras.backend.set_session(tf.compat.v1.Session(config=tf_config))
            
            # Try to explicitly load the model with a timeout
            default_model = tf.keras.models.load_model(model_path, compile=False)
            
            # Test the model with a simple prediction to ensure it's working
            test_input = np.zeros((1, 224, 224, 3), dtype=np.float32)
            logger.info("Running test prediction to verify model...")
            test_output = default_model.predict(test_input)
            logger.info(f"Model test prediction shape: {test_output.shape}")
            
            # If we got here, the model is working
            default_model_path = model_path
            default_model_loaded = True
            logger.info(f"Default model loaded successfully from {model_path}")
            return True
        except Exception as model_error:
            logger.error(f"Error loading model from {model_path}: {model_error}")
            # Log more detailed error information
            import traceback
            logger.error(f"Detailed traceback: {traceback.format_exc()}")
            return False
        
    except Exception as e:
        logger.error(f"General error in load_model function: {e}")
        import traceback
        logger.error(f"Detailed traceback: {traceback.format_exc()}")
        return False

@app.route('/model/status', methods=['GET'])
def model_status():
    global default_model_path, default_model_loaded
    return jsonify({
        'model_path': default_model_path,
        'loaded': default_model_loaded
    })

@app.route('/load_model', methods=['POST'])
def load_model_endpoint():
    try:
        data = request.json
        model_path = data.get('model_path') if data else None
        success = load_model(model_path)
        return jsonify({'success': success, 'loaded': default_model_loaded, 'path': default_model_path})
    except Exception as e:
        logger.error(f"Error in load_model endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Try to load the default model
    success = load_model()
    
    # Log application state
    logger.info(f"Default model loaded: {default_model_loaded} (success: {success})")
    logger.info(f"Default model path: {default_model_path}")
    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"Class labels: {class_labels}")
    
    # Start the Flask server
    logger.info("Starting Flask server on port 5000")
    app.run(host='0.0.0.0', port=5000)
