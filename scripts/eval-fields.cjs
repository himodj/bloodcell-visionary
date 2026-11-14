// Developer check for multi-cell analysis. Runs the real app pipeline on multi-cell fields.
//   electron scripts/eval-fields.cjs --mosaic <dir with gt.json>      known-answer mosaics
//   electron scripts/eval-fields.cjs --bccd <BCCD dir>               real fields with WBC boxes
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
require('../electron/main.cjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  try {
    let win;
    for (let i = 0; i < 100 && !win; i++) { await sleep(200); win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('app://')); }
    const wc = win.webContents;
    for (let i = 0; i < 300 && !(await wc.executeJavaScript('typeof window.__bcv === "object" && window.__bcv.status().loaded')); i++) await sleep(200);
    const analyze = (file, mode = 'auto') => {
      const mime = /\.png$/i.test(file) ? 'png' : 'jpeg';
      const url = `data:image/${mime};base64,${fs.readFileSync(file).toString('base64')}`;
      return wc.executeJavaScript(`window.__bcv.analyzeDataUrl(${JSON.stringify(url)}, ${JSON.stringify(mode)})`);
    };
    const mosaic = arg('--mosaic');
    if (mosaic) {
      const gt = JSON.parse(fs.readFileSync(path.join(mosaic, 'gt.json'), 'utf8'));
      let total = 0, found = 0, correct = 0, extra = 0, ms = 0, n = 0;
      for (const [name, g] of Object.entries(gt)) {
        const r = await analyze(path.join(mosaic, name));
        ms += r.totalMs; n++;
        const used = new Set();
        for (const c of g.cells) {
          total++;
          let best = -1, bd = 1e9;
          r.cells.forEach((d, i) => {
            const dx = (d.box.x + d.box.width / 2) * r.width - c.cx, dy = (d.box.y + d.box.height / 2) * r.height - c.cy;
            const dist = Math.hypot(dx, dy);
            if (dist < 110 && dist < bd) { bd = dist; best = i; }
          });
          if (best >= 0) { found++; used.add(best); if (r.cells[best].label === c.label) correct++; }
        }
        extra += r.cells.length - used.size;
      }
      console.log(`MOSAIC cells=${total} found=${found} correct=${correct} (${(100 * correct / total).toFixed(1)}%) extra=${extra} avg_ms_per_image=${Math.round(ms / n)}`);
    }
    const bccd = arg('--bccd');
    if (bccd) {
      let tp = 0, fn = 0, fp = 0, n = 0;
      for (const xf of fs.readdirSync(path.join(bccd, 'Annotations')).sort()) {
        const xml = fs.readFileSync(path.join(bccd, 'Annotations', xf), 'utf8');
        const boxes = [...xml.matchAll(/<object>\s*<name>WBC<\/name>[\s\S]*?<xmin>(\d+)<\/xmin>\s*<ymin>(\d+)<\/ymin>\s*<xmax>(\d+)<\/xmax>\s*<ymax>(\d+)<\/ymax>/g)].map((m) => m.slice(1).map(Number));
        const r = await analyze(path.join(bccd, 'JPEGImages', xf.replace('.xml', '.jpg')), 'multi');
        n++;
        const pts = r.cells.map((d) => [(d.box.x + d.box.width / 2) * r.width, (d.box.y + d.box.height / 2) * r.height]);
        const hit = new Set(); let m = 0;
        for (const b of boxes) {
          const ok = pts.map((p, i) => (p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]) ? i : -1).filter((i) => i >= 0);
          if (ok.length) { m++; ok.forEach((i) => hit.add(i)); }
        }
        tp += m; fn += boxes.length - m; fp += r.cells.length - hit.size;
      }
      console.log(`BCCD images=${n} WBC=${tp + fn} found=${tp} recall=${(tp / (tp + fn)).toFixed(3)} extra=${fp}`);
    }
    const singles = arg('--singles');
    if (singles) {
      const files = fs.readdirSync(singles).filter((f) => /\.jpg$/.test(f)).sort().filter((_f, i) => i % 9 === 0);
      let one = 0, multi = 0;
      for (const f of files) { const r = await analyze(path.join(singles, f)); if (r.cells.length === 1 && r.modeUsed === 'single') one++; else multi++; }
      console.log(`SINGLES images=${files.length} treated_as_single=${one} treated_as_multi=${multi}`);
    }
  } catch (e) { console.log('EVAL ERROR', e && e.stack || e); }
  app.exit(0);
});
