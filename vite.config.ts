import { defineConfig } from "vite";
export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: { input: { game: "index.html", vision: "vision.html" } },
  },
  worker: { format: "es" },
  server: { host: "127.0.0.1" },
});
