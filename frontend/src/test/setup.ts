import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

vi.stubGlobal("ResizeObserver", TestResizeObserver);
Element.prototype.scrollIntoView = vi.fn();
URL.createObjectURL = vi.fn(() => "blob:work-tools-test");
URL.revokeObjectURL = vi.fn();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
