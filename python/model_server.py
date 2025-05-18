
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

        # Standard loading methods only, no custom wrapper
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
            # Method 4: Try direct import from keras
            {
                'name': 'direct_keras_import',
                'load_func': lambda: load_with_direct_keras_import(model_path)
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
        
        # If all methods fail, return False
        logger.error("All attempts to load the model failed")
        logger.error("Error loading model: Failed to load model with any available method")
        return False
            
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        logger.error(f"Detailed traceback: {traceback.format_exc()}")
        return False
