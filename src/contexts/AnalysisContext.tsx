
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { analyzeBloodSample, isModelInitialized } from '../utils/analysisUtils';
import { toast } from 'sonner';

export type CellType = 
  | 'RBC' 
  | 'Platelet' 
  | 'Basophil'
  | 'Eosinophil'
  | 'Erythroblast'
  | 'IGImmatureWhiteCell'
  | 'Lymphocyte'
  | 'Monocyte'
  | 'Neutrophil';

export interface DetectedCell {
  type: CellType;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface CellCount {
  normal: {
    rbc: number;
    platelets: number;
  };
  abnormal: {
    rbc: number;
    platelets: number;
  };
  total: number;
  detectedCells: Record<CellType, number>;
}

export interface AnalysisResult {
  image: string | null;
  processedImage: string | null;
  cellCounts: CellCount;
  abnormalityRate: number;
  possibleConditions: string[];
  recommendations: string[];
  analysisDate: Date;
  detectedCells: DetectedCell[];
  reportLayout: 'standard' | 'compact' | 'detailed';
  notes: string;
}

interface AnalysisContextType {
  isAnalyzing: boolean;
  originalImage: string | null;
  analysisResult: AnalysisResult | null;
  error: string | null;
  setOriginalImage: (image: string | null) => void;
  startAnalysis: () => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  resetAnalysis: () => void;
  setError: (error: string | null) => void;
  updateReportLayout: (layout: 'standard' | 'compact' | 'detailed') => void;
  updateRecommendations: (recommendations: string[]) => void;
  updatePossibleConditions: (conditions: string[]) => void;
  updateNotes: (notes: string) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = async () => {
    if (!originalImage) {
      toast.error("Please upload an image first");
      return;
    }
    
    // Check if model is loaded before proceeding
    if (!isModelInitialized()) {
      toast.error("Please load a model first. Click the 'Load Model' or 'Browse for Model' button.");
      setError("Model not loaded. Please load a model first.");
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Use the real model analysis
      const result = await analyzeBloodSample(originalImage);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis error:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred during analysis');
      }
      toast.error(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setOriginalImage(null);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setError(null);
  };

  const updateReportLayout = (layout: 'standard' | 'compact' | 'detailed') => {
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        reportLayout: layout
      });
    }
  };

  const updateRecommendations = (recommendations: string[]) => {
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        recommendations
      });
    }
  };

  const updatePossibleConditions = (conditions: string[]) => {
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        possibleConditions: conditions
      });
    }
  };

  const updateNotes = (notes: string) => {
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        notes
      });
    }
  };

  return (
    <AnalysisContext.Provider
      value={{
        isAnalyzing,
        originalImage,
        analysisResult,
        error,
        setOriginalImage,
        startAnalysis,
        setAnalysisResult,
        resetAnalysis,
        setError,
        updateReportLayout,
        updateRecommendations,
        updatePossibleConditions,
        updateNotes
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
};
