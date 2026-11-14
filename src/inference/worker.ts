/// <reference lib="webworker" />
// Inference worker: owns the ONNX Runtime session so that loading the model and running
// predictions never block the user interface.
import * as ort from 'onnxruntime-web/wasm';

type InitMessage = {
  type: 'init';
  wasmBase: string;
  modelBytes: ArrayBuffer;
  inputSize: number;
  scale: number;
  numClasses: number;
};
type ClassifyMessage = {
  type: 'classify';
  id: number;
  // RGBA pixels, inputSize x inputSize, row-major
  pixels: ArrayBuffer;
};
type InMessage = InitMessage | ClassifyMessage;

let session: ort.InferenceSession | null = null;
let inputName = '';
let outputName = '';
let inputSize = 360;
let scale = 1 / 255;

function toTensor(rgba: Uint8ClampedArray): ort.Tensor {
  const n = inputSize * inputSize;
  const data = new Float32Array(n * 3);
  // NHWC float32. The network was trained on pixels scaled to [0, 1].
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    data[i * 3] = rgba[j] * scale;
    data[i * 3 + 1] = rgba[j + 1] * scale;
    data[i * 3 + 2] = rgba[j + 2] * scale;
  }
  return new ort.Tensor('float32', data, [1, inputSize, inputSize, 3]);
}

function toProbabilities(raw: Float32Array): number[] {
  const values = Array.from(raw);
  const sum = values.reduce((a, b) => a + b, 0);
  const looksLikeProbabilities = values.every((v) => v >= -1e-6 && v <= 1 + 1e-6) && Math.abs(sum - 1) < 1e-2;
  if (looksLikeProbabilities) return values;
  // Model exported without its softmax layer: normalise the logits here.
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / total);
}

async function run(rgba: Uint8ClampedArray): Promise<{ probabilities: number[]; ms: number }> {
  if (!session) throw new Error('Model is not loaded');
  const t0 = performance.now();
  const output = await session.run({ [inputName]: toTensor(rgba) });
  const ms = performance.now() - t0;
  const tensor = output[outputName];
  const probabilities = toProbabilities(tensor.data as Float32Array);
  if (probabilities.some((p) => !Number.isFinite(p))) {
    throw new Error('Model returned invalid (non-finite) values');
  }
  return { probabilities, ms };
}

async function init(msg: InitMessage) {
  const t0 = performance.now();
  inputSize = msg.inputSize;
  scale = msg.scale;

  const isolated = (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
  const cores = navigator.hardwareConcurrency || 2;
  const threads = isolated ? Math.max(1, Math.min(4, cores)) : 1;

  ort.env.wasm.wasmPaths = msg.wasmBase;
  ort.env.wasm.numThreads = threads;
  ort.env.wasm.proxy = false;
  ort.env.logLevel = 'error';

  const options: ort.InferenceSession.SessionOptions = {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  };

  let usedThreads = threads;
  try {
    session = await ort.InferenceSession.create(new Uint8Array(msg.modelBytes), options);
  } catch (err) {
    if (threads === 1) throw err;
    // Multi-threading unavailable on this machine: fall back to a single thread.
    ort.env.wasm.numThreads = 1;
    usedThreads = 1;
    session = await ort.InferenceSession.create(new Uint8Array(msg.modelBytes), options);
  }
  inputName = session.inputNames[0];
  outputName = session.outputNames[0];
  const loadMs = performance.now() - t0;

  // Warm-up run: validates the model end to end and removes first-run latency.
  const blank = new Uint8ClampedArray(inputSize * inputSize * 4).fill(128);
  const warm = await run(blank);
  if (warm.probabilities.length !== msg.numClasses) {
    session = null;
    throw new Error(
      `This model outputs ${warm.probabilities.length} classes, but ${msg.numClasses} class labels are configured. ` +
        'Provide a matching labels file (same name as the model, with a .json extension).'
    );
  }

  postMessage({
    type: 'ready',
    inputName,
    outputName,
    threads: usedThreads,
    crossOriginIsolated: isolated,
    loadMs,
    warmupMs: warm.ms,
    runtimeVersion: ort.env.versions?.web ?? 'unknown',
  });
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      await init(msg);
    } else if (msg.type === 'classify') {
      const { probabilities, ms } = await run(new Uint8ClampedArray(msg.pixels));
      postMessage({ type: 'result', id: msg.id, probabilities, ms });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (msg.type === 'classify') postMessage({ type: 'error', id: msg.id, message });
    else postMessage({ type: 'init-error', message });
  }
};
