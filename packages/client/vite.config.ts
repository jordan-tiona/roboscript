import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  resolve: {
    // Point directly at engine source during development — no need to build first
    alias: {
      "@roboscript/engine": path.resolve(__dirname, "../engine/src/index.ts"),
    },
  },
});
