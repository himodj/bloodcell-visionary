// Draws the labelled boxes onto the microscope image and cuts per-cell thumbnails,
// for the saved report and for printing.
import type { AnalysisResult, AnalyzedCell } from '../contexts/AnalysisContext';
import { getCellTypeColor, shortCellName } from '../utils/analysisUtils';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = src;
  });
}

function hasBox(cell: AnalyzedCell): boolean {
  const c = cell.coordinates;
  return !!c && c.width > 0 && c.height > 0 && c.width <= 100 && c.height <= 100;
}

/** Image with a numbered, labelled box on every cell (PNG data URL). */
export async function renderAnnotatedImage(result: AnalysisResult, maxSide = 1500): Promise<string> {
  const img = await loadImage(result.image);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return result.image;
  ctx.drawImage(img, 0, 0, w, h);

  const many = result.detectedCells.length > 1;
  const unit = Math.max(w, h);
  const line = Math.max(2, Math.round(unit / 320));
  const fontSize = Math.max(11, Math.round(unit / (many ? 52 : 34)));
  ctx.font = `600 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  result.detectedCells.forEach((cell, index) => {
    if (!hasBox(cell)) return;
    const c = cell.coordinates!;
    const x = (c.x / 100) * w;
    const y = (c.y / 100) * h;
    const bw = (c.width / 100) * w;
    const bh = (c.height / 100) * h;
    const color = getCellTypeColor(cell.type);

    ctx.lineWidth = line + 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(x, y, bw, bh);
    ctx.lineWidth = line;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, bw, bh);

    const text = many
      ? `${index + 1} ${shortCellName(cell.type)} ${(cell.confidence * 100).toFixed(0)}%`
      : `${cell.type} ${(cell.confidence * 100).toFixed(1)}%`;
    const pad = Math.round(fontSize * 0.35);
    const tw = ctx.measureText(text).width + pad * 2;
    const th = fontSize + pad * 1.4;
    let tx = x;
    let ty = y - th - 1;
    if (ty < 0) ty = Math.min(h - th, y + bh + 1);
    if (tx + tw > w) tx = Math.max(0, w - tw);
    ctx.fillStyle = color;
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, tx + pad, ty + th / 2 + 1);
  });
  return canvas.toDataURL('image/png');
}

/** One small picture per cell (JPEG data URLs, same order as result.detectedCells). */
export async function renderCellThumbnails(result: AnalysisResult, size = 150, limit = 60): Promise<string[]> {
  const img = await loadImage(result.image);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const thumbs: string[] = [];
  for (const cell of result.detectedCells.slice(0, limit)) {
    let cx = W / 2;
    let cy = H / 2;
    let side = Math.min(W, H);
    if (hasBox(cell) && result.detectedCells.length > 1) {
      const c = cell.coordinates!;
      cx = ((c.x + c.width / 2) / 100) * W;
      cy = ((c.y + c.height / 2) / 100) * H;
      side = Math.max((c.width / 100) * W, (c.height / 100) * H) * 1.5;
    }
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, size, size);
    const left = cx - side / 2;
    const top = cy - side / 2;
    const sx0 = Math.max(0, left);
    const sy0 = Math.max(0, top);
    const sx1 = Math.min(W, left + side);
    const sy1 = Math.min(H, top + side);
    if (sx1 > sx0 && sy1 > sy0) {
      const k = size / side;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, (sx0 - left) * k, (sy0 - top) * k, (sx1 - sx0) * k, (sy1 - sy0) * k);
    }
    thumbs.push(canvas.toDataURL('image/jpeg', 0.88));
  }
  return thumbs;
}
