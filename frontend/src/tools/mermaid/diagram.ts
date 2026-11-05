export type DiagramTheme = "light" | "dark";
export type ExportFormat = "png" | "jpg" | "svg";

export interface ExportFormatDefinition {
  format: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
}

export const exportFormats: readonly ExportFormatDefinition[] = [
  { format: "png", label: "PNG", extension: ".png", mimeType: "image/png" },
  { format: "jpg", label: "JPG", extension: ".jpg", mimeType: "image/jpeg" },
  { format: "svg", label: "SVG", extension: ".svg", mimeType: "image/svg+xml" },
] as const;

export const exportScales = [1, 2, 3] as const;
export type ExportScale = (typeof exportScales)[number];

/** Raster exports fall back to this size when the SVG declares none. */
const fallbackSize = { width: 1200, height: 800 } as const;

export function mermaidThemeFor(theme: DiagramTheme): "default" | "dark" {
  return theme === "dark" ? "dark" : "default";
}

/**
 * Diagrams render on an opaque backdrop so a dark-theme export stays readable
 * when it is dropped into a light document, and so JPG — which has no alpha
 * channel — never turns its transparent pixels black.
 */
export function diagramBackgroundFor(theme: DiagramTheme): string {
  return theme === "dark" ? "#11151b" : "#ffffff";
}

export function exportFileName(format: ExportFormat): string {
  return `diagram${definitionFor(format).extension}`;
}

export function definitionFor(format: ExportFormat): ExportFormatDefinition {
  const definition = exportFormats.find((candidate) => candidate.format === format);
  if (!definition) throw new Error(`Unsupported export format: ${format}`);
  return definition;
}

export interface NormalizedSvg {
  svg: string;
  width: number;
  height: number;
}

/**
 * Mermaid returns an SVG sized to its container through a `max-width` style and
 * a relative width. Exports need the intrinsic pixel size, a self-contained
 * namespace, and the diagram backdrop baked in.
 */
export function normalizeSvgForExport(svg: string, background: string): NormalizedSvg {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.querySelector("svg");
  if (!root || parsed.querySelector("parsererror")) {
    throw new Error("The rendered diagram is not a valid SVG document.");
  }

  const { width, height } = intrinsicSize(root);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  root.setAttribute("style", `background-color: ${background};`);

  return { svg: new XMLSerializer().serializeToString(root), width, height };
}

export function svgToBytes(svg: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(svg);
}

function intrinsicSize(root: Element): { width: number; height: number } {
  const viewBox = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: Math.ceil(viewBox[2]), height: Math.ceil(viewBox[3]) };
  }

  const width = pixelLength(root.getAttribute("width"));
  const height = pixelLength(root.getAttribute("height"));
  if (width > 0 && height > 0) return { width, height };

  return { ...fallbackSize };
}

function pixelLength(value: string | null): number {
  if (!value || value.includes("%")) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : 0;
}
