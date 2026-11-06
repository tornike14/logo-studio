// Shared helpers. No npm dependencies: everything runs on plain Node 18+ with the files in vendor/.
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

export const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VENDOR = join(SKILL_ROOT, 'vendor');

// Windows consoles can garble anything outside ASCII, so stdout stays ASCII and full text goes in report files.
export function ascii(text) {
  return String(text).replace(/[^\x20-\x7E\n\r\t]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}
export const say = (text) => console.log(ascii(text));

export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

// A missing argument should print how to run the tool, not a stack trace.
export function needs(ok, usage, problem) {
  if (ok) return;
  if (problem) say(problem);
  say(`usage: ${usage}`);
  process.exit(2);
}
export function needFile(path, usage) {
  needs(typeof path === 'string', usage);
  needs(existsSync(path), usage, `file not found: ${path}`);
  return resolve(path);
}

const RETRY = new Set(['EBUSY', 'EPERM', 'EACCES']);
function retrying(fn) {
  // Antivirus and OneDrive hold new files open for a moment on Windows.
  for (let attempt = 0; ; attempt++) {
    try { return fn(); } catch (e) {
      if (!RETRY.has(e.code) || attempt >= 6) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 80 * (attempt + 1));
    }
  }
}
export function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  retrying(() => writeFileSync(tmp, data));
  try { retrying(() => renameSync(tmp, path)); } finally { rmSync(tmp, { force: true }); }
}
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
export const writeJson = (path, value) => write(path, JSON.stringify(value, null, 2) + '\n');

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
export function safeName(name, fallback = 'item') {
  const slug = String(name).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).toLowerCase();
  const base = slug || fallback;
  return RESERVED.test(base) ? `${base}-x` : base;
}

export function sniff(buf) {
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 4 && buf.toString('latin1', 0, 3) === 'GIF') return 'gif';
  if (buf.length > 4 && buf.readUInt32LE(0) === 0x00010000) return 'ico';
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(buf.toString('utf8', 0, 2048))) return 'svg';
  return null;
}
export const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
export const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif', svg: 'svg', ico: 'ico' };

// Pixel size of a raster, or null for vector and unknown files.
export function rasterSize(buf) {
  const t = sniff(buf);
  if (t === 'png') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (t === 'gif') return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  if (t === 'jpeg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  if (t === 'webp') {
    const k = buf.toString('latin1', 12, 16);
    if (k === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
    if (k === 'VP8X') return [(buf.readUIntLE(24, 3)) + 1, (buf.readUIntLE(27, 3)) + 1];
  }
  return null;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
// channels 3 is RGB, 4 is RGBA.
export function encodePng(pixels, width, height, channels) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
export function hexRgb(hex) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.replace(/./g, '$&$&') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
}
// App Store icons may not carry an alpha channel, so transparency is flattened onto a colour.
export function flatten(rgba, background = '#FFFFFF') {
  const [br, bg, bb] = hexRgb(background);
  const out = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const a = rgba[i + 3] / 255;
    out[j] = Math.round(rgba[i] * a + br * (1 - a));
    out[j + 1] = Math.round(rgba[i + 1] * a + bg * (1 - a));
    out[j + 2] = Math.round(rgba[i + 2] * a + bb * (1 - a));
  }
  return out;
}
