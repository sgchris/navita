import { buildBackgroundMenu, buildItemMenu } from "./contextMenu";
import { uiFont } from "./measure";

async function checkContextMenus(): Promise<void> {
  try {
    const menus = [await buildItemMenu(), await buildBackgroundMenu()];
    await Promise.all(menus.map((m) => m.close()));
    console.info("[navita] selfcheck context menus ok");
  } catch (error) {
    console.error("[navita] selfcheck context menus failed", error);
  }
}

/** Canvas text measurement (used for middle truncation) must agree with real DOM layout. */
function checkTextMeasurement(): void {
  const sample = "The quick brown fox jumps over the lazy dog 0123456789.pdf";
  for (const [size, weight] of [
    [13, 400],
    [12, 400],
  ] as const) {
    const font = uiFont(size, weight);
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    context.font = font;
    const canvasWidth = context.measureText(sample).width;
    const span = document.createElement("span");
    span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${font}`;
    span.textContent = sample;
    document.body.append(span);
    const domWidth = span.getBoundingClientRect().width;
    span.remove();
    const level = Math.abs(canvasWidth - domWidth) > 2 ? "warn" : "info";
    console[level](
      `[navita] selfcheck text ${size}px canvas=${canvasWidth.toFixed(1)} dom=${domWidth.toFixed(1)} font="${context.font}"`,
    );
  }
}

/** Dev only: boot-time checks of things the agent cannot see. */
export async function runDevSelfCheck(): Promise<void> {
  if (!import.meta.env.DEV) return;
  await checkContextMenus();
  checkTextMeasurement();
}
