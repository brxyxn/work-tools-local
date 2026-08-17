/** Decode Base64 into PDF bytes without uploading or persisting the content. */
export function decodeBase64ToPdf(raw: string): Uint8Array<ArrayBuffer> {
  const cleaned = raw.replace(/\s+/g, "");
  if (!cleaned) {
    throw new Error("Nothing to decode — paste some base64 text first.");
  }

  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new Error("That doesn't look like valid base64.");
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const isPdf =
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46;
  if (!isPdf) {
    throw new Error("The decoded data is not a PDF file.");
  }

  return bytes;
}
