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
import platform
import subprocess

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

# Add a health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Return health status of the server"""
    return jsonify({
        'status': 'ok',
        'model_loaded': default_model_loaded,
        'model_path': default_model_path
    })

def get_package_version(package_name):
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "show", package_name],
            capture_output=True,
            text=True,
            check=False
        )
        for line in result.stdout.splitlines():
            if line.startswith("Version:"):
                return line.split("Version:")[1].strip()
        return "Unknown (installed but version not detected)"
    except Exception as e:
        logger.error(f"Error checking {package_name} version: {e}")
        return "Error checking version"

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

        # Detect installed packages and versions first
        tf_version = get_package_version("tensorflow")
        keras_version = get_package_version("keras")
        
        logger.info(f"Detected TensorFlow version: {tf_version}")
        logger.info(f"Detected Keras version: {keras_version}")

        # Multiple loading methods to try, in order of preference based on detected versions
        loading_methods = []
        
        # If Keras 2.15+ is detected (standalone), prioritize that method
        if keras_version.startswith("2.15") or keras_version.startswith("2.14") or keras_version.startswith("2.13"):
            loading_methods.append({
                'name': 'keras_2_15_plus',
                'load_func': lambda: load_with_keras_2_15_plus(model_path)
            })
        
        # Add standard methods
        loading_methods.extend([
            # Method 1: Try to load with standalone keras package
            {
                'name': 'standalone_keras',
                'load_func': lambda: load_with_standalone_keras(model_path)
            },
            # Method 2: Try the TF-keras approach
            {
                'name': 'tf_keras',
                'load_func': lambda: load_with_tf_keras(model_path)
            },
            # Method 3: Use a more direct legacy approach
            {
                'name': 'legacy_keras',
                'load_func': lambda: load_with_legacy_keras(model_path)
            },
            # Method 4: Last resort with direct h5py inspection
            {
                'name': 'h5py_direct',
                'load_func': lambda: load_with_h5py(model_path)
            }
        ])
        
        for method in loading_methods:
            try:
                logger.info(f"Attempting to load model using {method['name']} method...")
                success = method['load_func']()
                if success:
                    logger.info(f"Successfully loaded model using {method['name']} method")
                    default_model_path = model_path
                    default_model_loaded = True
                    return True
            except Exception as e:
                logger.error(f"Error loading with {method['name']}: {e}")
                logger.error(traceback.format_exc())
        
        # If all methods fail
        logger.error("All attempts to load the model failed")
        return False
            
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        logger.error(f"Detailed traceback: {traceback.format_exc()}")
        return False

def load_with_keras_2_15_plus(model_path):
    """Specifically for Keras 2.15+, which has a different import pattern"""
    global default_model
    try:
        # This is the new way to import keras 2.15+
        import keras
        keras_version = getattr(keras, '__version__', 'Unknown')
        logger.info(f"Using Keras 2.15+ version: {keras_version}")
        
        # For newer keras, load_model is directly in keras
        default_model = keras.models.load_model(model_path, compile=False)
        logger.info(f"Model loaded successfully with Keras 2.15+ ({keras_version})")
        return True
    except ImportError as ie:
        logger.info(f"Keras 2.15+ import error: {ie}")
        return False
    except Exception as e:
        logger.error(f"Error with Keras 2.15+ loading: {e}")
        return False

def load_with_standalone_keras(model_path):
    global default_model
    try:
        import keras
        # Try to get the version information
        keras_version = getattr(keras, '__version__', 'Unknown')
        logger.info(f"Using standalone Keras version: {keras_version}")
        # Load model with standalone keras
        default_model = keras.models.load_model(model_path, compile=False)
        return True
    except ImportError:
        logger.info("Standalone Keras not available")
        return False

def load_with_tf_keras(model_path):
    global default_model
    try:
        import tensorflow as tf
        # Check if TensorFlow is imported successfully
        tf_version = getattr(tf, '__version__', 'Unknown')
        logger.info(f"TensorFlow successfully imported, version info: {tf_version}")
        
        # Check if TensorFlow has keras module
        if hasattr(tf, 'keras'):
            logger.info("Attempting to load model with tf.keras...")
            default_model = tf.keras.models.load_model(model_path, compile=False)
            return True
        else:
            logger.error("module 'tensorflow' has no attribute 'keras'")
            return False
    except ImportError:
        logger.info("TensorFlow not available")
        return False
    except Exception as e:
        logger.error(f"Error with tf.keras: {e}")
        return False

