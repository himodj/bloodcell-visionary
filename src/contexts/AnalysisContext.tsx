
import React, { createContext, useContext, useState, ReactNode } from 'react';

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
}

// Define the context interface
interface AnalysisContextType {
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  startAnalysis: () => void;
  finishAnalysis: (result: AnalysisResult) => void;
  resetAnalysis: () => void;
  updateRecommendations: (recommendations: string[]) => void;
  updatePossibleConditions: (conditions: string[]) => void;
  updateProcessedImage: (imageUrl: string) => void;
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

  // Analysis workflow functions
  const startAnalysis = () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
  };

  const finishAnalysis = (result: AnalysisResult) => {
    setIsAnalyzing(false);
    setAnalysisResult(result);
  };

  const resetAnalysis = () => {
    setIsAnalyzing(false);
    setAnalysisResult(null);
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
        startAnalysis,
        finishAnalysis,
        resetAnalysis,
        updateRecommendations,
        updatePossibleConditions,
        updateProcessedImage,
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
