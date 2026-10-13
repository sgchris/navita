// TEMPORARY (M0 spike S1): reports how each system color token resolves in light and dark.
import { useEffect, useRef } from "react";

const TOKENS = [
  "--label",
  "--label-secondary",
  "--label-tertiary",
  "--separator",
  "--accent",
  "--selection-bg",
  "--selection-bg-unemphasized",
  "--selection-text",
  "--content-bg",
  "--control-bg",
];
const KEYWORDS = [
  "-apple-system-label",
  "-apple-system-secondary-label",
  "-apple-system-tertiary-label",
  "-apple-system-separator",
  "-apple-system-control-accent",
  "-apple-system-selected-content-background",
  "-apple-system-unemphasized-selected-content-background",
  "-apple-system-alternate-selected-control-text",
  "-apple-system-text-background",
];

export function Swatches() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const result: Record<string, unknown> = {
      supports: Object.fromEntries(KEYWORDS.map((k) => [k, CSS.supports("color", k)])),
      prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    };
    for (const scheme of ["light", "dark"]) {
      const wrap = ref.current?.querySelector<HTMLElement>(`[data-scheme="${scheme}"]`);
      if (!wrap) continue;
      const out: Record<string, string> = {};
      for (const token of TOKENS) {
        const probe = wrap.querySelector<HTMLElement>(`[data-token="${token}"]`);
        if (probe) out[token] = getComputedStyle(probe).color;
      }
      result[scheme] = out;
    }
    void fetch("/__swatch", { method: "POST", body: JSON.stringify(result, null, 2) });
  }, []);

  return (
    <div ref={ref} style={{ padding: 16, background: "var(--content-bg)", height: "100%" }}>
      {["light", "dark"].map((scheme) => (
        <div key={scheme} data-scheme={scheme} style={{ colorScheme: scheme, padding: 8 }}>
          <b>{scheme}</b>
          {TOKENS.map((t) => (
            <span
              key={t}
              data-token={t}
              style={{ color: `var(${t})`, background: "#888", marginRight: 8 }}
            >
              {t}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
