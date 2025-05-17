
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { analyzeImage } from '../utils/analysisUtils';
import { toast } from 'sonner';

// Define cell types based on the provided order
export type CellType = 
  | 'IG Immature White Cell'
  | 'Basophil'
  | 'Eosinophil'
  | 'Erythroblast'
  | 'Lymphocyte'
  | 'Monocyte'
  | 'Neutrophil'
  | 'Platelet';

// Define the structure of an analyzed cell
export interface AnalyzedCell {
  type: CellType;
  confidence: number;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Define the structure of cell counts
export interface CellCounts {
  totalCells: number;
  normalCells: number;
  abnormalCells: number;
  detectedCells: Record<CellType, number>;
}

// Define the structure of the analysis result
export interface AnalysisResult {
  image: string;
  processedImage?: string;
  analysisDate: Date;
  cellCounts: CellCounts;
  detectedCells: AnalyzedCell[];
  abnormalityRate: number;
  recommendations: string[];
  possibleConditions: string[];
  notes?: string;
}

// Define the context interface
interface AnalysisContextType {
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  originalImage: string | null;
  startAnalysis: () => void;
  finishAnalysis: (result: AnalysisResult) => void;
  resetAnalysis: () => void;
  updateRecommendations: (recommendations: string[]) => void;
  updatePossibleConditions: (conditions: string[]) => void;
  updateProcessedImage: (imageUrl: string) => void;
  setOriginalImage: (imageUrl: string | null) => void;
}

// Create the context
const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

// Create the provider component
interface AnalysisProviderProps {
  children: ReactNode;
}

export const AnalysisProvider: React.FC<AnalysisProviderProps> = ({ children }) => {
  // State variables
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);

  // Analysis workflow functions
  const startAnalysis = async () => {
    if (!originalImage) {
      toast.error('No image selected for analysis');
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      
      // Check for Electron environment
      if (!window.electron) {
        toast.error('Analysis requires the desktop application');
        setIsAnalyzing(false);
        return;
      }
      
      // Check model status before analysis
      try {
        const modelStatus = await window.electron.reloadPythonModel(
          await window.electron.getDefaultModelPath()
        );
        
        console.log('Model status check result:', modelStatus);
        
        if (!modelStatus.loaded) {
          toast.error('Model is not loaded properly. Please try reloading the model first.');
          setIsAnalyzing(false);
          return;
        }
      } catch (statusError) {
        console.error('Error checking model status:', statusError);
        toast.error('Failed to check model status. Please reload the model.');
        setIsAnalyzing(false);
        return;
      }
      
      // Perform the analysis
      const result = await analyzeImage(originalImage);
      
      // Update state with the results
      finishAnalysis(result);
      
      toast.success('Analysis completed successfully');
    } catch (error) {
      console.error('Error during analysis:', error);
      setIsAnalyzing(false);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const finishAnalysis = (result: AnalysisResult) => {
    setIsAnalyzing(false);
    setAnalysisResult(result);
  };

  const resetAnalysis = () => {
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setOriginalImage(null);
  };

  // Update functions
  const updateRecommendations = (recommendations: string[]) => {
    if (!analysisResult) return;
    setAnalysisResult({
      ...analysisResult,
      recommendations,
    });
  };

  const updatePossibleConditions = (conditions: string[]) => {
    if (!analysisResult) return;
    setAnalysisResult({
      ...analysisResult,
      possibleConditions: conditions,
    });
  };

  const updateProcessedImage = (imageUrl: string) => {
    if (!analysisResult) return;
    setAnalysisResult({
      ...analysisResult,
      processedImage: imageUrl,
    });
  };

  // Return the provider
  return (
    <AnalysisContext.Provider
      value={{
        isAnalyzing,
        analysisResult,
        originalImage,
        startAnalysis,
        finishAnalysis,
        resetAnalysis,
        updateRecommendations,
        updatePossibleConditions,
        updateProcessedImage,
        setOriginalImage,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

// Create a custom hook for using the context
export const useAnalysis = (): AnalysisContextType => {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
};
