
import React, { useState } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatNumber, determineSeverity, getCellTypeColor } from '../utils/analysisUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Droplet, Circle, Edit3, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import ImageWithDetection from './ImageWithDetection';
import PatientInfoForm from './PatientInfoForm';
import EditableCellType from './EditableCellType';
import DoctorNotes from './DoctorNotes';

const AnalysisResults: React.FC = () => {
  const { 
    analysisResult, 
    updateRecommendations, 
    updatePossibleConditions, 
    updatePatientInfo, 
    patientInfo, 
    updateCellType,
    currentReportPath,
    setCurrentReportPath,
    setOriginalReportData 
  } = useAnalysis();
  const [editingRecommendations, setEditingRecommendations] = useState(false);
  const [editingConditions, setEditingConditions] = useState(false);
  const [tempRecommendations, setTempRecommendations] = useState('');
  const [tempConditions, setTempConditions] = useState('');
  
  if (!analysisResult) return null;

  const { abnormalityRate, possibleConditions, detectedCells, processedImage } = analysisResult;
  const severity = determineSeverity(abnormalityRate);
  
  // Calculate average confidence level
  const avgConfidence = detectedCells.length > 0
    ? (detectedCells.reduce((sum, cell) => sum + cell.confidence, 0) / detectedCells.length * 100).toFixed(1)
    : "N/A";

  const handleCellTypeChange = (newType: any) => {
    updateCellType(newType);
  };
  
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      normal: '#34C759',
      mild: '#FFCC00',
      moderate: '#FF9500',
      severe: '#FF3B30'
    };
    return colors[severity] || colors.normal;
  };

  const handleEditRecommendations = () => {
    if (!analysisResult) return;
    setTempRecommendations(analysisResult.recommendations.join('\n'));
    setEditingRecommendations(true);
  };

  const handleSaveRecommendations = () => {
    const recArray = tempRecommendations.split('\n').filter(rec => rec.trim() !== '');
    updateRecommendations(recArray);
    setEditingRecommendations(false);
    toast.success('Recommendations updated');
  };

  const handleCancelEditRecommendations = () => {
    setEditingRecommendations(false);
    setTempRecommendations('');
  };

  const handleEditConditions = () => {
    if (!analysisResult) return;
    setTempConditions(analysisResult.possibleConditions.join('\n'));
    setEditingConditions(true);
  };

  const handleSaveConditions = () => {
    const conditionArray = tempConditions.split('\n').filter(cond => cond.trim() !== '');
    updatePossibleConditions(conditionArray);
    setEditingConditions(false);
    toast.success('Conditions updated');
  };

  const handleCancelEditConditions = () => {
    setEditingConditions(false);
    setTempConditions('');
  };

  return (
    <div className="animate-fade-in">
      {/* Patient Information Form */}
      <PatientInfoForm
        patientInfo={patientInfo}
        onPatientInfoChange={updatePatientInfo}
      />
      
      {/* Image with detection overlay */}
      {(processedImage || analysisResult.image) && (
        <ImageWithDetection
          imageUrl={processedImage || analysisResult.image}
          detectedCells={detectedCells}
          title="Blood Sample Analysis with Cell Detection"
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="medical-card overflow-hidden">
          <div className="p-4 bg-medical-red bg-opacity-5 border-b border-medical-red border-opacity-10 flex items-center justify-between">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Droplet size={16} className="text-medical-red mr-2" />
              Blood Cell Analysis
            </h3>
            {/* Save Report Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                if (!analysisResult) return;
                
                // Check if running in Electron
                if (!window.electron) {
                  toast.error('Save functionality requires Electron desktop app');
                  return;
                }
                  
                  try {
                    const reportData = {
                      reportId: `REP${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                      patientInfo,
                      analysisResult,
                      reportDate: new Date().toLocaleString(),
                      labConfig: {
                        labName: '',
                        address: '',
                        phone: '',
                        hematologyDoctorName: '',
                        licenseNumber: '',
                        logo: null
                      }
                    };

                  // Check if this is an existing report or a new one
                  if (currentReportPath) {
                    // Update existing report
                    const result = await window.electron.updateExistingReport(currentReportPath, reportData);
                    if (result.success) {
                      toast.success('Report updated successfully');
                    } else {
                      toast.error(`Failed to update report: ${result.error}`);
                    }
                  } else {
                    // Create new report
                    const result = await window.electron.saveReport(reportData);
                    if (result.success) {
                      toast.success(`Report saved successfully`);
                      // Set the current report path for future updates
                      setCurrentReportPath(result.folder);
                      setOriginalReportData(reportData);
                    } else {
                      toast.error(`Failed to save report: ${result.error}`);
                    }
                  }
                } catch (error) {
                  console.error('Error saving report:', error);
                  toast.error('Failed to save report');
                }
              }}
              className="text-xs"
            >
              <Save size={14} className="mr-1" />
              Save Report
            </Button>
          </div>
          <CardContent className="p-4">
            <div className="flex flex-col divide-y">
              {detectedCells.length > 0 ? (
                <EditableCellType
                  cellType={detectedCells[0].type}
                  confidence={detectedCells[0].confidence}
                  onCellTypeChange={handleCellTypeChange}
                />
              ) : (
                <div className="py-3">
                  <span className="text-medical-dark text-opacity-70">No cell detected</span>
                </div>
              )}
              
              <div className="py-3 flex justify-between items-center">
                <span className="text-sm text-medical-dark text-opacity-70">Analysis Date:</span>
                <span className="font-medium text-medical-dark">
                  {analysisResult.analysisDate.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="medical-card overflow-hidden">
          <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Circle size={16} className="text-medical-blue mr-2" />
              Cell Classification
            </h3>
          </div>
          <CardContent className="p-4 h-[300px]">
            {detectedCells.length > 0 ? (
              <div className="flex flex-col h-full justify-center items-center">
                <div 
                  className="w-24 h-24 rounded-full mb-4 flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: getCellTypeColor(detectedCells[0].type) }}
                >
                  {detectedCells[0].type.charAt(0)}
                </div>
                <h3 className="text-xl font-medium mb-2">{detectedCells[0].type}</h3>
                <p className="text-medical-dark text-opacity-70">
                  Confidence: {(detectedCells[0].confidence * 100).toFixed(1)}%
                </p>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-medical-dark text-opacity-70">No cell detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {detectedCells.length > 0 && (
        <Card className="medical-card overflow-hidden mb-6 border-l-4" style={{ borderLeftColor: getSeverityColor(severity) }}>
          <div className="p-4 bg-opacity-5 flex items-center justify-between" style={{ backgroundColor: `${getSeverityColor(severity)}20` }}>
            <div className="flex items-center">
              <AlertTriangle size={18} style={{ color: getSeverityColor(severity) }} className="mr-2" />
              <h3 className="font-display font-medium text-medical-dark">Possible Conditions</h3>
            </div>
            {!editingConditions ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleEditConditions}
                className="text-xs"
              >
                <Edit3 size={14} className="mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSaveConditions}
                  className="text-xs text-green-600"
                >
                  <Save size={14} className="mr-1" />
                  Save
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancelEditConditions}
                  className="text-xs text-red-600"
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <CardContent className="p-4">
            {editingConditions ? (
              <Textarea
                value={tempConditions}
                onChange={(e) => setTempConditions(e.target.value)}
                placeholder="Enter possible conditions (one per line)..."
                rows={4}
              />
            ) : (
              <ul className="list-disc pl-6 space-y-2">
                {possibleConditions.map((condition, index) => (
                  <li key={index} className="text-medical-dark">
                    {condition}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      
      {detectedCells.length > 0 && (
        <Card className="medical-card overflow-hidden mb-6">
          <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex items-center justify-between">
            <h3 className="font-display font-medium flex items-center text-medical-dark">
              <Circle size={16} className="text-medical-blue mr-2" />
              Recommendations
            </h3>
            {!editingRecommendations ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleEditRecommendations}
                className="text-xs"
              >
                <Edit3 size={14} className="mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSaveRecommendations}
                  className="text-xs text-green-600"
                >
                  <Save size={14} className="mr-1" />
                  Save
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancelEditRecommendations}
                  className="text-xs text-red-600"
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <CardContent className="p-4">
            {editingRecommendations ? (
              <Textarea
                value={tempRecommendations}
                onChange={(e) => setTempRecommendations(e.target.value)}
                placeholder="Enter recommendations (one per line)..."
                rows={4}
              />
            ) : (
              <ul className="list-disc pl-6 space-y-2">
                {analysisResult.recommendations.map((recommendation, index) => (
                  <li key={index} className="text-medical-dark">
                    {recommendation}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      
      <DoctorNotes />
    </div>
  );
};

export default AnalysisResults;
