import React from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId, getCellTypeColor, determineSeverity } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

const FormalReportGenerator: React.FC = () => {
  const { analysisResult, patientInfo } = useAnalysis();
  
  if (!analysisResult) return null;
  
  const reportId = generateReportId();
  const reportDate = formatReportDate(analysisResult.analysisDate);
  const severity = determineSeverity(analysisResult.abnormalityRate);
  
  const handlePrint = () => {
    window.print();
  };

  const handleSaveReport = async () => {
    // For now, just show a toast since we need to implement the save functionality in Electron
    toast.info('Report save functionality will be implemented with Electron backend');
    
    // Future implementation:
    // if (!window.electron) {
    //   toast.error('Save functionality requires the desktop application');
    //   return;
    // }

    // try {
    //   const reportData = {
    //     reportId,
    //     patientInfo,
    //     analysisResult,
    //     reportDate,
    //     severity
    //   };

    //   const result = await window.electron.saveReport(reportData);
    //   if (result.success) {
    //     toast.success(`Report saved to: ${result.filePath}`);
    //   } else {
    //     toast.error(`Failed to save report: ${result.error}`);
    //   }
    // } catch (error) {
    //   console.error('Error saving report:', error);
    //   toast.error('Failed to save report');
    // }
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
    <div className="mb-8">
      {/* Print-specific styles for formal lab report */}
      <style>
        {`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            body {
              background: white !important;
              color: black !important;
              font-family: 'Arial', sans-serif !important;
              font-size: 10pt !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .no-print {
              display: none !important;
            }
            
            .print-container {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 20mm !important;
              box-shadow: none !important;
              border: none !important;
            }
            
            .lab-header {
              border-bottom: 3px solid #1e40af !important;
              padding-bottom: 15px !important;
              margin-bottom: 20px !important;
              text-align: center !important;
            }
            
            .lab-title {
              font-size: 18pt !important;
              font-weight: bold !important;
              color: #1e40af !important;
              margin-bottom: 5px !important;
            }
            
            .lab-subtitle {
              font-size: 12pt !important;
              color: #374151 !important;
              margin-bottom: 3px !important;
            }
            
            .report-info {
              display: flex !important;
              justify-content: space-between !important;
              margin-bottom: 20px !important;
              font-size: 9pt !important;
            }
            
            .patient-section {
              background: #f8fafc !important;
              border: 1px solid #e2e8f0 !important;
              padding: 15px !important;
              margin-bottom: 20px !important;
              page-break-inside: avoid !important;
            }
            
            .section-title {
              font-size: 12pt !important;
              font-weight: bold !important;
              color: #1e40af !important;
              margin-bottom: 10px !important;
              border-bottom: 1px solid #cbd5e1 !important;
              padding-bottom: 3px !important;
            }
            
            .patient-grid {
              display: grid !important;
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 15px !important;
            }
            
            .patient-field {
              display: flex !important;
              flex-direction: column !important;
            }
            
            .field-label {
              font-weight: bold !important;
              font-size: 9pt !important;
              color: #374151 !important;
              margin-bottom: 2px !important;
            }
            
            .field-value {
              font-size: 10pt !important;
              color: #111827 !important;
              border-bottom: 1px solid #d1d5db !important;
              padding-bottom: 2px !important;
              min-height: 14px !important;
            }
            
            .analysis-section {
              margin-bottom: 20px !important;
              page-break-inside: avoid !important;
            }
            
            .images-section {
              display: flex !important;
              justify-content: space-between !important;
              gap: 20px !important;
              margin-bottom: 20px !important;
            }
            
            .image-container {
              flex: 1 !important;
              text-align: center !important;
              border: 1px solid #d1d5db !important;
              padding: 10px !important;
            }
            
            .image-container img {
              max-width: 100% !important;
              max-height: 200px !important;
              object-fit: contain !important;
            }
            
            .image-caption {
              font-size: 9pt !important;
              margin-top: 8px !important;
              font-weight: bold !important;
            }
            
            .results-grid {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 20px !important;
              margin-bottom: 20px !important;
            }
            
            .result-item {
              display: flex !important;
              justify-content: space-between !important;
              padding: 8px 0 !important;
              border-bottom: 1px solid #e5e7eb !important;
            }
            
            .result-label {
              font-weight: bold !important;
              font-size: 10pt !important;
            }
            
            .result-value {
              font-size: 10pt !important;
            }
            
            .findings-section {
              background: #fef3c7 !important;
              border: 1px solid #f59e0b !important;
              border-left: 4px solid #f59e0b !important;
              padding: 15px !important;
              margin-bottom: 20px !important;
            }
            
            .findings-list {
              margin: 10px 0 !important;
              padding-left: 20px !important;
            }
            
            .findings-list li {
              margin-bottom: 5px !important;
              font-size: 10pt !important;
            }
            
            .notes-section {
              border: 1px solid #d1d5db !important;
              padding: 15px !important;
              margin-bottom: 20px !important;
              min-height: 80px !important;
            }
            
            .signature-section {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 40px !important;
              margin-top: 30px !important;
              padding-top: 20px !important;
              border-top: 1px solid #d1d5db !important;
            }
            
            .signature-line {
              border-bottom: 1px solid #374151 !important;
              padding-bottom: 2px !important;
              margin-bottom: 5px !important;
              min-height: 20px !important;
            }
            
            .signature-label {
              font-size: 9pt !important;
              color: #374151 !important;
            }
            
            .footer {
              position: fixed !important;
              bottom: 15mm !important;
              left: 20mm !important;
              right: 20mm !important;
              text-align: center !important;
              font-size: 8pt !important;
              color: #6b7280 !important;
              border-top: 1px solid #e5e7eb !important;
              padding-top: 10px !important;
            }
          }
        `}
      </style>
      
      <Card className="no-print mb-4">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">Generate Formal Lab Report</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create a professional laboratory report with patient information and analysis results
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={handleSaveReport}
              >
                <Download size={16} />
                Save Report
              </Button>
              <Button 
                variant="default" 
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
      
      {/* Formal Lab Report Layout */}
      <div className="print-container">
        {/* Lab Header */}
        <div className="lab-header">
          <div className="lab-title">CLINICAL LABORATORY</div>
          <div className="lab-subtitle">Hematology Department</div>
          <div className="lab-subtitle">Blood Cell Analysis Report</div>
        </div>
        
        {/* Report Information */}
        <div className="report-info">
          <div>
            <strong>Report ID:</strong> {reportId}<br />
            <strong>Analysis Date:</strong> {reportDate}
          </div>
          <div>
            <strong>Report Type:</strong> Automated Blood Cell Analysis<br />
            <strong>Method:</strong> Deep Learning Neural Network
          </div>
        </div>
        
        {/* Patient Information Section */}
        <div className="patient-section">
          <div className="section-title">PATIENT INFORMATION</div>
          <div className="patient-grid">
            <div className="patient-field">
              <div className="field-label">Patient Name:</div>
              <div className="field-value">{patientInfo.name || 'Not specified'}</div>
            </div>
            <div className="patient-field">
              <div className="field-label">Age:</div>
              <div className="field-value">{patientInfo.age || 'Not specified'}</div>
            </div>
            <div className="patient-field">
              <div className="field-label">Gender:</div>
              <div className="field-value">{patientInfo.gender || 'Not specified'}</div>
            </div>
            <div className="patient-field">
              <div className="field-label">Sample Type:</div>
              <div className="field-value">{patientInfo.sampleType || 'Blood Sample'}</div>
            </div>
            <div className="patient-field">
              <div className="field-label">Physician:</div>
              <div className="field-value">{patientInfo.physicianName || 'Not specified'}</div>
            </div>
            <div className="patient-field">
              <div className="field-label">Lab Technician:</div>
              <div className="field-value">{patientInfo.labTechnician || 'Not specified'}</div>
            </div>
          </div>
          
          {patientInfo.clinicalNotes && (
            <div style={{ marginTop: '15px' }}>
              <div className="field-label">Clinical Notes:</div>
              <div className="field-value">{patientInfo.clinicalNotes}</div>
            </div>
          )}
        </div>
        
        {/* Sample Images */}
        <div className="analysis-section">
          <div className="section-title">MICROSCOPIC EXAMINATION</div>
          <div className="images-section">
            <div className="image-container">
              <img src={analysisResult.image} alt="Original Sample" />
              <div className="image-caption">Original Sample</div>
            </div>
            {analysisResult.processedImage && (
              <div className="image-container">
                <img src={analysisResult.processedImage} alt="Analyzed Sample" />
                <div className="image-caption">Analyzed Sample with Cell Detection</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Analysis Results */}
        <div className="analysis-section">
          <div className="section-title">ANALYSIS RESULTS</div>
          <div className="results-grid">
            <div>
              {analysisResult.detectedCells.length > 0 && (
                <>
                  <div className="result-item">
                    <span className="result-label">Detected Cell Type:</span>
                    <span className="result-value">{analysisResult.detectedCells[0].type}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Confidence Level:</span>
                    <span className="result-value">{(analysisResult.detectedCells[0].confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Analysis Method:</span>
                    <span className="result-value">AI-Powered Detection</span>
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="result-item">
                <span className="result-label">Total Cells Analyzed:</span>
                <span className="result-value">{analysisResult.cellCounts.totalCells}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Normal Cells:</span>
                <span className="result-value">{analysisResult.cellCounts.normalCells}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Abnormal Cells:</span>
                <span className="result-value">{analysisResult.cellCounts.abnormalCells}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Clinical Findings */}
        {(analysisResult.possibleConditions.length > 0 || analysisResult.recommendations.length > 0) && (
          <div className="findings-section">
            <div className="section-title">CLINICAL FINDINGS & RECOMMENDATIONS</div>
            
            {analysisResult.possibleConditions.length > 0 && (
              <div>
                <strong>Possible Conditions:</strong>
                <ul className="findings-list">
                  {analysisResult.possibleConditions.map((condition, index) => (
                    <li key={index}>{condition}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {analysisResult.recommendations.length > 0 && (
              <div>
                <strong>Recommendations:</strong>
                <ul className="findings-list">
                  {analysisResult.recommendations.map((recommendation, index) => (
                    <li key={index}>{recommendation}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Additional Notes */}
        <div className="analysis-section">
          <div className="section-title">ADDITIONAL NOTES</div>
          <div className="notes-section">
            {analysisResult.notes || 'No additional notes provided.'}
          </div>
        </div>
        
        {/* Signature Section */}
        <div className="signature-section">
          <div>
            <div className="signature-line"></div>
            <div className="signature-label">Lab Technician Signature & Date</div>
          </div>
          <div>
            <div className="signature-line"></div>
            <div className="signature-label">Reviewed by Pathologist & Date</div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="footer">
          <div>Clinical Laboratory • Blood Cell Analysis Report • Report ID: {reportId}</div>
          <div>Generated on {reportDate} • This report is for clinical use only</div>
          <div style={{ fontSize: '7pt', marginTop: '5px' }}>
            IMPORTANT: This automated analysis should be reviewed by a qualified healthcare professional. Results may require confirmation through manual microscopy.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormalReportGenerator;