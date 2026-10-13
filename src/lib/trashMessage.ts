const RESTORE_HINT = "\n\nYou can restore items from the Trash.";

/** Text of the confirmation shown before anything is moved to the Trash. */
export function trashConfirmationText(names: readonly string[]): string {
  const [only] = names;
  const question =
    names.length === 1 && only !== undefined
      ? `Are you sure you want to move “${only}” to the Trash?`
      : `Are you sure you want to move these ${names.length} items to the Trash?`;
  return question + RESTORE_HINT;
}
