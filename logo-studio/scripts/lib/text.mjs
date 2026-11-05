// Text as outlines, so a wordmark or a label never depends on a font being installed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { VENDOR } from './core.mjs';

const opentype = await import(pathToFileURL(join(VENDOR, 'opentype.mjs')).href);

export const parseFont = (data) => opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
let labelFont;
export function labelPath(text, x, y, size, anchor = 'start') {
  labelFont ||= parseFont(readFileSync(join(VENDOR, 'fonts', 'Poppins-Medium.ttf')));
  const safe = String(text).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').trim() || '?';
  const width = labelFont.getAdvanceWidth(safe, size);
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return labelFont.getPath(safe, left, y, size).toPathData(1);
}
export function outline(font, text, size, letterSpacing = 0) {
  const path = font.getPath(text, 0, 0, size, { letterSpacing: letterSpacing / 1000 });
  const box = path.getBoundingBox();
  return { d: path.toPathData(2), box, missing: [...text].filter((c) => c.trim() && font.charToGlyphIndex(c) === 0) };
}
