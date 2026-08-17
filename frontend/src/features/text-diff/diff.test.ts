import { describe, expect, test } from "vitest";

import { getAlignedDiff, getDiffStats, getUnifiedDiff } from "./diff";
import { diffFixtures } from "./diff.fixtures";

describe("text diff fixtures", () => {
  test.each(diffFixtures)("preserves the $name fixture", ({ original, changed, types, stats }) => {
    const rows = getAlignedDiff(original, changed);

    expect(rows.map((row) => row.type)).toEqual(types);
    expect(getDiffStats(rows)).toEqual(stats);
  });

  test("aligns modified lines with word-level highlights and line numbers", () => {
    const rows = getAlignedDiff("keep\nhello old\nlast", "keep\nhello new\nlast");

    expect(rows).toEqual([
      {
        type: "unchanged",
        left: { lineNo: 1, segments: [{ value: "keep", highlight: false }] },
        right: { lineNo: 1, segments: [{ value: "keep", highlight: false }] },
      },
      {
        type: "modified",
        left: {
          lineNo: 2,
          segments: [
            { value: "hello ", highlight: false },
            { value: "old", highlight: true },
          ],
        },
        right: {
          lineNo: 2,
          segments: [
            { value: "hello ", highlight: false },
            { value: "new", highlight: true },
          ],
        },
      },
      {
        type: "unchanged",
        left: { lineNo: 3, segments: [{ value: "last", highlight: false }] },
        right: { lineNo: 3, segments: [{ value: "last", highlight: false }] },
      },
    ]);
  });

  test("flattens a modified row into removed then added unified rows", () => {
    const unified = getUnifiedDiff(getAlignedDiff("before", "after"));

    expect(unified).toEqual([
      {
        type: "removed",
        sign: "-",
        leftNo: 1,
        rightNo: null,
        segments: [{ value: "before", highlight: true }],
      },
      {
        type: "added",
        sign: "+",
        leftNo: null,
        rightNo: 1,
        segments: [{ value: "after", highlight: true }],
      },
    ]);
  });
});
