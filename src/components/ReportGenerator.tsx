
import React from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId, generatePdfReport, determineSeverity } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FilePlus, Printer, FileText } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const ReportGenerator: React.FC = () => {
  const { analysisResult } = useAnalysis();
  
  if (!analysisResult) return null;
  
  const { abnormalityRate, recommendations, analysisDate } = analysisResult;
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

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-medium flex items-center">
          <FileText size={20} className="mr-2 text-medical-blue" />
          Lab Report
        </h2>
        <div className="flex space-x-2">
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
                <div className="flex justify-between">
                  <span className="text-medical-dark text-opacity-70">Normal RBCs:</span>
                  <span>{analysisResult.cellCounts.normal.rbc.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-medical-dark text-opacity-70">Normal Platelets:</span>
                  <span>{analysisResult.cellCounts.normal.platelets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-medical-dark text-opacity-70">Abnormal RBCs:</span>
                  <span className="text-medical-red">
                    {analysisResult.cellCounts.abnormal.rbc.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-medical-dark text-opacity-70">Abnormal Platelets:</span>
                  <span className="text-medical-red">
                    {analysisResult.cellCounts.abnormal.platelets.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="mb-6">
            <h4 className="font-medium mb-3 text-medical-dark">Findings</h4>
            <div className="text-sm space-y-2">
              {analysisResult.possibleConditions.map((condition, index) => (
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
          
          <div className="text-xs text-medical-dark text-opacity-50 mt-6">
            <p>
              This report was generated using BloodCellVision CNN analysis system. Results should be
              correlated with clinical findings and confirmed by a qualified healthcare professional.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportGenerator;
