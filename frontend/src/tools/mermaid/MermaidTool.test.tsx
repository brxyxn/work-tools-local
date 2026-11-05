import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { createMemoryServices } from "../../services/memory";
import type { DiagramTheme } from "./diagram";
import { MermaidTool } from "./MermaidTool";
import { rasterizeSvg } from "./raster";
import { renderDiagram } from "./render";

vi.mock("./render", () => ({ renderDiagram: vi.fn() }));
vi.mock("./raster", () => ({ rasterizeSvg: vi.fn() }));

const renderedSvg = (theme: DiagramTheme) =>
  `<svg data-theme="${theme}" viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg"><text>Start</text></svg>`;

beforeEach(() => {
  vi.mocked(renderDiagram).mockReset();
  vi.mocked(renderDiagram).mockImplementation(async (_source: string, theme: DiagramTheme) =>
    renderedSvg(theme),
  );
  vi.mocked(rasterizeSvg).mockReset();
  vi.mocked(rasterizeSvg).mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
});

async function previewReady(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector(".mermaid-figure svg")).not.toBeNull());
}

function setup(appTheme: DiagramTheme = "light") {
  const services = createMemoryServices();
  services.files.saveDiagram = vi.fn().mockResolvedValue({ cancelled: false, path: "/tmp/diagram" });
  const view = render(<MermaidTool files={services.files} appTheme={appTheme} />);
  return { services, ...view };
}

test("previews the seeded diagram and exports it as SVG bytes", async () => {
  const user = userEvent.setup();
  const { services, container } = setup();

  await previewReady(container);
  await user.click(screen.getByRole("button", { name: "Export SVG" }));

  await waitFor(() => expect(services.files.saveDiagram).toHaveBeenCalledOnce());
  const [name, format, bytes] = vi.mocked(services.files.saveDiagram).mock.calls[0];
  expect(name).toBe("diagram.svg");
  expect(format).toBe("svg");
  const exported = new TextDecoder().decode(bytes);
  expect(exported).toContain('width="320"');
  expect(exported).toContain("background-color: #ffffff;");
  expect(await screen.findByRole("status")).toHaveTextContent("Diagram exported to /tmp/diagram.");
});

test("rasterises PNG exports at the selected scale and saves the returned bytes", async () => {
  const user = userEvent.setup();
  const { services, container } = setup();

  await previewReady(container);
  await user.selectOptions(screen.getByLabelText("Image scale"), "3");
  await user.click(screen.getByRole("button", { name: "Export PNG" }));

  await waitFor(() => expect(services.files.saveDiagram).toHaveBeenCalledOnce());
  expect(vi.mocked(rasterizeSvg).mock.calls[0][1]).toEqual({
    format: "png",
    scale: 3,
    background: "#ffffff",
  });
  const [name, format, bytes] = vi.mocked(services.files.saveDiagram).mock.calls[0];
  expect(name).toBe("diagram.png");
  expect(format).toBe("png");
  expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47]);
});

test("exports JPG through the rasteriser as well", async () => {
  const user = userEvent.setup();
  const { services, container } = setup();

  await previewReady(container);
  await user.click(screen.getByRole("button", { name: "Export JPG" }));

  await waitFor(() => expect(services.files.saveDiagram).toHaveBeenCalledOnce());
  expect(vi.mocked(services.files.saveDiagram).mock.calls[0][1]).toBe("jpg");
  expect(vi.mocked(rasterizeSvg).mock.calls[0][1]).toMatchObject({ format: "jpg" });
});

test("starts in the application theme and re-renders when another diagram theme is chosen", async () => {
  const user = userEvent.setup();
  const { container } = setup("dark");

  await previewReady(container);
  expect(container.querySelector(".mermaid-figure svg")?.getAttribute("data-theme")).toBe("dark");
  expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");

  await user.click(screen.getByRole("button", { name: "Light" }));

  await waitFor(() =>
    expect(container.querySelector(".mermaid-figure svg")?.getAttribute("data-theme")).toBe("light"),
  );
});

test("uses the selected diagram theme as the exported backdrop", async () => {
  const user = userEvent.setup();
  const { services, container } = setup();

  await previewReady(container);
  await user.click(screen.getByRole("button", { name: "Dark" }));
  await waitFor(() => expect(renderDiagram).toHaveBeenCalledWith(expect.any(String), "dark"));
  await user.click(screen.getByRole("button", { name: "Export SVG" }));

  await waitFor(() => expect(services.files.saveDiagram).toHaveBeenCalledOnce());
  const bytes = vi.mocked(services.files.saveDiagram).mock.calls[0][2];
  expect(new TextDecoder().decode(bytes)).toContain("background-color: #11151b;");
});

test("reports invalid syntax without discarding the last rendered diagram", async () => {
  const user = userEvent.setup();
  const { container } = setup();

  await previewReady(container);
  vi.mocked(renderDiagram).mockRejectedValue(new Error("Parse error on line 2: unexpected token"));

  await user.type(screen.getByLabelText("Diagram source"), " ???");

  expect(await screen.findByRole("alert")).toHaveTextContent("Parse error on line 2");
  expect(container.querySelector(".mermaid-figure svg")).not.toBeNull();
});

test("surfaces a failed export without clearing the diagram", async () => {
  const user = userEvent.setup();
  const { services, container } = setup();
  services.files.saveDiagram = vi.fn().mockRejectedValue(new Error("disk is full"));

  await previewReady(container);
  await user.click(screen.getByRole("button", { name: "Export SVG" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("disk is full");
  expect(container.querySelector(".mermaid-figure svg")).not.toBeNull();
});

test("clearing the source empties the editor and disables the exports", async () => {
  const user = userEvent.setup();
  const { container } = setup();

  await previewReady(container);
  await user.click(screen.getByRole("button", { name: "Clear" }));

  expect(screen.getByLabelText("Diagram source")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Export PNG" })).toBeDisabled();
  expect(screen.getByText("Write some Mermaid source to preview the diagram here.")).toBeVisible();
});
