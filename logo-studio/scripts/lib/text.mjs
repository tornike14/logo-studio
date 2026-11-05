// Text as outlines, so a wordmark or a label never depends on a font being installed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { VENDOR } from './core.mjs';

const opentype = await import(pathToFileURL(join(VENDOR, 'opentype.mjs')).href);

export function parseFont(data) {
  const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  try { return opentype.parse(bytes); } catch { return opentype.parse(bytes, { lowMemory: false }); }
}

// opentype's own toPathData can write NaN for tiny numbers, which silently cuts letters off, so
// path data is always built here from the raw commands.
const num = (v) => {
  if (!Number.isFinite(v)) throw new Error('A glyph produced an invalid number.');
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
export function pathData(commands) {
  return commands.map((c) => {
    if (c.type === 'Z') return 'Z';
    if (c.type === 'C') return `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`;
    if (c.type === 'Q') return `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`;
    return `${c.type}${num(c.x)} ${num(c.y)}`;
  }).join('');
}

let labelFont;
export function labelPath(text, x, y, size, anchor = 'start') {
  labelFont ||= parseFont(readFileSync(join(VENDOR, 'fonts', 'Poppins-Medium.ttf')));
  const safe = String(text).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').trim() || '?';
  const width = labelFont.getAdvanceWidth(safe, size);
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return pathData(labelFont.getPath(safe, left, y, size).commands);
}

function getPath(font, text, x, y, size, options) {
  // Some fonts use substitution tables opentype cannot read. Text still draws without those features.
  try { return font.getPath(text, x, y, size, options); } catch {
    try { return font.getPath(text, x, y, size, { ...options, features: { liga: false, rlig: false } }); } catch {
      // Last resort: draw each letter by itself, without the font's substitutions.
      const merged = [];
      let left = x;
      for (const char of text) {
        const glyph = font.charToGlyph(char);
        merged.push(...glyph.getPath(left, y, size).commands);
        left += (glyph.advanceWidth * size) / font.unitsPerEm + (options.letterSpacing || 0) * size;
      }
      return { commands: merged, getBoundingBox() { const xs = [], ys = []; for (const c of merged) if (c.type !== 'Z') { xs.push(c.x); ys.push(c.y); } return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }; } };
    }
  }
}
export function outline(font, text, size, letterSpacing = 0) {
  const path = getPath(font, text, 0, 0, size, { letterSpacing: letterSpacing / 1000 });
  return { d: pathData(path.commands), box: path.getBoundingBox(), missing: [...text].filter((c) => c.trim() && font.charToGlyphIndex(c) === 0) };
}
// One entry per letter, for optical kerning, redrawn letters, or measuring a letter to build on it.
export function glyphs(font, text, size, letterSpacing = 0) {
  let x = 0;
  const scale = size / font.unitsPerEm;
  return [...text].map((char) => {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(x, 0, size);
    const box = path.getBoundingBox();
    const entry = { char, x, advance: glyph.advanceWidth * scale, box: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 }, d: pathData(path.commands) };
    x += entry.advance + (letterSpacing / 1000) * size;
    return entry;
  });
}
