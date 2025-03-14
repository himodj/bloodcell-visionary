
import React, { useState } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId, generatePdfReport, determineSeverity, formatNumber } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FilePlus, Printer, FileText, LayoutGrid } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';

const ReportGenerator: React.FC = () => {
  const { analysisResult, updateReportLayout, updateNotes } = useAnalysis();
  
  if (!analysisResult) return null;
  
  const { abnormalityRate, recommendations, analysisDate, reportLayout, cellCounts, possibleConditions, processedImage, notes } = analysisResult;
  const severity = determineSeverity(abnormalityRate);
  const reportId = generateReportId();
  
  const handlePrintReport = () => {
    generatePdfReport(analysisResult);
    toast.success('Preparing report for printing');
  };
  
  const handleSaveReport = () => {
    // In a real app, this would save the report to a database
    toast.success('Report saved successfully');
  };
  
  const handleLayoutChange = (layout: string) => {
    updateReportLayout(layout as 'standard' | 'compact' | 'detailed');
    toast.success(`Report layout changed to ${layout}`);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNotes(e.target.value);
  };
  
  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      normal: 'Normal',
      mild: 'Mild Abnormalities',
      moderate: 'Moderate Abnormalities',
      severe: 'Severe Abnormalities'
    };
    return labels[severity] || labels.normal;
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

  // Notes section component to include in all layouts
  const NotesSection = () => (
    <div className="mt-4">
      <h4 className="font-medium mb-2 text-medical-dark">Notes</h4>
      <Textarea 
        placeholder="Add your observations or additional information here..." 
        className="min-h-[100px]"
        value={notes || ''}
        onChange={handleNotesChange}
      />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-medium flex items-center">
          <FileText size={20} className="mr-2 text-medical-blue" />
          Lab Report
        </h2>
        <div className="flex space-x-2">
          <Select 
            defaultValue={reportLayout}
            onValueChange={handleLayoutChange}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Layout" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard Layout</SelectItem>
              <SelectItem value="compact">Compact Layout</SelectItem>
              <SelectItem value="detailed">Detailed Layout</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveReport}
            className="text-sm"
          >
            <FilePlus size={14} className="mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            onClick={handlePrintReport}
            className="bg-medical-blue hover:bg-medical-blue/90 text-sm"
          >
            <Printer size={14} className="mr-1" />
            Print
          </Button>
        </div>
      </div>
      
      {/* Standard Layout */}
      {reportLayout === 'standard' && (
        <Card className="medical-card overflow-hidden" id="print-content">
          <div className="p-4 border-b">
            <div className="flex flex-col md:flex-row justify-between">
              <div>
                <h3 className="font-display font-bold text-xl">Blood Cell Analysis Report</h3>
                <p className="text-sm text-medical-dark text-opacity-70">
                  Generated on {formatReportDate(analysisDate)}
                </p>
              </div>
              <div className="mt-2 md:mt-0">
                <p className="text-sm text-medical-dark text-opacity-70">Report ID: {reportId}</p>
                <div className="flex items-center mt-1">
                  <div className="h-2 w-2 rounded-full mr-1" style={{ backgroundColor: getSeverityColor(severity) }}></div>
                  <p className="text-sm font-medium" style={{ color: getSeverityColor(severity) }}>
                    {getSeverityLabel(severity)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="font-medium mb-2 text-medical-dark">Sample Information</h4>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-medical-dark text-opacity-70">Analysis Date:</span>
                    <span>{formatReportDate(analysisDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-medical-dark text-opacity-70">Abnormality Rate:</span>
                    <span className="font-medium" style={{ color: getSeverityColor(severity) }}>
                      {abnormalityRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-medical-dark text-opacity-70">Assessment:</span>
                    <span className="font-medium" style={{ color: getSeverityColor(severity) }}>
                      {getSeverityLabel(severity)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 text-medical-dark">Cell Count Summary</h4>
                <div className="text-sm space-y-2">
                  {Object.entries(cellCounts.detectedCells)
                    .filter(([_, count]) => count > 0)
                    .sort(([_, countA], [__, countB]) => countB - countA)
                    .slice(0, 4) // Show top 4 cell types
                    .map(([cellType, count], index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-medical-dark text-opacity-70">{cellType}:</span>
                        <span>{formatNumber(count)}</span>
                      </div>
                    ))
                  }
                  <div className="flex justify-between">
                    <span className="text-medical-dark text-opacity-70">Total Cells:</span>
                    <span className="font-medium">
                      {formatNumber(cellCounts.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="mb-6">
              <h4 className="font-medium mb-3 text-medical-dark">Findings</h4>
              <div className="text-sm space-y-2">
                {possibleConditions.map((condition, index) => (
                  <p key={index} className="text-medical-dark">
                    {condition}
                  </p>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3 text-medical-dark">Recommendations</h4>
              <ul className="list-disc pl-6 text-sm space-y-2">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="text-medical-dark">
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
            
            <Separator className="my-4" />
            
            <NotesSection />
            
            <div className="text-xs text-medical-dark text-opacity-50 mt-6">
              <p>
                This report was generated using BloodCellVision CNN analysis system. Results should be
                correlated with clinical findings and confirmed by a qualified healthcare professional.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Compact Layout */}
      {reportLayout === 'compact' && (
        <Card className="medical-card overflow-hidden" id="print-content">
          <div className="p-3 border-b bg-gray-50">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-bold text-base">Blood Cell Analysis Summary</h3>
              <p className="text-xs text-medical-dark text-opacity-70">ID: {reportId}</p>
            </div>
          </div>
          
          <CardContent className="p-3">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span>Generated: {formatReportDate(analysisDate)}</span>
                <span className="font-medium px-2 py-1 rounded" style={{ 
                  backgroundColor: `${getSeverityColor(severity)}20`,
                  color: getSeverityColor(severity)
                }}>
                  {getSeverityLabel(severity)} ({abnormalityRate.toFixed(1)}%)
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {Object.entries(cellCounts.detectedCells)
                  .filter(([_, count]) => count > 0)
                  .map(([cellType, count], index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-medical-dark text-opacity-70">{cellType}:</span>
                      <span>{formatNumber(count)}</span>
                    </div>
                  ))
                }
              </div>
              
              <Separator className="my-1" />
              
              <div>
                <h5 className="text-xs font-medium mb-1">Key Findings:</h5>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  {possibleConditions.slice(0, 3).map((condition, index) => (
                    <li key={index} className="text-medical-dark">
                      {condition}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h5 className="text-xs font-medium mb-1">Recommendations:</h5>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  {recommendations.slice(0, 3).map((recommendation, index) => (
                    <li key={index} className="text-medical-dark">
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </div>
              
              <Separator className="my-1" />
              
              <div>
                <h5 className="text-xs font-medium mb-1">Notes:</h5>
                <Textarea 
                  placeholder="Add your observations here..." 
                  className="min-h-[60px] text-xs p-2"
                  value={notes || ''}
                  onChange={handleNotesChange}
                />
              </div>
              
              <div className="text-xxs text-medical-dark text-opacity-50 mt-2 text-center">
                BloodCellVision AI-assisted analysis. Findings should be confirmed by a healthcare professional.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Detailed Layout */}
      {reportLayout === 'detailed' && (
        <Card className="medical-card overflow-hidden" id="print-content">
          <div className="p-4 border-b bg-blue-50">
            <div className="flex flex-col md:flex-row justify-between">
              <div>
                <h3 className="font-display font-bold text-xl">Comprehensive Hematology Analysis</h3>
                <p className="text-sm text-medical-dark text-opacity-70">
                  Deep Cell Morphology Assessment
                </p>
              </div>
              <div className="mt-2 md:mt-0 text-right">
                <p className="text-sm text-medical-dark text-opacity-70">Report ID: {reportId}</p>
                <p className="text-sm text-medical-dark text-opacity-70">Date: {formatReportDate(analysisDate)}</p>
              </div>
            </div>
          </div>
          
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-1">
                {processedImage && (
                  <img 
                    src={processedImage} 
                    alt="Processed Blood Sample" 
                    className="w-full h-auto object-contain border border-gray-200 rounded mb-4"
                  />
                )}
                
                <div className="bg-gray-50 p-3 rounded border">
                  <h4 className="font-medium text-sm mb-2 text-medical-dark">Assessment Summary</h4>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-medical-dark text-opacity-70">Status:</span>
                      <span className="font-medium" style={{ color: getSeverityColor(severity) }}>
                        {getSeverityLabel(severity)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-medical-dark text-opacity-70">Abnormality:</span>
                      <span className="font-medium" style={{ color: getSeverityColor(severity) }}>
                        {abnormalityRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-medical-dark text-opacity-70">Total Cells:</span>
                      <span className="font-medium">
                        {formatNumber(cellCounts.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <h4 className="font-medium mb-3 text-medical-dark border-b pb-2">Detailed Cell Analysis</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {Object.entries(cellCounts.detectedCells)
                    .filter(([_, count]) => count > 0)
                    .map(([cellType, count], index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border">
                        <div className="flex items-center mb-2">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: getSeverityColor(severity) }}></div>
                          <h5 className="font-medium text-sm">{cellType}</h5>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-medical-dark text-opacity-70">Count:</span>
                          <span className="font-medium">{formatNumber(count)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-medical-dark text-opacity-70">Percentage:</span>
                          <span className="font-medium">
                            {((count / cellCounts.total) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </div>
                
                <h4 className="font-medium mb-3 text-medical-dark border-b pb-2 mt-6">Clinical Interpretation</h4>
                
                <div className="mb-4">
                  <h5 className="text-sm font-medium mb-2 text-medical-dark">Findings:</h5>
                  <ul className="list-disc pl-6 text-sm space-y-2">
                    {possibleConditions.map((condition, index) => (
                      <li key={index} className="text-medical-dark">
                        {condition}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium mb-2 text-medical-dark">Clinical Recommendations:</h5>
                  <ul className="list-disc pl-6 text-sm space-y-2">
                    {recommendations.map((recommendation, index) => (
                      <li key={index} className="text-medical-dark">
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <NotesSection />
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="bg-gray-50 p-3 rounded text-xs text-medical-dark text-opacity-70 mt-6">
              <p className="font-medium mb-1">Methodology:</p>
              <p>
                Analysis performed using BloodCellVision deep learning convolutional neural network with cell detection and classification.
                The system identifies 8 major blood cell types: Basophils, Eosinophils, Erythroblasts, Immature Granulocytes, Lymphocytes, Monocytes, Neutrophils, and Platelets.
              </p>
              <p className="mt-2">
                This report is generated with AI assistance and should be interpreted by a qualified healthcare professional in conjunction with clinical findings.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportGenerator;
