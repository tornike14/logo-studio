// Reads and writes .ico files. Many websites only offer a favicon.ico, often holding old BMP images.
import { encodePng } from './core.mjs';

export function writeIco(pngs) {
  // pngs: [{ size, data }], PNG payloads, which every browser since 2008 reads.
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const p = 6 + 16 * i;
    header[p] = size >= 256 ? 0 : size;
    header[p + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(data.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

function dibToPng(buf, width, height) {
  const headerSize = buf.readUInt32LE(0);
  const bpp = buf.readUInt16LE(14);
  const compression = buf.readUInt32LE(16);
  if (compression !== 0 || ![1, 4, 8, 24, 32].includes(bpp)) return null;
  const colours = bpp <= 8 ? (buf.readUInt32LE(32) || 1 << bpp) : 0;
  const paletteAt = headerSize;
  const xorAt = paletteAt + colours * 4;
  const stride = Math.ceil((width * bpp) / 32) * 4;
  const maskStride = Math.ceil(width / 32) * 4;
  const andAt = xorAt + stride * height;
  const rgba = new Uint8Array(width * height * 4);
  let anyAlpha = false;
  for (let y = 0; y < height; y++) {
    const row = xorAt + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (bpp === 32 || bpp === 24) {
        const p = row + x * (bpp / 8);
        rgba[o] = buf[p + 2]; rgba[o + 1] = buf[p + 1]; rgba[o + 2] = buf[p];
        rgba[o + 3] = bpp === 32 ? buf[p + 3] : 255;
        if (bpp === 32 && buf[p + 3]) anyAlpha = true;
      } else {
        const bit = x * bpp;
        const byte = buf[row + (bit >> 3)];
        const index = (byte >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1);
        const c = paletteAt + index * 4;
        rgba[o] = buf[c + 2]; rgba[o + 1] = buf[c + 1]; rgba[o + 2] = buf[c]; rgba[o + 3] = 255;
      }
    }
  }
  if (bpp !== 32 || !anyAlpha) {
    if (andAt + maskStride * height <= buf.length) {
      for (let y = 0; y < height; y++) {
        const row = andAt + (height - 1 - y) * maskStride;
        for (let x = 0; x < width; x++) if ((buf[row + (x >> 3)] >> (7 - (x & 7))) & 1) rgba[(y * width + x) * 4 + 3] = 0;
      }
    } else if (bpp === 32) for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  }
  return encodePng(rgba, width, height, 4);
}

// The largest image inside an .ico, as a PNG, or null when it cannot be read.
export function icoToPng(buf) {
  const count = buf.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const p = 6 + 16 * i;
    if (p + 16 > buf.length) break;
    entries.push({ width: buf[p] || 256, height: buf[p + 1] || 256, size: buf.readUInt32LE(p + 8), offset: buf.readUInt32LE(p + 12) });
  }
  entries.sort((a, b) => b.width - a.width);
  for (const e of entries) {
    const data = buf.subarray(e.offset, e.offset + e.size);
    if (data.length < 8) continue;
    if (data.readUInt32BE(0) === 0x89504e47) return { png: Buffer.from(data), width: e.width };
    const out = dibToPng(data, e.width, e.height);
    if (out) return { png: out, width: e.width };
  }
  return null;
}
