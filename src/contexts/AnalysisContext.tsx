
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

// Define patient information
export interface PatientInfo {
  name: string;
  age: string;
  gender: string;
  sampleType: string;
  clinicalNotes: string;
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
  doctorNotes?: string;
  patientInfo: PatientInfo;
}

// Define the context interface
interface AnalysisContextType {
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  originalImage: string | null;
  patientInfo: PatientInfo;
  startAnalysis: () => void;
  finishAnalysis: (result: AnalysisResult) => void;
  resetAnalysis: () => void;
  updateRecommendations: (recommendations: string[]) => void;
  updatePossibleConditions: (conditions: string[]) => void;
  updateProcessedImage: (imageUrl: string) => void;
  setOriginalImage: (imageUrl: string | null) => void;
  updatePatientInfo: (info: PatientInfo) => void;
  updateCellType: (cellType: CellType) => void;
  updateDoctorNotes: (notes: string) => void;
  setCurrentReportPath: (path: string | null) => void;
  setOriginalReportData: (data: any) => void;
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
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    age: '',
    gender: '',
    sampleType: 'Blood Sample',
    clinicalNotes: ''
  });
  const [currentReportPath, setCurrentReportPath] = useState<string | null>(null);
  const [originalReportData, setOriginalReportData] = useState<any>(null);

  // Auto-save function to persist changes to file
  const saveChangesToFile = async (updatedResult: AnalysisResult) => {
    if (!currentReportPath || !window.electron || !originalReportData) return;
    
    try {
      // Use the original report data structure but with updated analysis result
      const reportData = {
        ...originalReportData,
        patientInfo,
        analysisResult: updatedResult,
        reportDate: originalReportData.reportDate, // Keep original date
      };
      
      // Update the existing report file instead of creating new
      await window.electron.updateExistingReport(currentReportPath, reportData);
    } catch (error) {
      console.error('Failed to auto-save changes:', error);
    }
  };

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
      
      // Check if Python server is running
      const serverRunning = await window.electron.isPythonServerRunning();
      if (!serverRunning) {
        toast.error('Python server is not running. Please restart the application.');
        setIsAnalyzing(false);
        return;
      }
      
      // Check model status before analysis
      try {
        const modelPath = await window.electron.getDefaultModelPath();
        if (!modelPath) {
          toast.error('No model file found. Please place model.h5 in the application directory.');
          setIsAnalyzing(false);
          return;
        }
        
        const modelStatus = await window.electron.reloadPythonModel(modelPath);
        console.log('Model status check result:', modelStatus);
        
        if (!modelStatus.success) {
          toast.error('Model is not loaded properly. Please check the Python environment and model file.');
          setIsAnalyzing(false);
          return;
        }
      } catch (statusError) {
        console.error('Error checking model status:', statusError);
        toast.error('Failed to check model status. Please ensure the Python server is running.');
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
    // Reset patient info for new test
    setPatientInfo({
      name: '',
      age: '',
      gender: '',
      sampleType: 'Blood Sample',
      clinicalNotes: ''
    });
  };

  // Update functions
  const updateRecommendations = (recommendations: string[]) => {
    if (!analysisResult) return;
    const updatedResult = {
      ...analysisResult,
      recommendations,
    };
    setAnalysisResult(updatedResult);
    // Auto-save changes if this is a loaded report
    saveChangesToFile(updatedResult);
  };

  const updatePossibleConditions = (conditions: string[]) => {
    if (!analysisResult) return;
    const updatedResult = {
      ...analysisResult,
      possibleConditions: conditions,
    };
    setAnalysisResult(updatedResult);
    // Auto-save changes if this is a loaded report
    saveChangesToFile(updatedResult);
  };

  const updateProcessedImage = (imageUrl: string) => {
    if (!analysisResult) return;
    setAnalysisResult({
      ...analysisResult,
      processedImage: imageUrl,
    });
  };

  const updatePatientInfo = (info: PatientInfo) => {
    setPatientInfo(info);
    if (analysisResult) {
      const updatedResult = {
        ...analysisResult,
        patientInfo: info,
      };
      setAnalysisResult(updatedResult);
      // Auto-save changes if this is a loaded report
      saveChangesToFile(updatedResult);
    }
  };

  const updateCellType = (cellType: CellType) => {
    if (!analysisResult || analysisResult.detectedCells.length === 0) return;
    
    const updatedCells = [...analysisResult.detectedCells];
    updatedCells[0] = { ...updatedCells[0], type: cellType };
    
    setAnalysisResult({
      ...analysisResult,
      detectedCells: updatedCells,
    });
  };

  const updateDoctorNotes = (notes: string) => {
    if (!analysisResult) return;
    const updatedResult = {
      ...analysisResult,
      doctorNotes: notes,
    };
    setAnalysisResult(updatedResult);
    // Auto-save changes if this is a loaded report
    saveChangesToFile(updatedResult);
  };

  // Return the provider
  return (
    <AnalysisContext.Provider
      value={{
        isAnalyzing,
        analysisResult,
        originalImage,
        patientInfo,
        startAnalysis,
        finishAnalysis,
        resetAnalysis,
        updateRecommendations,
        updatePossibleConditions,
        updateProcessedImage,
        setOriginalImage,
        updatePatientInfo,
        updateCellType,
        updateDoctorNotes,
        setCurrentReportPath,
        setOriginalReportData,
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
