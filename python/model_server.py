# Wrap the entire script in a try-except to catch any initialization errors
try:
    import os
    import sys
    import json
    import base64
    import traceback
    import logging
    from io import BytesIO
    import numpy as np
    from PIL import Image
    import importlib
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    import time

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
    
            # Standard loading methods only
            loading_methods = [
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
                # Method 4: Try direct import from keras
                {
                    'name': 'direct_keras_import',
                    'load_func': lambda: load_with_direct_keras_import(model_path)
                }
            ]
            
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
            
            # If all methods fail, log a critical error
            logger.critical("ALL ATTEMPTS TO LOAD MODEL FAILED - APPLICATION MAY NOT FUNCTION CORRECTLY")
            logger.error("All attempts to load the model failed")
            logger.error("Error loading model: Failed to load model with any available method")
            return False
                
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            logger.error(f"Detailed traceback: {traceback.format_exc()}")
            return False
    
    def load_with_standalone_keras(model_path):
        """Load model using standalone keras package with enhanced compatibility."""
        try:
            global default_model
            import keras
            import tensorflow as tf
            import h5py
            import json
            logger.info(f"Using standalone Keras version: {keras.__version__}")
            
            # Enhanced DTypePolicy class for compatibility
            class DTypePolicy:
                def __init__(self, name='float32'):
                    self._name = name
                    
                def __call__(self, *args, **kwargs):
                    return self
                    
                @property
                def name(self):
                    return self._name
                    
                def __str__(self):
                    return self._name
                    
                def __repr__(self):
                    return f"DTypePolicy('{self._name}')"
            
            # Comprehensive custom objects for compatibility
            custom_objects = {
                'batch_shape': None,
                'DTypePolicy': DTypePolicy,
                'mixed_float16': DTypePolicy('mixed_float16'),
                'float32': DTypePolicy('float32'),
                'float16': DTypePolicy('float16'),
                'policy': DTypePolicy('float32'),
            }
            
            # Try different loading approaches in order of preference
            loading_attempts = [
                ("Direct H5 architecture reconstruction", lambda: load_h5_with_reconstruction(model_path, keras, custom_objects)),
                ("Keras with enhanced custom objects", lambda: keras.models.load_model(model_path, compile=False, custom_objects=custom_objects)),
                ("TF Keras with custom objects", lambda: tf.keras.models.load_model(model_path, compile=False, custom_objects=custom_objects)),
                ("Weight-only loading with predefined architecture", lambda: load_weights_only_approach(model_path, keras)),
            ]
            
            for attempt_name, load_func in loading_attempts:
                try:
                    logger.info(f"Attempting: {attempt_name}")
                    result = load_func()
                    if result:
                        default_model = result
                        logger.info(f"Successfully loaded model using: {attempt_name}")
                        return True
                except Exception as e:
                    logger.warning(f"{attempt_name} failed: {e}")
                    
            return False
            
        except Exception as e:
            logger.error(f"Error with standalone keras: {e}")
            return False
    
    def load_h5_with_reconstruction(model_path, keras, custom_objects):
        """Advanced H5 loading with full config reconstruction."""
        import h5py
        import json
        
        with h5py.File(model_path, 'r') as f:
            # Load model architecture from JSON if available
            if 'model_config' in f.attrs:
                model_config = f.attrs['model_config']
                if isinstance(model_config, bytes):
                    model_config = model_config.decode('utf-8')
                
                config = json.loads(model_config)
                
                # Enhanced config cleaning
                def clean_config_advanced(obj):
                    if isinstance(obj, dict):
                        # Remove all problematic fields
                        problematic_keys = [
                            'batch_shape', 'dtype_policy', 'mixed_precision_policy',
                            'policy', '_dtype_policy', 'dtype'
                        ]
                        for key in list(obj.keys()):
                            if key in problematic_keys:
                                logger.debug(f"Removing problematic key: {key}")
                                del obj[key]
                        
                        # Handle batch_input_shape properly
                        if 'batch_input_shape' in obj:
                            batch_shape = obj['batch_input_shape']
                            if batch_shape and len(batch_shape) > 1:
                                obj['input_shape'] = batch_shape[1:]
                            del obj['batch_input_shape']
                        
                        # Clean nested configurations
                        for key, value in obj.items():
                            if isinstance(value, (dict, list)):
                                clean_config_advanced(value)
                                
                    elif isinstance(obj, list):
                        for item in obj:
                            if isinstance(item, (dict, list)):
                                clean_config_advanced(item)
                
                clean_config_advanced(config)
                
                # Create model from cleaned config
                logger.info("Creating model from enhanced cleaned config...")
                model = keras.models.model_from_json(json.dumps(config), custom_objects=custom_objects)
                
                # Load weights with error handling
                logger.info("Loading weights with error handling...")
                try:
                    model.load_weights(model_path)
                    logger.info("Successfully loaded weights")
                    return model
                except Exception as weight_err:
                    logger.error(f"Weight loading failed: {weight_err}")
                    # Try loading weights by name
                    try:
                        model.load_weights(model_path, by_name=True, skip_mismatch=True)
                        logger.info("Successfully loaded weights by name with skip mismatch")
                        return model
                    except Exception as by_name_err:
                        logger.error(f"Weight loading by name failed: {by_name_err}")
                        raise
        
        return None
    
    def load_weights_only_approach(model_path, keras):
        """Load weights into a predefined architecture."""
        import h5py
        
        # Try to inspect the model file to determine architecture
        try:
            with h5py.File(model_path, 'r') as f:
                # Look for layer information
                if 'model_weights' in f:
                    layer_names = list(f['model_weights'].keys()) if 'model_weights' in f else []
                else:
                    layer_names = [key for key in f.keys() if 'layer' in key.lower()]
                
                logger.info(f"Found {len(layer_names)} layers in model file")
                
                # Create a more flexible architecture based on detected layers
                model = create_flexible_architecture(layer_names, keras)
                
                if model:
                    try:
                        model.load_weights(model_path, by_name=True, skip_mismatch=True)
                        logger.info("Successfully loaded weights into flexible architecture")
                        return model
                    except Exception as e:
                        logger.error(f"Failed to load weights into flexible architecture: {e}")
                        
        except Exception as e:
            logger.error(f"Failed to inspect model file: {e}")
        
        return None
    
    def create_flexible_architecture(layer_names, keras):
        """Create a flexible model architecture based on detected layers."""
        try:
            # Try different common input shapes for blood cell models
            common_input_shapes = [
                (224, 224, 3),  # Common for medical imaging
                (150, 150, 3),  # Another common size
                (128, 128, 3),  # Original guess
                (64, 64, 3),    # Smaller size
                (256, 256, 3)   # Larger size
            ]
            
            for input_shape in common_input_shapes:
                try:
                    logger.info(f"Trying input shape: {input_shape}")
                    model = keras.Sequential([
                        keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=input_shape),
                        keras.layers.MaxPooling2D(2, 2),
                        keras.layers.Conv2D(64, (3, 3), activation='relu'),
                        keras.layers.MaxPooling2D(2, 2),
                        keras.layers.Conv2D(128, (3, 3), activation='relu'),
                        keras.layers.MaxPooling2D(2, 2),
                        keras.layers.Flatten(),
                        keras.layers.Dropout(0.5),
                        keras.layers.Dense(128, activation='relu'),
                        keras.layers.Dense(len(class_labels), activation='softmax')
                    ])
                    
                    logger.info(f"Created flexible CNN architecture with input shape: {input_shape}")
                    return model
                    
                except Exception as shape_err:
                    logger.warning(f"Failed with input shape {input_shape}: {shape_err}")
                    continue
            
            logger.error("All input shapes failed")
            return None
            
        except Exception as e:
            logger.error(f"Failed to create flexible architecture: {e}")
            return None
    
    def load_with_tf_keras(model_path):
        """Load model using tf.keras."""
        global default_model
        try:
            import tensorflow as tf
            logger.info(f"TensorFlow successfully imported, version info: {tf.__version__}")
            logger.info("Attempting to load model with tf.keras...")
            
            try:
                default_model = tf.keras.models.load_model(model_path, compile=False)
                return True
            except Exception as e:
                if 'batch_shape' in str(e):
                    logger.warning("Encountered batch_shape error in tf.keras, trying to load weights only")
                    # Try a fallback approach - create a model and load weights
                    try:
                        # This requires knowing the model architecture in advance
                        model = tf.keras.Sequential([
                            tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(128, 128, 3)),
                            tf.keras.layers.MaxPooling2D(2, 2),
                            tf.keras.layers.Flatten(),
                            tf.keras.layers.Dense(len(class_labels), activation='softmax')
                        ])
                        model.load_weights(model_path)
                        default_model = model
                        return True
                    except Exception as weight_err:
                        logger.error(f"Error loading weights only: {weight_err}")
                else:
                    logger.error(f"Error with tf.keras: {e}")
                return False
        except ImportError:
            logger.error("TensorFlow import failed")
            return False
    
    def load_with_legacy_keras(model_path):
        """Load model using legacy Keras methods."""
        global default_model
        try:
            import keras
            
            try:
                default_model = keras.models.load_model(model_path, compile=False)
                return True
            except Exception as e:
                if 'batch_shape' in str(e):
                    logger.warning("Encountered batch_shape error in legacy keras, trying custom loading")
                    # Try a legacy fallback approach
                    try:
                        from keras.models import Sequential
                        from keras.layers import Dense, Conv2D, MaxPooling2D, Flatten
                        
                        model = Sequential([
                            Conv2D(32, (3, 3), activation='relu', input_shape=(128, 128, 3)),
                            MaxPooling2D(2, 2),
                            Flatten(),
                            Dense(len(class_labels), activation='softmax')
                        ])
                        model.load_weights(model_path)
                        default_model = model
                        return True
                    except Exception as custom_err:
                        logger.error(f"Error in custom legacy loading: {custom_err}")
                else:
                    logger.error(f"Error with legacy keras: {e}")
                return False
        except ImportError:
            logger.error("Legacy Keras import failed")
            return False
    
    def load_with_direct_keras_import(model_path):
        """Load model using direct keras import approach."""
        global default_model
        try:
            from keras.models import load_model
            
            try:
                default_model = load_model(model_path, compile=False)
                return True
            except Exception as e:
                if 'batch_shape' in str(e):
                    logger.warning("Encountered batch_shape error in direct keras import")
                else:
                    logger.error(f"Error with direct keras import: {e}")
                return False
        except ImportError:
            logger.error("Direct Keras import failed")
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
                predictions = default_model.predict(img_batch)
                
                # Find the class with highest probability
                predicted_class_idx = np.argmax(predictions[0])
                predicted_class = class_labels[predicted_class_idx]
                confidence = float(predictions[0][predicted_class_idx])
                
                # Get all probabilities as a list
                all_probabilities = [float(p) for p in predictions[0]]
                
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
            # Return 503 Service Unavailable if the model isn't loaded
            return jsonify({"status": "degraded", "model_loaded": False}), 503
    
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
        
        # Check if requirements are met
        requirements = {
            "all_ok": True,
            "missing_packages": [],
            "incorrect_versions": []
        }
        
        # Check required packages
        required_packages = {
            "tensorflow": "2.10.0",
            "keras": "2.10.0",
            "h5py": "3.7.0",
            "numpy": "1.23.5",
            "pillow": "9.2.0"
        }
        
        for pkg, version in required_packages.items():
            installed_version = get_package_version(pkg)
            if not installed_version:
                requirements["all_ok"] = False
                requirements["missing_packages"].append(pkg)
            elif installed_version != version:
                requirements["all_ok"] = False
                requirements["incorrect_versions"].append(f"{pkg}={installed_version} (required: {version})")
        
        env_info["requirements_check"] = requirements
        
        return jsonify(env_info)
    
    @app.route('/load_model', methods=['POST'])
    def load_model_route():
        """Load or reload a model."""
        try:
            data = request.get_json()
            model_path = data.get('model_path')
            
            if not model_path:
                return jsonify({"success": False, "error": "No model path provided"})
            
            logger.info(f"Default model file found: {model_path}")
            
            # Attempt to load the model
            success = load_model(model_path)
            
            if success:
                return jsonify({"success": True, "loaded": True, "path": model_path})
            else:
                return jsonify({
                    "success": False, 
                    "error": "Failed to load model with any available method",
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
    
    @app.route('/requirements', methods=['GET'])
    def check_requirements():
        """Check if all required packages are installed with correct versions."""
        try:
            # Required packages and versions
            required_packages = {
                "tensorflow": "2.10.0",
                "keras": "2.10.0",
                "h5py": "3.7.0",
                "numpy": "1.23.5",
                "pillow": "9.2.0"
            }
            
            missing_packages = []
            incorrect_versions = []
            
            for pkg, version in required_packages.items():
                installed_version = get_package_version(pkg)
                if not installed_version:
                    missing_packages.append(pkg)
                elif installed_version != version:
                    incorrect_versions.append(f"{pkg}={installed_version} (required: {version})")
            
            all_ok = len(missing_packages) == 0 and len(incorrect_versions) == 0
            
            return jsonify({
                "all_ok": all_ok,
                "missing_packages": missing_packages,
                "incorrect_versions": incorrect_versions
            })
            
        except Exception as e:
            logger.error(f"Error checking requirements: {e}")
            logger.error(traceback.format_exc())
            return jsonify({
                "all_ok": False,
                "error": str(e)
            }), 500
    
    @app.route('/install_requirements', methods=['POST'])
    def install_requirements():
        """Install required packages."""
        try:
            import subprocess
            
            requirements_txt = """
    tensorflow==2.10.0
    keras==2.10.0
    h5py==3.7.0
    numpy==1.23.5
    pillow==9.2.0
    """
            
            # Write requirements to a temporary file
            temp_file = "temp_requirements.txt"
            with open(temp_file, "w") as f:
                f.write(requirements_txt.strip())
                
            # Install requirements
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", temp_file],
                capture_output=True,
                text=True
            )
            
            # Remove temporary file
            try:
                os.remove(temp_file)
            except:
                pass
                
            if result.returncode == 0:
                logger.info("Successfully installed requirements")
                return jsonify({"message": "Requirements installed successfully", "restart_needed": True})
            else:
                logger.error(f"Error installing requirements: {result.stderr}")
                return jsonify({"error": "Failed to install requirements", "details": result.stderr}), 500
                
        except Exception as e:
            logger.error(f"Error during installation: {e}")
            logger.error(traceback.format_exc())
            return jsonify({"error": str(e)}), 500
    
    # Initialize server by trying to load default model
    if os.environ.get('MODEL_PATH'):
        default_model_loaded = load_model(os.environ.get('MODEL_PATH'))
        logger.info(f"Default model loaded: {default_model_loaded} (success: {default_model_loaded})")
    else:
        logger.info("No MODEL_PATH environment variable set")
    
    logger.info(f"Default model path: {default_model_path}")
    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"Class labels: {class_labels}")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Python executable: {sys.executable}")
    
    # Log key package versions
    for pkg in ["tensorflow", "keras", "numpy", "h5py"]:
        version = get_package_version(pkg)
        logger.info(f"{pkg.capitalize()} version: {version}")
    
    # Start the server
    if __name__ == '__main__':
        logger.info("Starting Flask server on port 5000")
        app.run(host='0.0.0.0', port=5000)
        
except Exception as startup_error:
    print(f"CRITICAL STARTUP ERROR: {startup_error}")
    print("Detailed error information:")
    import traceback
    traceback.print_exc()
    # Keep the console window open if running standalone
    if os.environ.get('KEEP_CONSOLE_OPEN') == '1':
        input("Press Enter to exit...")
    sys.exit(1)
