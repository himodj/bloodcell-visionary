
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

// Function to analyze the blood sample using your model
export const analyzeBloodSample = async (imageDataUrl: string): Promise<AnalysisResult> => {
  try {
    if (!model) {
      throw new Error('Model not loaded. Please initialize the model first.');
    }

    // Preprocess image
    const tensor = await preprocessImage(imageDataUrl);
    
    // Perform prediction
    const predictions = await model.predict(tensor) as tf.Tensor;
    const results = await predictions.array();
    
    // Clean up tensors to avoid memory leaks
    tensor.dispose();
    predictions.dispose();
    
    // Simulate cell detection (in a real app, this would come from an object detection model)
    const detectedCells: DetectedCell[] = [];
    const cellTypes: CellType[] = ['Basophil', 'Eosinophil', 'Erythroblast', 'IGImmatureWhiteCell', 'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet', 'RBC'];
    
    // Generate some random detected cells for demonstration
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = imageDataUrl;
    });
    
    const width = img.width;
    const height = img.height;
    
    // Create some sample detected cells
    for (let i = 0; i < 12; i++) {
      const typeIndex = Math.floor(Math.random() * cellTypes.length);
      const cellType = cellTypes[typeIndex];
      const boxWidth = Math.floor(Math.random() * 50) + 50;
      const boxHeight = Math.floor(Math.random() * 50) + 50;
      const x = Math.floor(Math.random() * (width - boxWidth));
      const y = Math.floor(Math.random() * (height - boxHeight));
      
      detectedCells.push({
        type: cellType,
        boundingBox: {
          x,
          y,
          width: boxWidth,
          height: boxHeight
        },
        confidence: 0.7 + Math.random() * 0.3 // Random confidence between 0.7 and 1.0
      });
    }
    
    // Count detected cells by type
    const detectedCellCounts: Record<CellType, number> = {
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
    
    detectedCells.forEach(cell => {
      detectedCellCounts[cell.type]++;
    });
    
    // Process cell counts 
    const normalRbcCount = detectedCellCounts['RBC'];
    const normalPlateletCount = detectedCellCounts['Platelet'];
    
    // Determine which cells are abnormal based on morphology or type
    const abnormalRbcCount = detectedCellCounts['Erythroblast']; // Erythroblasts are abnormal RBCs
    const abnormalPlateletCount = 0; // Assume all platelets are normal for this demo
    
    // Consider certain cell types as indicators of potential issues
    const totalWhiteCells = 
      detectedCellCounts['Basophil'] + 
      detectedCellCounts['Eosinophil'] + 
      detectedCellCounts['IGImmatureWhiteCell'] + 
      detectedCellCounts['Lymphocyte'] + 
      detectedCellCounts['Monocyte'] + 
      detectedCellCounts['Neutrophil'];
    
    const totalCells = normalRbcCount + normalPlateletCount + abnormalRbcCount + abnormalPlateletCount + totalWhiteCells;
    
    // Calculate abnormality rate based on abnormal cells and unusual white cell distributions
    const abnormalityRate = ((abnormalRbcCount + abnormalPlateletCount) / totalCells) * 100;
    
    // Generate processed image with bounding boxes
    const processedImage = await generateProcessedImage(imageDataUrl, detectedCells);
    
    // Create the analysis result
    const result: AnalysisResult = {
      image: imageDataUrl,
      processedImage: processedImage,
      cellCounts: {
        normal: {
          rbc: normalRbcCount,
          platelets: normalPlateletCount
        },
        abnormal: {
          rbc: abnormalRbcCount,
          platelets: abnormalPlateletCount
        },
        total: totalCells,
        detectedCells: detectedCellCounts
      },
      abnormalityRate: abnormalityRate,
      possibleConditions: [],
      recommendations: [],
      analysisDate: new Date(),
      detectedCells: detectedCells,
      reportLayout: 'standard'
    };
    
    // Generate recommendations based on cell types found
    result.possibleConditions = generateConditionsByCell(detectedCellCounts, abnormalityRate);
    result.recommendations = generateRecommendationsByCell(detectedCellCounts, abnormalityRate);
    
    return result;
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('Failed to analyze blood sample');
  }
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
const generateRecommendationsByCell = (cellCounts: Record<CellType, number>, abnormalityRate: number): string[] => {
  const recommendations: string[] = [];
  
  // Eosinophil-related recommendations
  if (cellCounts['Eosinophil'] > 2) {
    recommendations.push('Check for allergies or parasitic infections');
    recommendations.push('Consider stool examination for ova and parasites');
  }
  
  // Basophil-related recommendations
  if (cellCounts['Basophil'] > 1) {
    recommendations.push('Monitor for hypersensitivity reactions');
    recommendations.push('Consider bone marrow examination if persistently elevated');
  }
  
  // Erythroblast-related recommendations
  if (cellCounts['Erythroblast'] > 0) {
    recommendations.push('Assess for hemolytic anemia or severe blood loss');
    recommendations.push('Bone marrow biopsy should be considered');
  }
  
  // Immature granulocyte recommendations
  if (cellCounts['IGImmatureWhiteCell'] > 0) {
    recommendations.push('Repeat complete blood count in 2-3 days');
    recommendations.push('Monitor for signs of infection or myeloproliferative disorders');
  }
  
  // Lymphocyte-related recommendations
  if (cellCounts['Lymphocyte'] > 4) {
    recommendations.push('Evaluate for viral infections, particularly EBV or CMV');
    recommendations.push('Flow cytometry if lymphocytosis persists to rule out lymphoproliferative disorder');
  } else if (cellCounts['Lymphocyte'] < 1 && cellCounts['Lymphocyte'] > 0) {
    recommendations.push('Assess immune status and risk of opportunistic infections');
  }
  
  // Neutrophil-related recommendations
  if (cellCounts['Neutrophil'] > 5) {
    recommendations.push('Search for source of infection or inflammation');
    recommendations.push('Blood cultures if fever present');
  } else if (cellCounts['Neutrophil'] < 1 && cellCounts['Neutrophil'] > 0) {
    recommendations.push('Neutropenic precautions and monitoring');
    recommendations.push('Evaluate medication history for potential causes');
  }
  
  // Monocyte-related recommendations
  if (cellCounts['Monocyte'] > 2) {
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
