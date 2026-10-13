import type { PointerEvent } from "react";
import { usePrefs } from "../state/prefs";

/** 6 px invisible drag handle on the sidebar's right edge (180-400 px, spec 8.1). */
export function Splitter() {
  const setSidebarWidth = usePrefs((s) => s.setSidebarWidth);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = usePrefs.getState().sidebarWidth;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) =>
      setSidebarWidth(startWidth + (ev.clientX - startX));
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  return <div className="splitter" onPointerDown={onPointerDown} />;
}
