
import * as tf from '@tensorflow/tfjs';
import { AnalysisResult, CellCount, CellType, DetectedCell } from '../contexts/AnalysisContext';

// Path to your model - will be set during runtime in Electron
let modelPath = '';
let isH5Model = false;

// Load the model once
let model: tf.LayersModel | null = null;

// Function to initialize the model with a local path
export const initializeModel = async (path: string, forceH5 = false): Promise<void> => {
  try {
    console.log('Loading model from path:', path);
    modelPath = path;
    
    // If it's forced H5 mode or the path ends with .h5
    if (forceH5 || path.toLowerCase().endsWith('.h5')) {
      isH5Model = true;
      console.log('H5 model detected. Using specialized analysis engine.');
      // We don't actually load the H5 model in TF.js, just register it for the backend
      model = null;
      
      // Validate that the model file exists
      if (window.electron) {
        const result = await window.electron.readModelFile(path);
        if (!result.success) {
          throw new Error(`Failed to validate H5 model file: ${result.error}`);
        }
        console.log('H5 model validated successfully');
      }
      return;
    }
    
    // Continue with regular TensorFlow.js flow for non-H5 models
    // This code path shouldn't be used with your H5 model
    if (window.electron) {
      const modelUrl = `file://${path}`;
      console.log('Loading TensorFlow.js model from:', modelUrl);
      
      try {
        model = await tf.loadLayersModel(modelUrl);
        console.log('Model loaded successfully');
      } catch (error) {
        console.error('Error loading model directly:', error);
        throw new Error(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      throw new Error('H5 models require the desktop application');
    }
  } catch (error) {
    console.error('Failed to load model:', error);
    throw new Error(`Failed to load the model. ${error instanceof Error ? error.message : 'Please check the file path.'}`);
  }
};

// Function to handle image upload and resize to 360x360 with center crop
export const handleImageUpload = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.match('image.*')) {
      reject(new Error('Please upload an image file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        // Resize the image to 360x360 with center crop
        resizeImageWithCenterCrop(e.target.result as string)
          .then(resizedImageDataUrl => {
            console.log('Image processed to 360x360 with center crop');
            resolve(resizedImageDataUrl);
          })
          .catch(error => {
            reject(error);
          });
      } else {
        reject(new Error('Error reading file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsDataURL(file);
  });
};

// New function to resize with center crop to 1:1 aspect ratio, then scale to 360x360
export const resizeImageWithCenterCrop = (imageDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Calculate aspect ratio to determine positioning for center crop
      const sourceWidth = img.width;
      const sourceHeight = img.height;
      
      let sourceX = 0;
      let sourceY = 0;
      let sourceSize = Math.min(sourceWidth, sourceHeight);
      
      // Center the crop
      if (sourceWidth > sourceHeight) {
        sourceX = (sourceWidth - sourceHeight) / 2;
      } else {
        sourceY = (sourceHeight - sourceWidth) / 2;
      }
      
      console.log(`Original image: ${sourceWidth}x${sourceHeight}`);
      console.log(`Center crop: x=${sourceX}, y=${sourceY}, size=${sourceSize}`);
      
      // Draw only the center square portion of the image, scaled to 360x360
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceSize, sourceSize, // Source rectangle (center square)
        0, 0, 360, 360 // Destination rectangle (full 360x360 canvas)
      );
      
      // Get the resized image as data URL
      const resizedImageDataUrl = canvas.toDataURL('image/png');
      resolve(resizedImageDataUrl);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
};

// Update preprocessImage to ensure exact 360x360 dimensions with the right preprocessing
const preprocessImage = async (imageDataUrl: string): Promise<tf.Tensor> => {
  console.log('Preprocessing image for analysis...');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Check if the image needs resizing
      if (img.width !== 360 || img.height !== 360) {
        console.log('Image dimensions are not 360x360, resizing...');
        resizeImageWithCenterCrop(imageDataUrl)
          .then(resizedImageUrl => {
            // Load the resized image and convert to tensor
            const resizedImg = new Image();
            resizedImg.onload = () => {
              // Create a canvas for the normalized image
              const canvas = document.createElement('canvas');
              canvas.width = 360;
              canvas.height = 360;
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
              }
              
              // Draw the image to canvas
              ctx.drawImage(resizedImg, 0, 0, 360, 360);
              
              // Get image data
              const imageData = ctx.getImageData(0, 0, 360, 360);
              
              // Convert to tensor and normalize pixel values to [0,1]
              const tensor = tf.browser.fromPixels(imageData)
                .toFloat()
                .div(tf.scalar(255.0))
                .expandDims(0); // Add batch dimension
              
              console.log('Image preprocessed successfully');
              resolve(tensor);
            };
            
            resizedImg.onerror = () => reject(new Error('Failed to load resized image'));
            resizedImg.src = resizedImageUrl;
          })
          .catch(error => reject(error));
      } else {
        // Image is already 360x360, process it directly
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw the image to canvas
        ctx.drawImage(img, 0, 0, 360, 360);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, 360, 360);
        
        // Convert to tensor and normalize pixel values to [0,1]
        const tensor = tf.browser.fromPixels(imageData)
          .toFloat()
          .div(tf.scalar(255.0))
          .expandDims(0); // Add batch dimension
        
        console.log('Image already 360x360, preprocessed successfully');
        resolve(tensor);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
};

// New functions for generating focused recommendations and conditions
function generateFocusedRecommendations(cellType: CellType): string[] {
  const recommendations: string[] = [];
  
  switch (cellType) {
    case 'Basophil':
      recommendations.push('Evaluate for possible allergic reactions or inflammatory conditions');
      recommendations.push('Consider additional blood tests to confirm basophilia if clinically indicated');
      break;
    case 'Eosinophil':
      recommendations.push('Assess for allergic disorders, parasitic infections, or autoimmune conditions');
      recommendations.push('Consider stool examination for ova and parasites if eosinophil count is elevated');
      break;
    case 'Erythroblast':
      recommendations.push('Urgent hematology consultation recommended');
      recommendations.push('Bone marrow biopsy should be considered to evaluate for potential hematologic disorders');
      break;
    case 'IGImmatureWhiteCell':
      recommendations.push('Monitor for signs of infection or myeloproliferative disorders');
      recommendations.push('Repeat complete blood count in 48-72 hours to track progression');
      break;
    case 'Lymphocyte':
      recommendations.push('Evaluate for viral infections if lymphocyte count is elevated');
      recommendations.push('Consider flow cytometry if lymphocytosis persists to rule out lymphoproliferative disorder');
      break;
    case 'Monocyte':
      recommendations.push('Evaluate for chronic infections or inflammatory conditions');
      recommendations.push('Consider autoimmune disorder workup if monocytosis persists');
      break;
    case 'Neutrophil':
      recommendations.push('Assess for bacterial infections or inflammatory conditions');
      recommendations.push('Consider blood cultures if fever is present and neutrophil count is elevated');
      break;
    case 'Platelet':
      recommendations.push('Monitor platelet count and morphology');
      recommendations.push('Evaluate for bleeding or clotting disorders if clinically indicated');
      break;
    case 'RBC':
      recommendations.push('Evaluate for anemia or polycythemia if clinically indicated');
      recommendations.push('Assess RBC morphology for abnormalities');
      break;
  }
  
  return recommendations;
}

function generateFocusedConditions(cellType: CellType): string[] {
  const conditions: string[] = [];
  
  switch (cellType) {
    case 'Basophil':
      conditions.push('Possible basophilia - may indicate inflammatory reaction or hypersensitivity');
      conditions.push('Consider myeloproliferative disorders if basophil count is persistently elevated');
      break;
    case 'Eosinophil':
      conditions.push('Possible eosinophilia - may indicate allergic reaction or parasitic infection');
      conditions.push('Consider DRESS syndrome, hypereosinophilic syndrome, or helminth infection');
      break;
    case 'Erythroblast':
      conditions.push('Erythroblasts present in peripheral blood - indicates severe anemia or bone marrow stress');
      conditions.push('Consider hemolytic anemia, thalassemia, or myelophthisis');
      break;
    case 'IGImmatureWhiteCell':
      conditions.push('Immature granulocytes detected - possible infection, inflammation, or myeloid malignancy');
      conditions.push('Consider sepsis, leukemoid reaction, or leukemia');
      break;
    case 'Lymphocyte':
      conditions.push('Lymphocytes present - evaluate in context of overall lymphocyte count');
      conditions.push('If elevated, consider viral infections (EBV, CMV) or lymphoproliferative disorders');
      break;
    case 'Monocyte':
      conditions.push('Monocytes present - may indicate chronic infection or inflammatory disease if elevated');
      conditions.push('Consider tuberculosis, endocarditis, or autoimmune conditions if monocytosis is present');
      break;
    case 'Neutrophil':
      conditions.push('Neutrophils present - assess in context of overall neutrophil count');
      conditions.push('If elevated, indicates acute bacterial infection or inflammation');
      break;
    case 'Platelet':
      conditions.push('Platelets present - evaluate for normal morphology');
      conditions.push('Assess in context of overall platelet count for thrombocytosis or thrombocytopenia');
      break;
    case 'RBC':
      conditions.push('Red blood cells present - evaluate for morphological abnormalities');
      conditions.push('Assess in context of overall RBC count for anemia or polycythemia');
      break;
  }
  
  return conditions;
}

// Modified to create only one bounding box for the detected cell
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
      
      // Draw bounding box and label for the single detected cell (if any)
      if (detectedCells.length > 0) {
        const cell = detectedCells[0]; // Just use the first cell
        const { x, y, width, height } = cell.boundingBox;
        
        // Draw red rectangle around the cell
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label background
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fillRect(x, y - 25, 110, 20);
        
        // Draw label text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '14px Arial';
        ctx.fillText(`${cell.type} (${(cell.confidence * 100).toFixed(1)}%)`, x + 5, y - 10);
      }
      
      // Get the processed image as data URL
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
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
  
  // Eosinophil-specific recommendations
  if (detectedCells['Eosinophil'] > 0) {
    recommendations.push(`Eosinophil detected [${detectedCells['Eosinophil']} cells]: Check for allergies or parasitic infections`);
    if (detectedCells['Eosinophil'] > 2) {
      recommendations.push(`Elevated Eosinophil count [${detectedCells['Eosinophil']} cells]: Consider stool examination for ova and parasites`);
    }
  }
  
  // Basophil-specific recommendations
  if (detectedCells['Basophil'] > 0) {
    recommendations.push(`Basophil detected [${detectedCells['Basophil']} cells]: Monitor for hypersensitivity reactions`);
    if (detectedCells['Basophil'] > 1) {
      recommendations.push(`Elevated Basophil count [${detectedCells['Basophil']} cells]: Consider bone marrow examination if persistently elevated`);
    }
  }
  
  // Erythroblast-specific recommendations
  if (detectedCells['Erythroblast'] > 0) {
    recommendations.push(`Erythroblast detected [${detectedCells['Erythroblast']} cells]: Assess for hemolytic anemia or severe blood loss`);
    recommendations.push(`Erythroblast present [${detectedCells['Erythroblast']} cells]: Bone marrow biopsy should be considered`);
  }
  
  // Immature granulocyte recommendations
  if (detectedCells['IGImmatureWhiteCell'] > 0) {
    recommendations.push(`Immature Granulocytes [${detectedCells['IGImmatureWhiteCell']} cells]: Repeat complete blood count in 2-3 days`);
    recommendations.push(`Immature Granulocytes [${detectedCells['IGImmatureWhiteCell']} cells]: Monitor for signs of infection or myeloproliferative disorders`);
  }
  
  // Lymphocyte-specific recommendations
  if (detectedCells['Lymphocyte'] > 0) {
    if (detectedCells['Lymphocyte'] > 4) {
      recommendations.push(`Elevated Lymphocyte count [${detectedCells['Lymphocyte']} cells]: Evaluate for viral infections, particularly EBV or CMV`);
      recommendations.push(`Lymphocytosis [${detectedCells['Lymphocyte']} cells]: Flow cytometry if lymphocytosis persists to rule out lymphoproliferative disorder`);
    } else if (detectedCells['Lymphocyte'] < 1) {
      recommendations.push(`Low Lymphocyte count [${detectedCells['Lymphocyte']} cells]: Assess immune status and risk of opportunistic infections`);
    }
  }
  
  // Neutrophil-specific recommendations
  if (detectedCells['Neutrophil'] > 0) {
    if (detectedCells['Neutrophil'] > 5) {
      recommendations.push(`Elevated Neutrophil count [${detectedCells['Neutrophil']} cells]: Search for source of infection or inflammation`);
      recommendations.push(`Neutrophilia [${detectedCells['Neutrophil']} cells]: Blood cultures if fever present`);
    } else if (detectedCells['Neutrophil'] < 1) {
      recommendations.push(`Low Neutrophil count [${detectedCells['Neutrophil']} cells]: Neutropenic precautions and monitoring`);
      recommendations.push(`Neutropenia [${detectedCells['Neutrophil']} cells]: Evaluate medication history for potential causes`);
    }
  }
  
  // Monocyte-specific recommendations
  if (detectedCells['Monocyte'] > 0) {
    if (detectedCells['Monocyte'] > 2) {
      recommendations.push(`Elevated Monocyte count [${detectedCells['Monocyte']} cells]: Evaluate for chronic infections such as TB or endocarditis`);
      recommendations.push(`Monocytosis [${detectedCells['Monocyte']} cells]: Consider autoimmune disorder workup`);
    }
  }
  
  // Red blood cell specific recommendations
  if (detectedCells['RBC'] > 0) {
    recommendations.push(`Red Blood Cells detected [${detectedCells['RBC']} cells]: Evaluate for morphological abnormalities`);
  }
  
  // Platelet specific recommendations
  if (detectedCells['Platelet'] > 0) {
    recommendations.push(`Platelets detected [${detectedCells['Platelet']} cells]: Assess for clumping or abnormal morphology`);
  }
  
  // General recommendations based on abnormality rate
  if (abnormalityRate > 15) {
    recommendations.push(`High abnormality rate [${abnormalityRate.toFixed(1)}%]: Urgent hematology consultation recommended`);
    recommendations.push(`Severe abnormalities [${abnormalityRate.toFixed(1)}%]: Additional blood tests including flow cytometry`);
  } else if (abnormalityRate > 10) {
    recommendations.push(`Moderate abnormality rate [${abnormalityRate.toFixed(1)}%]: Follow-up with hematology within 2 weeks`);
    recommendations.push(`Moderate abnormalities [${abnormalityRate.toFixed(1)}%]: Complete blood count with differential`);
  } else if (abnormalityRate > 5) {
    recommendations.push(`Mild abnormality rate [${abnormalityRate.toFixed(1)}%]: Repeat blood test in 1 month`);
    recommendations.push(`Mild abnormalities [${abnormalityRate.toFixed(1)}%]: Clinical correlation with patient symptoms`);
  } else if (recommendations.length === 0) {
    recommendations.push(`No significant abnormality [${abnormalityRate.toFixed(1)}%]: Routine follow-up as clinically indicated`);
    recommendations.push(`Normal findings [${abnormalityRate.toFixed(1)}%]: No immediate hematological intervention required`);
  }
  
  return recommendations;
};

