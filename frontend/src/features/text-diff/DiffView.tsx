import { Fragment } from "react";

import type { DiffCell, DiffRow, DiffSegment, UnifiedRow } from "./diff";

function Segments({ segments, highlightClass }: { segments: DiffSegment[]; highlightClass: string }) {
  return segments.map((segment, index) => segment.highlight
    ? <span key={index} className={highlightClass}>{segment.value}</span>
    : <Fragment key={index}>{segment.value}</Fragment>);
}

function LineNumber({ value, side }: { value: number | null; side: "Original" | "Changed" }) {
  return <div className="diff-line-number" role="cell" aria-label={value === null ? `${side}: no line` : `${side} line ${value}`}>{value ?? ""}</div>;
}

function Cell({ cell, highlightClass, className = "", label }: { cell: DiffCell | null; highlightClass: string; className?: string; label: string }) {
  return <div className={`diff-content ${className}`} role="cell" aria-label={label}>{cell ? <Segments segments={cell.segments} highlightClass={highlightClass} /> : "\u200b"}</div>;
}

function splitChange(row: DiffRow, side: "Original" | "Changed") {
  if (row.type === "unchanged") return "unchanged";
  if (row.type === "modified") return side === "Original" ? "removed" : "added";
  if (row.type === "removed") return side === "Original" ? "removed" : "no line";
  return side === "Changed" ? "added" : "no line";
}

function cellLabel(side: "Original" | "Changed", cell: DiffCell | null, change: string) {
  return cell ? `${side} line ${cell.lineNo}, ${change}: ${cell.segments.map((segment) => segment.value).join("")}` : `${side}: ${change}`;
}

export function SplitDiffView({ rows }: { rows: DiffRow[] }) {
  return <div className="diff-table diff-table-split" role="table" aria-label="Side-by-side text diff">
    {rows.map((row, index) => {
      const leftClass = row.type === "removed" || row.type === "modified" ? "diff-removed" : row.type === "added" ? "diff-placeholder" : "";
      const rightClass = row.type === "added" || row.type === "modified" ? "diff-added" : row.type === "removed" ? "diff-placeholder" : "";
      const leftChange = splitChange(row, "Original");
      const rightChange = splitChange(row, "Changed");
      return <div key={index} className="diff-row" role="row" aria-label={`${row.type[0].toUpperCase()}${row.type.slice(1)} text`}>
        <LineNumber value={row.left?.lineNo ?? null} side="Original" />
        <Cell cell={row.left} highlightClass="diff-highlight-removed" className={leftClass} label={cellLabel("Original", row.left, leftChange)} />
        <LineNumber value={row.right?.lineNo ?? null} side="Changed" />
        <Cell cell={row.right} highlightClass="diff-highlight-added" className={rightClass} label={cellLabel("Changed", row.right, rightChange)} />
      </div>;
    })}
  </div>;
}

export function UnifiedDiffView({ rows }: { rows: UnifiedRow[] }) {
  return <div className="diff-table diff-table-unified" role="table" aria-label="Unified text diff">
    {rows.map((row, index) => {
      const color = row.type === "added" ? "diff-added" : row.type === "removed" ? "diff-removed" : "";
      const highlight = row.type === "added" ? "diff-highlight-added" : "diff-highlight-removed";
      const text = row.segments.map((segment) => segment.value).join("");
      return <div key={index} className="diff-row" role="row" aria-label={`${row.type[0].toUpperCase()}${row.type.slice(1)} text`}>
        <LineNumber value={row.leftNo} side="Original" />
        <LineNumber value={row.rightNo} side="Changed" />
        <div className={`diff-sign ${color}`} role="cell" aria-label={row.type}>{row.sign}</div>
        <div className={`diff-content ${color}`} role="cell" aria-label={`${row.type} line: ${text}`}><Segments segments={row.segments} highlightClass={highlight} /></div>
      </div>;
    })}
  </div>;
}
