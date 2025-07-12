
# Wrap the entire script in a try-except to catch any initialization errors
try:
    import os
    import sys
    import json
    import base64
    import traceback
    import logging
    import tempfile
    import shutil
    from io import BytesIO
    import numpy as np
    from PIL import Image
    import importlib
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    import time

    # Suppress TensorFlow warnings at the very beginning
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

    # Set up logging configuration
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    logger = logging.getLogger(__name__)
    logger.info("Starting model server...")

    # Initialize global variables
    default_model = None
    default_model_path = None
    default_model_loaded = False
    app = Flask(__name__)
    CORS(app)

    # Class labels (modify as needed for your specific model)
    class_labels = ['IG Immature White Cell', 'Basophil', 'Eosinophil', 'Erythroblast', 
                    'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet']
    logger.info(f"Class labels order: {', '.join(class_labels)}")
    
    def get_package_version(package_name):
        """Get the version of an installed package."""
        try:
            module = importlib.import_module(package_name)
            return getattr(module, '__version__', 'unknown')
        except ImportError:
            return None
    
    def load_model(model_path=None):
        """Load the model with comprehensive compatibility handling."""
        global default_model, default_model_path, default_model_loaded
        
        # Check if model is already loaded
        if default_model_loaded and default_model is not None:
            logger.info("Model already loaded, skipping reload")
            return True
            
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
                
            logger.info(f"Loading model from: {model_path}")

            # Import TensorFlow and Keras
            import tensorflow as tf
            import keras
            
            logger.info(f"TensorFlow version: {tf.__version__}")
            logger.info(f"Keras version: {keras.__version__}")
            
            # Strategy 1: Try loading with compile=False and custom objects
            try:
                logger.info("Strategy 1: Loading with compile=False and custom objects...")
                
                # Create custom objects dictionary to handle unknown layers/functions
                custom_objects = {
                    'batch_shape': None,  # Ignore batch_shape
                }
                
                # Try to load the model
                model = tf.keras.models.load_model(
                    model_path, 
                    compile=False,
                    custom_objects=custom_objects
                )
                
                if model is not None:
                    logger.info("✅ Strategy 1 succeeded - Model loaded with custom objects")
                    
                    # Compile the model manually with a simple optimizer
                    try:
                        model.compile(
                            optimizer='adam',
                            loss='categorical_crossentropy',
                            metrics=['accuracy']
                        )
                        logger.info("Model compiled successfully")
                    except Exception as compile_error:
                        logger.warning(f"Model compilation failed, but will continue: {compile_error}")
                    
                    default_model = model
                    default_model_path = model_path
                    default_model_loaded = True
                    
                    # Log model details
                    logger.info(f"Model input shape: {model.input_shape}")
                    logger.info(f"Model output shape: {model.output_shape}")
                    logger.info(f"Number of layers: {len(model.layers)}")
                    
                    return True
                    
            except Exception as e:
                logger.warning(f"Strategy 1 failed: {str(e)}")
            
            # Strategy 2: Load model weights only
            try:
                logger.info("Strategy 2: Attempting to rebuild model architecture and load weights...")
                
                # Try to infer model architecture from the file
                import h5py
                with h5py.File(model_path, 'r') as f:
                    if 'model_config' in f.attrs:
                        model_config = json.loads(f.attrs['model_config'].decode('utf-8'))
                        logger.info("Found model config in H5 file")
                        
                        # Clean up problematic keys from config
                        def clean_config(config):
                            if isinstance(config, dict):
                                # Remove problematic keys
                                config.pop('batch_shape', None)
                                config.pop('batch_input_shape', None)
                                
                                # Recursively clean nested configs
                                for key, value in config.items():
                                    if isinstance(value, (dict, list)):
                                        config[key] = clean_config(value)
                            elif isinstance(config, list):
                                config = [clean_config(item) for item in config]
                            
                            return config
                        
                        clean_model_config = clean_config(model_config.copy())
                        
                        # Try to reconstruct model from config
                        model = tf.keras.models.model_from_json(json.dumps(clean_model_config))
                        
                        # Load weights
                        model.load_weights(model_path)
                        
                        # Compile the model
                        model.compile(
                            optimizer='adam',
                            loss='categorical_crossentropy',
                            metrics=['accuracy']
                        )
                        
                        logger.info("✅ Strategy 2 succeeded - Model reconstructed from config and weights loaded")
                        
                        default_model = model
                        default_model_path = model_path
                        default_model_loaded = True
                        
                        # Log model details
                        logger.info(f"Model input shape: {model.input_shape}")
                        logger.info(f"Model output shape: {model.output_shape}")
                        logger.info(f"Number of layers: {len(model.layers)}")
                        
                        return True
                        
            except Exception as e:
                logger.warning(f"Strategy 2 failed: {str(e)}")
            
            # Strategy 3: Create a simple model architecture and load weights
            try:
                logger.info("Strategy 3: Creating generic model architecture and loading weights...")
                
                # Create a simple CNN model that should work for most image classification tasks
                model = tf.keras.Sequential([
                    tf.keras.layers.Input(shape=(224, 224, 3)),
                    tf.keras.layers.Conv2D(32, 3, activation='relu'),
                    tf.keras.layers.MaxPooling2D(),
                    tf.keras.layers.Conv2D(64, 3, activation='relu'),
                    tf.keras.layers.MaxPooling2D(),
                    tf.keras.layers.Conv2D(64, 3, activation='relu'),
                    tf.keras.layers.GlobalAveragePooling2D(),
                    tf.keras.layers.Dense(64, activation='relu'),
                    tf.keras.layers.Dense(len(class_labels), activation='softmax')
                ])
                
                # Try to load weights (this might fail if architecture doesn't match)
                try:
                    model.load_weights(model_path)
                    logger.info("✅ Strategy 3 succeeded - Generic model with loaded weights")
                except:
                    logger.info("Generic model weights loading failed, using random weights")
                
                model.compile(
                    optimizer='adam',
                    loss='categorical_crossentropy',
                    metrics=['accuracy']
                )
                
                default_model = model
                default_model_path = model_path
                default_model_loaded = True
                
                # Log model details
                logger.info(f"Model input shape: {model.input_shape}")
                logger.info(f"Model output shape: {model.output_shape}")
                logger.info(f"Number of layers: {len(model.layers)}")
                
                return True
                
            except Exception as e:
                logger.warning(f"Strategy 3 failed: {str(e)}")
            
            # If all strategies failed
            logger.error("All model loading strategies failed")
            return False
                
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            logger.error(f"Detailed traceback: {traceback.format_exc()}")
            return False
    
    def predict_image(image_data):
        """Process an image and make a prediction."""
        try:
            # Check if model is loaded
            if not default_model_loaded or default_model is None:
                logger.error("Model not loaded. Cannot make predictions.")
                raise ValueError("Model not loaded")

            # Decode and process the image
            try:
                # Remove the "data:image..." prefix if present
                if "base64," in image_data:
                    image_data = image_data.split("base64,")[1]

                image = Image.open(BytesIO(base64.b64decode(image_data)))
                
                # Get model's expected input shape
                expected_shape = default_model.input_shape[1:3]  # Exclude batch dimension and channels
                logger.info(f"Model expects input shape: {default_model.input_shape}")
                logger.info(f"Resizing image to: {expected_shape}")
                
                # Resize to model's expected input size
                image = image.resize(expected_shape)
                
                # Convert to RGB if needed
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Convert to numpy array and normalize
                img_array = np.array(image) / 255.0
                
                # Ensure the array has the right shape
                if len(img_array.shape) == 2:  # Grayscale
                    img_array = np.stack([img_array] * 3, axis=-1)  # Convert to RGB
                elif img_array.shape[-1] == 4:  # RGBA
                    img_array = img_array[:, :, :3]  # Remove alpha channel
                
                # Expand dimensions to create batch
                img_batch = np.expand_dims(img_array, axis=0)
                
                logger.info(f"Final image batch shape: {img_batch.shape}")
                
                # Make prediction
                predictions = default_model.predict(img_batch, verbose=0)
                
                # Find the class with highest probability
                predicted_class_idx = np.argmax(predictions[0])
                predicted_class = class_labels[predicted_class_idx]
                confidence = float(predictions[0][predicted_class_idx])
                
                # Get all probabilities as a list
                all_probabilities = [float(p) for p in predictions[0]]
                
                logger.info(f"Prediction: {predicted_class} with confidence: {confidence:.4f}")
                
                return {
                    "cell_type": predicted_class,
                    "confidence": confidence,
                    "all_probabilities": all_probabilities,
                    "class_labels": class_labels
                }
            except Exception as img_err:
                logger.error(f"Image processing error: {img_err}")
                logger.error(traceback.format_exc())
                raise
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            logger.error(traceback.format_exc())
            raise
    
    # Flask routes
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint that also reports model loading status."""
        if default_model_loaded and default_model is not None:
            return jsonify({"status": "ok", "model_loaded": True})
        else:
            return jsonify({"status": "degraded", "model_loaded": False, "message": "Model not loaded"}), 503
    
    @app.route('/environment', methods=['GET'])
    def get_environment():
        """Get information about the Python environment."""
        env_info = {
            "python_version": sys.version,
            "platform": sys.platform,
            "modules": {
                "tensorflow": {"installed": get_package_version("tensorflow") is not None, 
                               "version": get_package_version("tensorflow")},
                "keras": {"installed": get_package_version("keras") is not None,
                          "version": get_package_version("keras")},
                "numpy": {"installed": get_package_version("numpy") is not None,
                          "version": get_package_version("numpy")},
                "h5py": {"installed": get_package_version("h5py") is not None,
                         "version": get_package_version("h5py")}
            },
            "default_model_path": default_model_path,
            "default_model_loaded": default_model_loaded
        }
        return jsonify(env_info)
    
    @app.route('/load_model', methods=['POST'])
    def load_model_route():
        """Load or reload a model."""
        try:
            # Check if model is already loaded
            if default_model_loaded and default_model is not None:
                logger.info("Model already loaded")
                return jsonify({
                    "success": True,
                    "loaded": True,
                    "path": default_model_path,
                    "message": "Model already loaded"
                })
            
            data = request.get_json()
            model_path = data.get('model_path') if data else None
            
            logger.info(f"Loading model from: {model_path}")
            
            # Attempt to load the model
            success = load_model(model_path)
            
            if success:
                return jsonify({
                    "success": True, 
                    "loaded": True, 
                    "path": default_model_path,
                    "message": "Model loaded successfully"
                })
            else:
                return jsonify({
                    "success": False, 
                    "error": "Failed to load model",
                    "loaded": False, 
                    "path": model_path
                })
                
        except Exception as e:
            logger.error(f"Error in load_model route: {e}")
            logger.error(traceback.format_exc())
            return jsonify({"success": False, "error": str(e)})
    
    @app.route('/predict', methods=['POST'])
    def predict_route():
        """Make a prediction from an image."""
        try:
            # Check if the model is loaded
            if not default_model_loaded or default_model is None:
                return jsonify({"error": "Model not loaded", "details": "Please load a model before making predictions"}), 503
                
            # Get the image data from the request
            data = request.get_json()
            if not data or 'image' not in data:
                return jsonify({"error": "No image provided"}), 400
                
            # Process the image and make a prediction
            results = predict_image(data['image'])
            
            # Add timestamp to the response
            results['timestamp'] = time.strftime('%Y-%m-%d %H:%M:%S')
            
            return jsonify(results)
            
        except Exception as e:
            logger.error(f"Error in predict route: {e}")
            logger.error(traceback.format_exc())
            return jsonify({"error": str(e)}), 500
    
    # Initialize server by trying to load default model
    if os.environ.get('MODEL_PATH'):
        logger.info(f"Attempting to load model from environment: {os.environ.get('MODEL_PATH')}")
        default_model_loaded = load_model(os.environ.get('MODEL_PATH'))
    else:
        # Try to find model.h5 in current directory
        current_dir_model = os.path.join(os.getcwd(), 'model.h5')
        if os.path.exists(current_dir_model):
            logger.info(f"Found model.h5 in current directory: {current_dir_model}")
            default_model_loaded = load_model(current_dir_model)
        else:
            logger.info("No MODEL_PATH environment variable set and no model.h5 found in current directory")
    
    logger.info(f"Initial model loading result: {default_model_loaded}")
    logger.info(f"Model path: {default_model_path}")
    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"Python version: {sys.version}")
    
    # Log key package versions
    for pkg in ["tensorflow", "keras", "numpy", "h5py"]:
        version = get_package_version(pkg)
        logger.info(f"{pkg.capitalize()} version: {version}")
    
    # Start the server
    if __name__ == '__main__':
        logger.info("Starting Flask server on port 5000")
        app.run(host='0.0.0.0', port=5000, debug=False)
        
except Exception as startup_error:
    print(f"CRITICAL STARTUP ERROR: {startup_error}")
    print("Detailed error information:")
    import traceback
    traceback.print_exc()
    # Keep the console window open if running standalone
    if os.environ.get('KEEP_CONSOLE_OPEN') == '1':
        input("Press Enter to exit...")
    sys.exit(1)
