# BloodCellVision 2.1

Desktop application that classifies blood cells into eight types (IG / immature
granulocyte, basophil, eosinophil, erythroblast, lymphocyte, monocyte, neutrophil, platelet)
with the EfficientNetV2B0-BloodCellVision model. It handles single-cell images and fields
with several cells, files every analysis in a report archive and prints a laboratory report.

## Download

Click the installer for your Windows version. The download starts immediately.

| Your Windows | Download |
|---|---|
| **Windows 10 or 11** (64-bit) | [BloodCellVision-Setup-2.1.1.exe](https://github.com/himodj/bloodcell-visionary/raw/main/installers/BloodCellVision-Setup-2.1.1.exe) (99 MB) |
| **Windows 7 SP1, 8 or 8.1** (64-bit) | [BloodCellVision-Setup-2.1.1-Win7-64bit.exe](https://github.com/himodj/bloodcell-visionary/raw/main/installers/BloodCellVision-Setup-2.1.1-Win7-64bit.exe) (87 MB) |
| **Windows 7 SP1, 8 or 8.1** (32-bit) | [BloodCellVision-Setup-2.1.1-Win7-32bit.exe](https://github.com/himodj/bloodcell-visionary/raw/main/installers/BloodCellVision-Setup-2.1.1-Win7-32bit.exe) (83 MB) |

Not sure which one? Right-click **This PC** (or **Computer**), choose **Properties** and read
"System type".

Then:

1. Run the downloaded file. It is not code-signed, so Windows SmartScreen may warn: choose
   "More info", then "Run anyway".
2. Start BloodCellVision and click **Self-test** on the home screen. It should report 7 of 7.

## About this version

Version 2 runs the model **inside the app**. There is no Python, TensorFlow or Keras on the
user's computer, no background server and no network access. The installer is about 100 MB
(version 1 was 367 MB).

## Install (end users)

Run `BloodCellVision-Setup-2.1.1.exe`. It installs for the current Windows user (no
administrator rights), adds Desktop and Start Menu shortcuts and an entry in
"Apps & features" for uninstalling. Windows 10 or 11, 64-bit.

For Windows 7 SP1, 8 and 8.1 use `BloodCellVision-Setup-2.1.1-Win7-64bit.exe` or
`...-Win7-32bit.exe`. These are the same application built on Electron 22, the last
version that runs on those systems (it no longer receives security updates). When printing
directly, the page footer with the page count is missing; "Save as PDF" has it.

If BloodCellVision 1.0 is installed, uninstall it first (your saved reports in
`Documents\BloodCellVision Reports` are kept and open in version 2).

After the first start, click **Self-test** on the home screen. It classifies seven
reference images shipped with the app and must report 7 of 7.

## What changed from version 1

| | Version 1 | Version 2 |
|---|---|---|
| Model runtime | Python + TensorFlow/Keras server on port 5000 | ONNX Runtime (WebAssembly) inside the app |
| Model file | `model.h5` (did not load, see below) | `resources/model/bloodcell.onnx` |
| Model loading | manual, failed on most machines | automatic at start-up, status shown on the home screen |
| Results | class + confidence | class + confidence + probability of all 8 classes, low-confidence warning |
| Several cells in one image | no | located, boxed, labelled and classified one by one |
| Reports | saved on request, edits often lost | filed automatically, every edit saved, print and PDF |
| Installer | 367 MB | ~100 MB |

All other features are kept: patient information, image upload / drag-and-drop / camera
capture, editable cell type, possible conditions and recommendations, doctor notes, lab
management, report template designer, formal report with print, report archive, search and
re-opening saved reports.

### Why version 1 could not load the model

`model.h5` was written by Keras 3.8 with an incomplete entry for its top-level input layer
(the entry has no shape). `keras.models.load_model()` therefore rejects the file on every
Python / Keras version, which is why changing versions never helped. The trained weights in
the file are intact.

`tools/convert_h5_to_onnx.py` rebuilds the network from the architecture stored in the file,
copies the weights by layer name, exports ONNX and checks that ONNX and Keras give the same
output (largest difference in any class probability: 0.0000018).

## Model facts the app relies on

Stored in `resources/model/bloodcell.json`:

- input 360 x 360 RGB; pixels divided by 255 (as in training, `rescale=1./255`)
- images are centre-cropped to a square, then resized
- output order: IG Immature White Cell, Basophil, Eosinophil, Erythroblast, Lymphocyte,
  Monocyte, Neutrophil, Platelet

## Images with several cells

The model itself was trained on images that show one cell. For a field with several cells
the app adds a locating step in front of it (`src/inference/detect.ts`):

1. Stained nuclei are found by colour (blue/purple well above green), thresholded with
   Otsu's method; lobes of one nucleus are joined; specks much smaller than the largest
   nucleus are ignored.
2. Around each nucleus a square window of 3 x the median nucleus diameter is cut, which
   reproduces the framing of the training images at any magnification.
3. Each window is classified by the unchanged model. Boxes, numbers and labels are drawn
   on the image.

On the home screen choose **Auto detect**, **One cell** or **Several cells**.

Measured with the app's own pipeline:

| Test | Result |
|---|---|
| 40 fields assembled from 311 labelled single-cell images | 311 of 311 cells found, 305 classified correctly (98.1%), no extra boxes |
| 364 real fields from another microscope (BCCD), 372 marked white cells | 369 found (99.2%), 14 extra boxes |
| 297 single-cell images in Auto mode | 292 treated as single-cell, 5 split into two boxes |

Limits: touching or overlapping white cells are boxed as one; platelets and red cells are
not located (classify a platelet image with **One cell**); cell-type accuracy on fields from
other microscopes and stains has not been measured. Wrong boxes can be removed and any cell
type corrected in the results table.

## Report archive

Every completed analysis gets a report number (`BCV-YYYYMMDD-NNN`) and is filed
automatically in `Documents\BloodCellVision Reports\<number>_<patient>\`:

| File | Content |
|---|---|
| `report.json` | patient, cells (type, confidence, box, probabilities), texts, model, lab details |
| `original.png/jpg` | the image exactly as analysed |
| `annotated.png` | the image with labelled boxes |
| `Report.html` | the printable report, self-contained |
| `Report.pdf` | written by "Save as PDF" |

Every later edit (patient details, cell types, removed boxes, conditions, recommendations,
doctor's notes) is saved to the same folder within half a second, and `Report.html` is
rebuilt. Search Reports lists the archive, searches by patient name, patient ID, report
number or cell type, reopens a report for editing and deletes to the Recycle Bin. Reports
saved by versions 1.x and 2.0 are listed and can be reopened.

Print Report (Ctrl+P), Save as PDF (Ctrl+Shift+P) and Save Report (Ctrl+S) are at the top
of the results page and in the File menu. Printing opens a preview window and the Windows
print dialog; if the printer refuses the job, the report is opened as a PDF instead.

The report layout is defined in one place, `src/report/buildReportHtml.ts`, and is used
for the preview, for printing, for PDF export and for the archived `Report.html`. Lab
details and the report template are also kept in `%APPDATA%\BloodCellVision\settings.json`.

## Build from source (developers)

Requires Node.js 20 or newer. Nothing else.

```
npm install
npm start          # build the UI and run the app
npm run dist       # build release/BloodCellVision-Setup-<version>.exe
npm run dist:win7-x64   # Windows 7/8 build, 64-bit
npm run dist:win7-x86   # Windows 7/8 build, 32-bit
```

`npm run dist` works on Windows, macOS and Linux. It packages the app with
electron-builder and builds the installer with NSIS (`build/installer.nsi`).

Checks:

```
npm run selftest                         # classify the bundled reference images, exit code 0 = pass
npx electron scripts/e2e.cjs --image <cell.jpg> --field <field.jpg> --shots <folder>   # drive the UI end to end
npx electron scripts/eval-fields.cjs --mosaic <dir> --bccd <dir>                    # measure multi-cell analysis
```

## Using a retrained model

```
pip install "tensorflow-cpu>=2.16" tf2onnx onnx onnxruntime h5py numpy
python tools/convert_h5_to_onnx.py model.h5 resources/model/bloodcell.onnx
npm run dist
```

If the classes or their order changed, edit `labels` in `resources/model/bloodcell.json`
to match `train_generator.class_indices`.

To try a model without rebuilding: home screen > Model details > "Use another model
(.onnx)". Put a `.json` with the same name next to the `.onnx` if its labels differ.

## Layout

```
electron/main.cjs          main process: window, app:// protocol, model file, reports
electron/preload.cjs       bridge exposed to the UI as window.electron
src/inference/engine.ts    model loading, cell windows, classification, self-test
src/inference/detect.ts    locating nuclei in multi-cell images
src/report/                report document, annotated image, lab/template settings
src/contexts/AnalysisContext.tsx   analysis state and automatic archiving
src/inference/worker.ts    ONNX Runtime session (runs in a worker thread)
src/                       React user interface
resources/model/           bloodcell.onnx, bloodcell.json, self-test reference images
tools/convert_h5_to_onnx.py  Keras .h5 -> ONNX converter with verification
build/installer.nsi        Windows installer script
scripts/                   build helpers and the end-to-end check
```

Logs: `%APPDATA%\BloodCellVision\app-debug.log` (File > Open Log File).
Reports: `Documents\BloodCellVision Reports`.

Self-test reference images are from the public PBC dataset (Acevedo et al., Mendeley Data,
CC BY 4.0).

BloodCellVision is a research and education tool, not a diagnostic device.
