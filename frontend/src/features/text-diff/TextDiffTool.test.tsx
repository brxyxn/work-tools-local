import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { createMemoryServices } from "../../services/memory";
import { TextDiffTool } from "./TextDiffTool";

test("shows split highlights, line numbers, and diff totals", () => {
  const services = createMemoryServices();
  render(
    <TextDiffTool
      initialDraft={{ originalText: "same\nold", changedText: "same\nnew", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
    />,
  );

  expect(screen.getByText("+1")).toBeVisible();
  expect(screen.getByText("−1")).toBeVisible();
  expect(screen.getAllByText("2")).toHaveLength(2);
  expect(screen.getByText("old")).toHaveClass("diff-highlight-removed");
  expect(screen.getByText("new")).toHaveClass("diff-highlight-added");
});

test("changes views, swaps inputs, clears inputs, and shows empty and identical states", async () => {
  const user = userEvent.setup();
  const services = createMemoryServices();
  render(
    <TextDiffTool
      initialDraft={{ originalText: "old", changedText: "new", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Unified" }));
  expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("-", { selector: ".diff-sign" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Swap" }));
  expect(screen.getByLabelText("Original text")).toHaveValue("new");
  expect(screen.getByLabelText("Changed text")).toHaveValue("old");

  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByText("Enter text in both fields to compare.")).toBeVisible();

  await user.type(screen.getByLabelText("Original text"), "same");
  await user.type(screen.getByLabelText("Changed text"), "same");
  expect(screen.getByText("The two texts are identical.")).toBeVisible();
});

test("restores selection after Option-Shift line movement and Command deletion shortcuts", async () => {
  const services = createMemoryServices();
  render(
    <TextDiffTool
      initialDraft={{ originalText: "one\ntwo\nthree", changedText: "", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
    />,
  );
  const original = screen.getByLabelText("Original text") as HTMLTextAreaElement;

  original.focus();
  original.setSelectionRange(4, 7);
  fireEvent.keyDown(original, { key: "ArrowUp", altKey: true, shiftKey: true });
  await waitFor(() => expect(original).toHaveValue("two\none\nthree"));
  expect(original.selectionStart).toBe(0);
  expect(original.selectionEnd).toBe(3);

  original.setSelectionRange(0, 3);
  fireEvent.keyDown(original, { key: "Delete", metaKey: true });
  await waitFor(() => expect(original).toHaveValue("one\nthree"));
  expect(original.selectionStart).toBe(0);
  expect(original.selectionEnd).toBe(0);
});

test("prevents boundary line movement without restoring a stale selection on the next edit", async () => {
  const services = createMemoryServices();
  render(
    <TextDiffTool
      initialDraft={{ originalText: "one\ntwo", changedText: "", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
    />,
  );
  const original = screen.getByLabelText("Original text") as HTMLTextAreaElement;

  original.setSelectionRange(0, 3);
  expect(fireEvent.keyDown(original, { key: "ArrowUp", altKey: true, shiftKey: true })).toBe(false);
  original.setSelectionRange(4, 7);
  fireEvent.change(original, { target: { value: "one\ntwo!" } });

  await waitFor(() => expect(original).toHaveValue("one\ntwo!"));
  expect(original.selectionStart).toBe(8);
  expect(original.selectionEnd).toBe(8);
});

test("announces split diff sides and change meaning to assistive technology", () => {
  const services = createMemoryServices();
  render(
    <TextDiffTool
      initialDraft={{ originalText: "old", changedText: "new", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
    />,
  );

  expect(screen.getByRole("table", { name: "Side-by-side text diff" })).toBeVisible();
  expect(screen.getByRole("row", { name: "Modified text" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "Original line 1, removed: old" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "Changed line 1, added: new" })).toBeVisible();
});

test("supports Command-Backspace line deletion", async () => {
  const services = createMemoryServices();
  render(
    <TextDiffTool
      initialDraft={{ originalText: "one\ntwo", changedText: "", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
    />,
  );
  const original = screen.getByLabelText("Original text") as HTMLTextAreaElement;

  original.setSelectionRange(4, 7);
  fireEvent.keyDown(original, { key: "Backspace", metaKey: true });

  await waitFor(() => expect(original).toHaveValue("one"));
  expect(original.selectionStart).toBe(3);
  expect(original.selectionEnd).toBe(3);
});

test("debounces rapid edits and persists only the latest draft", async () => {
  vi.useFakeTimers();
  const services = createMemoryServices();
  render(
    <TextDiffTool
      initialDraft={{ originalText: "", changedText: "", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
    />,
  );
  const original = screen.getByLabelText("Original text");

  fireEvent.change(original, { target: { value: "first" } });
  fireEvent.change(original, { target: { value: "latest" } });
  expect((await services.workspace.load()).state?.textDiffDraft.originalText).toBe("");

  await vi.advanceTimersByTimeAsync(350);
  expect((await services.workspace.load()).state?.textDiffDraft).toMatchObject({ originalText: "latest", changedText: "", viewMode: "split" });
  vi.useRealTimers();
});

function createDeferredSave(services: ReturnType<typeof createMemoryServices>) {
  const saveDraft = services.workspace.saveTextDiffDraft;
  const pending: Array<{ draft: Parameters<typeof saveDraft>[0]; resolve: () => void }> = [];
  services.workspace.saveTextDiffDraft = vi.fn((draft) => new Promise<void>((resolve) => {
    pending.push({ draft, resolve: () => { void saveDraft(draft).then(resolve); } });
  }));
  return pending;
}

test("flush waits for an edit made during a slow save and persists the latest draft", async () => {
  const services = createMemoryServices();
  const pending = createDeferredSave(services);
  const flushRef = { current: null as null | (() => Promise<void>) };
  render(
    <TextDiffTool
      initialDraft={{ originalText: "", changedText: "", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
      flushRef={flushRef}
    />,
  );
  const original = screen.getByLabelText("Original text");

  fireEvent.change(original, { target: { value: "first" } });
  let flushSettled = false;
  const flush = flushRef.current!().then(() => { flushSettled = true; });
  await waitFor(() => expect(pending).toHaveLength(1));
  fireEvent.change(original, { target: { value: "latest" } });
  pending[0].resolve();
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(pending[1].draft.originalText).toBe("latest");
  expect(flushSettled).toBe(false);
  pending[1].resolve();
  await flush;

  expect((await services.workspace.load()).state?.textDiffDraft.originalText).toBe("latest");
});

test("coalesces overlapping blur and switch flushes into one draft write", async () => {
  const services = createMemoryServices();
  const pending = createDeferredSave(services);
  const flushRef = { current: null as null | (() => Promise<void>) };
  render(
    <TextDiffTool
      initialDraft={{ originalText: "", changedText: "", viewMode: "split", updatedAt: 0 }}
      workspace={services.workspace}
      onMutationError={vi.fn()}
      flushRef={flushRef}
    />,
  );
  const original = screen.getByLabelText("Original text");

  fireEvent.change(original, { target: { value: "once" } });
  fireEvent.blur(original);
  const flush = flushRef.current!();
  await waitFor(() => expect(pending).toHaveLength(1));
  pending[0].resolve();
  await flush;

  expect(pending).toHaveLength(1);
});
