
import React, { useState } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId, generatePdfReport, determineSeverity, formatNumber } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FilePlus, Printer, FileText, LayoutGrid, PenLine } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';

const ReportGenerator: React.FC = () => {
  const { analysisResult, updateReportLayout, updateNotes, updateRecommendations } = useAnalysis();
  
  // Add patient information state
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [customAbnormalityRate, setCustomAbnormalityRate] = useState<string>('');
  const [customAssessment, setCustomAssessment] = useState<string>('');
  
  if (!analysisResult) return null;
  
  const { abnormalityRate, recommendations, analysisDate, reportLayout, cellCounts, possibleConditions, processedImage, notes, detectedCells } = analysisResult;
  const severity = determineSeverity(abnormalityRate);
  const reportId = generateReportId();
  
  // Calculate average confidence level
  const confidenceLevel = detectedCells.length > 0 
    ? (detectedCells.reduce((sum, cell) => sum + cell.confidence, 0) / detectedCells.length * 100).toFixed(1) 
    : "N/A";
  
  // Get most frequent cell types
  const getCellTypeCounts = () => {
    const counts: Record<string, number> = {};
    detectedCells.forEach(cell => {
      counts[cell.type] = (counts[cell.type] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type} (${count})`);
  };
  
  const mostFrequentCellTypes = getCellTypeCounts();
  
  const handlePrintReport = () => {
    window.print();
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
  
  const handleEditRecommendations = () => {
    const currentRecs = recommendations.join('\n');
    const newRecs = prompt('Edit recommendations (one per line):', currentRecs);
    
    if (newRecs !== null) {
      const recArray = newRecs.split('\n').filter(rec => rec.trim() !== '');
      updateRecommendations(recArray);
      toast.success('Recommendations updated');
    }
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

  // Patient information section for all layouts
  const PatientInfoSection = () => (
    <div className="mb-4">
      <h4 className="font-medium mb-2 text-medical-dark">Patient Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-medical-dark mb-1 block">Patient Name</label>
          <Input 
            placeholder="Enter patient name" 
            value={patientName} 
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-medical-dark mb-1 block">Age</label>
          <Input 
            placeholder="Enter age" 
            type="number"
            value={patientAge} 
            onChange={(e) => setPatientAge(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-medical-dark mb-1 block">Gender</label>
          <Select 
            value={patientGender} 
            onValueChange={setPatientGender}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Lab report specific print styles
  const printStyles = `
    @media print {
      @page {
        size: A4;
        margin: 15mm;
      }
      body {
        margin: 0;
        padding: 0;
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print, .no-print * {
        display: none !important;
      }
      .print-only {
        display: block !important;
      }
      #root > div > header,
      #root > div > main > div.animate-fade-in,
      #root > div > main > div.grid,
      #root > div > footer,
      button, 
      .select,
      .controls-container {
        display: none !important;
      }
      #print-content {
        display: block !important;
        width: 100%;
        height: auto;
        overflow: visible;
        box-shadow: none;
        border: none;
      }
      #print-content * {
        color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;

  return (
    <div className="animate-fade-in">
      <style>{printStyles}</style>
      <div className="flex items-center justify-between mb-4 no-print controls-container">
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
            {/* Patient Information */}
            <PatientInfoSection />
            
            <Separator className="my-4" />
            
            <div className="mb-6">
              <h4 className="font-medium mb-2 text-medical-dark">Sample Information</h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-medical-dark text-opacity-70">Analysis Date:</span>
                  <span>{formatReportDate(analysisDate)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-medical-dark text-opacity-70">Abnormality Rate:</span>
                  <div className="flex items-center">
                    <Input 
                      className="w-24 h-7 text-sm mr-2 inline-block"
                      value={customAbnormalityRate || abnormalityRate.toFixed(1)}
                      onChange={(e) => setCustomAbnormalityRate(e.target.value)}
                      placeholder={abnormalityRate.toFixed(1)}
                    />
                    <span className="font-medium">%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-medical-dark text-opacity-70">Assessment:</span>
                  <div className="flex items-center">
                    <Input 
                      className="w-40 h-7 text-sm"
                      value={customAssessment || getSeverityLabel(severity)}
                      onChange={(e) => setCustomAssessment(e.target.value)}
                      placeholder={getSeverityLabel(severity)}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-medical-dark text-opacity-70">Analysis Confidence:</span>
                  <span className="font-medium">
                    {confidenceLevel}%
                  </span>
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            {/* Detected cell types section */}
            <div className="mb-6">
              <h4 className="font-medium mb-2 text-medical-dark">Detected Cell Types</h4>
              <div className="text-sm space-y-2">
                {mostFrequentCellTypes.length > 0 ? (
                  mostFrequentCellTypes.map((cellType, index) => (
                    <p key={index} className="text-medical-dark">
                      {cellType}
                    </p>
                  ))
                ) : (
                  <p className="text-medical-dark">No cells detected</p>
                )}
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
            
            <div className="mb-6">
              <h4 className="font-medium mb-3 text-medical-dark flex items-center justify-between">
                <span>Cell-Specific Recommendations</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleEditRecommendations}
                  className="text-xs no-print"
                >
                  <PenLine size={14} className="mr-1" />
                  Edit
                </Button>
              </h4>
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
              {/* Patient Information - Compact */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-medical-dark mb-1">Patient Name</label>
                  <Input 
                    className="h-7 text-xs"
                    placeholder="Enter name" 
                    value={patientName} 
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-medical-dark mb-1">Age</label>
                  <Input 
                    className="h-7 text-xs"
                    placeholder="Age" 
                    type="number"
                    value={patientAge} 
                    onChange={(e) => setPatientAge(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-medical-dark mb-1">Gender</label>
                  <Select 
                    value={patientGender} 
                    onValueChange={setPatientGender}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span>Generated: {formatReportDate(analysisDate)}</span>
                <div className="flex items-center">
                  <Input 
                    className="w-16 h-6 text-xs mr-1"
                    value={customAbnormalityRate || abnormalityRate.toFixed(1)}
                    onChange={(e) => setCustomAbnormalityRate(e.target.value)}
                    placeholder={abnormalityRate.toFixed(1)}
                  />
                  <span>% - </span>
                  <Input 
                    className="w-32 h-6 text-xs ml-1"
                    value={customAssessment || getSeverityLabel(severity)}
                    onChange={(e) => setCustomAssessment(e.target.value)}
                    placeholder={getSeverityLabel(severity)}
                  />
                </div>
              </div>
              
              <Separator className="my-1" />
              
              {/* Detected cell types */}
              <div>
                <h5 className="text-xs font-medium mb-1">Detected Cell Types:</h5>
                <div className="text-xs space-y-1">
                  {mostFrequentCellTypes.length > 0 ? (
                    mostFrequentCellTypes.map((cellType, index) => (
                      <div key={index} className="text-medical-dark">
                        {cellType}
                      </div>
                    ))
                  ) : (
                    <div className="text-medical-dark">No cells detected</div>
                  )}
                </div>
              </div>
              
              {/* Analysis confidence */}
              <div>
                <h5 className="text-xs font-medium mb-1">Analysis Confidence:</h5>
                <div className="text-xs">
                  <span className="text-medical-dark">Confidence Level: {confidenceLevel}%</span>
                </div>
              </div>
              
              <Separator className="my-1" />
              
              <div>
                <h5 className="text-xs font-medium mb-1">Key Findings:</h5>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  {possibleConditions.map((condition, index) => (
                    <li key={index} className="text-medical-dark">
                      {condition}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h5 className="text-xs font-medium flex items-center justify-between mb-1">
                  <span>Cell-Specific Recommendations:</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleEditRecommendations}
                    className="text-xs no-print"
                  >
                    <PenLine size={10} className="mr-1" />
                    Edit
                  </Button>
                </h5>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  {recommendations.map((recommendation, index) => (
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
            {/* Patient Information for detailed layout */}
            <div className="mb-4">
              <h4 className="font-medium mb-2 text-medical-dark">Patient Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-medical-dark mb-1 block">Patient Name</label>
                  <Input 
                    placeholder="Enter patient name" 
                    value={patientName} 
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-medical-dark mb-1 block">Age</label>
                  <Input 
                    placeholder="Enter age" 
                    type="number"
                    value={patientAge} 
                    onChange={(e) => setPatientAge(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-medical-dark mb-1 block">Gender</label>
                  <Select 
                    value={patientGender} 
                    onValueChange={setPatientGender}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
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
                    <div className="flex justify-between items-center">
                      <span className="text-medical-dark text-opacity-70">Status:</span>
                      <Input 
                        className="w-32 h-7 text-sm"
                        value={customAssessment || getSeverityLabel(severity)}
                        onChange={(e) => setCustomAssessment(e.target.value)}
                        placeholder={getSeverityLabel(severity)}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-medical-dark text-opacity-70">Abnormality:</span>
                      <div className="flex items-center">
                        <Input 
                          className="w-20 h-7 text-sm mr-1"
                          value={customAbnormalityRate || abnormalityRate.toFixed(1)}
                          onChange={(e) => setCustomAbnormalityRate(e.target.value)}
                          placeholder={abnormalityRate.toFixed(1)}
                        />
                        <span>%</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-medical-dark text-opacity-70">Total Cells:</span>
                      <span className="font-medium">
                        {formatNumber(cellCounts.total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-medical-dark text-opacity-70">Confidence:</span>
                      <span className="font-medium">
                        {confidenceLevel}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <h4 className="font-medium mb-3 text-medical-dark border-b pb-2">Clinical Interpretation</h4>
                
                {/* Detected cell types */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium mb-2 text-medical-dark">Detected Cell Types:</h5>
                  <ul className="list-disc pl-6 text-sm space-y-2">
                    {mostFrequentCellTypes.length > 0 ? (
                      mostFrequentCellTypes.map((cellType, index) => (
                        <li key={index} className="text-medical-dark">
                          {cellType}
                        </li>
                      ))
                    ) : (
                      <li className="text-medical-dark">No cells detected</li>
                    )}
                  </ul>
                </div>
                
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
                  <h5 className="text-sm font-medium flex items-center justify-between mb-2">
                    <span>Cell-Specific Recommendations:</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleEditRecommendations}
                      className="text-xs no-print"
                    >
                      <PenLine size={14} className="mr-1" />
                      Edit
                    </Button>
                  </h5>
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