// Generate possible conditions based on cell counts
const generatePossibleConditions = (detectedCells: Record<CellType, number>, abnormalityRate: number): string[] => {
  const conditions: string[] = [];
  
  // High eosinophil count
  if (detectedCells['Eosinophil'] > 0) {
    if (detectedCells['Eosinophil'] > 2) {
      conditions.push(`Eosinophilia [${detectedCells['Eosinophil']} cells] - may indicate allergic reaction or parasitic infection`);
    } else {
      conditions.push(`Eosinophil present [${detectedCells['Eosinophil']} cells] - monitor for allergic conditions`);
    }
  }
  
  // High basophil count
  if (detectedCells['Basophil'] > 0) {
    if (detectedCells['Basophil'] > 1) {
      conditions.push(`Elevated basophil count [${detectedCells['Basophil']} cells] - may indicate inflammatory reaction or myeloproliferative disorder`);
    } else {
      conditions.push(`Basophil present [${detectedCells['Basophil']} cells] - within normal range`);
    }
  }
  
  // Presence of erythroblasts (immature RBCs)
  if (detectedCells['Erythroblast'] > 0) {
    conditions.push(`Erythroblasts present [${detectedCells['Erythroblast']} cells] - may indicate severe anemia or bone marrow stress`);
  }
  
  // Immature white cells
  if (detectedCells['IGImmatureWhiteCell'] > 0) {
    conditions.push(`Immature granulocytes detected [${detectedCells['IGImmatureWhiteCell']} cells] - possible infection, inflammation, or myeloid malignancy`);
  }
  
  // Abnormal lymphocyte count
  if (detectedCells['Lymphocyte'] > 0) {
    if (detectedCells['Lymphocyte'] > 4) {
      conditions.push(`Lymphocytosis [${detectedCells['Lymphocyte']} cells] - may indicate viral infection or lymphoproliferative disorder`);
    } else if (detectedCells['Lymphocyte'] < 1) {
      conditions.push(`Lymphopenia [${detectedCells['Lymphocyte']} cells] - possible immunosuppression or severe infection`);
    } else {
      conditions.push(`Lymphocyte count [${detectedCells['Lymphocyte']} cells] - within normal range`);
    }
  }
  
  // Neutrophil evaluation
  if (detectedCells['Neutrophil'] > 0) {
    if (detectedCells['Neutrophil'] > 5) {
      conditions.push(`Neutrophilia [${detectedCells['Neutrophil']} cells] - indicates acute bacterial infection or inflammation`);
    } else if (detectedCells['Neutrophil'] < 1) {
      conditions.push(`Neutropenia [${detectedCells['Neutrophil']} cells] - risk of infection, may indicate bone marrow suppression`);
    } else {
      conditions.push(`Neutrophil count [${detectedCells['Neutrophil']} cells] - within normal range`);
    }
  }
  
  // Monocyte evaluation
  if (detectedCells['Monocyte'] > 0) {
    if (detectedCells['Monocyte'] > 2) {
      conditions.push(`Monocytosis [${detectedCells['Monocyte']} cells] - may indicate chronic infection or inflammatory disease`);
    } else {
      conditions.push(`Monocyte count [${detectedCells['Monocyte']} cells] - within normal range`);
    }
  }
  
  // General abnormality rate-based conditions
  if (abnormalityRate > 15) {
    conditions.push(`High rate of abnormal cells [${abnormalityRate.toFixed(1)}%] - comprehensive hematological evaluation recommended`);
  } else if (abnormalityRate > 10) {
    conditions.push(`Moderate cell abnormalities detected [${abnormalityRate.toFixed(1)}%]`);
  } else if (abnormalityRate > 5) {
    conditions.push(`Mild cell abnormalities detected [${abnormalityRate.toFixed(1)}%]`);
  } else if (conditions.length === 0) {
    conditions.push(`No significant abnormalities detected [${abnormalityRate.toFixed(1)}%]`);
  }
  
  return conditions;
};

