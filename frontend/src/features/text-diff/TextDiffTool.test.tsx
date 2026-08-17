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
