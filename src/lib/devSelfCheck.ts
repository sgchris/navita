import { buildBackgroundMenu, buildItemMenu } from "./contextMenu";

/** Dev only: proves at boot that the context menus can be built (API shapes and permissions). */
export async function runDevSelfCheck(): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    const menus = [await buildItemMenu(), await buildBackgroundMenu()];
    await Promise.all(menus.map((m) => m.close()));
    console.info("[navita] selfcheck context menus ok");
  } catch (error) {
    console.error("[navita] selfcheck context menus failed", error);
  }
}
