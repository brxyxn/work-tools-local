import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import App from "./App";

vi.mock("@wailsio/runtime", () => ({
  Call: { ByID: vi.fn() },
  Events: { On: vi.fn() },
  WML: { Reload: vi.fn() },
}));

describe("Work Tools shell", () => {
  test("navigation exposes exactly the three implemented tools", () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", { name: "Tools" });
    const toolButtons = within(navigation).getAllByRole("button");

    expect(toolButtons).toHaveLength(3);
    expect(toolButtons.map((button) => button.textContent)).toEqual([
      "Text Diff",
      "JSON Visualizer",
      "Base64 → PDF",
    ]);
    expect(screen.queryByText(/UUID/i)).not.toBeInTheDocument();
  });

  test("selecting a tool changes the active workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "JSON Visualizer" }));

    expect(screen.getByRole("heading", { name: "JSON Visualizer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JSON Visualizer" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Command-K opens a searchable list containing only implemented tools", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const dialog = screen.getByRole("dialog", { name: "Find a tool" });
    expect(within(dialog).getAllByRole("option")).toHaveLength(3);
    expect(screen.queryByText(/UUID/i)).not.toBeInTheDocument();
  });

  test("theme control switches the document theme", async () => {
    const user = userEvent.setup();
    render(<App />);

    const themeButton = screen.getByRole("button", { name: /theme/i });
    const startingTheme = document.documentElement.dataset.theme;
    await user.click(themeButton);

    expect(document.documentElement.dataset.theme).not.toBe(startingTheme);
  });
});
