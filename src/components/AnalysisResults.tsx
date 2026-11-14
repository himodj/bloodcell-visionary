import React, { useEffect, useState } from 'react';
import { useAnalysis, type CellType } from '../contexts/AnalysisContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Circle, AlertTriangle, Edit3, Save, X, Check, FolderOpen, Trash2, Loader2, Archive, Printer, FileDown } from 'lucide-react';
import { CELL_TYPES, getCellTypeColor, LOW_CONFIDENCE_THRESHOLD } from '../utils/analysisUtils';
import { toast } from 'sonner';
import ImageWithDetection from './ImageWithDetection';
import DoctorNotes from './DoctorNotes';
import PatientInfoForm from './PatientInfoForm';
import { useReportActions } from '../report/useReportActions';

const AnalysisResults: React.FC = () => {
  const {
    analysisResult,
    patientInfo,
    reportMeta,
    saveState,
    saveError,
    updatePatientInfo,
    updateRecommendations,
    updatePossibleConditions,
    updateCellType,
    updateCellSubtype,
    removeCell,
    saveNow,
  } = useAnalysis();
  const [editingRecommendations, setEditingRecommendations] = useState(false);
  const [editingConditions, setEditingConditions] = useState(false);
  const [tempRecommendations, setTempRecommendations] = useState('');
  const [tempConditions, setTempConditions] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const actions = useReportActions();

  const cells = analysisResult?.detectedCells ?? [];
  useEffect(() => {
    if (cells.length > 0 && !cells.some((c) => c.id === selectedId)) setSelectedId(cells[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult]);

  if (!analysisResult) return null;

  const many = cells.length > 1;
  const selected = cells.find((c) => c.id === selectedId) ?? cells[0];
  const selectedIndex = selected ? cells.indexOf(selected) : -1;
  const counts = CELL_TYPES.map((type) => ({ type, count: cells.filter((c) => c.type === type).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const lowConfidence = cells.filter((c) => !c.edited && c.confidence < LOW_CONFIDENCE_THRESHOLD);
  const probabilities = selected?.probabilities ?? (cells.length === 1 ? analysisResult.probabilities : undefined);

  const saveList = (text: string, apply: (items: string[]) => void, done: () => void, message: string) => {
    apply(text.split('\n').map((line) => line.trim()).filter(Boolean));
    done();
    toast.success(message);
  };

  const editButtons = (editing: boolean, onEdit: () => void, onSave: () => void, onCancel: () => void) =>
    !editing ? (
      <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs">
        <Edit3 size={14} className="mr-1" />
        Edit
      </Button>
    ) : (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onSave} className="text-xs text-green-600">
          <Save size={14} className="mr-1" />
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs text-red-600">
          <X size={14} className="mr-1" />
          Cancel
        </Button>
      </div>
    );

  const cardHeader = (title: string, right?: React.ReactNode) => (
    <div className="p-4 bg-medical-blue bg-opacity-5 border-b border-medical-blue border-opacity-10 flex items-center justify-between">
      <h3 className="font-display font-medium flex items-center text-medical-dark">
        <Circle size={16} className="text-medical-blue mr-2" />
        {title}
      </h3>
      {right}
    </div>
  );

  return (
    <div className="animate-slide-up">
      {/* archive status: every analysis is filed automatically and every edit is saved */}
      <div
        data-save-state={saveState}
        className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
          saveState === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-medical-blue border-opacity-20 bg-white text-medical-dark'
        }`}
      >
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-medical-blue" />
          <span className="font-semibold">Report {reportMeta?.reportId ?? '—'}</span>
          <span className="text-opacity-70 text-medical-dark">· analysed {new Date(analysisResult.analysisDate).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-3">
          {saveState === 'saving' && (
            <span className="flex items-center text-gray-500"><Loader2 size={14} className="mr-1 animate-spin" />Saving…</span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center text-green-700">
              <Check size={14} className="mr-1" />
              Saved to archive{reportMeta?.updatedAt ? ` at ${new Date(reportMeta.updatedAt).toLocaleTimeString()}` : ''}
            </span>
          )}
          {saveState === 'error' && (
            <span className="flex items-center">
              <AlertTriangle size={14} className="mr-1" />
              Not saved: {saveError}
              <Button variant="outline" size="sm" className="ml-2 h-7" onClick={() => void saveNow()}>Retry</Button>
            </span>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-gray-100 pt-3" data-testid="top-actions">
          <Button size="sm" className="h-9 bg-medical-blue text-white hover:opacity-90" disabled={actions.busy !== null} onClick={() => void actions.print()}>
            {actions.busy === 'print' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Printer size={15} className="mr-2" />}
            Print Report
            <span className="ml-2 rounded bg-white bg-opacity-20 px-1 text-[10px]">Ctrl+P</span>
          </Button>
          <Button variant="outline" size="sm" className="h-9" disabled={actions.busy !== null} onClick={() => void actions.exportPdf()}>
            {actions.busy === 'pdf' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <FileDown size={15} className="mr-2" />}
            Save as PDF
          </Button>
          <Button variant="outline" size="sm" className="h-9" disabled={actions.busy !== null} onClick={() => void actions.save()}>
            {actions.busy === 'save' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Save size={15} className="mr-2" />}
            Save Report
          </Button>
          {reportMeta?.folderPath && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => window.electron?.archiveOpenFolder(reportMeta.folderPath)}>
              <FolderOpen size={15} className="mr-2" />
              Open Folder
            </Button>
          )}
          <span className="ml-auto text-xs text-gray-500">Changes are saved automatically</span>
        </div>
      </div>

      <PatientInfoForm patientInfo={patientInfo} onPatientInfoChange={updatePatientInfo} />

      <ImageWithDetection
        imageUrl={analysisResult.image}
        detectedCells={cells}
        title={many ? 'Blood Film with Detected Cells' : 'Blood Sample with Detection'}
        selectedCellId={selected?.id ?? null}
        onSelectCell={setSelectedId}
      />

      {analysisResult.note && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{analysisResult.note}</span>
        </div>
      )}

      {lowConfidence.length > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {many
              ? `Low confidence for cell${lowConfidence.length > 1 ? 's' : ''} ${lowConfidence.map((c) => cells.indexOf(c) + 1).join(', ')}. `
              : `Low confidence (${(lowConfidence[0].confidence * 100).toFixed(1)}%). `}
            The cell may be unusual, overlapping another cell or out of focus. Please review manually.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="medical-card overflow-hidden">
          {cardHeader(many ? `Differential of ${cells.length} Cells` : 'Blood Cell Analysis')}
          <CardContent className="p-4">
            {cells.length === 0 ? (
              <p className="text-sm text-gray-600">No cells remain in this analysis.</p>
            ) : (
              <table className="w-full text-sm" data-testid="differential">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 font-medium">Cell type</th>
                    <th className="pb-2 font-medium text-right">Count</th>
                    <th className="pb-2 font-medium text-right">%</th>
                    <th className="pb-2 w-1/3"></th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((row) => (
                    <tr key={row.type} className="border-t border-gray-100">
                      <td className="py-1.5">
                        <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ backgroundColor: getCellTypeColor(row.type) }} />
                        {row.type}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{row.count}</td>
                      <td className="py-1.5 text-right tabular-nums">{((row.count / cells.length) * 100).toFixed(1)}%</td>
                      <td className="py-1.5 pl-3">
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(row.count / cells.length) * 100}%`, backgroundColor: getCellTypeColor(row.type) }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {many && (
              <p className="mt-3 text-xs text-gray-500">
                Counts cover the white cells found in this one field. A clinical differential needs at least 100 cells.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="medical-card overflow-hidden">
          {cardHeader(
            many && selected ? `Cell ${selectedIndex + 1}: Model Probabilities` : 'Model Probabilities',
            typeof analysisResult.inferenceMs === 'number' ? (
              <span className="text-xs text-medical-dark text-opacity-60">Analysed in {Math.round(analysisResult.inferenceMs)} ms</span>
            ) : undefined
          )}
          <CardContent className="p-4 space-y-2">
            {selected && (
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${getCellTypeColor(selected.type)}20`, border: `2px solid ${getCellTypeColor(selected.type)}` }}
                >
                  <div className="w-9 h-9 rounded-full" style={{ backgroundColor: getCellTypeColor(selected.type) }} />
                </div>
                <div>
                  <div className="text-lg font-semibold text-medical-dark">{selected.type}</div>
                  <div className="text-sm text-medical-dark text-opacity-70">
                    {selected.edited
                      ? `Set by reviewer (model: ${selected.aiType}, ${(selected.confidence * 100).toFixed(1)}%)`
                      : `Confidence: ${(selected.confidence * 100).toFixed(1)}%`}
                  </div>
                </div>
              </div>
            )}
            {probabilities && probabilities.length > 0 ? (
              [...probabilities]
                .sort((a, b) => b.probability - a.probability)
                .map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <span className="w-44 shrink-0 text-medical-dark">{item.label}</span>
                    <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(item.probability * 100, 0.5)}%`, backgroundColor: getCellTypeColor(item.label as CellType) }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right tabular-nums text-medical-dark text-opacity-80">
                      {(item.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                ))
            ) : (
              <p className="text-sm text-gray-500">Per-class probabilities were not stored for this report.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {cells.length > 0 && (
        <Card className="medical-card overflow-hidden mb-6">
          {cardHeader(many ? 'Cell-by-Cell Results' : 'Classified Cell', <span className="text-xs text-medical-dark text-opacity-60">Change a type to correct the model; edits are saved to the report</span>)}
          <CardContent className="p-0">
            <table className="w-full text-sm" data-testid="cell-table">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                  <th className="px-4 py-2 font-medium w-12">#</th>
                  <th className="px-2 py-2 font-medium">Cell type</th>
                  <th className="px-2 py-2 font-medium">Subtype / remark</th>
                  <th className="px-2 py-2 font-medium text-right">Confidence</th>
                  <th className="px-4 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {cells.map((cell, index) => (
                  <tr
                    key={cell.id}
                    data-cell-row={cell.id}
                    onClick={() => setSelectedId(cell.id)}
                    className={`border-t border-gray-100 cursor-pointer ${selected?.id === cell.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-1.5">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-semibold text-white" style={{ backgroundColor: getCellTypeColor(cell.type) }}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Select value={cell.type} onValueChange={(value) => updateCellType(cell.id, value as CellType)}>
                        <SelectTrigger className="h-8 w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CELL_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Input
                        className="h-8"
                        defaultValue={cell.subtype || ''}
                        key={`${cell.id}-${cell.subtype || ''}`}
                        placeholder="optional"
                        onBlur={(e) => {
                          if (e.target.value !== (cell.subtype || '')) updateCellSubtype(cell.id, e.target.value);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {cell.edited ? (
                        <span className="text-blue-700" title={`Model: ${cell.aiType} ${(cell.confidence * 100).toFixed(1)}%`}>reviewed</span>
                      ) : (
                        <span className={cell.confidence < LOW_CONFIDENCE_THRESHOLD ? 'text-amber-700 font-medium' : ''}>
                          {(cell.confidence * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {many && (
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-600"
                          title="Remove this box (not a cell)"
                          onClick={() => removeCell(cell.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {cells.length > 0 && (
        <Card className="medical-card overflow-hidden mb-6 border-l-4" style={{ borderLeftColor: analysisResult.abnormalityRate > 0 ? '#FF9500' : '#34C759' }}>
          {cardHeader(
            'Possible Conditions',
            editButtons(
              editingConditions,
              () => { setTempConditions(analysisResult.possibleConditions.join('\n')); setEditingConditions(true); },
              () => saveList(tempConditions, updatePossibleConditions, () => setEditingConditions(false), 'Possible conditions updated'),
              () => setEditingConditions(false)
            )
          )}
          <CardContent className="p-4">
            {editingConditions ? (
              <Textarea value={tempConditions} onChange={(e) => setTempConditions(e.target.value)} placeholder="Enter possible conditions (one per line)..." rows={4} />
            ) : analysisResult.possibleConditions.length > 0 ? (
              <ul className="list-disc pl-6 space-y-2">
                {analysisResult.possibleConditions.map((condition, index) => (
                  <li key={index} className="text-medical-dark" dir="auto">{condition}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">None listed.</p>
            )}
          </CardContent>
        </Card>
      )}

      {cells.length > 0 && (
        <Card className="medical-card overflow-hidden mb-6">
          {cardHeader(
            'Recommendations',
            editButtons(
              editingRecommendations,
              () => { setTempRecommendations(analysisResult.recommendations.join('\n')); setEditingRecommendations(true); },
              () => saveList(tempRecommendations, updateRecommendations, () => setEditingRecommendations(false), 'Recommendations updated'),
              () => setEditingRecommendations(false)
            )
          )}
          <CardContent className="p-4">
            {editingRecommendations ? (
              <Textarea value={tempRecommendations} onChange={(e) => setTempRecommendations(e.target.value)} placeholder="Enter recommendations (one per line)..." rows={4} />
            ) : (
              <ul className="list-disc pl-6 space-y-2">
                {analysisResult.recommendations.map((recommendation, index) => (
                  <li key={index} className="text-medical-dark" dir="auto">{recommendation}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <DoctorNotes />
    </div>
  );
};

export default AnalysisResults;
