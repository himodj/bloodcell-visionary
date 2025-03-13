
import * as tf from '@tensorflow/tfjs';
import { AnalysisResult, CellCount } from '../contexts/AnalysisContext';

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
    
    // Process model output based on your model's specific output format
    // This is a placeholder - adjust according to your model's output
    const normalRbcCount = Math.round(results[0][0] * 5000);
    const normalPlateletCount = Math.round(results[0][1] * 300);
    const abnormalRbcCount = Math.round(results[0][2] * 500);
    const abnormalPlateletCount = Math.round(results[0][3] * 50);
    
    const totalCells = normalRbcCount + normalPlateletCount + abnormalRbcCount + abnormalPlateletCount;
    const abnormalityRate = ((abnormalRbcCount + abnormalPlateletCount) / totalCells) * 100;
    
    // Create the analysis result
    const result: AnalysisResult = {
      image: imageDataUrl,
      processedImage: imageDataUrl, // You can generate a processed image if needed
      cellCounts: {
        normal: {
          rbc: normalRbcCount,
          platelets: normalPlateletCount
        },
        abnormal: {
          rbc: abnormalRbcCount,
          platelets: abnormalPlateletCount
        },
        total: totalCells
      },
      abnormalityRate: abnormalityRate,
      possibleConditions: [],
      recommendations: [],
      analysisDate: new Date()
    };
    
    // Determine possible conditions based on abnormality rate
    if (abnormalityRate > 15) {
      result.possibleConditions = ['Leukemia', 'Lymphoma', 'Myelodysplastic syndrome'];
      result.recommendations = [
        'Urgent hematology consultation recommended',
        'Bone marrow biopsy should be considered',
        'Additional blood tests including flow cytometry'
      ];
    } else if (abnormalityRate > 10) {
      result.possibleConditions = ['Potential blood disorder', 'Early-stage myeloproliferative disorder'];
      result.recommendations = [
        'Follow-up with hematology within 2 weeks',
        'Complete blood count with differential',
        'Peripheral blood smear examination'
      ];
    } else if (abnormalityRate > 5) {
      result.possibleConditions = ['Mild abnormalities', 'Possible reactive changes'];
      result.recommendations = [
        'Repeat blood test in 1 month',
        'Clinical correlation with patient symptoms',
        'Monitor for changes in blood parameters'
      ];
    } else {
      result.possibleConditions = ['No significant abnormalities detected'];
      result.recommendations = [
        'Routine follow-up as clinically indicated',
        'No immediate hematological intervention required'
      ];
    }
    
    return result;
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('Failed to analyze blood sample');
  }
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
    'Abnormal': '#FF9500',
    'Normal': '#34C759'
  };
  
  return colorMap[cellType] || '#8E8E93';
};
