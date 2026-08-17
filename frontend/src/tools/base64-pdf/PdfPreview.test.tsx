import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const pdfSlick = vi.hoisted(() => ({
  destroy: vi.fn(),
  unbindEvents: vi.fn(),
  _cleanup: vi.fn(),
  viewer: { setDocument: vi.fn() },
  linkService: { setDocument: vi.fn() },
  document: null,
}));

vi.mock("@pdfslick/react", () => ({
  usePDFSlick: () => ({
    viewerRef: vi.fn(),
    usePDFSlickStore: vi.fn(),
    PDFSlickViewer: () => <div>PDF viewer</div>,
    store: { getState: () => ({ pdfSlick }) },
  }),
}));
vi.mock("@pdfslick/react/dist/pdf_viewer.css", () => ({}));

import { PdfPreview } from "./PdfPreview";

test("destroys PdfSlick on unmount even before its document resolves", () => {
  const view = render(<PdfPreview url="blob:preview" />);

  view.unmount();

  expect(pdfSlick.destroy).toHaveBeenCalledOnce();
});
