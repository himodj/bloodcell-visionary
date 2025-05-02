
import logging
import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import base64
import io
import sys
import traceback

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
        
        # Try different approaches to load the model based on what's available
        models_loaded = False
        error_messages = []
        
        # First try importing TensorFlow
        try:
            import tensorflow as tf
            logger.info(f"TensorFlow version: {tf.__version__}")
            
            # Try method 1: direct tf.keras (TF 2.x)
            try:
                logger.info("Trying to load model with tf.keras (TF 2.x)")
                default_model = tf.keras.models.load_model(model_path, compile=False)
                logger.info("Model loaded successfully with tf.keras (TF 2.x)")
                models_loaded = True
            except (AttributeError, ImportError) as e:
                error_messages.append(f"tf.keras attempt failed: {str(e)}")
                
                # Try method 2: importing keras directly (standalone or TF 1.x)
                try:
                    logger.info("Trying to load model with standalone Keras")
                    import keras
                    default_model = keras.models.load_model(model_path, compile=False)
                    logger.info("Model loaded successfully with standalone Keras")
                    models_loaded = True
                except (ImportError, Exception) as e:
                    error_messages.append(f"standalone keras attempt failed: {str(e)}")
                    
                    # Try method 3: tensorflow.python.keras (some TF versions)
                    try:
                        logger.info("Trying to load model with tensorflow.python.keras")
                        from tensorflow.python.keras.models import load_model
                        default_model = load_model(model_path, compile=False)
                        logger.info("Model loaded successfully with tensorflow.python.keras")
                        models_loaded = True
                    except (ImportError, Exception) as e:
                        error_messages.append(f"tensorflow.python.keras attempt failed: {str(e)}")
            
            if not models_loaded:
                raise ImportError(f"Failed to load model using any known method: {', '.join(error_messages)}")
                
            # Simple verification test
            test_input = np.zeros((1, 224, 224, 3), dtype=np.float32)
            logger.info("Running test prediction to verify model...")
            test_output = default_model.predict(test_input)
            logger.info(f"Model test prediction shape: {test_output.shape}")
            
            # If we got here, the model is working
            default_model_path = model_path
            default_model_loaded = True
            logger.info(f"Default model loaded successfully from {model_path}")
            return True
            
        except Exception as tf_error:
            logger.error(f"Error loading TensorFlow or model: {tf_error}")
            logger.error(f"Detailed traceback: {traceback.format_exc()}")
            return False
        
    except Exception as e:
        logger.error(f"General error in load_model function: {e}")
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
