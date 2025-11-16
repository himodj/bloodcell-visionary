import React, { useState, useEffect } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { formatReportDate, generateReportId } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';
import LabSettings, { LabConfiguration } from './LabSettings';
import { ReportTemplateConfig } from './ReportTemplateDesigner';

const FormalReportGeneratorNew: React.FC = () => {
  const { 
    analysisResult, 
    patientInfo, 
    currentReportPath,
    setCurrentReportPath, 
    setOriginalReportData 
  } = useAnalysis();
  const [labConfig, setLabConfig] = useState<LabConfiguration>({
    labName: '',
    address: '',
    phone: '',
    hematologyDoctorName: '',
    licenseNumber: '',
    logo: null
  });

  const [templateConfig, setTemplateConfig] = useState<ReportTemplateConfig | null>(null);

  useEffect(() => {
    const savedTemplate = localStorage.getItem('reportTemplateConfig');
    if (savedTemplate) {
      try {
        setTemplateConfig(JSON.parse(savedTemplate));
      } catch (e) {
        console.error('Failed to load template config', e);
      }
    }
  }, []);
  
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

      // Check if this is an existing report or a new one
      if (currentReportPath) {
        // Update existing report
        const result = await window.electron.updateExistingReport(currentReportPath, reportData);
        if (result.success) {
          toast.success('Report updated successfully');
          // Update the current report path if the folder was renamed
          if (result.newFolderPath && result.newFolderPath !== currentReportPath) {
            setCurrentReportPath(result.newFolderPath);
          }
        } else {
          toast.error(`Failed to update report: ${result.error}`);
        }
      } else {
        // Create new report
        const result = await window.electron.saveReport(reportData);
        if (result.success) {
          toast.success(`Report saved to: ${result.filePath}`);
          // Set the current report path for future updates
          setCurrentReportPath(result.filePath);
          setOriginalReportData(reportData);
        } else {
          toast.error(`Failed to save report: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Failed to save report');
    }
  };

  return (
    <div className="mb-8">
      {/* Print-specific styles for professional lab report */}
      <style>
        {`
          @media print {
            /* Hide everything by default */
            body * {
              visibility: hidden !important;
            }
            
            /* Only show the print container and its children */
            .print-container,
            .print-container * {
              visibility: visible !important;
            }
            
            /* Position print container at top of page */
            .print-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            
            @page {
              size: ${templateConfig?.pageSize || 'A4'} ${templateConfig?.orientation || 'portrait'};
              margin: ${templateConfig?.marginTop || 8}mm ${templateConfig?.marginRight || 8}mm ${templateConfig?.marginBottom || 8}mm ${templateConfig?.marginLeft || 8}mm;
            }
            
            html, body {
              width: ${templateConfig?.pageSize === 'Letter' ? '8.5in' : '210mm'};
              height: ${templateConfig?.pageSize === 'Letter' ? '11in' : '297mm'};
              margin: 0;
              padding: 0;
              background: white !important;
              color: ${templateConfig?.textColor || '#000'} !important;
              font-family: '${templateConfig?.fontFamily || 'Times New Roman'}', serif !important;
              font-size: ${templateConfig?.baseFontSize || 10}pt !important;
              line-height: 1.2 !important;
            }
            
            .no-print {
              display: none !important;
            }
            
            .print-container {
              width: 100% !important;
              height: auto !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              page-break-after: avoid !important;
              display: flex !important;
              flex-direction: column !important;
            }
            
            /* Professional Lab Header */
            .lab-header {
              display: flex !important;
              justify-content: space-between !important;
              align-items: flex-start !important;
              border-bottom: ${templateConfig?.borderWidth || 2}px ${templateConfig?.borderStyle || 'solid'} ${templateConfig?.primaryColor || '#2563eb'} !important;
              padding-bottom: ${templateConfig?.sectionGap || 3}mm !important;
              margin-bottom: ${templateConfig?.sectionGap || 3}mm !important;
              page-break-inside: avoid !important;
            }
            
            .lab-info {
              flex: 1 !important;
            }
            
            .lab-title {
              font-size: ${templateConfig?.headerFontSize || 16}pt !important;
              font-weight: bold !important;
              color: ${templateConfig?.secondaryColor || '#1e40af'} !important;
              margin: 0 0 2mm 0 !important;
              letter-spacing: 0.5px !important;
              text-transform: uppercase !important;
            }
            
            .lab-subtitle {
              font-size: ${(templateConfig?.baseFontSize || 10) - 1}pt !important;
              color: #374151 !important;
              margin: 0 0 1mm 0 !important;
              line-height: 1.4 !important;
            }
            
            .lab-logo {
              height: 25mm !important;
              max-width: 30mm !important;
              object-fit: contain !important;
              margin-left: 5mm !important;
              display: ${templateConfig?.showLogo === false ? 'none' : 'block'} !important;
            }
            
            /* Report Info Banner */
            .report-info {
              background: #f1f5f9 !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 2mm !important;
              padding: 2mm 3mm !important;
              margin-bottom: ${templateConfig?.sectionGap || 3}mm !important;
              display: ${templateConfig?.showReportInfo === false ? 'none' : 'grid'} !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 3mm !important;
              font-size: ${(templateConfig?.baseFontSize || 10) - 1}pt !important;
              page-break-inside: avoid !important;
            }
            
            .report-info strong {
              color: ${templateConfig?.secondaryColor || '#1e40af'} !important;
              font-weight: 600 !important;
            }
            
            /* Patient Information Box */
            .patient-box {
              border: ${templateConfig?.borderWidth || 2}px ${templateConfig?.borderStyle || 'solid'} ${templateConfig?.primaryColor || '#2563eb'} !important;
              background: #fafafa !important;
              padding: ${templateConfig?.sectionGap || 3}mm !important;
              margin-bottom: ${templateConfig?.sectionGap || 3}mm !important;
              page-break-inside: avoid !important;
              display: ${templateConfig?.showPatientBox === false ? 'none' : 'block'} !important;
            }
            
            .patient-title {
              font-size: ${(templateConfig?.baseFontSize || 10) + 1}pt !important;
              font-weight: bold !important;
              color: ${templateConfig?.secondaryColor || '#1e40af'} !important;
              text-align: center !important;
              margin: 0 0 2mm 0 !important;
              padding-bottom: 1mm !important;
              border-bottom: 1px solid #cbd5e1 !important;
            }
            
            .patient-grid {
              display: grid !important;
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 2mm !important;
              margin-top: 2mm !important;
            }
            
            .patient-field {
              display: flex !important;
              flex-direction: column !important;
            }
            
            .field-label {
              font-weight: 600 !important;
              font-size: ${(templateConfig?.baseFontSize || 10) - 1.5}pt !important;
              color: #475569 !important;
              margin-bottom: 0.5mm !important;
            }
            
            .field-value {
              font-size: ${(templateConfig?.baseFontSize || 10) - 0.5}pt !important;
              color: ${templateConfig?.textColor || '#000'} !important;
              border-bottom: 1px solid #cbd5e1 !important;
              padding-bottom: 1mm !important;
              min-height: 5mm !important;
              word-wrap: break-word !important;
            }
            
            /* Analysis Section */
            .results-section {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 3mm !important;
              margin-bottom: 3mm !important;
              page-break-inside: avoid !important;
            }
            
            .section-title {
              font-size: ${templateConfig?.baseFontSize || 10}pt !important;
              font-weight: bold !important;
              color: ${templateConfig?.secondaryColor || '#1e40af'} !important;
              border-bottom: ${templateConfig?.borderWidth || 2}px ${templateConfig?.borderStyle || 'solid'} ${templateConfig?.primaryColor || '#2563eb'} !important;
              padding-bottom: 1mm !important;
              margin-bottom: 2mm !important;
              text-transform: uppercase !important;
              letter-spacing: 0.3px !important;
            }
            
            .result-item {
              display: flex !important;
              justify-content: space-between !important;
              padding: 1.5mm 0 !important;
              border-bottom: 1px dotted #d1d5db !important;
              font-size: 9pt !important;
            }
            
            .result-label {
              font-weight: 600 !important;
              color: #475569 !important;
            }
            
            .result-value {
              color: #000 !important;
              font-weight: 500 !important;
            }
            
            /* Image Section - Compact */
            .image-section {
              text-align: center !important;
              margin-bottom: ${templateConfig?.sectionGap || 3}mm !important;
              page-break-inside: avoid !important;
              display: ${templateConfig?.showImage === false ? 'none' : 'block'} !important;
            }
            
            .print-image-container {
              position: relative !important;
              display: inline-block !important;
              max-width: 50mm !important;
              margin: 0 auto !important;
            }
            
            .analysis-image {
              max-width: 50mm !important;
              max-height: 50mm !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 1mm !important;
            }
            
            .image-caption {
              font-size: 7.5pt !important;
              margin-top: 1mm !important;
              font-style: italic !important;
              color: #64748b !important;
            }
            
            /* Hide bounding boxes in print */
            .print-bounding-box {
              display: none !important;
            }
            
            .print-cell-label {
              display: none !important;
            }
            
            /* Clinical Findings */
            .findings-section {
              background: #fef9c3 !important;
              border: 1px solid #eab308 !important;
              border-left: 3px solid #ca8a04 !important;
              padding: 2mm 3mm !important;
              margin-bottom: ${templateConfig?.sectionGap || 3}mm !important;
              page-break-inside: avoid !important;
              display: ${templateConfig?.showClinicalFindings === false ? 'none' : 'block'} !important;
            }
            
            .findings-title {
              font-size: 9.5pt !important;
              font-weight: bold !important;
              color: #92400e !important;
              margin: 0 0 1.5mm 0 !important;
            }
            
            .findings-content {
              font-size: 8.5pt !important;
              line-height: 1.4 !important;
              color: #000 !important;
            }
            
            .findings-list {
              margin: 1mm 0 !important;
              padding-left: 5mm !important;
              list-style-type: disc !important;
            }
            
            .findings-list li {
              margin-bottom: 1mm !important;
            }
            
            /* Notes Sections */
            .notes-section {
              margin-bottom: ${templateConfig?.sectionGap || 3}mm !important;
              page-break-inside: avoid !important;
              display: ${templateConfig?.showDoctorNotes === false ? 'none' : 'block'} !important;
            }
            
            .notes-content {
              padding: 2mm !important;
              border: 1px solid #cbd5e1 !important;
              background: #f8fafc !important;
              border-radius: 1mm !important;
              font-size: 8.5pt !important;
              line-height: 1.4 !important;
              color: #000 !important;
            }
            
            /* Signature Section */
            .signature-section {
              display: ${templateConfig?.showSignatures === false ? 'none' : 'flex'} !important;
              justify-content: space-around !important;
              margin-top: 5mm !important;
              padding-top: 3mm !important;
              border-top: 1px solid #cbd5e1 !important;
              page-break-inside: avoid !important;
            }
            
            .signature-box {
              width: 35mm !important;
              text-align: center !important;
            }
            
            .signature-line {
              border-bottom: 1px solid #000 !important;
              margin-bottom: 1mm !important;
              height: 10mm !important;
            }
            
            .signature-label {
              font-size: 8pt !important;
              color: #374151 !important;
              line-height: 1.3 !important;
              font-weight: 500 !important;
            }
            
            /* Footer */
            .program-footer {
              position: fixed !important;
              bottom: 5mm !important;
              left: 10mm !important;
              right: 10mm !important;
              text-align: center !important;
              font-size: 7.5pt !important;
              color: #64748b !important;
              border-top: 1px solid #e2e8f0 !important;
              padding-top: 1.5mm !important;
            }
            
            /* Text Selection and Copyability */
            * {
              user-select: text !important;
              -webkit-user-select: text !important;
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
          <div className="notes-section">
            <div className="section-title">DOCTOR NOTES</div>
            <div className="notes-content">
              {analysisResult.doctorNotes}
            </div>
          </div>
        )}

        {/* Additional Notes */}
        {analysisResult.notes && (
          <div className="notes-section">
            <div className="section-title">ADDITIONAL NOTES</div>
            <div className="notes-content">
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
        <div className="program-footer" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div><strong>BloodCellVision</strong> - AI-Powered Blood Cell Analysis System</div>
            <div style={{ fontSize: '7pt', marginTop: '2mm' }}>
              Report ID: {reportId} | Generated: {reportDate}
            </div>
            <div style={{ fontSize: '7pt', marginTop: '1mm', color: '#94a3b8' }}>
              © BloodCellVision License - This report is generated by licensed BloodCellVision software
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormalReportGeneratorNew;