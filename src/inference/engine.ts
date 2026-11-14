// Model engine: loads the ONNX model once, finds cells and classifies them.
// Everything runs locally inside the app (ONNX Runtime WebAssembly in a worker).

import { findNuclei, median } from './detect';

export interface ModelMeta {
  name: string;
  version?: string;
  description?: string;
  inputSize: number;
  /** multiplier applied to 0-255 pixel values before they enter the network */
  scale: number;
  labels: string[];
  abnormalLabels?: string[];
}

export interface ModelStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  loaded: boolean;
  error?: string;
  meta?: ModelMeta;
  path?: string;
  fileName?: string;
  isDefault?: boolean;
  sizeBytes?: number;
  sha256?: string;
  threads?: number;
  loadMs?: number;
  warmupMs?: number;
  runtimeVersion?: string;
}

export interface Prediction {
  label: string;
  index: number;
  confidence: number;
  /** probability for every class, in model output order */
  probabilities: { label: string; probability: number }[];
  inferenceMs: number;
}

export interface SelfTestRow {
  name: string;
  expected: string;
  predicted: string;
  confidence: number;
  ok: boolean;
}
export interface SelfTestResult {
  passed: boolean;
  correct: number;
  total: number;
  rows: SelfTestRow[];
  source?: string;
  error?: string;
}

let worker: Worker | null = null;
let status: ModelStatus = { state: 'idle', loaded: false };
let loadPromise: Promise<ModelStatus> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: { probabilities: number[]; ms: number }) => void; reject: (e: Error) => void }>();
const listeners = new Set<(s: ModelStatus) => void>();

function setStatus(next: ModelStatus) {
  status = next;
  listeners.forEach((l) => l(status));
}

export function getModelStatus(): ModelStatus {
  return status;
}

export function subscribeModelStatus(listener: (s: ModelStatus) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function disposeWorker(reason: string) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.forEach((p) => p.reject(new Error(reason)));
  pending.clear();
}

function log(level: string, message: string) {
  try {
    window.electron?.log(level, message);
  } catch {
    /* ignore */
  }
}

async function doLoad(): Promise<ModelStatus> {
  if (!window.electron) {
    throw new Error('The model can only be loaded inside the BloodCellVision desktop application.');
  }
  disposeWorker('Model is being reloaded');
  setStatus({ state: 'loading', loaded: false });

  const file = await window.electron.loadModelFile();
  if (!file.success || !file.bytes || !file.meta) {
    throw new Error(file.error || 'The model file could not be read.');
  }
  const meta = file.meta as ModelMeta;
  if (!meta.inputSize || !Array.isArray(meta.labels) || meta.labels.length === 0) {
    throw new Error('The model description is incomplete (inputSize / labels).');
  }

  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker = w;

  const ready = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Timed out while loading the model.')), 120000);
    w.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'ready') {
        window.clearTimeout(timeout);
        resolve(msg);
      } else if (msg.type === 'init-error') {
        window.clearTimeout(timeout);
        const invalid = /protobuf|Can't create a session|invalid model/i.test(msg.message);
        reject(new Error(invalid ? `"${file.fileName}" is not a valid ONNX model file.\n(${msg.message})` : msg.message));
      } else if (msg.type === 'result') {
        pending.get(msg.id)?.resolve({ probabilities: msg.probabilities, ms: msg.ms });
        pending.delete(msg.id);
      } else if (msg.type === 'error') {
        pending.get(msg.id)?.reject(new Error(msg.message));
        pending.delete(msg.id);
      }
    };
    w.onerror = (event) => {
      window.clearTimeout(timeout);
      reject(new Error(event.message || 'The inference worker failed to start.'));
    };

    // Copy into a standalone buffer so it can be transferred to the worker.
    const bytes = file.bytes as Uint8Array;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    w.postMessage(
      {
        type: 'init',
        wasmBase: new URL('./ort/', document.baseURI).href,
        modelBytes: buffer,
        inputSize: meta.inputSize,
        scale: meta.scale ?? 1 / 255,
        numClasses: meta.labels.length,
      },
      [buffer]
    );
  });

  const next: ModelStatus = {
    state: 'ready',
    loaded: true,
    meta,
    path: file.path,
    fileName: file.fileName,
    isDefault: file.isDefault,
    sizeBytes: file.size,
    sha256: file.sha256,
    threads: ready.threads as number,
    loadMs: ready.loadMs as number,
    warmupMs: ready.warmupMs as number,
    runtimeVersion: ready.runtimeVersion as string,
  };
  log(
    'info',
    `Model ready: ${next.fileName} (${meta.labels.length} classes, ${next.threads} thread(s), load ${Math.round(next.loadMs ?? 0)} ms, warm-up ${Math.round(next.warmupMs ?? 0)} ms)`
  );
  setStatus(next);
  return next;
}

