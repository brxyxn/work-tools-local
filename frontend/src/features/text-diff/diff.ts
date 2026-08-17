import { diffLines, diffWordsWithSpace } from "diff";

export interface DiffSegment {
  value: string;
  highlight: boolean;
}

export interface DiffCell {
  lineNo: number;
  segments: DiffSegment[];
}

export type DiffRowType = "unchanged" | "added" | "removed" | "modified";

export interface DiffRow {
  type: DiffRowType;
  left: DiffCell | null;
  right: DiffCell | null;
}

export interface UnifiedRow {
  type: "unchanged" | "added" | "removed";
  sign: " " | "+" | "-";
  leftNo: number | null;
  rightNo: number | null;
  segments: DiffSegment[];
}

export interface DiffStats {
  additions: number;
  deletions: number;
}

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function diffWordSegments(left: string, right: string): { left: DiffSegment[]; right: DiffSegment[] } {
  const leftSegments: DiffSegment[] = [];
  const rightSegments: DiffSegment[] = [];
  for (const part of diffWordsWithSpace(left, right)) {
    if (part.added) rightSegments.push({ value: part.value, highlight: true });
    else if (part.removed) leftSegments.push({ value: part.value, highlight: true });
    else {
      leftSegments.push({ value: part.value, highlight: false });
      rightSegments.push({ value: part.value, highlight: false });
    }
  }
  return { left: leftSegments, right: rightSegments };
}

export function getAlignedDiff(original: string, changed: string): DiffRow[] {
  const parts = diffLines(original, changed);
  const rows: DiffRow[] = [];
  let leftLineNo = 0;
  let rightLineNo = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part.added && !part.removed) {
      for (const line of splitLines(part.value)) {
        leftLineNo += 1;
        rightLineNo += 1;
        const cell = { segments: [{ value: line, highlight: false }] };
        rows.push({
          type: "unchanged",
          left: { lineNo: leftLineNo, ...cell },
          right: { lineNo: rightLineNo, ...cell },
        });
      }
      continue;
    }

    if (part.removed && parts[index + 1]?.added) {
      const removedLines = splitLines(part.value);
      const addedLines = splitLines(parts[index + 1].value);
      for (let lineIndex = 0; lineIndex < Math.max(removedLines.length, addedLines.length); lineIndex += 1) {
        const left = removedLines[lineIndex];
        const right = addedLines[lineIndex];
        if (left !== undefined && right !== undefined) {
          leftLineNo += 1;
          rightLineNo += 1;
          const segments = diffWordSegments(left, right);
          rows.push({
            type: "modified",
            left: { lineNo: leftLineNo, segments: segments.left },
            right: { lineNo: rightLineNo, segments: segments.right },
          });
        } else if (left !== undefined) {
          leftLineNo += 1;
          rows.push({ type: "removed", left: { lineNo: leftLineNo, segments: [{ value: left, highlight: true }] }, right: null });
        } else if (right !== undefined) {
          rightLineNo += 1;
          rows.push({ type: "added", left: null, right: { lineNo: rightLineNo, segments: [{ value: right, highlight: true }] } });
        }
      }
      index += 1;
      continue;
    }

    for (const line of splitLines(part.value)) {
      if (part.removed) {
        leftLineNo += 1;
        rows.push({ type: "removed", left: { lineNo: leftLineNo, segments: [{ value: line, highlight: true }] }, right: null });
      } else {
        rightLineNo += 1;
        rows.push({ type: "added", left: null, right: { lineNo: rightLineNo, segments: [{ value: line, highlight: true }] } });
      }
    }
  }
  return rows;
}

export function getUnifiedDiff(rows: DiffRow[]): UnifiedRow[] {
  return rows.flatMap((row): UnifiedRow[] => {
    if (row.type === "unchanged") return [{ type: "unchanged", sign: " ", leftNo: row.left!.lineNo, rightNo: row.right!.lineNo, segments: row.left!.segments }];
    if (row.type === "removed") return [{ type: "removed", sign: "-", leftNo: row.left!.lineNo, rightNo: null, segments: row.left!.segments }];
    if (row.type === "added") return [{ type: "added", sign: "+", leftNo: null, rightNo: row.right!.lineNo, segments: row.right!.segments }];
    return [
      { type: "removed", sign: "-", leftNo: row.left!.lineNo, rightNo: null, segments: row.left!.segments },
      { type: "added", sign: "+", leftNo: null, rightNo: row.right!.lineNo, segments: row.right!.segments },
    ];
  });
}

export function getDiffStats(rows: DiffRow[]): DiffStats {
  return rows.reduce((stats, row) => ({
    additions: stats.additions + (row.type === "added" || row.type === "modified" ? 1 : 0),
    deletions: stats.deletions + (row.type === "removed" || row.type === "modified" ? 1 : 0),
  }), { additions: 0, deletions: 0 });
}
