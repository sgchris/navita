import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { events } from "./api/events";
import { commands } from "./api/commands";
import { installDevLog } from "./lib/devLog";
import { runDevSelfCheck } from "./lib/devSelfCheck";
import { dispatchAction } from "./lib/actions";
import { installKeyboard } from "./lib/keyboard";
import { installLiveRefresh } from "./lib/liveRefresh";
import { installMenuSync, syncMenu } from "./lib/menuSync";
import {
  initWindowActiveClass,
  installNativeFeelGuards,
  installWindowTitle,
  showWindowAfterPaint,
} from "./lib/platform";
import { useListing } from "./state/listing";
import { useNavigation } from "./state/navigation";
import { usePlaces } from "./state/places";
import { usePrefs } from "./state/prefs";
import { useTree } from "./state/tree";
import { installWiring } from "./state/wiring";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/toolbar.css";
import "./styles/file-list.css";
import "./styles/icon-grid.css";
import "./styles/states.css";
import "./styles/sidebar.css";

async function boot(): Promise<void> {
  installDevLog();
  installNativeFeelGuards();
  installWiring();
  installKeyboard();
  installWindowTitle();
  installMenuSync();
  void installLiveRefresh();
  void events.onMenu((id) => {
    if (import.meta.env.DEV) console.info(`[navita] menu ${id}`);
    dispatchAction(id);
    syncMenu(true);
  });
  void initWindowActiveClass();

  const [home] = await Promise.all([commands.homeDir(), usePlaces.getState().load()]);
  useNavigation.getState().setHomePath(home);

  const root = document.getElementById("root");
  if (!root) throw new Error("#root not found");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  showWindowAfterPaint();
  void runDevSelfCheck();
  await useNavigation.getState().init(null);
  await useTree.getState().init({
    homePath: home,
    currentPath: useNavigation.getState().currentPath,
    saved: usePrefs.getState().expandedTreePaths,
  });
  console.info(
    `[navita] ready tree=${[...useTree.getState().expanded].join(",")} places=${usePlaces
      .getState()
      .places.map((p) => p.name)
      .join(",")}`,
  );
  console.info(
    `[navita] ready path=${useNavigation.getState().currentPath} entries=${useListing.getState().entries.length}`,
  );
}

void boot();
