import { useEffect, useRef, useState } from "react";
import { IconDownload, IconMoon, IconSun, IconTrash } from "@tabler/icons-react";

import type { FilePort } from "../../services/types";
import {
  diagramBackgroundFor,
  exportFileName,
  exportFormats,
  exportScales,
  normalizeSvgForExport,
  svgToBytes,
  type DiagramTheme,
  type ExportFormat,
  type ExportScale,
} from "./diagram";
import { rasterizeSvg } from "./raster";
import { renderDiagram } from "./render";

const sampleDiagram = `flowchart TD
  A[Write Mermaid source] --> B{Valid syntax?}
  B -- Yes --> C[Live preview]
  B -- No --> D[Inline error]
  C --> E[Export PNG / JPG / SVG]`;

const renderDelay = 280;

interface MermaidToolProps {
  files: FilePort;
  appTheme: DiagramTheme;
}

export function MermaidTool({ files, appTheme }: MermaidToolProps) {
  const [source, setSource] = useState(sampleDiagram);
  const [diagramTheme, setDiagramTheme] = useState<DiagramTheme>(appTheme);
  const [scale, setScale] = useState<ExportScale>(2);
  const [svg, setSvg] = useState<string | null>(null);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "status" | "alert"; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const themePinned = useRef(false);

  // The diagram follows the application theme until the reader picks one.
  useEffect(() => {
    if (!themePinned.current) setDiagramTheme(appTheme);
  }, [appTheme]);

  useEffect(() => {
    const trimmed = source.trim();
    if (!trimmed) {
      setSvg(null);
      setSyntaxError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderDiagram(trimmed, diagramTheme)
        .then((rendered) => {
          if (cancelled) return;
          setSvg(rendered);
          setSyntaxError(null);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setSyntaxError(error instanceof Error ? error.message : "The diagram could not be rendered.");
        });
    }, renderDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [diagramTheme, source]);

  const selectTheme = (theme: DiagramTheme) => {
    themePinned.current = true;
    setDiagramTheme(theme);
  };

  const exportDiagram = async (format: ExportFormat) => {
    if (!svg) return;
    setMessage(null);
    setExporting(true);
    try {
      const background = diagramBackgroundFor(diagramTheme);
      const bytes =
        format === "svg"
          ? svgToBytes(normalizeSvgForExport(svg, background).svg)
          : await rasterizeSvg(svg, { format, scale, background });
      const result = await files.saveDiagram(exportFileName(format), format, bytes);
      if (!result.cancelled) {
        setMessage({
          kind: "status",
          text: `Diagram exported to ${result.path ?? exportFileName(format)}.`,
        });
      }
    } catch (error) {
      setMessage({
        kind: "alert",
        text:
          error instanceof Error
            ? error.message
            : `Couldn't export the diagram as ${format.toUpperCase()}.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const clear = () => {
    setSource("");
    setSvg(null);
    setSyntaxError(null);
    setMessage(null);
  };

  return (
    <div className="mermaid-tool">
      <div className="mermaid-toolbar">
        <div className="mermaid-theme-switch" role="group" aria-label="Diagram theme">
          <button
            type="button"
            aria-pressed={diagramTheme === "light"}
            onClick={() => selectTheme("light")}
          >
            <IconSun size={15} aria-hidden="true" />
            Light
          </button>
          <button
            type="button"
            aria-pressed={diagramTheme === "dark"}
            onClick={() => selectTheme("dark")}
          >
            <IconMoon size={15} aria-hidden="true" />
            Dark
          </button>
        </div>

        <label className="mermaid-scale" htmlFor="mermaid-scale">
          Image scale
          <select
            id="mermaid-scale"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value) as ExportScale)}
          >
            {exportScales.map((option) => (
              <option key={option} value={option}>
                {option}×
              </option>
            ))}
          </select>
        </label>

        <div className="mermaid-exports">
          {exportFormats.map((definition) => (
            <button
              key={definition.format}
              type="button"
              disabled={!svg || exporting}
              onClick={() => void exportDiagram(definition.format)}
            >
              <IconDownload size={15} aria-hidden="true" />
              {`Export ${definition.label}`}
            </button>
          ))}
          <button type="button" className="clear-action" onClick={clear} disabled={!source}>
            <IconTrash size={15} aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      {message && (
        <div className={`tool-message ${message.kind}`} role={message.kind}>
          {message.text}
        </div>
      )}

      <div className="mermaid-panes">
        <div className="mermaid-editor">
          <label htmlFor="mermaid-source">Diagram source</label>
          <textarea
            id="mermaid-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="flowchart TD&#10;  A[Start] --> B[Finish]"
            spellCheck={false}
          />
          {syntaxError && (
            <pre className="mermaid-syntax-error" role="alert">
              {syntaxError}
            </pre>
          )}
        </div>

        <div className="mermaid-preview">
          <span className="mermaid-preview-label">Preview</span>
          <div className="mermaid-canvas" data-diagram-theme={diagramTheme}>
            {svg ? (
              // Mermaid renders with securityLevel "strict", which escapes any
              // HTML in diagram labels before it reaches this markup.
              <div className="mermaid-figure" dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <p>Write some Mermaid source to preview the diagram here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
