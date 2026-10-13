import { writeFileSync } from "node:fs";
import process from "node:process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

// TEMPORARY (M0 spike S1): receives the swatch report from the app. Removed in M0.5.
const swatchSink = (): Plugin => ({
  name: "swatch-sink",
  configureServer(server) {
    server.middlewares.use("/__swatch", (req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        writeFileSync(process.env.SWATCH_OUT ?? "swatch.json", body);
        res.end("ok");
      });
    });
  },
});

export default defineConfig({
  plugins: [react(), swatchSink()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "safari16",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
