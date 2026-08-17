import { describe, expect, test } from "vitest";

import { deleteLines, moveLines } from "./textarea-edit";

describe("textarea line editing", () => {
  test("moves the selected line up and restores its selection", () => {
    expect(moveLines({ value: "one\ntwo\nthree", selectionStart: 4, selectionEnd: 7 }, "up")).toEqual({
      value: "two\none\nthree",
      selectionStart: 0,
      selectionEnd: 3,
    });
  });

  test("moves a multiline selection down and keeps the full block selected", () => {
    expect(moveLines({ value: "a\nb\nc\nd", selectionStart: 2, selectionEnd: 5 }, "down")).toEqual({
      value: "a\nd\nb\nc",
      selectionStart: 4,
      selectionEnd: 7,
    });
  });

  test("does not move a line beyond the document boundary", () => {
    const top = { value: "one\ntwo", selectionStart: 0, selectionEnd: 3 };
    const bottom = { value: "one\ntwo", selectionStart: 4, selectionEnd: 7 };

    expect(moveLines(top, "up")).toBe(top);
    expect(moveLines(bottom, "down")).toBe(bottom);
  });

  test("deletes a multiline selection and restores the caret at the removed block", () => {
    expect(deleteLines({ value: "one\ntwo\nthree\nfour", selectionStart: 4, selectionEnd: 13 })).toEqual({
      value: "one\nfour",
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  test("deletes the last line by consuming its leading newline", () => {
    expect(deleteLines({ value: "one\ntwo", selectionStart: 4, selectionEnd: 7 })).toEqual({
      value: "one",
      selectionStart: 3,
      selectionEnd: 3,
    });
  });
});
