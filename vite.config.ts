import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Cross-origin isolation lets the ONNX Runtime use multiple threads.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  base: "./",
  server: { host: "localhost", port: 8080, headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  plugins: [react()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  build: { target: "chrome108", chunkSizeWarningLimit: 2000 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
