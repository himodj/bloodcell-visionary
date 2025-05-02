
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
import importlib

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

def check_tensorflow_installation():
    """Check if TensorFlow is properly installed and usable"""
    try:
        # Check what packages are available
        logger.info("Checking environment...")
        if 'keras' in sys.modules:
            logger.info("Keras is already imported")
        
        if 'tensorflow' in sys.modules:
            logger.info("TensorFlow is already imported")
        
        # Try direct import
        try:
            import tensorflow as tf
            if hasattr(tf, '__version__'):
                logger.info(f"Successfully imported TensorFlow version {tf.__version__}")
                return True, tf
            else:
                logger.error("TensorFlow imported but has no __version__ attribute")
                
                # Try to get more information
                logger.info(f"TensorFlow module path: {tf.__file__}")
                logger.info(f"Available attributes in TensorFlow: {dir(tf)[:20]}")
                
                # Return the module anyway
                return True, tf
                
        except ImportError as e:
            logger.error(f"Failed to import TensorFlow: {e}")
            
        # Try importing keras directly 
        try:
            import keras
            logger.info(f"Successfully imported standalone Keras version {keras.__version__}")
            return True, keras
        except ImportError as e:
            logger.error(f"Failed to import standalone Keras: {e}")
        
        return False, None
        
    except Exception as e:
        logger.error(f"Error checking TensorFlow installation: {e}")
        logger.error(traceback.format_exc())
        return False, None

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
        
        # First try to check if we can even import TensorFlow
        tf_ok, tf_or_keras = check_tensorflow_installation()
        
        if not tf_ok:
            logger.error("Cannot import TensorFlow or Keras. Please check your Python installation.")
            return False
        
        # Try different approaches to load the model based on what's available
        models_loaded = False
        error_messages = []
        
        # First try standalone keras if that's what we got back
        if tf_or_keras.__name__ == 'keras':
            try:
                logger.info("Loading model with standalone Keras...")
                default_model = tf_or_keras.models.load_model(model_path, compile=False)
                logger.info("Model loaded successfully with standalone Keras")
                models_loaded = True
            except Exception as e:
                error_messages.append(f"Standalone keras attempt failed: {str(e)}")
        else:
            # Try with the TensorFlow module we got
            try:
                logger.info("Loading model using available TensorFlow...")
                
                # Check if this TensorFlow has keras
                if hasattr(tf_or_keras, 'keras'):
                    default_model = tf_or_keras.keras.models.load_model(model_path, compile=False)
                    logger.info("Model loaded successfully with tf.keras")
                    models_loaded = True
                # Maybe it's an older version with different API
                elif hasattr(tf_or_keras, 'saved_model'):
                    default_model = tf_or_keras.saved_model.load(model_path)
                    logger.info("Model loaded successfully with tf.saved_model")
                    models_loaded = True
                else:
                    logger.error("TensorFlow available but lacks keras and saved_model modules")
                    error_messages.append("TensorFlow lacks needed modules")
            except (AttributeError, ImportError, Exception) as e:
                error_messages.append(f"TensorFlow loading attempt failed: {str(e)}")
                
        if not models_loaded:
            # Try a different approach - install and import keras directly
            try:
                logger.info("Attempting to install and import standalone keras...")
                import pip
                pip.main(['install', 'keras'])
                
                # Force reimport of keras
                if 'keras' in sys.modules:
                    del sys.modules['keras']
                
                import keras
                default_model = keras.models.load_model(model_path, compile=False)
                logger.info("Model loaded successfully with fresh keras installation")
                models_loaded = True
            except Exception as pip_err:
                error_messages.append(f"Keras installation attempt failed: {str(pip_err)}")
            
        if not models_loaded:
            error_msg = f"Failed to load model using any known method: {', '.join(error_messages)}"
            logger.error(error_msg)
            return False
                
        # Simple verification test
        try:
            test_input = np.zeros((1, 224, 224, 3), dtype=np.float32)
            logger.info("Running test prediction to verify model...")
            test_output = default_model.predict(test_input)
            logger.info(f"Model test prediction shape: {test_output.shape}")
            
            # If we got here, the model is working
            default_model_path = model_path
            default_model_loaded = True
            logger.info(f"Default model loaded successfully from {model_path}")
            return True
        except Exception as test_error:
            logger.error(f"Model verification test failed: {test_error}")
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

@app.route('/environment', methods=['GET'])
def environment_info():
    """Return information about the Python environment"""
    try:
        env_info = {
            'python_version': sys.version,
            'platform': sys.platform,
            'modules': {}
        }
        
        # Check for key modules
        for module_name in ['tensorflow', 'keras', 'numpy', 'h5py']:
            try:
                module = importlib.import_module(module_name)
                version = getattr(module, '__version__', 'Unknown version')
                env_info['modules'][module_name] = {
                    'installed': True,
                    'version': version,
                    'path': getattr(module, '__file__', 'Unknown path')
                }
            except ImportError:
                env_info['modules'][module_name] = {
                    'installed': False
                }
        
        return jsonify(env_info)
    except Exception as e:
        logger.error(f"Error getting environment info: {e}")
        return jsonify({'error': str(e)}), 500

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
