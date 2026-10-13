import { showBackgroundMenu } from "../lib/contextMenu";
import { cx } from "../lib/cx";
import { useListEntries, useVisibleEntries } from "../lib/viewModel";
import { countHidden } from "../lib/visible";
import { useListing } from "../state/listing";
import { usePrefs } from "../state/prefs";
import { useUi } from "../state/ui";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { FileList } from "./FileList";
import { IconGrid } from "./IconGrid";

/** Main pane: picks spinner, error, empty state, Icons view or List view. */
export function ContentPane() {
  const status = useListing((s) => s.status);
  const error = useListing((s) => s.error);
  const showSpinner = useListing((s) => s.showSpinner);
  const allEntries = useListing((s) => s.entries);
  const entries = useVisibleEntries();
  const listEntries = useListEntries();
  const viewMode = usePrefs((s) => s.viewMode);
  const setShowHidden = usePrefs((s) => s.setShowHidden);
  const emphasized = useUi((s) => s.focusedPane === "content" && s.windowActive);
  const setFocusedPane = useUi((s) => s.setFocusedPane);

  let body = null;
  if (showSpinner) {
    body = <div className="spinner" role="progressbar" />;
  } else if (status === "error" && error) {
    body = <ErrorState error={error} />;
  } else if (status === "ready" && viewMode === "list" && listEntries.length > 0) {
    // List view always has the ".." row (except at the root), so an empty folder still shows it.
    body = (
      <>
        <FileList entries={listEntries} />
        {entries.length === 0 && (
          <EmptyState
            belowList
            hiddenCount={countHidden(allEntries)}
            onShowHidden={() => setShowHidden(true)}
          />
        )}
      </>
    );
  } else if (status === "ready" && entries.length === 0) {
    body = (
      <EmptyState hiddenCount={countHidden(allEntries)} onShowHidden={() => setShowHidden(true)} />
    );
  } else if (status === "ready") {
    body =
      viewMode === "list" ? <FileList entries={listEntries} /> : <IconGrid entries={entries} />;
  }

  return (
    <div
      className={cx("content", emphasized && "pane--emphasized")}
      onPointerDown={() => setFocusedPane("content")}
      onContextMenu={(e) => {
        e.preventDefault();
        void showBackgroundMenu();
      }}
    >
      {body}
    </div>
  );
}
