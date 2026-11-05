import { definitionFor, normalizeSvgForExport, type ExportFormat } from "./diagram";

export interface RasterOptions {
  format: Exclude<ExportFormat, "svg">;
  scale: number;
  background: string;
}

const jpegQuality = 0.95;

/** Rasterises a rendered diagram SVG to PNG or JPG bytes through a canvas. */
export async function rasterizeSvg(
  svg: string,
  { format, scale, background }: RasterOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const normalized = normalizeSvgForExport(svg, background);
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized.svg)}`,
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(normalized.width * scale));
  canvas.height = Math.max(1, Math.round(normalized.height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This system cannot rasterise the diagram.");
  // JPG has no alpha channel, so the backdrop is painted before the diagram.
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, definitionFor(format).mimeType);
  return new Uint8Array(await blob.arrayBuffer());
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The diagram could not be converted to an image."));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The diagram could not be encoded as an image."));
      },
      mimeType,
      jpegQuality,
    );
  });
}
