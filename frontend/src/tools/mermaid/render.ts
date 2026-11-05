import { mermaidThemeFor, type DiagramTheme } from "./diagram";

type Mermaid = (typeof import("mermaid"))["default"];

let loading: Promise<Mermaid> | null = null;
let sequence = 0;

/**
 * Mermaid is several megabytes, so it is imported on first render instead of
 * being bundled into the application entry chunk.
 */
async function loadMermaid(): Promise<Mermaid> {
  loading ??= import("mermaid").then((module) => module.default);
  return loading;
}

/** Renders Mermaid source to an SVG string, throwing on invalid syntax. */
export async function renderDiagram(source: string, theme: DiagramTheme): Promise<string> {
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: mermaidThemeFor(theme),
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  });
  await mermaid.parse(source);
  sequence += 1;
  const { svg } = await mermaid.render(`work-tools-diagram-${sequence}`, source);
  return svg;
}
