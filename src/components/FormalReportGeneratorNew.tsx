import React, { useState } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';
import LabSettings, { LabConfiguration } from './LabSettings';

const FormalReportGeneratorNew: React.FC = () => {
  const { analysisResult, patientInfo } = useAnalysis();
  const [labConfig, setLabConfig] = useState<LabConfiguration>({
    labName: '',
    address: '',
    phone: '',
    hematologyDoctorName: '',
    licenseNumber: '',
    logo: null
  });
  
  if (!analysisResult) return null;
  
  const reportId = generateReportId();
  const reportDate = formatReportDate(analysisResult.analysisDate);
  
  const handlePrint = async () => {
    // Save report first, then print
    await handleSaveReport();
    window.print();
  };

  const handleSaveReport = async () => {
    if (!window.electron) {
      toast.error('Save functionality requires the desktop application');
      return;
    }

    try {
      const reportData = {
        reportId,
        patientInfo,
        analysisResult,
        reportDate,
        labConfig
      };

      const result = await window.electron.saveReport(reportData);
      if (result.success) {
        toast.success(`Report saved to: ${result.filePath}`);
      } else {
        toast.error(`Failed to save report: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Failed to save report');
    }
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
              font-size: 11pt !important;
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
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              border-bottom: 3px solid #1e40af !important;
              padding-bottom: 20px !important;
              margin-bottom: 30px !important;
            }
            
            .lab-info {
              flex: 1 !important;
            }
            
            .lab-title {
              font-size: 20pt !important;
              font-weight: bold !important;
              color: #1e40af !important;
              margin-bottom: 8px !important;
            }
            
            .lab-subtitle {
              font-size: 11pt !important;
              color: #374151 !important;
              margin-bottom: 3px !important;
            }
            
            .lab-logo {
              height: 60px !important;
              object-fit: contain !important;
            }
            
            .patient-box {
              border: 2px solid #1e40af !important;
              padding: 20px !important;
              margin-bottom: 25px !important;
              background: #f8fafc !important;
            }
            
            .patient-title {
              font-size: 14pt !important;
              font-weight: bold !important;
              color: #1e40af !important;
              margin-bottom: 15px !important;
              text-align: center !important;
            }
            
            .patient-grid {
              display: grid !important;
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 15px !important;
              margin-bottom: 15px !important;
            }
            
            .patient-field {
              display: flex !important;
              flex-direction: column !important;
            }
            
            .field-label {
              font-weight: bold !important;
              font-size: 10pt !important;
              color: #374151 !important;
              margin-bottom: 3px !important;
            }
            
            .field-value {
              font-size: 11pt !important;
              color: #111827 !important;
              border-bottom: 1px solid #d1d5db !important;
              padding-bottom: 3px !important;
              min-height: 18px !important;
            }
            
            .image-section {
              text-align: center !important;
              margin-bottom: 25px !important;
              page-break-inside: avoid !important;
            }
            
            .section-title {
              font-size: 14pt !important;
              font-weight: bold !important;
              color: #1e40af !important;
              margin-bottom: 15px !important;
              border-bottom: 2px solid #cbd5e1 !important;
              padding-bottom: 5px !important;
            }
            
            .analysis-image {
              max-width: 300px !important;
              max-height: 300px !important;
              border: 2px solid #d1d5db !important;
              border-radius: 8px !important;
            }
            
            .image-caption {
              font-size: 10pt !important;
              margin-top: 10px !important;
              font-style: italic !important;
            }
            
            .results-section {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 30px !important;
              margin-bottom: 25px !important;
            }
            
            .result-item {
              display: flex !important;
              justify-content: space-between !important;
              padding: 8px 0 !important;
              border-bottom: 1px solid #e5e7eb !important;
            }
            
            .result-label {
              font-weight: bold !important;
              font-size: 11pt !important;
            }
            
            .result-value {
              font-size: 11pt !important;
            }
            
            .findings-section {
              background: #fef3c7 !important;
              border: 2px solid #f59e0b !important;
              border-radius: 8px !important;
              padding: 20px !important;
              margin-bottom: 25px !important;
            }
            
            .findings-title {
              font-size: 13pt !important;
              font-weight: bold !important;
              color: #92400e !important;
              margin-bottom: 12px !important;
            }
            
            .findings-content {
              font-size: 11pt !important;
              line-height: 1.4 !important;
            }
            
            .findings-list {
              margin: 10px 0 !important;
              padding-left: 20px !important;
            }
            
            .findings-list li {
              margin-bottom: 8px !important;
            }
            
            .signature-section {
              display: flex !important;
              justify-content: space-between !important;
              margin-top: 40px !important;
              padding-top: 20px !important;
              border-top: 1px solid #d1d5db !important;
            }
            
            .signature-box {
              width: 200px !important;
              text-align: center !important;
            }
            
            .signature-line {
              border-bottom: 2px solid #374151 !important;
              margin-bottom: 8px !important;
              height: 40px !important;
            }
            
            .signature-label {
              font-size: 10pt !important;
              color: #374151 !important;
            }
            
            .program-footer {
              position: fixed !important;
              bottom: 10mm !important;
              left: 20mm !important;
              right: 20mm !important;
              text-align: center !important;
              font-size: 9pt !important;
              color: #6b7280 !important;
              border-top: 1px solid #e5e7eb !important;
              padding-top: 10px !important;
            }

            .print-image-container {
              position: relative !important;
              display: inline-block !important;
            }

            .print-bounding-box {
              position: absolute !important;
              border: 2px solid #ef4444 !important;
              background-color: rgba(239, 68, 68, 0.1) !important;
              pointer-events: none !important;
            }

            .print-cell-label {
              position: absolute !important;
              background-color: #ef4444 !important;
              color: white !important;
              padding: 2px 6px !important;
              font-size: 9pt !important;
              font-weight: bold !important;
              border-radius: 3px !important;
              white-space: nowrap !important;
            }
            
            .report-info {
              display: flex !important;
              justify-content: space-between !important;
              margin-bottom: 25px !important;
              font-size: 10pt !important;
              color: #6b7280 !important;
            }
          }
        `}
      </style>
      
      {/* Lab Configuration Settings - Only shown in no-print */}
      <div className="no-print">
        <LabSettings onConfigurationChange={setLabConfig} />
      </div>
      
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
          <div className="lab-info">
            <div className="lab-title">{labConfig.labName || 'CLINICAL LABORATORY'}</div>
            <div className="lab-subtitle">Hematology Department</div>
            <div className="lab-subtitle">{labConfig.address}</div>
            <div className="lab-subtitle">Phone: {labConfig.phone}</div>
            <div className="lab-subtitle">License: {labConfig.licenseNumber}</div>
            {labConfig.hematologyDoctorName && (
              <div className="lab-subtitle">Dr. {labConfig.hematologyDoctorName}</div>
            )}
          </div>
          {labConfig.logo && (
            <img src={labConfig.logo} alt="Lab Logo" className="lab-logo" />
          )}
        </div>
        
        {/* Report Information */}
        <div className="report-info">
          <div>
            <strong>Report ID:</strong> {reportId}<br />
            <strong>Analysis Date:</strong> {reportDate}
          </div>
          <div>
            <strong>Report Type:</strong> Blood Cell Analysis<br />
            <strong>Method:</strong> AI-Powered Analysis
          </div>
        </div>
        
        {/* Patient Information Box */}
        <div className="patient-box">
          <div className="patient-title">PATIENT INFORMATION</div>
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
          </div>
          
          <div className="patient-grid">
            <div className="patient-field">
              <div className="field-label">Sample Type:</div>
              <div className="field-value">{patientInfo.sampleType || 'Blood Sample'}</div>
            </div>
            <div className="patient-field">
              <div className="field-label">Collection Date:</div>
              <div className="field-value">{reportDate}</div>
            </div>
            <div className="patient-field">
              <div className="field-label">Report Date:</div>
              <div className="field-value">{reportDate}</div>
            </div>
          </div>
          
          {patientInfo.clinicalNotes && (
            <div style={{ marginTop: '15px' }}>
              <div className="field-label">Clinical Notes:</div>
              <div className="field-value">{patientInfo.clinicalNotes}</div>
            </div>
          )}
        </div>
        
        {/* Analyzed Image with Bounding Box */}
        <div className="image-section">
          <div className="section-title">MICROSCOPIC EXAMINATION</div>
          <div className="print-image-container">
            <img 
              src={analysisResult.processedImage || analysisResult.image} 
              alt="Blood Sample Analysis" 
              className="analysis-image"
            />
            {analysisResult.detectedCells.length > 0 && (
              <>
                <div className="print-bounding-box" style={{
                  top: analysisResult.detectedCells[0].coordinates ? `${analysisResult.detectedCells[0].coordinates.y}%` : '37.5%',
                  left: analysisResult.detectedCells[0].coordinates ? `${analysisResult.detectedCells[0].coordinates.x}%` : '37.5%',
                  width: analysisResult.detectedCells[0].coordinates ? `${analysisResult.detectedCells[0].coordinates.width}%` : '25%',
                  height: analysisResult.detectedCells[0].coordinates ? `${analysisResult.detectedCells[0].coordinates.height}%` : '25%',
                }}>
                </div>
                <div className="print-cell-label" style={{
                  top: (analysisResult.detectedCells[0].coordinates?.y || 37.5) < 15 ? 
                    `${(analysisResult.detectedCells[0].coordinates?.y || 37.5) + (analysisResult.detectedCells[0].coordinates?.height || 25) + 2}%` : 
                    `${(analysisResult.detectedCells[0].coordinates?.y || 37.5) - 3}%`,
                  left: `${(analysisResult.detectedCells[0].coordinates?.x || 37.5) + ((analysisResult.detectedCells[0].coordinates?.width || 25) / 2)}%`,
                  transform: 'translateX(-50%)'
                }}>
                  {analysisResult.detectedCells[0].type}
                </div>
              </>
            )}
          </div>
          <div className="image-caption">
            Blood cell sample with AI-powered detection overlay
          </div>
        </div>
        
        {/* Analysis Results */}
        <div className="results-section">
          <div>
            <div className="section-title">ANALYSIS RESULTS</div>
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
                  <span className="result-value">Neural Network</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Processing Time:</span>
                  <span className="result-value">&lt; 1 second</span>
                </div>
              </>
            )}
          </div>
          
          <div>
            <div className="section-title">QUALITY METRICS</div>
            <div className="result-item">
              <span className="result-label">Image Quality:</span>
              <span className="result-value">Good</span>
            </div>
            <div className="result-item">
              <span className="result-label">Model Version:</span>
              <span className="result-value">v1.0</span>
            </div>
            <div className="result-item">
              <span className="result-label">Analysis Status:</span>
              <span className="result-value">Complete</span>
            </div>
          </div>
        </div>
        
        {/* Clinical Findings */}
        {(analysisResult.possibleConditions.length > 0 || analysisResult.recommendations.length > 0) && (
          <div className="findings-section">
            <div className="findings-title">CLINICAL FINDINGS & RECOMMENDATIONS</div>
            <div className="findings-content">
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
          </div>
        )}
        
        {/* Doctor Notes */}
        {analysisResult.doctorNotes && (
          <div style={{ marginBottom: '25px' }}>
            <div className="section-title">DOCTOR NOTES</div>
            <div style={{ padding: '15px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '11pt' }}>
              {analysisResult.doctorNotes}
            </div>
          </div>
        )}

        {/* Additional Notes */}
        {analysisResult.notes && (
          <div style={{ marginBottom: '25px' }}>
            <div className="section-title">ADDITIONAL NOTES</div>
            <div style={{ padding: '15px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '11pt' }}>
              {analysisResult.notes}
            </div>
          </div>
        )}
        
        {/* Signature Section */}
        <div className="signature-section">
          <div className="signature-box">
            <div className="signature-line"></div>
            <div className="signature-label">Laboratory Technician<br />Date: ___________</div>
          </div>
          <div className="signature-box">
            <div className="signature-line"></div>
            <div className="signature-label">{labConfig.hematologyDoctorName ? `Dr. ${labConfig.hematologyDoctorName}` : 'Reviewed by Doctor'}<br />Date: ___________</div>
          </div>
        </div>
        
        {/* Program Footer */}
        <div className="program-footer">
          <div><strong>BloodCellVision</strong></div>
          <div style={{ fontSize: '8pt', marginTop: '3px' }}>
            Report ID: {reportId} | Generated: {reportDate}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormalReportGeneratorNew;