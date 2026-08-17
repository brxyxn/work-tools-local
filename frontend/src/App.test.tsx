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
  test("keeps the app sidebar outside third-party sidebar selectors", async () => {
    render(<App services={createMemoryServices()} />);

    const navigation = await screen.findByRole("navigation", { name: "Tools" });
    const sidebar = navigation.closest("aside");

    expect(sidebar).toHaveClass("app-sidebar");
    expect(sidebar).not.toHaveClass("sidebar");
  });

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

  test("restores and saves Text Diff drafts, flushing edits before a tool switch", async () => {
    const user = userEvent.setup();
    const services = createMemoryServices({
      state: {
        payloads: [],
        selectedPayloadId: null,
        textDiffDraft: { originalText: "before", changedText: "after", viewMode: "unified", updatedAt: 1 },
        settings: {},
      },
    });
    const firstLaunch = render(<App services={services} />);

    const original = await screen.findByLabelText("Original text");
    expect(original).toHaveValue("before");
    expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute("aria-pressed", "true");

    await user.clear(original);
    await user.type(original, "edited before switch");
    await user.click(screen.getByRole("button", { name: "JSON Visualizer" }));

    expect((await services.workspace.load()).state?.textDiffDraft).toMatchObject({
      originalText: "edited before switch",
      changedText: "after",
      viewMode: "unified",
    });

    firstLaunch.unmount();
    render(<App services={services} />);
    await user.click(await screen.findByRole("button", { name: "Text Diff" }));
    expect(await screen.findByLabelText("Original text")).toHaveValue("edited before switch");
  });

  test("keeps edited Text Diff input visible and reports a failed draft write", async () => {
    const user = userEvent.setup();
    const services = createMemoryServices();
    services.workspace.saveTextDiffDraft = vi.fn().mockRejectedValue(new Error("database is busy"));
    render(<App services={services} />);

    const original = await screen.findByLabelText("Original text");
    await user.type(original, "visible edit");
    fireEvent.blur(original);

    expect(original).toHaveValue("visible edit");
    expect(await screen.findByRole("alert")).toHaveTextContent("database is busy");
  });

  test("keeps Text Diff active with edited input when its pre-switch flush fails", async () => {
    const user = userEvent.setup();
    const services = createMemoryServices();
    services.workspace.saveTextDiffDraft = vi.fn().mockRejectedValue(new Error("database is busy"));
    render(<App services={services} />);

    const original = await screen.findByLabelText("Original text");
    await user.type(original, "do not lose this edit");
    await user.click(screen.getByRole("button", { name: "JSON Visualizer" }));

    expect(screen.getByRole("heading", { name: "Text Diff" })).toBeVisible();
    expect(screen.getByLabelText("Original text")).toHaveValue("do not lose this edit");
    expect(screen.getByRole("alert")).toHaveTextContent("database is busy");
  });
});
