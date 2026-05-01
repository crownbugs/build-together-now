import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      // strict:true + a narrow allowlist was occasionally rejecting legitimate
      // dependency requests on the Lovable preview, which the proxy surfaced as
      // 502s. Loosening this keeps dev imports resolving reliably.
      strict: false,
      allow: [path.resolve(import.meta.dirname)],
    },
    host: true,
    // Don't crash the dev server on transient HMR errors — the preview should
    // recover on the next save instead of going dark.
    hmr: {
      overlay: false,
    },
  },
});
