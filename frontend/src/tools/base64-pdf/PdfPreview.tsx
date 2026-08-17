import { useEffect } from "react";
import { usePDFSlick } from "@pdfslick/react";
import "@pdfslick/react/dist/pdf_viewer.css";

export function PdfPreview({ url }: { url: string }) {
  const { viewerRef, usePDFSlickStore, PDFSlickViewer, store } = usePDFSlick(url, {
    scaleValue: "page-width",
  });

  useEffect(() => () => {
    const pdfSlick = store.getState().pdfSlick;
    if (!pdfSlick) return;
    void pdfSlick.destroy();
  }, [store]);

  return (
    <div className="pdfSlick pdf-preview">
      <PDFSlickViewer {...{ viewerRef, usePDFSlickStore }} />
    </div>
  );
}
