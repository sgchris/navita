import { appendFileSync } from "node:fs";
import process from "node:process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

/**
 * Dev only: receives console/error reports from the webview (see src/lib/devLog.ts) and appends
 * them to the file named by NAVITA_DEV_LOG. Without that variable the reports are discarded.
 */
const devLogSink = (): Plugin => ({
  name: "navita-dev-log",
  configureServer(server) {
    server.middlewares.use("/__devlog", (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const file = process.env.NAVITA_DEV_LOG;
        if (file) appendFileSync(file, `${body}\n`);
        res.end("ok");
      });
    });
  },
});

export default defineConfig({
  plugins: [react(), devLogSink()],
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
