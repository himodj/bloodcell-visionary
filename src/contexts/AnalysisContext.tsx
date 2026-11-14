import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { analyzeImage, conditionsForCells, recommendationsForCells, summarizeCells } from '../utils/analysisUtils';
import { toast } from 'sonner';
import { loadModel, type AnalysisMode } from '../inference/engine';
import { buildReportHtml } from '../report/buildReportHtml';
import { renderAnnotatedImage, renderCellThumbnails } from '../report/annotate';
import { getLabConfig, getTemplateConfig } from '../report/settings';

// Define cell types based on the model's output order
export type CellType =
  | 'IG Immature White Cell'
  | 'Basophil'
  | 'Eosinophil'
  | 'Erythroblast'
  | 'Lymphocyte'
  | 'Monocyte'
  | 'Neutrophil'
  | 'Platelet';

// One classified cell
export interface AnalyzedCell {
  id: number;
  type: CellType;
  confidence: number;
  /** what the model said, kept when a reviewer changes the type */
  aiType?: CellType;
  /** true when the type was set by a person */
  edited?: boolean;
  subtype?: string;
  /** box around the cell in percent (0-100) of the image width / height */
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  probabilities?: { label: string; probability: number }[];
}

export interface CellCounts {
  totalCells: number;
  normalCells: number;
  abnormalCells: number;
  detectedCells: Record<CellType, number>;
}

export interface PatientInfo {
  name: string;
  age: string;
  gender: string;
  sampleType: string;
  clinicalNotes: string;
  patientId?: string;
  referringDoctor?: string;
}

export interface AnalysisResult {
  image: string;
  processedImage?: string;
  analysisDate: Date;
  analysisMode?: 'single' | 'multi';
  imageWidth?: number;
  imageHeight?: number;
  /** remark from the analysis step, e.g. when no nucleus was found */
  note?: string;
  cellCounts: CellCounts;
  detectedCells: AnalyzedCell[];
  abnormalityRate: number;
  recommendations: string[];
  possibleConditions: string[];
  notes?: string;
  doctorNotes?: string;
  patientInfo: PatientInfo;
  /** probability of every class for a single-cell image */
  probabilities?: { label: string; probability: number }[];
  /** time taken to analyse the image, in milliseconds */
  inferenceMs?: number;
  modelInfo?: { name: string; version?: string; fileName?: string; sha256?: string };
}

/** Where the current analysis lives in the report archive */
export interface ReportMeta {
  reportId: string;
  folderPath: string;
  createdAt: string;
  updatedAt?: string;
}

export type SaveState = 'unsaved' | 'saving' | 'saved' | 'error';

export const emptyPatientInfo: PatientInfo = {
  name: '',
  age: '',
  gender: '',
  sampleType: 'Blood Sample',
  clinicalNotes: '',
  patientId: '',
  referringDoctor: ''
};

