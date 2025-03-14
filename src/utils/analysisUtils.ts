import * as tf from '@tensorflow/tfjs';
import { AnalysisResult, CellCount, CellType, DetectedCell } from '../contexts/AnalysisContext';

// Path to your model - will be set during runtime in Electron
let modelPath = '';

// Load the model once
let model: tf.LayersModel | null = null;

// Function to initialize the model with a local path
export const initializeModel = async (path: string): Promise<void> => {
  try {
    modelPath = path;
    model = await tf.loadLayersModel(`file://${path}`);
    console.log('Model loaded successfully from:', path);
  } catch (error) {
    console.error('Failed to load model:', error);
    throw new Error('Failed to load the model. Please check the file path.');
  }
};

// Function to handle image upload
export const handleImageUpload = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.match('image.*')) {
      reject(new Error('Please upload an image file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Error reading file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsDataURL(file);
  });
};

// Function to preprocess the image for the model
const preprocessImage = async (imageDataUrl: string): Promise<tf.Tensor> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Create a canvas to resize and process the image
      const canvas = document.createElement('canvas');
      // Set dimensions based on your model's input requirements
      canvas.width = 224;  // Adjust to your model's requirements
      canvas.height = 224; // Adjust to your model's requirements
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Draw and resize image to canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Get image data as RGB
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Convert to tensor and normalize
      const tensor = tf.browser.fromPixels(imageData)
        .toFloat()
        .div(tf.scalar(255.0))
        .expandDims(0); // Add batch dimension
      
      resolve(tensor);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
};

