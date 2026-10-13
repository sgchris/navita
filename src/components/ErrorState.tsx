import { commands, toAppError, type AppError } from "../api/commands";
import { Lock } from "../lib/icons";
import { describeError } from "../lib/open";
import { selectCanBack, useNavigation } from "../state/navigation";
import { useUi } from "../state/ui";

/** Shown when the current folder cannot be listed (spec 8.8). */
export function ErrorState({ error }: { error: AppError }) {
  const canBack = useNavigation(selectCanBack);
  const permissionDenied = error.code === "permissionDenied";

  const openPrivacySettings = () => {
    commands.openFullDiskAccessSettings().catch((e) => {
      useUi.getState().flash(`Couldn’t open Privacy Settings: ${describeError(toAppError(e))}`);
    });
  };
  const goBack = () => {
    const navigation = useNavigation.getState();
    void (canBack ? navigation.back() : navigation.home());
  };

  return (
    <div className="state">
      <Lock size={32} strokeWidth={1.5} />
      <div>
        {permissionDenied
          ? "Navita doesn’t have permission to view this folder."
          : `This folder can’t be opened: ${describeError(error)}`}
      </div>
      {permissionDenied && (
        <button
          type="button"
          className="state__button state__button--primary"
          onClick={openPrivacySettings}
        >
          Open Privacy Settings…
        </button>
      )}
      <button type="button" className="state__button" onClick={goBack}>
        Go Back
      </button>
    </div>
  );
}
