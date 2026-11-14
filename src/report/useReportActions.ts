// Save / Print / PDF for the open analysis. Shared by the buttons at the top of the
// results page, the report panel, the File menu and the keyboard shortcuts.
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAnalysis } from '../contexts/AnalysisContext';
import { getLabConfig, getTemplateConfig } from './settings';

export type ReportBusy = 'save' | 'print' | 'pdf' | null;

export function useReportActions() {
  const { analysisResult, reportMeta, patientInfo, saveNow } = useAnalysis();
  const [busy, setBusy] = useState<ReportBusy>(null);
  const available = !!analysisResult && !!reportMeta && !!window.electron;

  const save = useCallback(async () => {
    if (!available || busy) return;
    setBusy('save');
    try {
      const html = await saveNow();
      if (html) toast.success(`Report ${reportMeta!.reportId} saved`);
      else toast.error('The report could not be saved');
    } finally {
      setBusy(null);
    }
  }, [available, busy, saveNow, reportMeta]);

  const exportPdf = useCallback(
    async (quiet = false): Promise<boolean> => {
      if (!available || (busy && !quiet)) return false;
      if (!quiet) setBusy('pdf');
      try {
        const html = await saveNow();
        if (!html) throw new Error('The report could not be prepared.');
        const result = await window.electron!.exportReportPdf({
          html,
          folderPath: reportMeta!.folderPath || undefined,
          fileName: `Report ${reportMeta!.reportId}${patientInfo.name ? ` ${patientInfo.name}` : ''}`,
          footerText: `${getLabConfig().labName || 'BloodCellVision'} · Report ${reportMeta!.reportId}`,
        });
        if (result.success) {
          if (!quiet) toast.success('PDF saved in the report folder and opened');
          return true;
        }
        if (!result.canceled) toast.error(`PDF export failed: ${result.error}`);
        return false;
      } catch (error) {
        toast.error(`PDF export failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      } finally {
        if (!quiet) setBusy(null);
      }
    },
    [available, busy, saveNow, reportMeta, patientInfo.name]
  );

  const print = useCallback(async () => {
    if (!available || busy) return;
    setBusy('print');
    try {
      // file the latest edits first, then print exactly what was filed
      const html = await saveNow();
      if (!html) throw new Error('The report could not be prepared.');
      const template = getTemplateConfig();
      const result = await window.electron!.printReport({
        html,
        pageSize: template.pageSize,
        landscape: template.orientation === 'landscape',
      });
      if (result.success) {
        toast.success('Report sent to the printer');
      } else if (!result.canceled) {
        // the printer or its driver refused the job: hand over a PDF that can be printed from any viewer
        const opened = await exportPdf(true);
        toast.error(
          opened
            ? `The printer did not accept the job (${result.error}). The report was opened as a PDF instead; print it from there.`
            : `Printing failed: ${result.error}`
        );
      }
    } catch (error) {
      toast.error(`Printing failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  }, [available, busy, saveNow, exportPdf]);

  return { available, busy, save, print, exportPdf: () => exportPdf(false) };
}
