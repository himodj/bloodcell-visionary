// Copies the ONNX Runtime WebAssembly runtime into public/ort so it is shipped
// inside the app and loaded locally (the app never touches the network).
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dst = join(root, 'public', 'ort');
mkdirSync(dst, { recursive: true });
for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  if (!existsSync(join(src, f))) {
    console.error(`Missing ${f} - run "npm install" first.`);
    process.exit(1);
  }
  copyFileSync(join(src, f), join(dst, f));
}
console.log('ONNX Runtime WebAssembly files copied to public/ort');
