import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import App from "./App";
import { createMemoryServices } from "./services/memory";

vi.mock("@wailsio/runtime", () => ({
  Call: { ByID: vi.fn() },
  Events: { On: vi.fn() },
  WML: { Reload: vi.fn() },
}));

describe("Work Tools shell", () => {
  test("navigation exposes exactly the three implemented tools", async () => {
    render(<App services={createMemoryServices()} />);

    const navigation = await screen.findByRole("navigation", { name: "Tools" });
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
    render(<App services={createMemoryServices()} />);

    await user.click(await screen.findByRole("button", { name: "JSON Visualizer" }));

    expect(screen.getByRole("heading", { name: "JSON Visualizer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JSON Visualizer" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Command-K opens a searchable list containing only implemented tools", async () => {
    render(<App services={createMemoryServices()} />);

    await screen.findByRole("navigation", { name: "Tools" });

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const dialog = screen.getByRole("dialog", { name: "Find a tool" });
    expect(within(dialog).getAllByRole("option")).toHaveLength(3);
    expect(screen.queryByText(/UUID/i)).not.toBeInTheDocument();
  });

  test("theme control switches the document theme", async () => {
    const user = userEvent.setup();
    render(<App services={createMemoryServices()} />);

    const themeButton = await screen.findByRole("button", { name: /theme/i });
    const startingTheme = document.documentElement.dataset.theme;
    await user.click(themeButton);

    expect(document.documentElement.dataset.theme).not.toBe(startingTheme);
  });

  test("restores the selected tool and theme from SQLite workspace state", async () => {
    render(
      <App
        services={createMemoryServices({
          state: {
            payloads: [],
            selectedPayloadId: null,
            textDiffDraft: { originalText: "", changedText: "", viewMode: "split", updatedAt: 0 },
            settings: { selected_tool: "json-visualizer", theme: "dark" },
          },
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "JSON Visualizer" })).toBeVisible();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  test("shows database recovery details instead of the workspace", async () => {
    render(
      <App
        services={createMemoryServices({
          recovery: {
            message: "database disk image is malformed",
            databasePath: "/Users/test/Library/Application Support/Work Tools/work-tools.db",
            logPath: "/Users/test/Library/Logs/Work Tools/work-tools.log",
          },
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Local data needs attention" })).toBeVisible();
    expect(screen.getByText(/work-tools\.db/)).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Tools" })).not.toBeInTheDocument();
  });

  test("keeps visible state unchanged when a settings write fails", async () => {
    const user = userEvent.setup();
    const services = createMemoryServices();
    services.workspace.saveSettings = vi.fn().mockRejectedValue(new Error("database is busy"));
    render(<App services={services} />);

    await user.click(await screen.findByRole("button", { name: "JSON Visualizer" }));

    expect(screen.getByRole("heading", { name: "Text Diff" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("database is busy");
  });
});
