import type { AppError } from "../api/commands";
import { describeError } from "../lib/open";

export function ErrorState({ error }: { error: AppError }) {
  const message =
    error.code === "permissionDenied"
      ? "Navita doesn’t have permission to view this folder."
      : `This folder can’t be opened: ${describeError(error)}`;
  return (
    <div className="state">
      <div>{message}</div>
    </div>
  );
}
