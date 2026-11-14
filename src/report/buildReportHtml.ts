// Builds the printable laboratory report as one self-contained HTML document.
// The same document is used for the on-screen preview, for printing / PDF export and for
// the Report.html file kept in the archive, so all three always look identical.
import type { AnalysisResult, PatientInfo } from '../contexts/AnalysisContext';
import type { LabConfiguration } from '../components/LabSettings';
import type { ReportTemplateConfig } from '../components/ReportTemplateDesigner';
import { CELL_TYPES, getCellTypeColor, LOW_CONFIDENCE_THRESHOLD } from '../utils/analysisUtils';

export interface ReportInput {
  reportId: string;
  createdAt: string;
  patientInfo: PatientInfo;
  lab: LabConfiguration;
  template: ReportTemplateConfig;
  result: AnalysisResult;
  /** microscope image with labelled boxes (data URL) */
  annotatedImage: string;
  /** one thumbnail per cell (data URLs) */
  thumbnails: string[];
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

function safeFont(value: string | undefined): string {
  const clean = (value || 'Times New Roman').replace(/[^a-zA-Z0-9 ,'-]/g, '');
  return `'${clean.replace(/'/g, '')}', 'Segoe UI', Tahoma, Arial, sans-serif`;
}

function fmtDate(value: string | Date | undefined, withTime = true): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return withTime ? `${date}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : date;
}

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const field = (label: string, value: string) =>
  `<div class="field"><div class="field-label">${esc(label)}</div><div class="field-value" dir="auto">${value ? esc(value) : '&mdash;'}</div></div>`;

export function buildReportHtml(input: ReportInput): string {
  const { reportId, patientInfo, lab, template: t, result } = input;
  const cells = result.detectedCells || [];
  const multi = cells.length > 1;
  const primary = safeColor(t.primaryColor, '#2563eb');
  const secondary = safeColor(t.secondaryColor, '#1e40af');
  const accent = safeColor(t.accentColor, '#3b82f6');
  const text = safeColor(t.textColor, '#000000');
  const base = Math.min(14, Math.max(8, Number(t.baseFontSize) || 10));
  const head = Math.min(26, Math.max(12, Number(t.headerFontSize) || 16));
  const gap = Math.min(10, Math.max(1, Number(t.sectionGap) || 3));
  const bw = Math.min(4, Math.max(1, Number(t.borderWidth) || 2));
  const bs = ['solid', 'double', 'dashed'].includes(t.borderStyle) ? t.borderStyle : 'solid';
  const mm = (v: number, d: number) => Math.min(30, Math.max(5, Number(v) || d));
  const margins = `${mm(t.marginTop, 10)}mm ${mm(t.marginRight, 10)}mm ${mm(t.marginBottom, 10) + 6}mm ${mm(t.marginLeft, 10)}mm`;
  const pageSize = t.pageSize === 'Letter' ? 'Letter' : 'A4';
  const orientation = t.orientation === 'landscape' ? 'landscape' : 'portrait';
  const pageWidth = pageSize === 'A4' ? (orientation === 'portrait' ? 210 : 297) : orientation === 'portrait' ? 216 : 279;

  // ---- differential count
  const counts = CELL_TYPES.map((type) => ({ type, count: cells.filter((c) => c.type === type).length })).filter((r) => r.count > 0);
  counts.sort((a, b) => b.count - a.count);
  const total = cells.length;
  const lowConfidence = cells.filter((c) => c.confidence < LOW_CONFIDENCE_THRESHOLD && !c.edited);
  const reviewed = cells.filter((c) => c.edited);
  const doctor = (lab.hematologyDoctorName || '').trim();
  const doctorLabel = doctor ? (/^dr\.?\s/i.test(doctor) ? doctor : `Dr. ${doctor}`) : '';

  const headerHtml = `
  <header class="lab-header">
    ${t.showLogo && lab.logo ? `<img class="lab-logo" src="${esc(lab.logo)}" alt="">` : ''}
    <div class="lab-id">
      <div class="lab-name" dir="auto">${esc(lab.labName || 'Clinical Laboratory')}</div>
      <div class="lab-dept">Hematology Department</div>
    </div>
    <div class="lab-contact">
      ${lab.address ? `<div dir="auto">${esc(lab.address)}</div>` : ''}
      ${lab.phone ? `<div>Tel: <span dir="ltr">${esc(lab.phone)}</span></div>` : ''}
      ${lab.licenseNumber ? `<div>License No: ${esc(lab.licenseNumber)}</div>` : ''}
      ${doctorLabel ? `<div dir="auto">${esc(doctorLabel)}</div>` : ''}
    </div>
  </header>`;

  const titleHtml = `
  <div class="title-bar">
    <div class="title">Peripheral Blood Cell Analysis Report</div>
    ${t.showReportInfo ? `<div class="title-meta">
      <span><b>Report No:</b> ${esc(reportId)}</span>
      <span><b>Analysis date:</b> ${esc(fmtDate(result.analysisDate))}</span>
      <span><b>Printed:</b> ${esc(fmtDate(new Date(), false))}</span>
    </div>` : ''}
  </div>`;

  const patientHtml = t.showPatientBox ? `
  <section class="block patient">
    <h2>Patient Information</h2>
    <div class="fields">
      ${field('Patient name', patientInfo.name)}
      ${field('Patient ID', patientInfo.patientId || '')}
      ${field('Age', patientInfo.age)}
      ${field('Gender', patientInfo.gender)}
      ${field('Sample type', patientInfo.sampleType || 'Blood Sample')}
      ${field('Referring doctor', patientInfo.referringDoctor || '')}
      ${field('Sample analysed', fmtDate(result.analysisDate))}
      ${field('Report No', reportId)}
    </div>
    ${patientInfo.clinicalNotes ? `<div class="clinical"><span class="field-label">Clinical notes</span><div dir="auto" class="pre">${esc(patientInfo.clinicalNotes)}</div></div>` : ''}
  </section>` : '';

  // ---- result panel next to the image
  let resultPanel = '';
  if (multi) {
    resultPanel = `
      <table class="diff">
        <thead><tr><th>Cell type</th><th class="num">Count</th><th class="num">%</th><th class="barcol"></th></tr></thead>
        <tbody>
          ${counts.map((r) => `<tr>
            <td><span class="dot" style="background:${getCellTypeColor(r.type)}"></span>${esc(r.type)}</td>
            <td class="num">${r.count}</td>
            <td class="num">${pct(r.count / total)}</td>
            <td class="barcol"><div class="bar"><div style="width:${((r.count / total) * 100).toFixed(1)}%;background:${getCellTypeColor(r.type)}"></div></div></td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td>Total cells classified</td><td class="num">${total}</td><td class="num">100%</td><td></td></tr></tfoot>
      </table>
      <p class="small muted">Differential of the white cells located in this field. A clinical differential count requires at least 100 cells.</p>`;
  } else if (cells.length === 1) {
    const cell = cells[0];
    const probs = [...(cell.probabilities || result.probabilities || [])].sort((a, b) => b.probability - a.probability).slice(0, 4);
    resultPanel = `
      <div class="result-card">
        <div class="result-label">Identified cell type</div>
        <div class="result-type"><span class="dot big" style="background:${getCellTypeColor(cell.type)}"></span>${esc(cell.type)}</div>
        ${cell.subtype ? `<div class="small" dir="auto">Subtype: ${esc(cell.subtype)}</div>` : ''}
        <div class="result-conf">${cell.edited ? 'Classified by reviewer' : `Model confidence: <b>${pct(cell.confidence)}</b>`}</div>
        ${cell.edited && cell.aiType && cell.aiType !== cell.type ? `<div class="small muted">Model suggestion: ${esc(cell.aiType)} (${pct(cell.confidence)})</div>` : ''}
      </div>
      ${probs.length ? `<table class="diff probs">
        <thead><tr><th>Model probabilities</th><th class="num">%</th><th class="barcol"></th></tr></thead>
        <tbody>${probs.map((p) => `<tr>
          <td><span class="dot" style="background:${getCellTypeColor(p.label as never)}"></span>${esc(p.label)}</td>
          <td class="num">${pct(p.probability)}</td>
          <td class="barcol"><div class="bar"><div style="width:${Math.max(p.probability * 100, 0.5).toFixed(1)}%;background:${getCellTypeColor(p.label as never)}"></div></div></td>
        </tr>`).join('')}</tbody>
      </table>` : ''}`;
  } else {
    resultPanel = '<p>No cell was identified in this image.</p>';
  }

  const imageHtml = t.showImage ? `
  <section class="block">
    <h2>Microscopic Examination</h2>
    <div class="exam">
      <figure class="exam-image">
        <img src="${esc(input.annotatedImage)}" alt="Blood film image">
        <figcaption>${multi ? `Blood film field with ${total} classified cells (numbers refer to the table below)` : 'Blood film image with the classified cell marked'}</figcaption>
      </figure>
      <div class="exam-result">${resultPanel}</div>
    </div>
  </section>` : `<section class="block"><h2>Results</h2>${resultPanel}</section>`;

  const cellGridHtml = multi ? `
  <section class="block flow">
    <h2>Cell-by-Cell Results</h2>
    <div class="cells">
      ${cells.map((cell, i) => `<div class="cell">
        ${input.thumbnails[i] ? `<img src="${esc(input.thumbnails[i])}" alt="">` : '<div class="noimg"></div>'}
        <div class="cell-no" style="background:${getCellTypeColor(cell.type)}">${i + 1}</div>
        <div class="cell-type">${esc(cell.type)}</div>
        <div class="cell-conf">${cell.edited ? 'reviewed' : pct(cell.confidence)}${!cell.edited && cell.confidence < LOW_CONFIDENCE_THRESHOLD ? ' &#9888;' : ''}</div>
      </div>`).join('')}
    </div>
    ${lowConfidence.length ? `<p class="small muted">&#9888; Low model confidence (below ${Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}%) for cell${lowConfidence.length > 1 ? 's' : ''} ${cells.map((c, i) => (lowConfidence.includes(c) ? i + 1 : 0)).filter(Boolean).join(', ')}: manual review advised.</p>` : ''}
    ${reviewed.length ? `<p class="small muted">"reviewed" = cell type set by the reviewer.</p>` : ''}
  </section>` : (lowConfidence.length ? `<p class="small muted warn">&#9888; Low model confidence: manual review of this cell is advised.</p>` : '');

  const list = (items: string[]) => `<ul>${items.map((i) => `<li dir="auto">${esc(i)}</li>`).join('')}</ul>`;
  const findingsHtml = t.showClinicalFindings && ((result.possibleConditions || []).length || (result.recommendations || []).length) ? `
  <section class="block findings">
    <h2>Interpretation &amp; Recommendations</h2>
    <div class="two">
      ${(result.possibleConditions || []).length ? `<div class="box"><h3>Possible associated conditions</h3>${list(result.possibleConditions)}<p class="small muted">For clinical correlation; not a diagnosis.</p></div>` : ''}
      ${(result.recommendations || []).length ? `<div class="box"><h3>Recommendations</h3>${list(result.recommendations)}</div>` : ''}
    </div>
  </section>` : '';

  const notesHtml = t.showDoctorNotes && (result.doctorNotes || '').trim() ? `
  <section class="block">
    <h2>Doctor's Notes</h2>
    <div class="box pre" dir="auto">${esc(result.doctorNotes)}</div>
  </section>` : '';

  const model = result.modelInfo;
  const methodHtml = `
  <section class="block method">
    <h2>Method</h2>
    <p class="small">Digital image of a stained peripheral blood film, classified by a deep-learning model${model ? ` (${esc(model.name)}${model.version ? ` v${esc(model.version)}` : ''})` : ''} into eight cell types.
    ${multi ? 'Cells were located automatically by their stained nuclei and classified one by one.' : 'The image was classified as a single cell.'}
    ${typeof result.inferenceMs === 'number' ? `Processing time: ${Math.round(result.inferenceMs)} ms.` : ''}
    This is a computer-assisted result intended to support, not replace, review by qualified laboratory staff.</p>
  </section>`;

  const signaturesHtml = t.showSignatures ? `
  <section class="signatures">
    <div class="sig"><div class="sig-line"></div><div class="sig-name">Laboratory Technician</div><div class="sig-sub">Signature &amp; date</div></div>
    <div class="sig"><div class="sig-line"></div><div class="sig-name" dir="auto">${doctorLabel ? esc(doctorLabel) : 'Reviewing Doctor'}</div><div class="sig-sub">${doctorLabel ? 'Hematology &middot; ' : ''}Signature &amp; date</div></div>
  </section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report ${esc(reportId)}${patientInfo.name ? ` - ${esc(patientInfo.name)}` : ''}</title>
<style>
  @page {
    size: ${pageSize} ${orientation};
    margin: ${margins};
    @bottom-left { content: "${esc(lab.labName || 'BloodCellVision').replace(/["\\]/g, '')} \\00B7  Report ${esc(reportId).replace(/["\\]/g, '')}"; font-size: 7.5pt; color: #6b7280; font-family: 'Segoe UI', Arial, sans-serif; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 7.5pt; color: #6b7280; font-family: 'Segoe UI', Arial, sans-serif; }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${safeFont(t.fontFamily)}; font-size: ${base}pt; line-height: 1.35; color: ${text}; background: #fff; }
  @media screen {
    body { background: #e5e7eb; padding: 16px 0; }
    .page { width: ${pageWidth}mm; max-width: 100%; margin: 0 auto; background: #fff; padding: ${margins}; box-shadow: 0 2px 12px rgba(0,0,0,.18); }
  }
  h2 { font-size: ${base + 1}pt; margin: 0 0 1.6mm; padding-bottom: .8mm; color: ${secondary}; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid ${accent}; }
  h3 { font-size: ${base}pt; margin: 0 0 1mm; color: ${secondary}; }
  p { margin: 1mm 0 0; }
  ul { margin: 0; padding-left: 4.5mm; }
  li { margin-bottom: .6mm; }
  .small { font-size: ${Math.max(7, base - 2)}pt; }
  .muted { color: #6b7280; }
  .pre { white-space: pre-wrap; }
  .block { margin-top: ${gap + 1}mm; break-inside: avoid; }
  .block.flow { break-inside: auto; }
  h2, h3 { break-after: avoid; }

  .lab-header { display: flex; align-items: center; gap: 4mm; padding-bottom: 3mm; border-bottom: ${bw + 1}px ${bs} ${primary}; }
  .lab-logo { max-height: 22mm; max-width: 34mm; object-fit: contain; }
  .lab-id { flex: 1; min-width: 0; }
  .lab-name { font-size: ${head + 4}pt; font-weight: 700; color: ${primary}; line-height: 1.15; }
  .lab-dept { font-size: ${base + 1}pt; color: #374151; letter-spacing: .06em; text-transform: uppercase; margin-top: .6mm; }
  .lab-contact { text-align: right; font-size: ${Math.max(7, base - 1)}pt; color: #374151; line-height: 1.45; max-width: 70mm; }

  .title-bar { margin-top: ${gap}mm; background: ${primary}; color: #fff; padding: 2mm 3.5mm; border-radius: 1mm; display: flex; justify-content: space-between; align-items: center; gap: 4mm; flex-wrap: wrap; }
  .title { font-size: ${head - 3}pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .title-meta { display: flex; gap: 5mm; font-size: ${Math.max(7, base - 1.5)}pt; flex-wrap: wrap; }

  .patient { border: ${bw}px ${bs} ${primary}; border-radius: 1.2mm; padding: 2.5mm 3.5mm 3mm; background: #f8fafc; }
  .patient h2 { border-bottom-color: ${primary}; }
  .fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 5mm; }
  .field-label { font-size: ${Math.max(6.5, base - 2.5)}pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
  .field-value { font-weight: 600; border-bottom: 1px dotted #cbd5e1; min-height: 1.4em; overflow-wrap: anywhere; }
  .clinical { margin-top: 2mm; }

  .exam { display: flex; gap: 5mm; align-items: flex-start; }
  .exam-image { margin: 0; flex: 0 0 ${multi ? 56 : 44}%; text-align: center; }
  .exam-image img { max-width: 100%; max-height: ${multi ? 98 : 62}mm; border: 1px solid #94a3b8; border-radius: 1mm; display: block; margin: 0 auto; }
  figcaption { font-size: ${Math.max(6.5, base - 2.5)}pt; color: #6b7280; margin-top: 1mm; font-style: italic; }
  .exam-result { flex: 1; min-width: 0; }

  .result-card { border: 1px solid #cbd5e1; border-left: 4px solid ${primary}; border-radius: 1mm; padding: 2.5mm 3mm; margin-bottom: 3mm; }
  .result-label { font-size: ${Math.max(6.5, base - 2.5)}pt; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
  .result-type { font-size: ${head}pt; font-weight: 700; margin: .5mm 0; }
  .result-conf { font-size: ${base}pt; }

  table.diff { width: 100%; border-collapse: collapse; font-size: ${Math.max(7.5, base - 0.5)}pt; }
  table.diff th { text-align: left; font-weight: 700; color: #fff; background: ${secondary}; padding: 1.1mm 1.8mm; }
  table.diff td { padding: 1mm 1.8mm; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  table.diff tfoot td { font-weight: 700; border-top: 1.5px solid ${secondary}; border-bottom: none; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .barcol { width: 30%; }
  .bar { height: 2.2mm; background: #eef2f7; border-radius: 1.1mm; overflow: hidden; }
  .bar > div { height: 100%; border-radius: 1.1mm; }
  .dot { display: inline-block; width: 2.4mm; height: 2.4mm; border-radius: 50%; margin-right: 1.6mm; vertical-align: baseline; }
  .dot.big { width: 3.4mm; height: 3.4mm; }

  .cells { display: grid; grid-template-columns: repeat(${orientation === 'landscape' ? 9 : 6}, 1fr); gap: 2.5mm; }
  .cell { position: relative; border: 1px solid #cbd5e1; border-radius: 1mm; overflow: hidden; text-align: center; break-inside: avoid; background: #fff; }
  .cell img, .cell .noimg { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #f1f5f9; }
  .cell-no { position: absolute; top: 0; left: 0; color: #fff; font-weight: 700; font-size: ${Math.max(7, base - 2)}pt; padding: .3mm 1.5mm; border-bottom-right-radius: 1mm; font-family: 'Segoe UI', Arial, sans-serif; }
  .cell-type { font-size: ${Math.max(6.5, base - 2.5)}pt; font-weight: 600; padding: .8mm .8mm 0; line-height: 1.15; }
  .cell-conf { font-size: ${Math.max(6.5, base - 2.5)}pt; color: #475569; padding-bottom: .8mm; }

  .two { display: flex; gap: 4mm; }
  .two > .box { flex: 1; }
  .box { border: 1px solid #cbd5e1; border-radius: 1mm; padding: 2mm 3mm; background: #fbfcfe; }
  .method p { color: #4b5563; }

  .signatures { display: flex; justify-content: space-between; gap: 20mm; margin-top: 4mm; break-inside: avoid; }
  .sig { flex: 1; text-align: center; }
  .sig-line { border-bottom: 1px solid #111827; height: 9mm; }
  .sig-name { font-weight: 700; margin-top: 1mm; }
  .sig-sub { font-size: ${Math.max(6.5, base - 2.5)}pt; color: #6b7280; }
  .generated { margin-top: 3mm; padding-top: 1mm; border-top: 1px solid #e5e7eb; font-size: 6.5pt; color: #9ca3af; text-align: center; font-family: 'Segoe UI', Arial, sans-serif; }
</style>
</head>
<body>
<div class="page">
  ${headerHtml}
  ${titleHtml}
  ${patientHtml}
  ${imageHtml}
  ${cellGridHtml}
  ${findingsHtml}
  ${notesHtml}
  ${methodHtml}
  ${signaturesHtml}
  <div class="generated">Generated with BloodCellVision &middot; Report ${esc(reportId)} &middot; created ${esc(fmtDate(input.createdAt))}</div>
</div>
</body>
</html>`;
}
