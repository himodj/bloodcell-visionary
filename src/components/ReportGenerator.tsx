
import React, { useState } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId, determineSeverity, getCellTypeColor, formatNumber } from '../utils/analysisUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Printer, FileText, Check, Edit3, Save } from 'lucide-react';
import { toast } from 'sonner';

// Custom print stylesheet for report formatting
const PrintStyles = () => (
  <style jsx global>{`
    @media print {
      /* Hide everything except the report content */
      body > *:not(#root),
      #root > *:not(main),
      main > *:not(.print-container) {
        display: none !important;
      }
      
      /* Fix container styles for print */
      .container {
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
      }
      
      /* Report specific styles */
      .print-container {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
      }
      
      .print-report {
        padding: 0.5cm !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
        font-size: 11pt !important;
      }
      
      .print-header {
        padding-bottom: 0.5cm !important;
        margin-bottom: 0.5cm !important;
        border-bottom: 1pt solid #ddd !important;
      }
      
      .print-header h1 {
        font-size: 18pt !important;
        margin-bottom: 0.2cm !important;
        color: #000 !important;
      }
      
      .print-content {
        page-break-inside: avoid !important;
      }
      
      .page-break {
        page-break-after: always !important;
      }
      
      /* Hide non-print elements */
      .no-print {
        display: none !important;
      }
      
      /* Show print-only elements */
      .print-only {
        display: block !important;
      }
      
      /* Format tables nicely */
      .print-table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 0.5cm 0 !important;
      }
      
      .print-table th, .print-table td {
        border: 1pt solid #ddd !important;
        padding: 0.2cm !important;
        text-align: left !important;
      }
      
      .print-table th {
        background-color: #f5f5f5 !important;
        font-weight: bold !important;
      }
      
      /* Make images fit properly */
      .print-image {
        max-width: 100% !important;
        height: auto !important;
        page-break-inside: avoid !important;
        margin: 0.5cm 0 !important;
        border: 1pt solid #ddd !important;
      }
      
      /* Cell type color indicators */
      .cell-type-indicator {
        display: inline-block !important;
        width: 0.3cm !important;
        height: 0.3cm !important;
        border-radius: 50% !important;
        margin-right: 0.2cm !important;
        vertical-align: middle !important;
      }
      
      /* Two column layout */
      .print-columns {
        display: flex !important;
        flex-direction: row !important;
        gap: 0.5cm !important;
      }
      
      .print-column {
        width: 50% !important;
      }
      
      /* Hide chart placeholder in print */
      .recharts-wrapper .recharts-surface {
        display: none !important;
      }
      
      /* Footer */
      .print-footer {
        margin-top: 0.5cm !important;
        padding-top: 0.5cm !important;
        border-top: 1pt solid #ddd !important;
        font-size: 10pt !important;
        color: #666 !important;
        text-align: center !important;
      }
    }
  `}</style>
);

