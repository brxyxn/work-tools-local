import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenView(): never {
  throw new Error("render failed");
}

test("offers a recovery action when the workspace cannot render", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  render(
    <AppErrorBoundary>
      <BrokenView />
    </AppErrorBoundary>,
  );

  expect(screen.getByRole("heading", { name: "Work Tools encountered a problem" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Reload Work Tools" })).toBeVisible();
});
