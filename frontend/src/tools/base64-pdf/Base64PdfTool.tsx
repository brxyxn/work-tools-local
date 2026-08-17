import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { IconClipboard, IconDeviceFloppy, IconFileTypePdf, IconFolderOpen, IconTrash, IconX } from "@tabler/icons-react";

import type { FilePort } from "../../services/types";
import { decodeBase64ToPdf } from "./decode";

const PdfPreview = lazy(() => import("./PdfPreview").then((module) => ({ default: module.PdfPreview })));

export function Base64PdfTool({ files }: { files: FilePort }) {
  const [input, setInput] = useState("");
  const [pdfBytes, setPdfBytes] = useState<Uint8Array<ArrayBuffer> | null>(null);
  const [pdfURL, setPdfURL] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "status" | "alert"; text: string } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => { urlRef.current = pdfURL; }, [pdfURL]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const showPDF = (bytes: Uint8Array<ArrayBuffer>) => {
    const nextURL = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setPdfURL((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextURL;
    });
    setPdfBytes(bytes);
  };

  const closePreview = useCallback(() => {
    setPdfURL((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!pdfURL) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closePreview, pdfURL]);

  const decode = () => {
    try {
      showPDF(decodeBase64ToPdf(input));
      setMessage({ kind: "status", text: "PDF decoded." });
    } catch (error) {
      setMessage({ kind: "alert", text: error instanceof Error ? error.message : "Failed to decode." });
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return setMessage({ kind: "alert", text: "Clipboard is empty." });
      setInput(text);
      setMessage({ kind: "status", text: "Pasted from clipboard." });
    } catch {
      setMessage({ kind: "alert", text: "Couldn't read the clipboard. Check browser permissions." });
    }
  };

  const openText = async () => {
    try {
      const result = await files.openBase64TextFile();
      if (result.cancelled) return;
      setInput(result.text ?? "");
      setMessage({ kind: "status", text: `Loaded ${result.name ?? "text file"}.` });
    } catch (error) {
      setMessage({ kind: "alert", text: error instanceof Error ? error.message : "Couldn't read that file." });
    }
  };

  const save = async () => {
    if (!pdfBytes) return;
    try {
      const result = await files.saveDecodedPDF("decoded.pdf", pdfBytes);
      if (!result.cancelled) setMessage({ kind: "status", text: "PDF saved." });
    } catch (error) {
      setMessage({ kind: "alert", text: error instanceof Error ? error.message : "Couldn't save the PDF." });
    }
  };

  const clear = () => {
    setInput("");
    setPdfBytes(null);
    setPdfURL((current) => { if (current) URL.revokeObjectURL(current); return null; });
    setMessage(null);
  };

  return (
    <div className="base64-pdf-tool">
      <label htmlFor="base64-input">Base64 input</label>
      <textarea
        id="base64-input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); decode(); }
        }}
        placeholder="Paste base64-encoded PDF text…"
        spellCheck={false}
      />
      <div className="tool-actions">
        <button type="button" className="primary-action" onClick={decode} disabled={!input.trim()}><IconFileTypePdf size={17} />Decode</button>
        <button type="button" onClick={() => void paste()}><IconClipboard size={17} />Paste from clipboard</button>
        <button type="button" onClick={() => void openText()}><IconFolderOpen size={17} />Open .txt</button>
        {pdfBytes && <button type="button" onClick={() => void save()}><IconDeviceFloppy size={17} />Save PDF</button>}
        {(input || pdfBytes) && <button type="button" className="clear-action" onClick={clear}><IconTrash size={17} />Clear</button>}
      </div>
      {message && <div className={`tool-message ${message.kind}`} role={message.kind}>{message.text}</div>}
      <div className="pdf-preview-section">
        {pdfURL && (
          <div className="pdf-preview-toolbar">
            <span>PDF preview</span>
            <button type="button" onClick={closePreview}><IconX size={16} />Close preview</button>
          </div>
        )}
        <div className="pdf-preview-frame">
          {pdfURL ? <Suspense fallback={<p>Loading viewer…</p>}><PdfPreview key={pdfURL} url={pdfURL} /></Suspense> : <p>Decode some base64 to preview the PDF here.</p>}
        </div>
      </div>
    </div>
  );
}
