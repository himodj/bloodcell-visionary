
import { CellType, AnalysisResult, AnalyzedCell } from '../contexts/AnalysisContext';
import { toast } from 'sonner';

// Initialize model state
let modelInitialized = false;
let modelPath: string | null = null;

// Format a number with commas for thousands
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Format a date for the report
export const formatReportDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Generate a random report ID
export const generateReportId = (): string => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

// Determine severity based on abnormality rate
export const determineSeverity = (abnormalityRate: number): 'normal' | 'mild' | 'moderate' | 'severe' => {
  if (abnormalityRate < 0.1) return 'normal';
  if (abnormalityRate < 0.3) return 'mild';
  if (abnormalityRate < 0.5) return 'moderate';
  return 'severe';
};

// Get color for a cell type
export const getCellTypeColor = (cellType: CellType): string => {
  const colorMap: Record<CellType, string> = {
    'IG Immature White Cell': '#5AC8FA',
    'Basophil': '#AF52DE',
    'Eosinophil': '#FF9500',
    'Erythroblast': '#FF2D55',
    'Lymphocyte': '#34C759',
    'Monocyte': '#FFCC00',
    'Neutrophil': '#007AFF',
    'Platelet': '#0A84FF'
  };
  
  return colorMap[cellType] || '#8E8E93';
};

// Check if model is initialized
export const isModelInitialized = (): boolean => {
  return modelInitialized;
};

// Initialize the model
export const initializeModel = async (path: string, forceH5 = false): Promise<boolean> => {
  try {
    console.log(`Initializing model from path: ${path}`);
    
    // Set the model path globally
    modelPath = path;
    
    // Mark model as initialized
    modelInitialized = true;
    
    console.log('Model initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize model:', error);
    modelInitialized = false;
    throw error;
  }
};

// Handle image upload and analysis
export const handleImageUpload = async (
  file: File, 
  onStart: () => void,
  onComplete: (result: AnalysisResult) => void,
  onError: (error: string) => void
): Promise<void> => {
  try {
    console.log('Processing image upload:', file.name);
    
    // Check if model is initialized
    if (!window.electron || !modelInitialized) {
      throw new Error('Model not initialized or not in Electron environment');
    }
    
    // Start analysis
    onStart();
    
    // Read file as data URL
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read image file');
        }
        
        const imageDataUrl = e.target.result as string;
        
        // Analyze image with H5 model via Electron backend
        console.log('Sending image for analysis...');
        const response = await window.electron.analyzeWithH5Model(modelPath, imageDataUrl);
        
        if (response.error) {
          throw new Error(`Analysis failed: ${response.error}`);
        }
        
        console.log('Analysis completed successfully:', response);
        
        // Get cell type and confidence from response
        const cellType = response.cell_type as CellType;
        const confidence = response.confidence;
        
        // Get current date
        const analysisDate = new Date();
        
        // Create a cell object
        const analyzedCell: AnalyzedCell = {
          type: cellType,
          confidence: confidence
        };
        
        // Initialize cell counts
        const cell_counts = {
          'IG Immature White Cell': 0,
          'Basophil': 0,
          'Eosinophil': 0,
          'Erythroblast': 0,
          'Lymphocyte': 0,
          'Monocyte': 0,
          'Neutrophil': 0,
          'Platelet': 0
        };
        
        // Increment the detected cell type
        cell_counts[cellType] = 1;
        
        // Determine if the cell is abnormal based on its type
        const isAbnormal = ['IG Immature White Cell', 'Basophil', 'Eosinophil'].includes(cellType);
        
        // Create analysis result
        const result: AnalysisResult = {
          image: imageDataUrl,
          analysisDate,
          cellCounts: {
            totalCells: 1,
            normalCells: isAbnormal ? 0 : 1,
            abnormalCells: isAbnormal ? 1 : 0,
            detectedCells: cell_counts
          },
          detectedCells: [analyzedCell],
          abnormalityRate: isAbnormal ? 1.0 : 0.0,
          recommendations: generateRecommendations(cellType),
          possibleConditions: generatePossibleConditions(cellType)
        };
        
        onComplete(result);
      } catch (error) {
        console.error('Error processing image:', error);
        onError(error instanceof Error ? error.message : String(error));
      }
    };
    
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error handling image upload:', error);
    onError(error instanceof Error ? error.message : String(error));
  }
};

// Generate recommendations based on cell type
const generateRecommendations = (cellType: CellType): string[] => {
  const commonRecommendations = [
    'Consult with a hematologist for further evaluation.',
    'Consider follow-up testing in 3-6 months.',
    'Maintain proper hydration and a balanced diet.'
  ];
  
  const specificRecommendations: Record<CellType, string[]> = {
    'IG Immature White Cell': [
      'Monitor for signs of infection or inflammation.',
      'Additional bone marrow evaluation may be needed.'
    ],
    'Basophil': [
      'Consider testing for allergies or inflammatory conditions.',
      'Avoid potential allergens if appropriate.'
    ],
    'Eosinophil': [
      'Evaluate for potential parasitic infections or allergies.',
      'Monitor respiratory symptoms if present.'
    ],
    'Erythroblast': [
      'Follow-up complete blood count (CBC) recommended.',
      'Iron level testing may be beneficial.'
    ],
    'Lymphocyte': [
      'Monitor for signs of viral infection.',
      'Consider immune system evaluation if levels are abnormal.'
    ],
    'Monocyte': [
      'Follow up for potential chronic infections.',
      'Evaluate for inflammatory conditions.'
    ],
    'Neutrophil': [
      'Monitor for bacterial infections.',
      'Follow up on inflammatory markers if elevated.'
    ],
    'Platelet': [
      'Monitor bleeding and clotting function.',
      'Avoid medications that affect platelet function if appropriate.'
    ]
  };
  
  return [...specificRecommendations[cellType], ...commonRecommendations];
};

// Generate possible conditions based on cell type
const generatePossibleConditions = (cellType: CellType): string[] => {
  const conditions: Record<CellType, string[]> = {
    'IG Immature White Cell': [
      'Leukemia',
      'Severe infection',
      'Bone marrow response to inflammation'
    ],
    'Basophil': [
      'Allergic reaction',
      'Chronic inflammation',
      'Myeloproliferative disorders'
    ],
    'Eosinophil': [
      'Parasitic infection',
      'Allergic disorder',
      'Asthma',
      'Autoimmune condition'
    ],
    'Erythroblast': [
      'Anemia',
      'Response to blood loss',
      'Bone marrow disorder',
      'Hemolytic conditions'
    ],
    'Lymphocyte': [
      'Viral infection',
      'Chronic inflammation',
      'Lymphocytic leukemia',
      'Normal immune response'
    ],
    'Monocyte': [
      'Chronic infection',
      'Inflammatory disorder',
      'Recovery phase of an infection'
    ],
    'Neutrophil': [
      'Bacterial infection',
      'Inflammatory response',
      'Normal immune function'
    ],
    'Platelet': [
      'Clotting disorder',
      'Bone marrow function',
      'Normal blood component'
    ]
  };
  
  return conditions[cellType] || ['Unknown condition'];
};

// Resize and crop image to square
export const resizeImageWithCenterCrop = (
  imageDataUrl: string,
  targetSize: number = 224
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Calculate dimensions for center crop
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;
      
      // Draw the center-cropped image to the canvas
      ctx.drawImage(img, x, y, size, size, 0, 0, targetSize, targetSize);
      
      // Convert canvas to data URL
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };
    
    img.src = imageDataUrl;
  });
};