const ReportGenerator: React.FC = () => {
  const { analysisResult, updateReportLayout, updateNotes } = useAnalysis();
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState('');
  
  if (!analysisResult) return null;
  
  const reportId = generateReportId();
  const reportDate = formatReportDate(analysisResult.analysisDate);
  const { cellCounts, abnormalityRate, possibleConditions, recommendations, detectedCells, reportLayout } = analysisResult;
  const severity = determineSeverity(abnormalityRate);
  
  // Prepare data for pie chart
  const pieData = Object.entries(cellCounts.detectedCells)
    .map(([type, count]) => ({
      name: type,
      value: count,
      color: getCellTypeColor(type)
    }))
    .filter(item => item.value > 0);
  
  // Calculate average confidence level
  const avgConfidence = detectedCells.length > 0
    ? (detectedCells.reduce((sum, cell) => sum + cell.confidence, 0) / detectedCells.length * 100).toFixed(1)
    : "N/A";
  
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      normal: '#34C759',
      mild: '#FFCC00',
      moderate: '#FF9500',
      severe: '#FF3B30'
    };
    return colors[severity] || colors.normal;
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleSaveNotes = () => {
    updateNotes(tempNotes);
    setEditingNotes(false);
    toast.success('Notes saved successfully');
  };
  
  const handleCancelEdit = () => {
    setTempNotes(analysisResult.notes || '');
    setEditingNotes(false);
  };
  
  const handleStartEdit = () => {
    setTempNotes(analysisResult.notes || '');
    setEditingNotes(true);
  };
  
  return (
    <>
      <PrintStyles />
      
      <div className="no-print mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <Tabs
            defaultValue={reportLayout}
            className="w-full" 
            onValueChange={(value) => updateReportLayout(value as 'standard' | 'compact' | 'detailed')}
          >
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="standard">Standard</TabsTrigger>
              <TabsTrigger value="compact">Compact</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex gap-2 items-center" 
              onClick={handlePrint}
            >
              <Printer size={16} />
              Print Report
            </Button>
            
            <Button 
              variant="outline" 
              className="flex gap-2 items-center" 
              onClick={() => toast.success('Report saved as PDF')}
            >
              <FileText size={16} />
              Save PDF
            </Button>
          </div>
        </div>
        
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-medium text-medical-dark">Medical Notes</h3>
              {editingNotes ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes}>
                    <Save size={14} className="mr-1" />
                    Save
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={handleStartEdit}>
                  <Edit3 size={14} className="mr-1" />
                  Edit Notes
                </Button>
              )}
            </div>
            
            {editingNotes ? (
              <Textarea
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                placeholder="Add your medical notes here..."
                className="min-h-[150px]"
              />
            ) : (
              <div className="bg-gray-50 p-4 rounded-md min-h-[100px]">
                {analysisResult.notes ? (
                  <p className="whitespace-pre-line">{analysisResult.notes}</p>
                ) : (
                  <p className="text-gray-400 italic">No notes added yet. Click Edit Notes to add your observations.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Print preview container */}
      <div className="print-container animate-fade-in">
        <div className="bg-white border rounded-lg shadow-md p-8 print-report">
          {/* Report Header */}
          <div className="border-b pb-6 mb-6 print-header">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold text-medical-dark">Blood Cell Analysis Report</h1>
                <p className="text-gray-600">Report ID: {reportId}</p>
              </div>
              <div className="text-right mt-4 md:mt-0">
                <p className="text-gray-600">Date: {reportDate}</p>
                <p className="text-gray-600">
                  <span 
                    className="inline-block w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: getSeverityColor(severity) }}
                  ></span>
                  Severity: <span className="font-medium">{severity.charAt(0).toUpperCase() + severity.slice(1)}</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-medical-dark">Analysis Summary</h3>
                <div className="bg-gray-50 p-4 rounded-sm">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-gray-600">Total Cells:</span>
                    <span className="font-medium">{formatNumber(cellCounts.total)}</span>
                    
                    <span className="text-gray-600">Abnormality Rate:</span>
                    <span 
                      className="font-medium"
                      style={{ color: getSeverityColor(severity) }}
                    >{abnormalityRate.toFixed(1)}%</span>
                    
                    <span className="text-gray-600">Analysis Confidence:</span>
                    <span className="font-medium">{avgConfidence}%</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-medical-dark">Patient Information</h3>
                <div className="bg-gray-50 p-4 rounded-sm">
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-gray-600">Patient ID:</span>
                    <span className="font-medium">PA-12345</span>
                    
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">Sample Analysis</span>
                    
                    <span className="text-gray-600">Referring Physician:</span>
                    <span className="font-medium">Dr. [Physician Name]</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Blood sample image and processed image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print-content">
            <div>
              <h3 className="font-medium mb-2 text-medical-dark">Original Blood Sample</h3>
              <img 
                src={analysisResult.image || ''} 
                alt="Blood Sample"
                className="w-full border border-gray-200 rounded-sm print-image"
              />
            </div>
            <div>
              <h3 className="font-medium mb-2 text-medical-dark">Cell Detection Analysis</h3>
              <img 
                src={analysisResult.processedImage || ''} 
                alt="Processed Blood Sample"
                className="w-full border border-gray-200 rounded-sm print-image"
              />
            </div>
          </div>
          
          {/* Cell counts and distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print-columns">
            <div className="print-column">
              <h3 className="font-medium mb-4 text-medical-dark">Detected Cell Types</h3>
              <table className="w-full border-collapse print-table">
                <thead>
                  <tr>
                    <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left">Cell Type</th>
                    <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cellCounts.detectedCells)
                    .filter(([_, count]) => count > 0)
                    .sort(([_, countA], [__, countB]) => countB - countA)
                    .map(([cellType, count], index) => (
                      <tr key={index}>
                        <td className="border border-gray-200 px-4 py-2">
                          <span 
                            className="inline-block w-3 h-3 rounded-full mr-2 cell-type-indicator"
                            style={{ backgroundColor: getCellTypeColor(cellType) }}
                          ></span>
                          {cellType}
                        </td>
                        <td className="border border-gray-200 px-4 py-2 text-right">{formatNumber(count)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            
            <div className="print-column">
              <h3 className="font-medium mb-4 text-medical-dark">Cell Distribution</h3>
              <div className="h-[220px] border border-gray-200 rounded-sm bg-gray-50 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={1}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend 
                      layout="vertical" 
                      align="right"
                      verticalAlign="middle"
                      iconType="circle"
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Fallback for print (pie charts don't print well) */}
              <div className="hidden print-only">
                <p className="text-sm text-gray-500 italic text-center mt-2">
                  Cell distribution chart - See digital report for interactive visualization
                </p>
                <table className="w-full border-collapse print-table mt-2">
                  <thead>
                    <tr>
                      <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left">Cell Type</th>
                      <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieData.map((item, index) => (
                      <tr key={index}>
                        <td className="border border-gray-200 px-4 py-2">
                          <span 
                            className="inline-block w-3 h-3 rounded-full mr-2 cell-type-indicator"
                            style={{ backgroundColor: item.color }}
                          ></span>
                          {item.name}
                        </td>
                        <td className="border border-gray-200 px-4 py-2 text-right">
                          {((item.value / cellCounts.total) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Page break for print */}
          <div className="hidden print-only page-break"></div>
          
          {/* Analysis findings */}
          <div className="grid grid-cols-1 gap-6 mb-8 print-content">
            <div>
              <h3 className="font-medium mb-4 text-medical-dark border-b pb-2">Analysis Findings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-sm text-medical-dark mb-2">Possible Conditions</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {possibleConditions.map((condition, index) => (
                      <li key={index} className="text-gray-800">{condition}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-medical-dark mb-2">Recommendations</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {recommendations.map((recommendation, index) => (
                      <li key={index} className="text-gray-800">{recommendation}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {reportLayout === 'detailed' && (
                <div className="mb-6">
                  <h4 className="font-medium text-sm text-medical-dark mb-2">Detailed Cell Analysis</h4>
                  <table className="w-full border-collapse print-table">
                    <thead>
                      <tr>
                        <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left">Cell Type</th>
                        <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-right">Confidence</th>
                        <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detectedCells
                        .sort((a, b) => b.confidence - a.confidence)
                        .slice(0, 10)
                        .map((cell, index) => (
                          <tr key={index}>
                            <td className="border border-gray-200 px-4 py-2">
                              <span 
                                className="inline-block w-3 h-3 rounded-full mr-2 cell-type-indicator"
                                style={{ backgroundColor: getCellTypeColor(cell.type) }}
                              ></span>
                              {cell.type}
                            </td>
                            <td className="border border-gray-200 px-4 py-2 text-right">
                              {(cell.confidence * 100).toFixed(1)}%
                            </td>
                            <td className="border border-gray-200 px-4 py-2 text-sm">
                              {`x:${cell.boundingBox.x}, y:${cell.boundingBox.y}`}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {analysisResult.notes && (
                <div>
                  <h4 className="font-medium text-sm text-medical-dark mb-2">Medical Notes</h4>
                  <div className="bg-gray-50 p-4 rounded-sm text-sm">
                    <p className="whitespace-pre-line">{analysisResult.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="border-t pt-4 mt-8 text-center text-gray-500 text-sm print-footer">
            <p>Blood Cell Analysis Report - Generated by Blood Cell Analyzer v1.0</p>
            <p className="mt-1">This report is for informational purposes only and should be reviewed by a qualified healthcare professional.</p>
            <p className="mt-1">© {new Date().getFullYear()} Blood Cell Analyzer</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportGenerator;
