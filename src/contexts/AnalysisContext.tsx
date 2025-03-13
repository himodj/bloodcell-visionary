
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { analyzeBloodSample } from '../utils/analysisUtils';

export type CellType = 'RBC' | 'Platelet' | 'Abnormal';

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
}

export interface AnalysisResult {
  image: string | null;
  processedImage: string | null;
  cellCounts: CellCount;
  abnormalityRate: number;
  possibleConditions: string[];
  recommendations: string[];
  analysisDate: Date;
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
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = async () => {
    if (!originalImage) return;
    
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
        setError
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
