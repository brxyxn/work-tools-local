import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import type { TextDiffDraft } from "../../../bindings/github.com/brxyxn/work-tools-local/internal/storage/models";
import type { WorkspacePort } from "../../services/types";
import { getAlignedDiff, getDiffStats, getUnifiedDiff } from "./diff";
import { SplitDiffView, UnifiedDiffView } from "./DiffView";
import { useLineEditing } from "./useLineEditing";

type ViewMode = "split" | "unified";
type DraftContent = Pick<TextDiffDraft, "originalText" | "changedText" | "viewMode">;

const debounceMs = 350;

export interface TextDiffToolProps {
  initialDraft: TextDiffDraft;
  workspace: WorkspacePort;
  onMutationError: (message: string | null) => void;
  onDraftChange?: (draft: TextDiffDraft) => void;
  flushRef?: MutableRefObject<(() => Promise<void>) | null>;
}

export function TextDiffTool({ initialDraft, workspace, onMutationError, onDraftChange, flushRef }: TextDiffToolProps) {
  const initialViewMode: ViewMode = initialDraft.viewMode === "unified" ? "unified" : "split";
  const initialContent: DraftContent = { originalText: initialDraft.originalText, changedText: initialDraft.changedText, viewMode: initialViewMode };
  const [original, setOriginal] = useState(initialContent.originalText);
  const [changed, setChanged] = useState(initialContent.changedText);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const draftRef = useRef<DraftContent>(initialContent);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainRef = useRef<Promise<void> | null>(null);

  const drainSaves = useCallback(async () => {
    while (savedRevisionRef.current < revisionRef.current) {
      const revision = revisionRef.current;
      const snapshot = draftRef.current;
      try {
        await workspace.saveTextDiffDraft({ ...snapshot, updatedAt: Date.now() });
        savedRevisionRef.current = revision;
        onMutationError(null);
      } catch (error) {
        onMutationError(error instanceof Error ? error.message : "Unable to save the Text Diff draft.");
        if (revision === revisionRef.current) throw error;
      }
    }
  }, [draftRef, onMutationError, workspace]);

  const persist = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    while (savedRevisionRef.current < revisionRef.current) {
      let drain = drainRef.current;
      if (!drain) {
        drain = drainSaves();
        drainRef.current = drain;
        drain.then(
          () => { if (drainRef.current === drain) drainRef.current = null; },
          () => { if (drainRef.current === drain) drainRef.current = null; },
        );
      }
      await drain;
    }
  }, [drainSaves]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void persist().catch(() => undefined); }, debounceMs);
  }, [persist]);

  const updateDraft = useCallback((next: DraftContent) => {
    draftRef.current = next;
    revisionRef.current += 1;
    setOriginal(next.originalText);
    setChanged(next.changedText);
    setViewMode(next.viewMode as ViewMode);
    onDraftChange?.({ ...next, updatedAt: Date.now() });
    scheduleSave();
  }, [draftRef, onDraftChange, scheduleSave, setChanged, setOriginal, setViewMode]);

  useEffect(() => {
    if (flushRef) flushRef.current = persist;
    return () => {
      if (flushRef?.current === persist) flushRef.current = null;
      void persist().catch(() => undefined);
    };
  }, [flushRef, persist]);

  const originalEditing = useLineEditing(original, (value) => updateDraft({ ...draftRef.current, originalText: value }));
  const changedEditing = useLineEditing(changed, (value) => updateDraft({ ...draftRef.current, changedText: value }));
  const rows = useMemo(() => getAlignedDiff(original, changed), [original, changed]);
  const stats = useMemo(() => getDiffStats(rows), [rows]);
  const hasInput = original.length > 0 || changed.length > 0;
  const identical = hasInput && stats.additions === 0 && stats.deletions === 0;

  return <div className="text-diff-tool">
    <div className="text-diff-inputs">
      <label>Original text
        <textarea aria-label="Original text" value={original} spellCheck={false}
          placeholder="Paste the original text…"
          onChange={(event) => updateDraft({ ...draftRef.current, originalText: event.target.value })}
          onBlur={() => void persist().catch(() => undefined)} {...originalEditing} />
      </label>
      <label>Changed text
        <textarea aria-label="Changed text" value={changed} spellCheck={false}
          placeholder="Paste the changed text…"
          onChange={(event) => updateDraft({ ...draftRef.current, changedText: event.target.value })}
          onBlur={() => void persist().catch(() => undefined)} {...changedEditing} />
      </label>
    </div>
    <div className="text-diff-actions">
      <button type="button" onClick={() => updateDraft({ ...draftRef.current, originalText: changed, changedText: original })} disabled={!hasInput}>Swap</button>
      <button type="button" onClick={() => updateDraft({ ...draftRef.current, originalText: "", changedText: "" })} disabled={!hasInput}>Clear</button>
      <div className="diff-stats" aria-label="Diff totals"><span>+{stats.additions}</span><span>−{stats.deletions}</span></div>
    </div>
    <div className="diff-view-toggle" aria-label="Diff view">
      <button type="button" aria-pressed={viewMode === "split"} onClick={() => updateDraft({ ...draftRef.current, viewMode: "split" })}>Side by side</button>
      <button type="button" aria-pressed={viewMode === "unified"} onClick={() => updateDraft({ ...draftRef.current, viewMode: "unified" })}>Unified</button>
    </div>
    {!hasInput ? <div className="diff-empty-state">Enter text in both fields to compare.</div>
      : identical ? <div className="diff-empty-state">The two texts are identical.</div>
        : viewMode === "split" ? <SplitDiffView rows={rows} /> : <UnifiedDiffView rows={getUnifiedDiff(rows)} />}
  </div>;
}
