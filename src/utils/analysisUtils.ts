
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

// Handle image upload - simplified version for direct use in components
export const handleImageUpload = async (file: File): Promise<string> => {
  try {
    console.log('Processing image upload:', file.name);
    
    // Read file as data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target?.result) {
          reject(new Error('Failed to read image file'));
          return;
        }
        
        const imageDataUrl = e.target.result as string;
        
        try {
          // Resize and crop the image
          const resizedImage = await resizeImageWithCenterCrop(imageDataUrl);
          resolve(resizedImage);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read the image file'));
      };
      
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Error handling image upload:', error);
    throw error;
  }
};

// Define the response type from the Python server
interface PythonServerResponse {
  cell_type?: string;
  confidence?: number;
  all_probabilities?: number[];
  class_labels?: string[];
  error?: string;
  detectedCells?: Array<{
    type: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  cellCounts?: Record<string, number>;
  timestamp?: string;
}

// Analyze image with backend API
export const analyzeImage = async (imageDataUrl: string): Promise<AnalysisResult> => {
  if (!window.electron || !modelInitialized) {
    throw new Error('Model not initialized or not in Electron environment');
  }
  
  console.log('Sending image for analysis...');
  
  try {
    // Call the electron method to analyze the image
    const response = await window.electron.analyzeWithH5Model(modelPath, imageDataUrl) as PythonServerResponse;
    
    if (response.error) {
      throw new Error(`Model analysis failed: ${response.error}`);
    }
    
    console.log('Analysis completed successfully:', response);
    
    // Extract cell information from the response
    let cellType: CellType;
    let confidence: number;
    
    // Handle the response format from our Python server
    if (response.cell_type) {
      cellType = mapToCellType(response.cell_type);
      confidence = response.confidence || 0.8;
    } else if (response.detectedCells && response.detectedCells.length > 0) {
      // Fallback to older format with detectedCells array
      const cell = response.detectedCells[0];
      cellType = mapToCellType(cell.type);
      confidence = cell.confidence;
    } else {
      // This is an error case - the model should always return a cell type
      throw new Error('No cell type detected in model response');
    }
    
    // Create a cell object
    const analyzedCell: AnalyzedCell = {
      type: cellType,
      confidence,
      coordinates: {
        x: 0,
        y: 0,
        width: 224,
        height: 224
      }
    };
    
    // Initialize cell counts
    const cellCounts: Record<CellType, number> = {
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
    cellCounts[cellType] = 1;
    
    // Determine if the cell is abnormal based on its type
    const isAbnormal = ['IG Immature White Cell', 'Basophil', 'Eosinophil'].includes(cellType);
    
    // Create analysis result
    const result: AnalysisResult = {
      image: imageDataUrl,
      analysisDate: new Date(),
      cellCounts: {
        totalCells: 1,
        normalCells: isAbnormal ? 0 : 1,
        abnormalCells: isAbnormal ? 1 : 0,
        detectedCells: cellCounts
      },
      detectedCells: [analyzedCell],
      abnormalityRate: isAbnormal ? 1.0 : 0.0,
      recommendations: generateRecommendations(cellType),
      possibleConditions: generatePossibleConditions(cellType)
    };
    
    return result;
  } catch (error) {
    console.error('Error during Python backend analysis:', error);
    throw error;
  }
};

// Map string to valid CellType
const mapToCellType = (typeString: string): CellType => {
  // Clean up the input string
  const normalized = typeString.trim();
  
  // Direct mapping for exact matches
  const validCellTypes: CellType[] = [
    'IG Immature White Cell',
    'Basophil',
    'Eosinophil',
    'Erythroblast',
    'Lymphocyte',
    'Monocyte',
    'Neutrophil',
    'Platelet'
  ];
  
  // Check for exact match
  for (const validType of validCellTypes) {
    if (normalized === validType) {
      return validType;
    }
  }
  
  // Check for case-insensitive match
  for (const validType of validCellTypes) {
    if (normalized.toLowerCase() === validType.toLowerCase()) {
      return validType;
    }
  }
  
  // Handle special case for IG
  if (normalized.includes('IG') || 
      normalized.toLowerCase().includes('immature') || 
      normalized.toLowerCase().includes('granulocyte')) {
    return 'IG Immature White Cell';
  }
  
  // Default fallback
  return 'Lymphocyte'; // Most common cell type as default
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
