/**
 * Test photos for the upload tests, drawn in the browser (no files in the repo). "photo" looks like
 * a camera picture (gradients, shapes, grain) and is several MB at 4000 x 3000; "noise" is random
 * pixels that no encoder can shrink much; "text" is dark text on white, like a size chart.
 */
import type { Page } from "@playwright/test";

export type PhotoSpec = { width: number; height: number; kind?: "photo" | "noise" | "text" | "transparent"; type?: "image/jpeg" | "image/png"; quality?: number; seed?: number };

export async function makePhoto(page: Page, spec: PhotoSpec): Promise<Buffer> {
  const base64 = await page.evaluate(async (s) => {
    const kind = s.kind ?? "photo";
    const c = document.createElement("canvas");
    c.width = s.width; c.height = s.height;
    const ctx = c.getContext("2d")!;
    let seed = (s.seed ?? 1) * 9301 + 49297;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    if (kind === "noise") {
      const img = ctx.createImageData(s.width, s.height);
      for (let i = 0; i < img.data.length; i += 4) { img.data[i] = rnd() * 255; img.data[i + 1] = rnd() * 255; img.data[i + 2] = rnd() * 255; img.data[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    } else if (kind === "text") {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, s.width, s.height);
      ctx.fillStyle = "#111"; ctx.font = `${Math.round(s.height / 60)}px sans-serif`;
      for (let y = 40; y < s.height; y += Math.round(s.height / 45)) ctx.fillText(`Size ${Math.round(rnd() * 99)}   Chest ${Math.round(rnd() * 120)}   Waist ${Math.round(rnd() * 99)}   Length ${Math.round(rnd() * 99)}   Shoulder ${Math.round(rnd() * 60)}`, 40, y);
    } else {
      const g = ctx.createLinearGradient(0, 0, s.width, s.height);
      g.addColorStop(0, "#2b4a2a"); g.addColorStop(0.5, "#c9a86a"); g.addColorStop(1, "#27384d");
      ctx.fillStyle = g; ctx.fillRect(0, 0, s.width, s.height);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `hsla(${rnd() * 360}, 60%, ${30 + rnd() * 40}%, ${0.2 + rnd() * 0.5})`;
        ctx.beginPath(); ctx.arc(rnd() * s.width, rnd() * s.height, 20 + rnd() * s.width / 12, 0, Math.PI * 2); ctx.fill();
      }
      // fine grain, like a sensor
      const grain = ctx.getImageData(0, 0, s.width, s.height);
      for (let i = 0; i < grain.data.length; i += 4) { const n = (rnd() - 0.5) * 38; grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n; }
      ctx.putImageData(grain, 0, 0);
      if (kind === "transparent") {
        // knock out a corner so the picture has real transparency
        ctx.clearRect(0, 0, s.width / 2, s.height / 2);
      }
    }
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), s.type ?? "image/jpeg", s.quality ?? 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }, spec);
  return Buffer.from(base64, "base64");
}

/** Adds an EXIF "orientation" tag to a JPEG (6 = the camera was held upright; the stored pixels are rotated). */
export function withExifOrientation(jpeg: Buffer, orientation: number): Buffer {
  const tiff = Buffer.from([0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, 0, 0, 0, 0]);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const len = exif.length + 2;
  const segment = Buffer.concat([Buffer.from([0xff, 0xe1, len >> 8, len & 255]), exif]);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

export type MultipartFile = { field: string; filename: string; type: string; bytes: number; data: Buffer };

/** Pulls the files out of a multipart request body (enough for these tests). */
export function multipartFiles(body: Buffer, contentType: string): MultipartFile[] {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!boundary) return [];
  const delimiter = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  const files: MultipartFile[] = [];
  let pos = body.indexOf(delimiter);
  while (pos !== -1) {
    const next = body.indexOf(delimiter, pos + delimiter.length);
    if (next === -1) break;
    const part = body.subarray(pos + delimiter.length + 2, next - 2); // skip CRLF around the part
    const headerEnd = part.indexOf("\r\n\r\n");
    const headers = part.subarray(0, headerEnd).toString("latin1");
    const m = /name="([^"]*)"; filename="([^"]*)"/.exec(headers);
    if (m) {
      const data = part.subarray(headerEnd + 4);
      files.push({ field: m[1], filename: m[2], type: /Content-Type: ([^\r\n]+)/i.exec(headers)?.[1] ?? "", bytes: data.length, data });
    }
    pos = next;
  }
  return files;
}