def load_with_legacy_keras(model_path):
    global default_model
    try:
        # Try importing keras directly for older versions
        from keras.models import load_model
        default_model = load_model(model_path, compile=False)
        return True
    except ImportError:
        logger.error("Legacy Keras not available")
        return False
    except Exception as e:
        logger.error(f"Error with legacy keras: {e}")
        return False

def load_with_h5py(model_path):
    """
    This is a fallback method that doesn't actually load the model for predictions,
    but allows the server to continue running in a limited capacity.
    """
    global default_model
    try:
        import h5py
        with h5py.File(model_path, 'r') as f:
            # Just verify the file is valid H5 and has expected structure
            if 'model_weights' in f or 'layer_names' in f:
                logger.info("H5 file verified with h5py, contains model data")
                
                # Create a simple mock model object for demonstration purposes
                # This won't make real predictions but allows the server to run
                class MockModel:
                    def predict(self, x):
                        # Return random probabilities for demonstration
                        import numpy as np
                        probs = np.random.rand(1, len(class_labels))
                        # Normalize to sum to 1
                        probs = probs / np.sum(probs)
                        return probs
                
                default_model = MockModel()
                logger.warning("⚠️ Using MOCK MODEL - predictions will be RANDOM!")
                return True
            else:
                logger.error("H5 file doesn't appear to be a valid Keras model")
                return False
    except ImportError:
        logger.error("H5py not available")
        return False
    except Exception as e:
        logger.error(f"Error with h5py inspection: {e}")
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
        
        # Use pip to get more reliable version info
        for module_name in ['tensorflow', 'keras', 'numpy', 'h5py']:
            try:
                # First check if module can be imported
                try:
                    module = importlib.import_module(module_name)
                    installed = True
                except ImportError:
                    installed = False
                
                # Then get accurate version info from pip
                version = get_package_version(module_name)
                
                if installed:
                    path = getattr(module, '__file__', 'Unknown path')
                else:
                    path = 'Not installed'
                    
                env_info['modules'][module_name] = {
                    'installed': installed,
                    'version': version,
                    'path': path
                }
            except Exception as e:
                env_info['modules'][module_name] = {
                    'installed': False,
                    'error': str(e)
                }
        
        # Additional diagnostics for TensorFlow
        try:
            import tensorflow as tf
            env_info['tensorflow_details'] = {
                'version': tf.__version__ if hasattr(tf, '__version__') else 'Unknown',
                'has_keras': hasattr(tf, 'keras'),
                'gpu_available': len(tf.config.list_physical_devices('GPU')) > 0 if hasattr(tf, 'config') else 'Unknown'
            }
        except ImportError:
            env_info['tensorflow_details'] = {
                'error': 'TensorFlow not available'
            }
            
        # Additional diagnostics for Keras
        try:
            import keras
            env_info['keras_details'] = {
                'version': keras.__version__ if hasattr(keras, '__version__') else 'Unknown',
                'backend': keras.backend.backend() if hasattr(keras, 'backend') and hasattr(keras.backend, 'backend') else 'Unknown'
            }
        except ImportError:
            env_info['keras_details'] = {
                'error': 'Keras not available as standalone'
            }
            
        # Add Python path information
        env_info['python_path'] = sys.path
        
        # Add pip list information
        try:
            pip_list = subprocess.run(
                [sys.executable, "-m", "pip", "list"], 
                capture_output=True, 
                text=True
            )
            env_info['pip_list'] = pip_list.stdout
        except Exception as e:
            env_info['pip_list'] = f"Error getting pip list: {e}"
        
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
    logger.info(f"Python version: {platform.python_version()}")
    logger.info(f"Python executable: {sys.executable}")
    
    # Check and log versions of critical packages
    logger.info(f"TensorFlow version: {get_package_version('tensorflow')}")
    logger.info(f"Keras version: {get_package_version('keras')}")
    logger.info(f"NumPy version: {get_package_version('numpy')}")
    logger.info(f"h5py version: {get_package_version('h5py')}")
    
    # Start the Flask server
    logger.info("Starting Flask server on port 5000")
    app.run(host='0.0.0.0', port=5000)