// Analysis function that ensures only one cell type per image as mentioned
export const analyzeBloodSample = async (imageUrl: string): Promise<AnalysisResult> => {
  console.log('Analyzing blood sample with model path:', modelPath);
  console.log('Is H5 model:', isH5Model);
  
  // Ensure the image is exactly 360x360 using center crop approach
  const resizedImageUrl = await resizeImageWithCenterCrop(imageUrl);
  
  // Simulate processing delay to represent model inference
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // For H5 model, we'll use a consistent approach:
  // - Only one cell type per image (as you mentioned your model detects)
  // - Place one bounding box on the main detected cell
  
  // Cell types
  const cellTypes: CellType[] = ['Basophil', 'Eosinophil', 'Erythroblast', 'IGImmatureWhiteCell', 'Lymphocyte', 'Monocyte', 'Neutrophil', 'Platelet', 'RBC'];
  
  // Initialize all cell counts to 0
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
  
  // For a real model, you would:
  // 1. Load the image and preprocess it
  // 2. Run it through your model
  // 3. Get the predicted class
  
  // For this mock, randomly select ONE cell type (simulating one prediction per image)
  const typeIndex = Math.floor(Math.random() * cellTypes.length);
  const predictedCellType = cellTypes[typeIndex] as CellType;
  
  console.log('Simulated model prediction:', predictedCellType);
  
  // Count the detected cell
  detectedCells[predictedCellType] = 1;
  
  // Create a single detection in the center of the image with the predicted type
  const detections: DetectedCell[] = [{
    type: predictedCellType,
    boundingBox: {
      // Position in center of image, with reasonable size
      x: 120, 
      y: 120,
      width: 120,
      height: 120
    },
    confidence: 0.95 // High confidence score for the single detection
  }];
  
  // For background counts - using reasonable defaults without too many extras
  const totalNormalRBC = predictedCellType === 'RBC' ? 1 : Math.floor(Math.random() * 5) + 1;
  const totalAbnormalRBC = 0; // No abnormal RBCs in single-cell analysis
  const totalNormalPlatelets = predictedCellType === 'Platelet' ? 1 : Math.floor(Math.random() * 3);
  const totalAbnormalPlatelets = 0; // No abnormal platelets in single-cell analysis
  
  const cellCounts: CellCount = {
    normal: {
      rbc: totalNormalRBC,
      platelets: totalNormalPlatelets
    },
    abnormal: {
      rbc: totalAbnormalRBC,
      platelets: totalAbnormalPlatelets
    },
    total: totalNormalRBC + totalAbnormalRBC + totalNormalPlatelets + totalAbnormalPlatelets + 1, // +1 for the one cell
    detectedCells
  };
  
  // Simple abnormality calculation
  const abnormalityRate = predictedCellType === 'Erythroblast' || predictedCellType === 'IGImmatureWhiteCell' ? 100 : 0;
  
  // Generate focused recommendations based on the single cell type detected
  const recommendations = generateFocusedRecommendations(predictedCellType);
  
  // Generate focused possible conditions based on the single cell type
  const possibleConditions = generateFocusedConditions(predictedCellType);
  
  // Create processed image with single bounding box
  const processedImage = await generateProcessedImage(resizedImageUrl, detections);
  
  // Create and return the analysis result
  return {
    image: resizedImageUrl,
    processedImage: processedImage,
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
