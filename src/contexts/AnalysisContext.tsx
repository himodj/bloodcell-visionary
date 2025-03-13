
import React, { createContext, useContext, useState, ReactNode } from 'react';

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

  const startAnalysis = () => {
    setIsAnalyzing(true);
    setError(null);
    
    // In a real app, this would be the point where you'd send the image to your CNN model
    // For demo purposes, we'll simulate analysis with a timeout
    setTimeout(() => {
      setIsAnalyzing(false);
      
      // Simulate analysis result
      if (originalImage) {
        const result: AnalysisResult = {
          image: originalImage,
          processedImage: originalImage, // In a real app, this would be different
          cellCounts: {
            normal: {
              rbc: Math.floor(Math.random() * 5000) + 3000,
              platelets: Math.floor(Math.random() * 300) + 150
            },
            abnormal: {
              rbc: Math.floor(Math.random() * 500),
              platelets: Math.floor(Math.random() * 30)
            },
            total: 0 // Will be calculated
          },
          abnormalityRate: Math.random() * 20,
          possibleConditions: [],
          recommendations: [],
          analysisDate: new Date()
        };
        
        // Calculate totals
        result.cellCounts.total = 
          result.cellCounts.normal.rbc + 
          result.cellCounts.normal.platelets + 
          result.cellCounts.abnormal.rbc + 
          result.cellCounts.abnormal.platelets;
        
        // Determine possible conditions based on abnormality rate
        if (result.abnormalityRate > 15) {
          result.possibleConditions = ['Leukemia', 'Lymphoma', 'Myelodysplastic syndrome'];
          result.recommendations = [
            'Urgent hematology consultation recommended',
            'Bone marrow biopsy should be considered',
            'Additional blood tests including flow cytometry'
          ];
        } else if (result.abnormalityRate > 10) {
          result.possibleConditions = ['Potential blood disorder', 'Early-stage myeloproliferative disorder'];
          result.recommendations = [
            'Follow-up with hematology within 2 weeks',
            'Complete blood count with differential',
            'Peripheral blood smear examination'
          ];
        } else if (result.abnormalityRate > 5) {
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
        
        setAnalysisResult(result);
      }
    }, 3000);
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
