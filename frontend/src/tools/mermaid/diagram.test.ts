import { expect, test } from "vitest";

import {
  diagramBackgroundFor,
  exportFileName,
  mermaidThemeFor,
  normalizeSvgForExport,
  svgToBytes,
} from "./diagram";

const mermaidSvg =
  '<svg aria-roledescription="flowchart-v2" width="100%" viewBox="0 0 420.5 260.25" ' +
  'style="max-width: 420.5px;" xmlns="http://www.w3.org/2000/svg"><g><text>Start</text></g></svg>';

test("maps each theme to its Mermaid theme and export backdrop", () => {
  expect(mermaidThemeFor("light")).toBe("default");
  expect(mermaidThemeFor("dark")).toBe("dark");
  expect(diagramBackgroundFor("light")).toBe("#ffffff");
  expect(diagramBackgroundFor("dark")).toBe("#11151b");
});

test("names exports after the requested format", () => {
  expect(exportFileName("png")).toBe("diagram.png");
  expect(exportFileName("jpg")).toBe("diagram.jpg");
  expect(exportFileName("svg")).toBe("diagram.svg");
});

test("replaces the responsive Mermaid sizing with the intrinsic pixel size", () => {
  const normalized = normalizeSvgForExport(mermaidSvg, "#ffffff");

  expect(normalized).toMatchObject({ width: 421, height: 261 });
  const root = new DOMParser().parseFromString(normalized.svg, "image/svg+xml").querySelector("svg");
  expect(root?.getAttribute("width")).toBe("421");
  expect(root?.getAttribute("height")).toBe("261");
  expect(root?.getAttribute("style")).toBe("background-color: #ffffff;");
  expect(root?.getAttribute("viewBox")).toBe("0 0 420.5 260.25");
});

test("bakes the diagram backdrop into the exported SVG", () => {
  const normalized = normalizeSvgForExport(mermaidSvg, "#11151b");

  expect(normalized.svg).toContain("background-color: #11151b;");
  expect(normalized.svg).not.toContain("max-width");
  expect(normalized.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
});

test("falls back to the width and height attributes when no viewBox exists", () => {
  const normalized = normalizeSvgForExport(
    '<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg"></svg>',
    "#ffffff",
  );

  expect(normalized).toMatchObject({ width: 300, height: 150 });
  expect(normalized.svg).toContain('viewBox="0 0 300 150"');
});

test("rejects markup that is not an SVG document", () => {
  expect(() => normalizeSvgForExport("<p>not a diagram</p>", "#ffffff")).toThrow(/valid SVG/);
});

test("encodes SVG exports as UTF-8 bytes", () => {
  const bytes = svgToBytes('<svg><text>café</text></svg>');

  expect(new TextDecoder().decode(bytes)).toBe('<svg><text>café</text></svg>');
});
