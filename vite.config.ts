import { defineConfig } from "vite";
export default defineConfig({
  root: "src/viewer",
  server: {
    host: "127.0.0.1",
    proxy: { "/live": { target: "ws://127.0.0.1:4174", ws: true } },
  },
  build: { outDir: "../../dist/viewer", emptyOutDir: true },
});
