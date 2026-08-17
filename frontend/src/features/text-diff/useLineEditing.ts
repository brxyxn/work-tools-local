import { useLayoutEffect, useRef } from "react";

import { deleteLines, moveLines, type TextState } from "./textarea-edit";

export function useLineEditing(value: string, onChange: (value: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (ref.current && selection) {
      ref.current.setSelectionRange(selection.start, selection.end);
      pendingSelection.current = null;
    }
  }, [value]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    const state: TextState = { value: target.value, selectionStart: target.selectionStart, selectionEnd: target.selectionEnd };
    let next: TextState | null = null;
    if (event.altKey && event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      next = moveLines(state, event.key === "ArrowUp" ? "up" : "down");
    } else if (event.metaKey && (event.key === "Backspace" || event.key === "Delete")) {
      next = deleteLines(state);
    }
    if (!next) return;
    event.preventDefault();
    if (next === state) return;
    pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
    onChange(next.value);
  };

  return { ref, onKeyDown };
}
