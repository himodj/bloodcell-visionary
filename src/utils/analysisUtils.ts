
import { CellType, AnalysisResult, AnalyzedCell, CellCounts } from '../contexts/AnalysisContext';
import { analyzeField, getModelStatus, loadModel, type AnalysisMode } from '../inference/engine';

// Format a number with commas for thousands
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Format a date for the report
export const formatReportDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
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

// True once the model is loaded and ready for analysis
export const isModelInitialized = (): boolean => {
  return getModelStatus().loaded;
};

// Longest side kept for an uploaded image. Larger images are reduced; nothing is cropped,
// so wide fields with several cells stay intact.
const MAX_IMAGE_SIDE = 2000;

// Reads an uploaded file and returns it as a data URL ready for analysis
export const handleImageUpload = async (file: File): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => (e.target?.result ? resolve(e.target.result as string) : reject(new Error('Failed to read image file')));
    reader.onerror = () => reject(new Error('Failed to read the image file'));
    reader.readAsDataURL(file);
  });
  return prepareImage(dataUrl);
};

// Normalises any image to PNG (small images, lossless) or JPEG (large ones), limited to MAX_IMAGE_SIDE
export const prepareImage = (imageDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('The image is empty'));
        return;
      }
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const small = canvas.width * canvas.height <= 700 * 700;
      resolve(small ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.93));
    };
    img.onerror = () => reject(new Error('This file is not an image the application can read'));
    img.src = imageDataUrl;
  });
};

export const CELL_TYPES: CellType[] = [
  'IG Immature White Cell',
  'Basophil',
  'Eosinophil',
  'Erythroblast',
  'Lymphocyte',
  'Monocyte',
  'Neutrophil',
  'Platelet'
];

// Cell types reported as abnormal findings when seen in peripheral blood
const ABNORMAL_TYPES: CellType[] = ['IG Immature White Cell', 'Basophil', 'Eosinophil'];

// Below this confidence the result is flagged for manual review
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

// Short names used on image labels
export const shortCellName = (cellType: CellType): string => {
  const names: Record<CellType, string> = {
    'IG Immature White Cell': 'IG',
    'Basophil': 'Basophil',
    'Eosinophil': 'Eosinophil',
    'Erythroblast': 'Erythroblast',
    'Lymphocyte': 'Lymphocyte',
    'Monocyte': 'Monocyte',
    'Neutrophil': 'Neutrophil',
    'Platelet': 'Platelet'
  };
  return names[cellType] || cellType;
};

// Counts per type and the share of cells of a type flagged as abnormal
export const summarizeCells = (cells: AnalyzedCell[]): { cellCounts: CellCounts; abnormalityRate: number } => {
  const detected = Object.fromEntries(CELL_TYPES.map((t) => [t, 0])) as Record<CellType, number>;
  let abnormal = 0;
  for (const cell of cells) {
    if (cell.type in detected) detected[cell.type] += 1;
    if (ABNORMAL_TYPES.includes(cell.type)) abnormal += 1;
  }
  return {
    cellCounts: {
      totalCells: cells.length,
      normalCells: cells.length - abnormal,
      abnormalCells: abnormal,
      detectedCells: detected
    },
    abnormalityRate: cells.length > 0 ? abnormal / cells.length : 0
  };
};

// Distinct cell types present, most frequent first
const typesByFrequency = (cells: AnalyzedCell[]): CellType[] => {
  const counts = new Map<CellType, number>();
  cells.forEach((c) => counts.set(c.type, (counts.get(c.type) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
};

const unique = (items: string[]): string[] => [...new Set(items)];

export const recommendationsForCells = (cells: AnalyzedCell[]): string[] => {
  const types = typesByFrequency(cells);
  if (types.length === 0) return [];
  if (types.length === 1) return generateRecommendations(types[0]);
  const common = generateRecommendations(types[0]).slice(-3);
  const specific = types.flatMap((t) => generateRecommendations(t).slice(0, -3).slice(0, 1));
  return unique([...specific, ...common]);
};

export const conditionsForCells = (cells: AnalyzedCell[]): string[] => {
  const types = typesByFrequency(cells);
  if (types.length <= 1) return types.length ? generatePossibleConditions(types[0]) : [];
  // with several cell types, list only what the flagged (abnormal) types point to
  const flagged = types.filter((t) => ABNORMAL_TYPES.includes(t));
  return unique(flagged.flatMap((t) => generatePossibleConditions(t).slice(0, 2)));
};

// Analyze an image with the on-device model.
// mode: 'single' = the image shows one cell, 'multi' = find and classify every cell, 'auto' = decide from the image
export const analyzeImage = async (imageDataUrl: string, mode: AnalysisMode = 'auto'): Promise<AnalysisResult> => {
  if (!getModelStatus().loaded) {
    const status = await loadModel();
    if (!status.loaded) {
      throw new Error(status.error || 'The model could not be loaded.');
    }
  }

  const field = await analyzeField(imageDataUrl, mode);
  const status = getModelStatus();

  const detectedCells: AnalyzedCell[] = field.cells.map((cell, index) => {
    const type = mapToCellType(cell.prediction.label);
    return {
      id: index + 1,
      type,
      aiType: type,
      confidence: cell.prediction.confidence,
      probabilities: cell.prediction.probabilities,
      coordinates: {
        x: cell.box.x * 100,
        y: cell.box.y * 100,
        width: cell.box.width * 100,
        height: cell.box.height * 100
      }
    };
  });

  const summary = summarizeCells(detectedCells);

  return {
    image: imageDataUrl,
    analysisDate: new Date(),
    analysisMode: field.modeUsed,
    imageWidth: field.imageWidth,
    imageHeight: field.imageHeight,
    note: field.note,
    cellCounts: summary.cellCounts,
    detectedCells,
    probabilities: detectedCells.length === 1 ? detectedCells[0].probabilities : undefined,
    inferenceMs: field.totalMs,
    modelInfo: {
      name: status.meta?.name || 'unknown',
      version: status.meta?.version,
      fileName: status.fileName,
      sha256: status.sha256
    },
    abnormalityRate: summary.abnormalityRate,
    recommendations: recommendationsForCells(detectedCells),
    possibleConditions: conditionsForCells(detectedCells),
    patientInfo: {
      name: '',
      age: '',
      gender: '',
      sampleType: 'Blood Sample',
      clinicalNotes: ''
    }
  };
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
  
  // An unknown label means the model and its labels file do not match this application.
  throw new Error(`The model returned an unknown cell type: "${typeString}"`);
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
  targetSize: number = 360
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