// Generate a processed image with bounding boxes for detected cells
const generateProcessedImage = (imageDataUrl: string, detectedCells: DetectedCell[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      // Draw bounding boxes and labels for each detected cell
      detectedCells.forEach(cell => {
        const { x, y, width, height } = cell.boundingBox;
        
        // Draw red rectangle around the cell
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label background
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fillRect(x, y - 20, 100, 20);
        
        // Draw label text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText(`${cell.type} (${(cell.confidence * 100).toFixed(1)}%)`, x + 5, y - 5);
      });
      
      // Get the processed image as data URL
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
};

// Function to map model output indices to cell types
const mapIndexToCellType = (index: number): CellType => {
  const cellTypeMap: Record<number, CellType> = {
    0: 'Basophil',
    1: 'Eosinophil',
    2: 'Erythroblast',
    3: 'IGImmatureWhiteCell',
    4: 'Lymphocyte',
    5: 'Monocyte',
    6: 'Neutrophil',
    7: 'Platelet',
    8: 'RBC'
  };
  
  return cellTypeMap[index] || 'RBC';
};

// Mock analysis function that will be replaced with real ML model in production
export const analyzeBloodSample = async (imageUrl: string): Promise<AnalysisResult> => {
  // In production, this would use TensorFlow.js to analyze the image
  // For now, we're using a mock implementation
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Mock detection results
  const cellTypes: CellType[] = ['Basophil', 'Eosinophil', 'Erythroblast', 'IGImmatureWhiteCell', 'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet', 'RBC'];
  
  // Create a detection count object with initial counts of 0
  const detectedCells: Record<CellType, number> = {
    'Basophil': 0,
    'Eosinophil': 0,
    'Erythroblast': 0,
    'IGImmatureWhiteCell': 0,
    'Lymphocyte': 0,
    'Monocyte': 0, 
    'Neutrophil': 0,
    'Platelet': 0,
    'RBC': 0
  };
  
  // Randomly generate between 20-50 cell detections
  const numDetections = Math.floor(Math.random() * 30) + 20;
  const detections: DetectedCell[] = [];
  
  for (let i = 0; i < numDetections; i++) {
    // Select a random cell type
    const typeIndex = Math.floor(Math.random() * cellTypes.length);
    const type = cellTypes[typeIndex] as CellType;
    
    // Create a detection with random position and size
    const detection: DetectedCell = {
      type,
      boundingBox: {
        x: Math.random() * 0.8, // Normalized coordinates (0-1)
        y: Math.random() * 0.8,
        width: Math.random() * 0.2 + 0.05,
        height: Math.random() * 0.2 + 0.05
      },
      confidence: Math.random() * 0.3 + 0.7 // 0.7-1.0 confidence score
    };
    
    detections.push(detection);
    detectedCells[type]++;
  }
  
  const totalNormalRBC = Math.floor(Math.random() * 200) + 300;
  const totalAbnormalRBC = Math.floor(Math.random() * 30);
  const totalNormalPlatelets = Math.floor(Math.random() * 100) + 150;
  const totalAbnormalPlatelets = Math.floor(Math.random() * 20);
  
  const cellCounts: CellCount = {
    normal: {
      rbc: totalNormalRBC,
      platelets: totalNormalPlatelets
    },
    abnormal: {
      rbc: totalAbnormalRBC,
      platelets: totalAbnormalPlatelets
    },
    total: totalNormalRBC + totalAbnormalRBC + totalNormalPlatelets + totalAbnormalPlatelets + numDetections,
    detectedCells
  };
  
  // Calculate abnormality rate
  const abnormalityRate = 
    ((totalAbnormalRBC + totalAbnormalPlatelets) / 
    (totalNormalRBC + totalAbnormalRBC + totalNormalPlatelets + totalAbnormalPlatelets)) * 100;
  
  // Create mock recommendations based on cell counts
  const recommendations = generateRecommendations(detectedCells, abnormalityRate);
  
  // Create mock possible conditions based on cell counts
  const possibleConditions = generatePossibleConditions(detectedCells, abnormalityRate);
  
  // Create and return the analysis result object
  return {
    image: imageUrl,
    processedImage: await generateProcessedImage(imageUrl, detections),
    cellCounts,
    abnormalityRate,
    possibleConditions,
    recommendations,
    analysisDate: new Date(),
    detectedCells: detections,
    reportLayout: 'standard',
    notes: '' // Initialize with empty notes
  };
};

// Generate conditions based on specific cell types and their counts
const generateConditionsByCell = (cellCounts: Record<CellType, number>, abnormalityRate: number): string[] => {
  const conditions: string[] = [];
  
  // High eosinophil count
  if (cellCounts['Eosinophil'] > 2) {
    conditions.push('Possible eosinophilia - may indicate allergic reaction or parasitic infection');
  }
  
  // High basophil count
  if (cellCounts['Basophil'] > 1) {
    conditions.push('Elevated basophil count - may indicate inflammatory reaction or myeloproliferative disorder');
  }
  
  // Presence of erythroblasts (immature RBCs)
  if (cellCounts['Erythroblast'] > 0) {
    conditions.push('Erythroblasts present in peripheral blood - may indicate severe anemia or bone marrow stress');
  }
  
  // Immature white cells
  if (cellCounts['IGImmatureWhiteCell'] > 0) {
    conditions.push('Immature granulocytes detected - possible infection, inflammation, or myeloid malignancy');
  }
  
  // Abnormal lymphocyte count
  if (cellCounts['Lymphocyte'] > 4) {
    conditions.push('Lymphocytosis - may indicate viral infection or lymphoproliferative disorder');
  } else if (cellCounts['Lymphocyte'] < 1 && cellCounts['Lymphocyte'] > 0) {
    conditions.push('Lymphopenia - possible immunosuppression or severe infection');
  }
  
  // Neutrophil evaluation
  if (cellCounts['Neutrophil'] > 5) {
    conditions.push('Neutrophilia - indicates acute bacterial infection or inflammation');
  } else if (cellCounts['Neutrophil'] < 1 && cellCounts['Neutrophil'] > 0) {
    conditions.push('Neutropenia - risk of infection, may indicate bone marrow suppression');
  }
  
  // Monocyte evaluation
  if (cellCounts['Monocyte'] > 2) {
    conditions.push('Monocytosis - may indicate chronic infection or inflammatory disease');
  }
  
  // General abnormality rate-based conditions
  if (abnormalityRate > 15) {
    conditions.push('High rate of abnormal cells - comprehensive hematological evaluation recommended');
  } else if (abnormalityRate > 10) {
    conditions.push('Moderate cell abnormalities detected');
  } else if (abnormalityRate > 5) {
    conditions.push('Mild cell abnormalities detected');
  } else if (conditions.length === 0) {
    conditions.push('No significant abnormalities detected');
  }
  
  return conditions;
};

// Generate recommendations based on cell findings
const generateRecommendations = (detectedCells: Record<CellType, number>, abnormalityRate: number): string[] => {
  const recommendations: string[] = [];
  
  // Eosinophil-related recommendations
  if (detectedCells['Eosinophil'] > 2) {
    recommendations.push('Check for allergies or parasitic infections');
    recommendations.push('Consider stool examination for ova and parasites');
  }
  
  // Basophil-related recommendations
  if (detectedCells['Basophil'] > 1) {
    recommendations.push('Monitor for hypersensitivity reactions');
    recommendations.push('Consider bone marrow examination if persistently elevated');
  }
  
  // Erythroblast-related recommendations
  if (detectedCells['Erythroblast'] > 0) {
    recommendations.push('Assess for hemolytic anemia or severe blood loss');
    recommendations.push('Bone marrow biopsy should be considered');
  }
  
  // Immature granulocyte recommendations
  if (detectedCells['IGImmatureWhiteCell'] > 0) {
    recommendations.push('Repeat complete blood count in 2-3 days');
    recommendations.push('Monitor for signs of infection or myeloproliferative disorders');
  }
  
  // Lymphocyte-related recommendations
  if (detectedCells['Lymphocyte'] > 4) {
    recommendations.push('Evaluate for viral infections, particularly EBV or CMV');
    recommendations.push('Flow cytometry if lymphocytosis persists to rule out lymphoproliferative disorder');
  } else if (detectedCells['Lymphocyte'] < 1 && detectedCells['Lymphocyte'] > 0) {
    recommendations.push('Assess immune status and risk of opportunistic infections');
  }
  
  // Neutrophil-related recommendations
  if (detectedCells['Neutrophil'] > 5) {
    recommendations.push('Search for source of infection or inflammation');
    recommendations.push('Blood cultures if fever present');
  } else if (detectedCells['Neutrophil'] < 1 && detectedCells['Neutrophil'] > 0) {
    recommendations.push('Neutropenic precautions and monitoring');
    recommendations.push('Evaluate medication history for potential causes');
  }
  
  // Monocyte-related recommendations
  if (detectedCells['Monocyte'] > 2) {
    recommendations.push('Evaluate for chronic infections such as TB or endocarditis');
    recommendations.push('Consider autoimmune disorder workup');
  }
  
  // General recommendations based on abnormality rate
  if (abnormalityRate > 15) {
    recommendations.push('Urgent hematology consultation recommended');
    recommendations.push('Additional blood tests including flow cytometry');
  } else if (abnormalityRate > 10) {
    recommendations.push('Follow-up with hematology within 2 weeks');
    recommendations.push('Complete blood count with differential');
  } else if (abnormalityRate > 5) {
    recommendations.push('Repeat blood test in 1 month');
    recommendations.push('Clinical correlation with patient symptoms');
  } else if (recommendations.length === 0) {
    recommendations.push('Routine follow-up as clinically indicated');
    recommendations.push('No immediate hematological intervention required');
  }
  
  return recommendations;
};

// Generate possible conditions based on cell counts
const generatePossibleConditions = (detectedCells: Record<CellType, number>, abnormalityRate: number): string[] => {
  const conditions: string[] = [];
  
  // High eosinophil count
  if (detectedCells['Eosinophil'] > 2) {
    conditions.push('Possible eosinophilia - may indicate allergic reaction or parasitic infection');
  }
  
  // High basophil count
  if (detectedCells['Basophil'] > 1) {
    conditions.push('Elevated basophil count - may indicate inflammatory reaction or myeloproliferative disorder');
  }
  
  // Presence of erythroblasts (immature RBCs)
  if (detectedCells['Erythroblast'] > 0) {
    conditions.push('Erythroblasts present in peripheral blood - may indicate severe anemia or bone marrow stress');
  }
  
  // Immature white cells
  if (detectedCells['IGImmatureWhiteCell'] > 0) {
    conditions.push('Immature granulocytes detected - possible infection, inflammation, or myeloid malignancy');
  }
  
  // Abnormal lymphocyte count
  if (detectedCells['Lymphocyte'] > 4) {
    conditions.push('Lymphocytosis - may indicate viral infection or lymphoproliferative disorder');
  } else if (detectedCells['Lymphocyte'] < 1 && detectedCells['Lymphocyte'] > 0) {
    conditions.push('Lymphopenia - possible immunosuppression or severe infection');
  }
  
  // Neutrophil evaluation
  if (detectedCells['Neutrophil'] > 5) {
    conditions.push('Neutrophilia - indicates acute bacterial infection or inflammation');
  } else if (detectedCells['Neutrophil'] < 1 && detectedCells['Neutrophil'] > 0) {
    conditions.push('Neutropenia - risk of infection, may indicate bone marrow suppression');
  }
  
  // Monocyte evaluation
  if (detectedCells['Monocyte'] > 2) {
    conditions.push('Monocytosis - may indicate chronic infection or inflammatory disease');
  }
  
  // General abnormality rate-based conditions
  if (abnormalityRate > 15) {
    conditions.push('High rate of abnormal cells - comprehensive hematological evaluation recommended');
  } else if (abnormalityRate > 10) {
    conditions.push('Moderate cell abnormalities detected');
  } else if (abnormalityRate > 5) {
    conditions.push('Mild cell abnormalities detected');
  } else if (conditions.length === 0) {
    conditions.push('No significant abnormalities detected');
  }
  
  return conditions;
};

// This function simulates generating a formatted date for reports
export const formatReportDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// This function simulates generating a unique report ID
export const generateReportId = (): string => {
  return `BCA-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
};

// This function would convert analysis results to a PDF for printing
export const generatePdfReport = (result: AnalysisResult): void => {
  // In a real app, this would generate a PDF
  console.log('Generating PDF report for printing', result);
  window.print();
};

// This function would determine the severity level based on abnormality rate
export const determineSeverity = (abnormalityRate: number): 'normal' | 'mild' | 'moderate' | 'severe' => {
  if (abnormalityRate < 5) return 'normal';
  if (abnormalityRate < 10) return 'mild';
  if (abnormalityRate < 15) return 'moderate';
  return 'severe';
};

// Helper function to format numbers with commas
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Color mapping for visualization
export const getCellTypeColor = (cellType: string): string => {
  const colorMap: Record<string, string> = {
    'RBC': '#FF4B55',
    'Platelet': '#0A84FF',
    'Basophil': '#AF52DE',
    'Eosinophil': '#FF9500',
    'Erythroblast': '#FF2D55',
    'IGImmatureWhiteCell': '#5AC8FA',
    'Lymphocyte': '#34C759',
    'Monocyte': '#FFCC00',
    'Neutrophil': '#007AFF',
    'Abnormal': '#FF3B30',
    'Normal': '#34C759'
  };
  
  return colorMap[cellType] || '#8E8E93';
};
