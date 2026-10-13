/** Dev only: forwards errors and console output to the Vite dev server (see vite.config.ts). */
export function installDevLog(): void {
  if (!import.meta.env.DEV) return;

  const send = (level: string, parts: unknown[]) => {
    const message = parts
      .map((p) => (p instanceof Error ? (p.stack ?? p.message) : String(p)))
      .join(" ");
    void fetch("/__devlog", { method: "POST", body: JSON.stringify({ level, message }) }).catch(
      () => undefined,
    );
  };

  window.addEventListener("error", (e) =>
    send("error", ["Uncaught", e.message, e.filename, e.lineno]),
  );
  window.addEventListener("unhandledrejection", (e) =>
    send("error", ["Uncaught (in promise)", e.reason]),
  );
  for (const level of ["error", "warn", "info"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      send(level, args);
      original(...args);
    };
  }
}
