import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { createMemoryServices } from "../../services/memory";
import { Base64PdfTool } from "./Base64PdfTool";

vi.mock("./PdfPreview", () => ({ PdfPreview: () => <div>PDF preview</div> }));

test("decodes whitespace-tolerant PDF input and saves the same bytes", async () => {
  const user = userEvent.setup();
  const services = createMemoryServices();
  services.files.saveDecodedPDF = vi.fn().mockResolvedValue({ cancelled: false, path: "/tmp/decoded.pdf" });
  render(<Base64PdfTool files={services.files} />);

  await user.type(screen.getByLabelText("Base64 input"), "JVBERi0xLjQK{enter}JSVFT0Y=");
  await user.click(screen.getByRole("button", { name: "Decode" }));
  expect(await screen.findByText("PDF preview")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Save PDF" }));
  expect(services.files.saveDecodedPDF).toHaveBeenCalledOnce();
  const bytes = vi.mocked(services.files.saveDecodedPDF).mock.calls[0][1];
  expect(new TextDecoder().decode(bytes)).toBe("%PDF-1.4\n%%EOF");
});

test("shows the existing invalid PDF message", async () => {
  const user = userEvent.setup();
  const services = createMemoryServices();
  render(<Base64PdfTool files={services.files} />);

  await user.type(screen.getByLabelText("Base64 input"), "aGVsbG8=");
  await user.click(screen.getByRole("button", { name: "Decode" }));

  expect(screen.getByRole("alert")).toHaveTextContent("The decoded data is not a PDF file.");
});

test("loads text selected through the native file service", async () => {
  const user = userEvent.setup();
  const services = createMemoryServices();
  services.files.openBase64TextFile = vi.fn().mockResolvedValue({
    cancelled: false,
    name: "payload.txt",
    text: "JVBERi0=",
  });
  render(<Base64PdfTool files={services.files} />);

  await user.click(screen.getByRole("button", { name: "Open .txt" }));

  expect(screen.getByLabelText("Base64 input")).toHaveValue("JVBERi0=");
  expect(screen.getByRole("status")).toHaveTextContent("Loaded payload.txt.");
});

test("closes the PDF preview without clearing the Base64 input", async () => {
  const user = userEvent.setup();
  const services = createMemoryServices();
  render(<Base64PdfTool files={services.files} />);

  const input = screen.getByLabelText("Base64 input");
  await user.type(input, "JVBERi0xLjQKJSVFT0Y=");
  await user.click(screen.getByRole("button", { name: "Decode" }));
  const closeButton = screen.getByRole("button", { name: "Close preview" });

  await user.click(closeButton);

  expect(screen.queryByRole("button", { name: "Close preview" })).not.toBeInTheDocument();
  expect(input).toHaveValue("JVBERi0xLjQKJSVFT0Y=");
});

test("closes the PDF preview when Escape is pressed", async () => {
  const user = userEvent.setup();
  const services = createMemoryServices();
  render(<Base64PdfTool files={services.files} />);

  await user.type(screen.getByLabelText("Base64 input"), "JVBERi0xLjQKJSVFT0Y=");
  await user.click(screen.getByRole("button", { name: "Decode" }));
  expect(screen.getByRole("button", { name: "Close preview" })).toBeVisible();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("button", { name: "Close preview" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Base64 input")).toHaveValue("JVBERi0xLjQKJSVFT0Y=");
});
