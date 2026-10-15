import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error JavaScript build-only license collector.
import { licenseNotices } from "./scripts/licenses.mjs";

export default defineConfig({
  base: "./",
  plugins: [react(), licenseNotices()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
});
