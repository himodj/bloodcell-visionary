
import React from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId, getCellTypeColor, determineSeverity } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Printer } from 'lucide-react';

const ReportGenerator: React.FC = () => {
  const { analysisResult } = useAnalysis();
  
  if (!analysisResult) return null;
  
  const handlePrint = () => {
    window.print();
  };
  
  const reportId = generateReportId();
  const reportDate = formatReportDate(analysisResult.analysisDate);
  const severity = determineSeverity(analysisResult.abnormalityRate);
  
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
    <div className="mb-8">
      {/* Print-specific styles */}
      <style>
        {`
          @media print {
            body {
              background-color: white !important;
              color: black !important;
              font-size: 12pt !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .print-only {
              display: block !important;
            }
            
            .no-print {
              display: none !important;
            }
            
            .print-container {
              width: 100% !important;
              padding: 20px !important;
              margin: 0 !important;
              box-shadow: none !important;
              page-break-after: always !important;
            }
            
            .print-header {
              display: flex !important;
              justify-content: space-between !important;
              border-bottom: 1px solid #ccc !important;
              padding-bottom: 10px !important;
              margin-bottom: 20px !important;
            }
            
            .report-title {
              font-size: 16pt !important;
              font-weight: bold !important;
            }
            
            .print-section {
              margin-bottom: 20px !important;
              break-inside: avoid !important;
            }
            
            .print-section-title {
              font-size: 14pt !important;
              font-weight: bold !important;
              margin-bottom: 10px !important;
              border-bottom: 1px solid #ddd !important;
              padding-bottom: 5px !important;
            }
            
            .print-grid {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 20px !important;
            }
            
            .print-images {
              text-align: center !important;
              margin-bottom: 20px !important;
              display: flex !important;
              justify-content: space-between !important;
            }
            
            .print-image {
              max-width: 48% !important;
              border: 1px solid #ddd !important;
              padding: 5px !important;
            }
            
            .print-image img {
              max-width: 100% !important;
              height: auto !important;
            }
            
            .print-image-caption {
              font-size: 10pt !important;
              margin-top: 5px !important;
            }
            
            .print-label {
              font-weight: bold !important;
            }
            
            .print-value {
              margin-bottom: 5px !important;
            }
            
            .print-list {
              margin-left: 20px !important;
              margin-bottom: 10px !important;
            }
            
            .print-list-item {
              margin-bottom: 5px !important;
            }
            
            .print-footer {
              border-top: 1px solid #ccc !important;
              padding-top: 10px !important;
              font-size: 9pt !important;
              text-align: center !important;
              margin-top: 20px !important;
            }
            
            .print-notes {
              margin-top: 20px !important;
              border: 1px solid #ddd !important;
              padding: 10px !important;
              min-height: 100px !important;
            }
          }
        `}
      </style>
      
      <Card className="no-print mb-4">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Generate Report</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create a printable report of the blood cell analysis results
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={handlePrint}
              >
                <Printer size={16} />
                Print Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Print Layout - This will be visible when printing */}
      <div className="print-container">
        <div className="print-header">
          <div>
            <div className="report-title">Blood Cell Analysis Report</div>
            <div>Report ID: {reportId}</div>
            <div>Analysis Date: {reportDate}</div>
          </div>
        </div>
        
        <div className="print-section">
          <div className="print-section-title">Blood Sample Images</div>
          <div className="print-images">
            <div className="print-image">
              <img src={analysisResult.image || ''} alt="Original Sample" />
              <div className="print-image-caption">Original Sample</div>
            </div>
            <div className="print-image">
              <img src={analysisResult.processedImage || ''} alt="Analyzed Sample" />
              <div className="print-image-caption">Analyzed Sample with Cell Detection</div>
            </div>
          </div>
        </div>
        
        <div className="print-section">
          <div className="print-section-title">Cell Detection Results</div>
          {analysisResult.detectedCells.length > 0 ? (
            <div className="print-grid">
              <div>
                <div className="print-label">Detected Cell Type:</div>
                <div className="print-value">{analysisResult.detectedCells[0].type}</div>
                <div className="print-label">Confidence Level:</div>
                <div className="print-value">{(analysisResult.detectedCells[0].confidence * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="print-label">Analysis Method:</div>
                <div className="print-value">Deep Learning Neural Network</div>
                <div className="print-label">Analysis Date:</div>
                <div className="print-value">{reportDate}</div>
              </div>
            </div>
          ) : (
            <div>No cells detected in this sample.</div>
          )}
        </div>
        
        <div className="print-section">
          <div className="print-section-title">Findings</div>
          {analysisResult.possibleConditions.length > 0 && (
            <div>
              <div className="print-label">Possible Conditions:</div>
              <ul className="print-list">
                {analysisResult.possibleConditions.map((condition, index) => (
                  <li key={index} className="print-list-item">{condition}</li>
                ))}
              </ul>
            </div>
          )}
          
          {analysisResult.recommendations.length > 0 && (
            <div>
              <div className="print-label">Recommendations:</div>
              <ul className="print-list">
                {analysisResult.recommendations.map((recommendation, index) => (
                  <li key={index} className="print-list-item">{recommendation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="print-section">
          <div className="print-section-title">Notes</div>
          <div className="print-notes">
            {analysisResult.notes || 'No additional notes.'}
          </div>
        </div>
        
        <div className="print-footer">
          <div>Blood Cell Analysis Report - {reportId}</div>
          <div>Generated on {reportDate}</div>
          <div>This report is for informational purposes only and should be reviewed by a healthcare professional.</div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
