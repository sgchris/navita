import { Fragment } from "react";
import { cx } from "../lib/cx";
import { ancestorsOf, basename } from "../lib/paths";
import { useNavigation } from "../state/navigation";
import { usePlaces } from "../state/places";

/** Clickable breadcrumb of the current folder (decisions B27). */
export function PathBar() {
  const currentPath = useNavigation((s) => s.currentPath);
  const rootName = usePlaces((s) => s.rootName);
  const paths = currentPath === null ? [] : ancestorsOf(currentPath);
  return (
    <div className="path-bar">
      {paths.map((path, index) => (
        <Fragment key={path}>
          {index > 0 && <span className="path-bar__separator">›</span>}
          <button
            type="button"
            className={cx(
              "path-bar__segment",
              index === paths.length - 1 && "path-bar__segment--last",
            )}
            onClick={() => {
              if (path !== currentPath) void useNavigation.getState().navigate(path);
            }}
          >
            {index === 0 ? rootName : basename(path)}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
