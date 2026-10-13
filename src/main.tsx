import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { commands } from "./api/commands";
import { installDevLog } from "./lib/devLog";
import { installKeyboard } from "./lib/keyboard";
import {
  initWindowActiveClass,
  installNativeFeelGuards,
  showWindowAfterPaint,
} from "./lib/platform";
import { useListing } from "./state/listing";
import { useNavigation } from "./state/navigation";
import { installWiring } from "./state/wiring";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/toolbar.css";
import "./styles/file-list.css";
import "./styles/icon-grid.css";
import "./styles/states.css";

async function boot(): Promise<void> {
  installDevLog();
  installNativeFeelGuards();
  installWiring();
  installKeyboard();
  void initWindowActiveClass();

  const home = await commands.homeDir();
  useNavigation.getState().setHomePath(home);

  const root = document.getElementById("root");
  if (!root) throw new Error("#root not found");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  showWindowAfterPaint();
  await useNavigation.getState().init(null);
  console.info(
    `[navita] ready path=${useNavigation.getState().currentPath} entries=${useListing.getState().entries.length}`,
  );
}

void boot();
