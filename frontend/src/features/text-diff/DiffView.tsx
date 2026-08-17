import { Fragment } from "react";

import type { DiffCell, DiffRow, DiffSegment, UnifiedRow } from "./diff";

function Segments({ segments, highlightClass }: { segments: DiffSegment[]; highlightClass: string }) {
  return segments.map((segment, index) => segment.highlight
    ? <span key={index} className={highlightClass}>{segment.value}</span>
    : <Fragment key={index}>{segment.value}</Fragment>);
}

function LineNumber({ value }: { value: number | null }) {
  return <div className="diff-line-number" aria-hidden="true">{value ?? ""}</div>;
}

function Cell({ cell, highlightClass, className = "" }: { cell: DiffCell | null; highlightClass: string; className?: string }) {
  return <div className={`diff-content ${className}`}>{cell ? <Segments segments={cell.segments} highlightClass={highlightClass} /> : "\u200b"}</div>;
}

export function SplitDiffView({ rows }: { rows: DiffRow[] }) {
  return <div className="diff-table diff-table-split" aria-label="Side-by-side text diff">
    {rows.flatMap((row, index) => {
      const leftClass = row.type === "removed" || row.type === "modified" ? "diff-removed" : row.type === "added" ? "diff-placeholder" : "";
      const rightClass = row.type === "added" || row.type === "modified" ? "diff-added" : row.type === "removed" ? "diff-placeholder" : "";
      return [
        <LineNumber key={`${index}-left-number`} value={row.left?.lineNo ?? null} />,
        <Cell key={`${index}-left`} cell={row.left} highlightClass="diff-highlight-removed" className={leftClass} />,
        <LineNumber key={`${index}-right-number`} value={row.right?.lineNo ?? null} />,
        <Cell key={`${index}-right`} cell={row.right} highlightClass="diff-highlight-added" className={rightClass} />,
      ];
    })}
  </div>;
}

export function UnifiedDiffView({ rows }: { rows: UnifiedRow[] }) {
  return <div className="diff-table diff-table-unified" aria-label="Unified text diff">
    {rows.flatMap((row, index) => {
      const color = row.type === "added" ? "diff-added" : row.type === "removed" ? "diff-removed" : "";
      const highlight = row.type === "added" ? "diff-highlight-added" : "diff-highlight-removed";
      return [
        <LineNumber key={`${index}-left-number`} value={row.leftNo} />,
        <LineNumber key={`${index}-right-number`} value={row.rightNo} />,
        <div key={`${index}-sign`} className={`diff-sign ${color}`} aria-hidden="true">{row.sign}</div>,
        <div key={`${index}-content`} className={`diff-content ${color}`}><Segments segments={row.segments} highlightClass={highlight} /></div>,
      ];
    })}
  </div>;
}