/** Loads the model (or returns the already loaded one). Pass force=true to reload from disk. */
export function loadModel(force = false): Promise<ModelStatus> {
  if (status.loaded && !force) return Promise.resolve(status);
  if (loadPromise) return loadPromise;
  loadPromise = doLoad()
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      disposeWorker(message);
      log('error', `Model load failed: ${message}`);
      const failed: ModelStatus = { state: 'error', loaded: false, error: message };
      setStatus(failed);
      return failed;
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = src;
  });
}

/**
 * Cuts a square window out of an image and returns it as the RGBA pixel block the network
 * expects (size x size). Parts of the window that fall outside the image are filled with
 * the given background colour.
 */
function windowToPixels(
  img: HTMLImageElement,
  left: number,
  top: number,
  side: number,
  size: number,
  fill: string
): ArrayBuffer {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create a drawing surface for the image.');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, size, size);
  const sx0 = Math.max(0, left);
  const sy0 = Math.max(0, top);
  const sx1 = Math.min(img.naturalWidth, left + side);
  const sy1 = Math.min(img.naturalHeight, top + side);
  if (sx1 > sx0 && sy1 > sy0) {
    const k = size / side;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, (sx0 - left) * k, (sy0 - top) * k, (sx1 - sx0) * k, (sy1 - sy0) * k);
  }
  return ctx.getImageData(0, 0, size, size).data.buffer as ArrayBuffer;
}

async function classifyPixels(pixels: ArrayBuffer): Promise<Prediction> {
  if (!status.loaded || !worker || !status.meta) {
    throw new Error('The model is not loaded.');
  }
  const meta = status.meta;
  const id = nextId++;
  const activeWorker = worker;
  const { probabilities, ms } = await new Promise<{ probabilities: number[]; ms: number }>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    activeWorker.postMessage({ type: 'classify', id, pixels }, [pixels]);
  });

  let index = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > probabilities[index]) index = i;
  }
  return {
    label: meta.labels[index],
    index,
    confidence: probabilities[index],
    probabilities: probabilities.map((probability, i) => ({ label: meta.labels[i], probability })),
    inferenceMs: ms,
  };
}

/** Classifies one single-cell image (centre crop to a square, as in training). */
export async function classifyImage(imageDataUrl: string): Promise<Prediction> {
  if (!status.loaded || !status.meta) throw new Error('The model is not loaded.');
  const img = await loadImage(imageDataUrl);
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('The image is empty.');
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const pixels = windowToPixels(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, status.meta.inputSize, '#ffffff');
  return classifyPixels(pixels);
}

export type AnalysisMode = 'auto' | 'single' | 'multi';

export interface FieldCell {
  /** box drawn around the cell, as fractions (0..1) of the image width / height */
  box: { x: number; y: number; width: number; height: number };
  prediction: Prediction;
}

export interface FieldAnalysis {
  modeUsed: 'single' | 'multi';
  cells: FieldCell[];
  imageWidth: number;
  imageHeight: number;
  totalMs: number;
  note?: string;
}

/** longest side of the image used for locating nuclei */
const DETECT_WORK_SIZE = 640;
/** classification window = this many median nucleus diameters (matches the training framing) */
const WINDOW_PER_NUCLEUS = 3.0;
const MIN_WINDOW_PER_OWN_NUCLEUS = 2.3;
const BOX_PER_NUCLEUS = 1.7;
export const MAX_CELLS_PER_IMAGE = 60;

/**
 * Analyses an image that may contain one or several cells.
 *  - single: the whole image is one cell (how the model was trained)
 *  - multi : every stained nucleus is located, a training-sized window is cut around each
 *            and classified separately
 *  - auto  : multi when several nuclei are found, otherwise single
 */
export async function analyzeField(imageDataUrl: string, mode: AnalysisMode = 'auto'): Promise<FieldAnalysis> {
  if (!status.loaded || !status.meta) throw new Error('The model is not loaded.');
  const t0 = performance.now();
  const size = status.meta.inputSize;
  const img = await loadImage(imageDataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) throw new Error('The image is empty.');

  // locate nuclei on a reduced copy
  const scale = Math.min(1, DETECT_WORK_SIZE / Math.max(W, H));
  const ww = Math.max(1, Math.round(W * scale));
  const wh = Math.max(1, Math.round(H * scale));
  const work = document.createElement('canvas');
  work.width = ww;
  work.height = wh;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (!wctx) throw new Error('Could not create a drawing surface for the image.');
  wctx.fillStyle = '#ffffff';
  wctx.fillRect(0, 0, ww, wh);
  wctx.imageSmoothingEnabled = true;
  wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(img, 0, 0, ww, wh);
  const workPixels = wctx.getImageData(0, 0, ww, wh).data;

  let blobs = mode === 'single' ? [] : findNuclei(workPixels, ww, wh);
  const windowSide = (WINDOW_PER_NUCLEUS * median(blobs.map((b) => b.diameter))) / scale;
  const looksLikeSingleCellImage = blobs.length <= 1 && (blobs.length === 0 || windowSide >= 0.5 * Math.min(W, H));
  const single = mode === 'single' || (mode === 'auto' && looksLikeSingleCellImage) || blobs.length === 0;

  const clampBox = (cx: number, cy: number, side: number) => {
    const x0 = Math.max(0, cx - side / 2);
    const y0 = Math.max(0, cy - side / 2);
    const x1 = Math.min(W, cx + side / 2);
    const y1 = Math.min(H, cy + side / 2);
    return { x: x0 / W, y: y0 / H, width: (x1 - x0) / W, height: (y1 - y0) / H };
  };

  if (single) {
    const side = Math.min(W, H);
    const pixels = windowToPixels(img, (W - side) / 2, (H - side) / 2, side, size, '#ffffff');
    const prediction = await classifyPixels(pixels);
    // mark the stained nucleus when one is visible, otherwise the analysed square
    const marker = mode === 'single' ? findNuclei(workPixels, ww, wh)[0] : blobs[0];
    const box = marker
      ? clampBox(marker.cx / scale, marker.cy / scale, (BOX_PER_NUCLEUS * marker.diameter) / scale)
      : clampBox(W / 2, H / 2, side * 0.9);
    return {
      modeUsed: 'single',
      cells: [{ box, prediction }],
      imageWidth: W,
      imageHeight: H,
      totalMs: performance.now() - t0,
      note: mode === 'multi' ? 'No stained nucleus was found, so the whole image was classified as one cell.' : undefined,
    };
  }

  let note: string | undefined;
  if (blobs.length > MAX_CELLS_PER_IMAGE) {
    note = `${blobs.length} cells were found; the ${MAX_CELLS_PER_IMAGE} largest were classified.`;
    blobs = blobs.slice(0, MAX_CELLS_PER_IMAGE);
  }

  // average colour of the image fills window areas that extend past the image edge
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < workPixels.length; i += 4) {
    r += workPixels[i];
    g += workPixels[i + 1];
    b += workPixels[i + 2];
  }
  const px = workPixels.length / 4;
  const fill = `rgb(${Math.round(r / px)}, ${Math.round(g / px)}, ${Math.round(b / px)})`;

  // reading order: top to bottom, then left to right
  const rowHeight = Math.max(1, windowSide * scale * 0.5);
  const ordered = [...blobs].sort((p, q) => {
    const rp = Math.floor(p.cy / rowHeight);
    const rq = Math.floor(q.cy / rowHeight);
    return rp !== rq ? rp - rq : p.cx - q.cx;
  });

  const cells: FieldCell[] = [];
  for (const blob of ordered) {
    const cx = blob.cx / scale;
    const cy = blob.cy / scale;
    const own = blob.diameter / scale;
    const side = Math.max(windowSide, MIN_WINDOW_PER_OWN_NUCLEUS * own);
    const pixels = windowToPixels(img, cx - side / 2, cy - side / 2, side, size, fill);
    const prediction = await classifyPixels(pixels);
    cells.push({ box: clampBox(cx, cy, BOX_PER_NUCLEUS * own), prediction });
  }
  return { modeUsed: 'multi', cells, imageWidth: W, imageHeight: H, totalMs: performance.now() - t0, note };
}

/** Classifies the labelled reference images shipped with the app. */
export async function runSelfTest(): Promise<SelfTestResult> {
  try {
    if (!window.electron) throw new Error('Self-test requires the desktop application.');
    if (!status.loaded) {
      const s = await loadModel();
      if (!s.loaded) throw new Error(s.error || 'Model not loaded');
    }
    const res = await window.electron.getSelfTestSamples();
    if (!res.success || res.samples.length === 0) throw new Error(res.error || 'No reference images found.');
    const rows: SelfTestRow[] = [];
    for (const sample of res.samples) {
      const p = await classifyImage(sample.dataUrl);
      rows.push({ name: sample.name, expected: sample.expected, predicted: p.label, confidence: p.confidence, ok: p.label === sample.expected });
    }
    const correct = rows.filter((r) => r.ok).length;
    const result = { passed: correct === rows.length, correct, total: rows.length, rows, source: res.source };
    log('info', `Self-test: ${correct}/${rows.length} reference images classified correctly`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', `Self-test failed: ${message}`);
    return { passed: false, correct: 0, total: 0, rows: [], error: message };
  }
}

// Hook used by the automated self-test (BloodCellVision.exe --selftest).
(window as unknown as { __bcv: unknown }).__bcv = {
  loadModel: () => loadModel(),
  status: () => getModelStatus(),
  classifyDataUrl: async (dataUrl: string) => {
    const p = await classifyImage(dataUrl);
    return { label: p.label, confidence: p.confidence, inferenceMs: p.inferenceMs };
  },
  runSelfTest: () => runSelfTest(),
  analyzeDataUrl: async (dataUrl: string, mode: AnalysisMode = 'auto') => {
    const f = await analyzeField(dataUrl, mode);
    return {
      modeUsed: f.modeUsed,
      width: f.imageWidth,
      height: f.imageHeight,
      totalMs: f.totalMs,
      cells: f.cells.map((c) => ({ box: c.box, label: c.prediction.label, confidence: c.prediction.confidence })),
    };
  },
};
