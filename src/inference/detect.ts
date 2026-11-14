// Finds stained white-cell nuclei in a blood-smear image.
//
// The classifier was trained on images that each show ONE cell. To handle a field with
// several cells, this module locates every nucleus (the dark blue / purple stained body),
// and the engine then cuts a window around each one - framed like a training image - and
// classifies the windows one by one.
//
// Pure functions on pixel arrays: no DOM, no network.

export interface NucleusBlob {
  /** centre of the stained nucleus, in pixels of the analysed (work) image */
  cx: number;
  cy: number;
  /** estimated nucleus diameter in work-image pixels */
  diameter: number;
  /** stained area in work-image pixels */
  area: number;
}

const MIN_THRESHOLD = 25;
const MIN_AREA_PX = 12;
/** blobs much smaller than the largest nucleus are platelets / stain specks, not white cells */
const MIN_AREA_FRACTION = 0.12;

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  // separable mean filter with edge replication
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / win;
      const add = Math.min(w - 1, x + r + 1);
      const sub = Math.max(0, x - r);
      acc += src[row + add] - src[row + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      const add = Math.min(h - 1, y + r + 1);
      const sub = Math.max(0, y - r);
      acc += tmp[add * w + x] - tmp[sub * w + x];
    }
  }
  return out;
}

function otsuThreshold(values: Float32Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] < 0 ? 0 : values[i] > 255 ? 255 : values[i];
    hist[Math.floor(v)]++;
  }
  const total = values.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let w0 = 0;
  let sum0 = 0;
  let best = 0;
  let bestT = 0;
  for (let t = 0; t < 255; t++) {
    w0 += hist[t];
    sum0 += t * hist[t];
    if (w0 === 0 || w0 === total) continue;
    const m0 = sum0 / w0;
    const m1 = (sumAll - sum0) / (total - w0);
    const between = w0 * (total - w0) * (m0 - m1) * (m0 - m1);
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT;
}

/** 4-connected component labelling. Returns labels (0 = background) and the component count. */
function label(mask: Uint8Array, w: number, h: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let count = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    count++;
    let top = 0;
    stack[top++] = start;
    labels[start] = count;
    while (top > 0) {
      const p = stack[--top];
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = count; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = count; stack[top++] = p + 1; }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = count; stack[top++] = p - w; }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = count; stack[top++] = p + w; }
    }
  }
  return { labels, count };
}

/**
 * @param rgba   RGBA pixels of the (downscaled) image, row-major
 * @returns one entry per white-cell nucleus found, largest first
 */
export function findNuclei(rgba: Uint8ClampedArray, w: number, h: number): NucleusBlob[] {
  const n = w * h;
  // "Purple-ness": Romanowsky stains colour nuclei blue/purple (blue well above green),
  // while red cells are pink and the background is pale.
  let score: Float32Array = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const r = rgba[j];
    const g = rgba[j + 1];
    const b = rgba[j + 2];
    const v = Math.min(b - g, (b - g) * 0.5 + (r - g) * 0.5 + 40);
    score[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  score = boxBlur(score, w, h, 1);
  const threshold = Math.max(otsuThreshold(score), MIN_THRESHOLD);

  const mask = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    if (score[i] > threshold) {
      mask[i] = 1;
      any = true;
    }
  }
  if (!any) return [];

  // size of the largest stained body sets the scale for joining nucleus lobes
  const first = label(mask, w, h);
  const firstAreas = new Float64Array(first.count + 1);
  for (let i = 0; i < n; i++) if (first.labels[i]) firstAreas[first.labels[i]]++;
  let largest = 0;
  for (let k = 1; k <= first.count; k++) largest = Math.max(largest, firstAreas[k]);
  const joinRadius = Math.max(1, Math.round(Math.sqrt(largest / Math.PI) * 0.35));

  // close gaps so the lobes of one segmented nucleus count as one cell
  const maskF = new Float32Array(n);
  for (let i = 0; i < n; i++) maskF[i] = mask[i];
  const density = boxBlur(maskF, w, h, joinRadius);
  const closed = new Uint8Array(n);
  for (let i = 0; i < n; i++) closed[i] = density[i] > 0.33 ? 1 : 0;

  const { labels, count } = label(closed, w, h);
  const area = new Float64Array(count + 1);
  const sumX = new Float64Array(count + 1);
  const sumY = new Float64Array(count + 1);
  const minX = new Int32Array(count + 1).fill(w);
  const maxX = new Int32Array(count + 1).fill(-1);
  const minY = new Int32Array(count + 1).fill(h);
  const maxY = new Int32Array(count + 1).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const k = labels[i];
      if (!k) continue;
      if (x < minX[k]) minX[k] = x;
      if (x > maxX[k]) maxX[k] = x;
      if (y < minY[k]) minY[k] = y;
      if (y > maxY[k]) maxY[k] = y;
      if (mask[i]) {
        area[k]++;
        sumX[k] += x;
        sumY[k] += y;
      }
    }
  }
  let biggest = 0;
  for (let k = 1; k <= count; k++) biggest = Math.max(biggest, area[k]);

  const blobs: NucleusBlob[] = [];
  for (let k = 1; k <= count; k++) {
    if (area[k] < MIN_AREA_PX || area[k] < MIN_AREA_FRACTION * biggest) continue;
    const bw = maxX[k] - minX[k] + 1;
    const bh = maxY[k] - minY[k] + 1;
    blobs.push({
      cx: sumX[k] / area[k],
      cy: sumY[k] / area[k],
      diameter: Math.max(2 * Math.sqrt(area[k] / Math.PI), 0.8 * Math.max(bw, bh)),
      area: area[k],
    });
  }
  blobs.sort((a, b) => b.area - a.area);
  return blobs;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
