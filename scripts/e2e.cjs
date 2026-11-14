// Developer end-to-end check. Drives the real UI exactly like a user would.
// Usage: electron scripts/e2e.cjs --image <single cell.jpg> --field <multi-cell.jpg> --shots <dir>
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const imagePath = arg('--image');
const fieldPath = arg('--field');
const shots = arg('--shots') || path.join(os.tmpdir(), 'bcv-shots');
const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'bcv-docs-'));
fs.mkdirSync(shots, { recursive: true });
app.setPath('documents', docs);
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'bcv-user-')));

require('../electron/main.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const steps = [];
function ok(name, cond, extra) { steps.push({ name, ok: !!cond, extra }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); }

app.whenReady().then(async () => {
  let failed = false;
  try {
    let win;
    for (let i = 0; i < 100 && !win; i++) { await sleep(200); win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('app://')); }
    const wc = win.webContents;
    const js = (code) => wc.executeJavaScript(code);
    const waitFor = async (code, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(code)) return true; await sleep(150); } return false; };
    const shot = async (name) => fs.writeFileSync(path.join(shots, name + '.png'), (await wc.capturePage()).toPNG());
    const clickText = (text) => js(`(() => { const b=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim().includes(${JSON.stringify(text)})); if(!b) return false; b.click(); return true; })()`);
    const setInput = (selector, value) => js(`(() => { const i=document.querySelector(${JSON.stringify(selector)}); if(!i) return false; const proto = i.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    const upload = (file) => js(`(async () => {
      const bin = atob(${JSON.stringify(fs.readFileSync(file).toString('base64'))}); const u8 = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([u8], 'sample.jpg', { type: 'image/jpeg' }));
      const input = document.querySelector('input[type=file]'); input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const reportsDir = path.join(docs, 'BloodCellVision Reports');
    const folders = () => (fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).sort() : []);
    const record = (folder) => JSON.parse(fs.readFileSync(path.join(reportsDir, folder, 'report.json'), 'utf8'));
    const saved = () => waitFor('document.querySelector("[data-save-state]")?.dataset.saveState === "saved"', 15000);

    ok('UI loaded', await waitFor('document.body.innerText.includes("Blood Cell Analysis")'));
    ok('model auto-loaded', await waitFor('window.__bcv.status().loaded === true', 60000));

    // lab details used on every report
    await js(`localStorage.setItem('labConfiguration', JSON.stringify({labName:'Al-Rafidain Clinical Laboratory',address:'Baghdad, Al-Mansour, Street 14',phone:'+964 770 000 0000',hematologyDoctorName:'Ahmed Kareem',licenseNumber:'LAB-2026-118',logo:null}))`);

    // ---------- 1. single-cell image
    await upload(imagePath);
    ok('image accepted', await waitFor('!!document.querySelector(\'img[alt="Blood Sample"]\')'));
    await clickText('Edit'); await sleep(250);
    await setInput('#patient-name', 'Test Patient');
    await setInput('#patient-age', '42');
    await setInput('#patient-id', 'P-1001');
    await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Save').click()`);
    await sleep(250);
    await shot('1-home-image');
    ok('start analysis', await clickText('Start Analysis'));
    ok('results shown', await waitFor('location.hash.includes("/analysis") && document.body.innerText.includes("Model Probabilities")', 30000));
    ok('filed automatically', await saved() && folders().length === 1, folders()[0]);
    let rec = record(folders()[0]);
    ok('report number format', /^BCV-\d{8}-001$/.test(rec.reportId), rec.reportId);
    ok('patient stored', rec.patientInfo.name === 'Test Patient' && rec.patientInfo.patientId === 'P-1001' && rec.patientInfo.age === '42');
    ok('one cell stored with probabilities', rec.analysis.detectedCells.length === 1 && rec.analysis.detectedCells[0].probabilities.length === 8, rec.analysis.detectedCells[0].type);
    let files = fs.readdirSync(path.join(reportsDir, folders()[0])).sort();
    ok('archive files', ['Report.html', 'annotated.png', 'report.json'].every((f) => files.includes(f)) && files.some((f) => f.startsWith('original.')), files.join(', '));
    ok('json holds no image data', !fs.readFileSync(path.join(reportsDir, folders()[0], 'report.json'), 'utf8').includes('base64'));
    await sleep(600); await shot('2-single-results');

    // ---------- 2. edits are written to the same report
    await clickText('Edit'); await sleep(250);
    await setInput('#patient-name', 'Test Patient Edited');
    await setInput('#clinical-notes', 'Fever for 3 days');
    await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Save').click()`);
    await sleep(900); await saved();
    rec = record(folders()[0]);
    ok('patient edit saved to the report', rec.patientInfo.name === 'Test Patient Edited' && rec.patientInfo.clinicalNotes === 'Fever for 3 days');
    ok('still one folder, same number', folders().length === 1 && rec.reportId.endsWith('-001'));
    const htmlFile = fs.readFileSync(path.join(reportsDir, folders()[0], 'Report.html'), 'utf8');
    ok('Report.html follows the edit', htmlFile.includes('Test Patient Edited') && htmlFile.includes('Fever for 3 days') && htmlFile.includes('Al-Rafidain Clinical Laboratory') && htmlFile.includes('Dr. Ahmed Kareem'));

    // PDF export
    ok('pdf button', await clickText('Save as PDF'));
    const pdfPath = path.join(reportsDir, folders()[0], 'Report.pdf');
    for (let i = 0; i < 60 && !fs.existsSync(pdfPath); i++) await sleep(200);
    ok('Report.pdf written', fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 20000, fs.existsSync(pdfPath) ? `${fs.statSync(pdfPath).size} bytes` : '');
    if (fs.existsSync(pdfPath)) fs.copyFileSync(pdfPath, path.join(shots, 'single.pdf'));
    await js('window.scrollTo(0, document.body.scrollHeight)'); await sleep(500); await shot('3-report-preview');

    // ---------- 3. multi-cell field
    await js('location.hash = "#/"'); await sleep(400);
    await clickText('New Analysis'); await sleep(300);
    await js('window.scrollTo(0, 0)');
    await upload(fieldPath);
    ok('field accepted', await waitFor('!!document.querySelector(\'img[alt="Blood Sample"]\')'));
    await sleep(200); await shot('4-home-field');
    await clickText('Start Analysis');
    ok('multi-cell results shown', await waitFor('location.hash.includes("/analysis") && document.querySelectorAll("[data-cell-box]").length > 1', 60000));
    const boxes = await js('document.querySelectorAll("[data-cell-box]").length');
    ok('second report filed', await saved() && folders().length === 2, `${boxes} boxes`);
    const multiFolder = folders().find((f) => f.includes('-002'));
    rec = record(multiFolder);
    ok('new analysis starts with a blank patient', !rec.patientInfo.name, JSON.stringify(rec.patientInfo.name));
    ok('all cells stored with boxes', rec.analysis.detectedCells.length === boxes && rec.analysis.detectedCells.every((c) => c.coordinates && c.coordinates.width > 0), `${rec.analysis.detectedCells.length} cells, mode ${rec.analysis.analysisMode}`);
    await sleep(500); await shot('5-multi-results');
    await js('window.scrollTo(0, 900)'); await sleep(400); await shot('6-multi-table');

    // correct one cell type and remove one box
    const before = rec.analysis.detectedCells;
    await js(`window.__e2eCtx = true`);
    await js(`document.querySelector('[data-cell-row="${before[1].id}"] button[title]')?.click()`);
    await sleep(900); await saved();
    rec = record(multiFolder);
    ok('removed box is gone from the report', rec.analysis.detectedCells.length === before.length - 1 && rec.analysis.cellCounts.totalCells === before.length - 1);
    await clickText('Save as PDF');
    const pdf2 = path.join(reportsDir, multiFolder, 'Report.pdf');
    for (let i = 0; i < 60 && !fs.existsSync(pdf2); i++) await sleep(200);
    ok('multi-cell PDF written', fs.existsSync(pdf2));
    if (fs.existsSync(pdf2)) fs.copyFileSync(pdf2, path.join(shots, 'multi.pdf'));
    fs.copyFileSync(path.join(reportsDir, multiFolder, 'annotated.png'), path.join(shots, 'annotated.png'));

    // ---------- 4. archive: search, reopen, edit again, delete
    await js('location.hash = "#/search"');
    ok('both reports listed', await waitFor('document.querySelectorAll("[data-report]").length === 2', 10000));
    await sleep(300); await shot('7-archive');
    await setInput('input[placeholder^="Patient name"]', 'P-1001');
    ok('search by patient ID', await waitFor('document.querySelectorAll("[data-report]").length === 1'));
    ok('reopen', await clickText('Reopen Analysis'));
    ok('reopened report shows its patient', await waitFor('location.hash.includes("/analysis") && document.body.innerText.includes("Test Patient Edited") && document.body.innerText.includes("-001")', 10000));
    ok('reopened report shows its own image and single cell', await js('document.querySelectorAll("[data-cell-box]").length === 1'));
    ok('patient form holds the reopened patient', await (async () => { await clickText('Edit'); await sleep(250); return js('document.querySelector("#patient-name").value === "Test Patient Edited"'); })());
    await setInput('#patient-age', '43');
    await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Save').click()`);
    await sleep(900); await saved();
    const first = folders().find((f) => f.includes('-001'));
    rec = record(first);
    ok('edit after reopening saved to the same report', rec.patientInfo.age === '43' && folders().length === 2);
    ok('stale PDF removed after the edit', !fs.existsSync(path.join(reportsDir, first, 'Report.pdf')));
    ok('original image untouched by edits', fs.readdirSync(path.join(reportsDir, first)).some((f) => f.startsWith('original.')));
    await sleep(400); await shot('8-reopened');

    // ---------- 5. top-of-page buttons and Ctrl+P
    await js('window.scrollTo(0, 0)'); await sleep(300);
    ok('Print / PDF / Save buttons at the top of the page', await js(`(() => { const t=document.querySelector('[data-testid="top-actions"]'); if(!t) return false; const txt=t.innerText; return txt.includes('Print Report') && txt.includes('Save as PDF') && txt.includes('Save Report') && t.getBoundingClientRect().top < 400; })()`));
    await shot('9-top-actions');
    const pdfAgain = path.join(reportsDir, first, 'Report.pdf');
    wc.send('menu:command', 'print');   // what Ctrl+P / File > Print Report sends
    // this test machine has no printer: the job is refused and the report must arrive as a PDF instead
    let printed = false;
    for (let i = 0; i < 100 && !printed; i++) { await sleep(200); printed = fs.existsSync(pdfAgain) || await js('document.body.innerText.includes("sent to the printer")'); }
    ok('Ctrl+P prints (or falls back to a PDF when the printer refuses)', printed, fs.existsSync(pdfAgain) ? 'PDF fallback' : 'printed');
    ok('app still responsive after printing', await js('document.querySelectorAll("[data-cell-box]").length === 1'));
    wc.send('menu:command', 'save'); await sleep(1500);
    ok('Ctrl+S saves', await js('document.body.innerText.includes("saved")'));

    failed = steps.some((s) => !s.ok);
  } catch (err) {
    console.log('E2E ERROR', err && err.stack || err);
    failed = true;
  }
  fs.writeFileSync(path.join(shots, 'e2e.json'), JSON.stringify(steps, null, 2));
  app.exit(failed ? 1 : 0);
});
