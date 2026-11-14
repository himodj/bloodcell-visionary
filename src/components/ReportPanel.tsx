import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileText, FileDown, FolderOpen, Loader2, Printer } from 'lucide-react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { buildReportHtml } from '../report/buildReportHtml';
import { renderAnnotatedImage, renderCellThumbnails } from '../report/annotate';
import { getLabConfig, getTemplateConfig } from '../report/settings';
import LabSettings from './LabSettings';
import { useReportActions } from '../report/useReportActions';

/** The printable laboratory report: live preview, print, PDF export. */
const ReportPanel: React.FC = () => {
  const { analysisResult, patientInfo, reportMeta, saveNow } = useAnalysis();
  const { busy, print, exportPdf } = useReportActions();
  const [html, setHtml] = useState('');
  const [labVersion, setLabVersion] = useState(0);
  const generation = useRef(0);

  // Rebuild the preview shortly after anything shown in the report changes.
  useEffect(() => {
    if (!analysisResult || !reportMeta) {
      setHtml('');
      return;
    }
    const current = ++generation.current;
    const timer = window.setTimeout(async () => {
      try {
        const [annotatedImage, thumbnails] = await Promise.all([
          renderAnnotatedImage(analysisResult),
          renderCellThumbnails(analysisResult),
        ]);
        if (current !== generation.current) return;
        setHtml(
          buildReportHtml({
            reportId: reportMeta.reportId,
            createdAt: reportMeta.createdAt,
            patientInfo,
            lab: getLabConfig(),
            template: getTemplateConfig(),
            result: analysisResult,
            annotatedImage,
            thumbnails,
          })
        );
      } catch (error) {
        console.error('Report preview failed:', error);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [analysisResult, patientInfo, reportMeta?.reportId, reportMeta?.createdAt, labVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!analysisResult || !reportMeta) return null;

  const lab = getLabConfig();
  const labIncomplete = !lab.labName || !lab.hematologyDoctorName;

  return (
    <Card className="medical-card overflow-hidden">
      <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-medium flex items-center text-medical-dark">
          <FileText size={16} className="text-medical-blue mr-2" />
          Laboratory Report
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void print()} disabled={busy !== null || !html} className="bg-medical-blue text-white hover:opacity-90">
            {busy === 'print' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Printer size={16} className="mr-2" />}
            Print Report (Ctrl+P)
          </Button>
          <Button variant="outline" onClick={() => void exportPdf()} disabled={busy !== null || !html}>
            {busy === 'pdf' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FileDown size={16} className="mr-2" />}
            Save as PDF
          </Button>
          {reportMeta.folderPath && (
            <Button variant="outline" onClick={() => window.electron?.archiveOpenFolder(reportMeta.folderPath)}>
              <FolderOpen size={16} className="mr-2" />
              Report Folder
            </Button>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <Accordion type="single" collapsible defaultValue={labIncomplete ? 'lab' : undefined} className="mb-4">
          <AccordionItem value="lab">
            <AccordionTrigger className="text-sm font-medium">
              Laboratory details on the report{labIncomplete ? ' — please complete' : ''}
            </AccordionTrigger>
            <AccordionContent>
              <LabSettings
                onConfigurationChange={() => {
                  setLabVersion((v) => v + 1);
                  void saveNow();
                }}
              />
              <p className="text-xs text-gray-500">The logo and full details are set under Management. Page size, colours and sections are set under Report Template.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {html ? (
          <iframe
            title="Report preview"
            data-testid="report-preview"
            srcDoc={html}
            sandbox=""
            className="w-full rounded border border-gray-300 bg-gray-200"
            style={{ height: '900px' }}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Preparing the report…
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportPanel;