interface AnalysisContextType {
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  originalImage: string | null;
  patientInfo: PatientInfo;
  analysisMode: AnalysisMode;
  reportMeta: ReportMeta | null;
  saveState: SaveState;
  saveError: string | null;
  setAnalysisMode: (mode: AnalysisMode) => void;
  startAnalysis: () => void;
  resetAnalysis: () => void;
  setOriginalImage: (imageUrl: string | null) => void;
  updatePatientInfo: (info: PatientInfo) => void;
  updateRecommendations: (recommendations: string[]) => void;
  updatePossibleConditions: (conditions: string[]) => void;
  updateDoctorNotes: (notes: string) => void;
  updateCellType: (cellId: number, cellType: CellType) => void;
  updateCellSubtype: (cellId: number, subtype: string) => void;
  removeCell: (cellId: number) => void;
  /** opens a report from the archive; resolves to true when it loaded */
  openArchivedReport: (folderPath: string) => Promise<boolean>;
  /** writes pending changes to the archive now and returns the up-to-date report document */
  saveNow: () => Promise<string | null>;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

interface AnalysisProviderProps {
  children: ReactNode;
}

const SAVE_DELAY_MS = 500;

export const AnalysisProvider: React.FC<AnalysisProviderProps> = ({ children }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>(emptyPatientInfo);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('auto');
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('unsaved');
  const [saveError, setSaveError] = useState<string | null>(null);

  // The archive writer always works from the latest values, whatever render it was queued in.
  const latest = useRef<{ result: AnalysisResult | null; patient: PatientInfo; meta: ReportMeta | null }>({
    result: null,
    patient: emptyPatientInfo,
    meta: null
  });
  const saveTimer = useRef<number | null>(null);
  const saveChain = useRef<Promise<string | null>>(Promise.resolve(null));
  const originalStored = useRef(false);

  const apply = (result: AnalysisResult | null, patient: PatientInfo, meta: ReportMeta | null) => {
    latest.current = { result, patient, meta };
    setAnalysisResult(result);
    setPatientInfo(patient);
    setReportMeta(meta);
  };

  /** Writes the current analysis to its archive folder. Returns the report HTML. */
  const writeToArchive = useCallback(async (): Promise<string | null> => {
    const { result, patient, meta } = latest.current;
    if (!result || !meta || !window.electron) return null;
    setSaveState('saving');
    try {
      const lab = getLabConfig();
      const [annotated, thumbnails] = await Promise.all([renderAnnotatedImage(result), renderCellThumbnails(result)]);
      const html = buildReportHtml({
        reportId: meta.reportId,
        createdAt: meta.createdAt,
        patientInfo: patient,
        lab,
        template: getTemplateConfig(),
        result,
        annotatedImage: annotated,
        thumbnails
      });
      const { image, processedImage, patientInfo: _ignored, ...analysis } = result;
      const response = await window.electron.archiveSave({
        folderPath: meta.folderPath || undefined,
        record: {
          reportId: meta.reportId,
          createdAt: meta.createdAt,
          patientInfo: patient,
          lab: { ...lab, logo: lab.logo ? '(stored in settings)' : null },
          analysis
        },
        html,
        images: {
          annotated,
          // the microscope image itself never changes, so it is written once
          original: originalStored.current ? undefined : image
        }
      });
      if (!response.success || !response.folderPath) throw new Error(response.error || 'The report could not be written.');
      originalStored.current = true;
      // the analysis may have been closed or replaced while this was being written
      if (latest.current.meta && latest.current.meta.reportId === meta.reportId) {
        const nextMeta = { ...latest.current.meta, folderPath: response.folderPath, updatedAt: response.updatedAt };
        latest.current.meta = nextMeta;
        setReportMeta(nextMeta);
        setSaveState('saved');
        setSaveError(null);
      }
      return html;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Archive save failed:', message);
      setSaveState('error');
      setSaveError(message);
      return null;
    }
  }, []);

  const enqueueSave = useCallback((): Promise<string | null> => {
    saveChain.current = saveChain.current.then(() => writeToArchive(), () => writeToArchive());
    return saveChain.current;
  }, [writeToArchive]);

  /** Called after every edit: saves shortly afterwards, merging quick successive edits. */
  const scheduleSave = useCallback(() => {
    if (!latest.current.meta) return;
    setSaveState('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void enqueueSave();
    }, SAVE_DELAY_MS);
  }, [enqueueSave]);

  const saveNow = useCallback(async (): Promise<string | null> => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    return enqueueSave();
  }, [enqueueSave]);

  // Do not lose an edit made just before the window closes.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void enqueueSave();
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [enqueueSave]);

  const startAnalysis = async () => {
    if (!originalImage) {
      toast.error('No image selected for analysis');
      return;
    }
    if (!window.electron) {
      toast.error('Analysis requires the desktop application');
      return;
    }

    try {
      setIsAnalyzing(true);
      apply(null, latest.current.patient, null);
      setSaveState('unsaved');
      setSaveError(null);

      const modelStatus = await loadModel();
      if (!modelStatus.loaded) {
        toast.error(`Model is not loaded: ${modelStatus.error || 'unknown error'}`);
        setIsAnalyzing(false);
        return;
      }

      const result = await analyzeImage(originalImage, analysisMode);
      result.patientInfo = latest.current.patient;

      // Every analysis gets a report number and is filed in the archive straight away.
      const allocated = await window.electron.archiveAllocate();
      const meta: ReportMeta = { reportId: allocated.reportId, folderPath: '', createdAt: allocated.createdAt };
      originalStored.current = false;
      apply(result, latest.current.patient, meta);
      setIsAnalyzing(false);

      const saved = await enqueueSave();
      const count = result.detectedCells.length;
      if (saved) {
        toast.success(`${count === 1 ? 'Analysis' : `Analysis of ${count} cells`} completed and saved as ${allocated.reportId}`);
      } else {
        toast.warning('Analysis completed, but the report could not be saved to the archive');
      }
      if (result.note) toast.info(result.note);
    } catch (error) {
      console.error('Error during analysis:', error);
      setIsAnalyzing(false);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const resetAnalysis = () => {
    // make sure the last edit of the report being closed reaches the disk first
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void writeToArchive();
    }
    setIsAnalyzing(false);
    setOriginalImage(null);
    apply(null, { ...emptyPatientInfo }, null);
    setSaveState('unsaved');
    setSaveError(null);
  };

  /** Applies a change to the analysis and files it. */
  const commit = (next: AnalysisResult) => {
    apply(next, latest.current.patient, latest.current.meta);
    scheduleSave();
  };

  const updatePatientInfo = (info: PatientInfo) => {
    const result = latest.current.result ? { ...latest.current.result, patientInfo: info } : null;
    apply(result, info, latest.current.meta);
    scheduleSave();
  };

  const updateRecommendations = (recommendations: string[]) => {
    if (latest.current.result) commit({ ...latest.current.result, recommendations });
  };

  const updatePossibleConditions = (conditions: string[]) => {
    if (latest.current.result) commit({ ...latest.current.result, possibleConditions: conditions });
  };

  const updateDoctorNotes = (notes: string) => {
    if (latest.current.result) commit({ ...latest.current.result, doctorNotes: notes });
  };

  /** After the set of cells or their types changed: counts and suggested texts follow. */
  const withCells = (result: AnalysisResult, cells: AnalysisResult['detectedCells']): AnalysisResult => {
    const summary = summarizeCells(cells);
    // keep texts the user has rewritten; refresh them only while they are still the generated ones
    const autoRecs = recommendationsForCells(result.detectedCells);
    const autoConds = conditionsForCells(result.detectedCells);
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
    return {
      ...result,
      detectedCells: cells,
      cellCounts: summary.cellCounts,
      abnormalityRate: summary.abnormalityRate,
      recommendations: same(result.recommendations, autoRecs) ? recommendationsForCells(cells) : result.recommendations,
      possibleConditions: same(result.possibleConditions, autoConds) ? conditionsForCells(cells) : result.possibleConditions
    };
  };

  const updateCellType = (cellId: number, cellType: CellType) => {
    const result = latest.current.result;
    if (!result) return;
    const cells = result.detectedCells.map((cell) =>
      cell.id === cellId
        ? { ...cell, type: cellType, aiType: cell.aiType ?? cell.type, edited: cellType !== (cell.aiType ?? cell.type) }
        : cell
    );
    commit(withCells(result, cells));
  };

  const updateCellSubtype = (cellId: number, subtype: string) => {
    const result = latest.current.result;
    if (!result) return;
    commit({ ...result, detectedCells: result.detectedCells.map((cell) => (cell.id === cellId ? { ...cell, subtype } : cell)) });
  };

  const removeCell = (cellId: number) => {
    const result = latest.current.result;
    if (!result) return;
    commit(withCells(result, result.detectedCells.filter((cell) => cell.id !== cellId)));
  };

  const openArchivedReport = async (folderPath: string): Promise<boolean> => {
    if (!window.electron) return false;
    try {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        await writeToArchive();
      }
      const loaded = await window.electron.archiveLoad(folderPath);
      if (!loaded.success || !loaded.record) {
        toast.error(loaded.error || 'This report could not be opened');
        return false;
      }
      const record = loaded.record;
      const patient: PatientInfo = { ...emptyPatientInfo, ...(record.patientInfo || {}) };
      const analysis = record.analysis || {};
      const cells: AnalyzedCell[] = (analysis.detectedCells || []).map((cell: AnalyzedCell, index: number) => ({
        ...cell,
        id: typeof cell.id === 'number' ? cell.id : index + 1
      }));
      const summary = summarizeCells(cells);
      const result: AnalysisResult = {
        ...analysis,
        image: loaded.image || '',
        analysisDate: new Date(analysis.analysisDate || record.createdAt),
        detectedCells: cells,
        cellCounts: summary.cellCounts,
        abnormalityRate: summary.abnormalityRate,
        recommendations: analysis.recommendations || [],
        possibleConditions: analysis.possibleConditions || [],
        doctorNotes: analysis.doctorNotes || '',
        patientInfo: patient
      };
      originalStored.current = !!loaded.hasOriginal;
      setOriginalImage(result.image || null);
      setIsAnalyzing(false);
      apply(result, patient, {
        reportId: record.reportId,
        folderPath: loaded.folderPath || folderPath,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      });
      setSaveState('saved');
      setSaveError(null);
      return true;
    } catch (error) {
      console.error('Error opening report:', error);
      toast.error('This report could not be opened');
      return false;
    }
  };

  return (
    <AnalysisContext.Provider
      value={{
        isAnalyzing,
        analysisResult,
        originalImage,
        patientInfo,
        analysisMode,
        reportMeta,
        saveState,
        saveError,
        setAnalysisMode,
        startAnalysis,
        resetAnalysis,
        setOriginalImage,
        updatePatientInfo,
        updateRecommendations,
        updatePossibleConditions,
        updateDoctorNotes,
        updateCellType,
        updateCellSubtype,
        removeCell,
        openArchivedReport,
        saveNow
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = (): AnalysisContextType => {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
};
