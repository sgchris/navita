import { describe, expect, it } from "vitest";
import { trashConfirmationText } from "./trashMessage";

describe("trashConfirmationText", () => {
  it("names a single item", () => {
    expect(trashConfirmationText(["report.pdf"])).toBe(
      "Are you sure you want to move “report.pdf” to the Trash?\n\nYou can restore items from the Trash.",
    );
  });

  it("keeps quotes and emoji in the name intact", () => {
    expect(trashConfirmationText(['a "b" 😀.txt'])).toContain('“a "b" 😀.txt”');
  });

  it("counts several items", () => {
    expect(trashConfirmationText(["a", "b", "c"])).toBe(
      "Are you sure you want to move these 3 items to the Trash?\n\nYou can restore items from the Trash.",
    );
  });
});
