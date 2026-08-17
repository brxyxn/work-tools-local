import { describe, expect, test } from "vitest";

import { decodeBase64ToPdf } from "./decode";

describe("decodeBase64ToPdf", () => {
  test("preserves whitespace-tolerant PDF decoding", () => {
    const bytes = decodeBase64ToPdf("JVBERi0xLjQK\nJSVFT0Y=");
    expect(new TextDecoder().decode(bytes)).toBe("%PDF-1.4\n%%EOF");
  });

  test.each([
    ["", "Nothing to decode — paste some base64 text first."],
    ["not-base64", "That doesn't look like valid base64."],
    ["aGVsbG8=", "The decoded data is not a PDF file."],
  ])("rejects %j with the existing message", (input, message) => {
    expect(() => decodeBase64ToPdf(input)).toThrow(message);
  });
});
