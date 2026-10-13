import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {
  initWindowActiveClass,
  installNativeFeelGuards,
  showWindowAfterPaint,
} from "./lib/platform";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";

installNativeFeelGuards();
void initWindowActiveClass();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
showWindowAfterPaint();
