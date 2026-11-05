// Proves the engine works on this computer. node self-test.mjs [--network]
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { args, say, write, sniff, rasterSize, safeName, hexRgb, encodePng, ascii, readJson } from './lib/core.mjs';
import { png, opaquePng, rasterise } from './lib/render.mjs';
import { writeIco, icoToPng } from './lib/ico.mjs';
import { labelPath, parseFont, outline } from './lib/text.mjs';
import { findBrowser, screenshot } from './lib/browser.mjs';

const a = args();
const here = dirname(fileURLToPath(import.meta.url));
// An awkward folder on purpose: spaces, accents, an apostrophe, a hash and brackets.
const root = mkdtempSync(join(tmpdir(), 'logo studio '));
const dir = join(root, "Jané O'Brien #1 (tést) 中");
const results = [];
async function test(name, fn) {
  try { const note = await fn(); results.push({ name, ok: true, note }); } catch (e) { results.push({ name, ok: false, note: e.message }); }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const mark = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><radialGradient id="g"><stop offset="0" stop-color="#FFB98A"/><stop offset="1" stop-color="#FF8A7A"/></radialGradient></defs><circle cx="512" cy="512" r="352" fill="#5B7CFA"/><circle cx="512" cy="700" r="90" fill="url(#g)"/></svg>';

await test('writes into an awkward folder', () => { write(join(dir, 'a.txt'), 'café'); must(readFileSync(join(dir, 'a.txt'), 'utf8') === 'café', 'text changed'); });
await test('renders SVG with a gradient', () => { const b = Buffer.from(png(mark, 256)); must(sniff(b) === 'png', 'not a PNG'); must(rasterSize(b)[0] === 256, 'wrong size'); write(join(dir, 'mark.png'), b); });
await test('renders down to 16 px', () => { must(rasterise(mark, 16).width === 16, 'wrong size'); });
await test('opaque PNG has no alpha channel', () => { const b = opaquePng(mark, 64, '#F6F1EA'); must(b[25] === 2, `colour type ${b[25]}`); });
await test('writes an ICO and reads it back', () => {
  const ico = writeIco([16, 32, 48].map((size) => ({ size, data: Buffer.from(png(mark, size)) })));
  must(sniff(ico) === 'ico', 'not an ICO');
  const back = icoToPng(ico);
  must(back.width === 48 && sniff(back.png) === 'png', 'largest image not found');
});
await test('reads an old BMP ICO', () => {
  const w = 16, h = 16, xor = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { xor[i * 4] = 255; xor[i * 4 + 3] = 255; }
  const dib = Buffer.alloc(40); dib.writeUInt32LE(40, 0); dib.writeInt32LE(w, 4); dib.writeInt32LE(h * 2, 8); dib.writeUInt16LE(1, 12); dib.writeUInt16LE(32, 14);
  const body = Buffer.concat([dib, xor, Buffer.alloc(4 * h)]);
  const head = Buffer.alloc(22); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); head[6] = w; head[7] = h; head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(body.length, 14); head.writeUInt32LE(22, 18);
  const r = icoToPng(Buffer.concat([head, body]));
  must(r && sniff(r.png) === 'png' && r.width === 16, 'BMP not converted');
});
await test('outlines label text with no system fonts', () => { must(labelPath('Harbor', 0, 20, 14).length > 50, 'empty path'); });
await test('outlines a wordmark and spots missing letters', () => {
  const font = parseFont(readFileSync(join(here, '..', 'vendor', 'fonts', 'Poppins-Medium.ttf')));
  const o = outline(font, 'Harbor 中', 120);
  must(o.d.length > 100, 'empty path'); must(o.missing.length === 1, 'missing glyph not reported');
});
await test('safe file names', () => { must(safeName('CON') === 'con-x', 'reserved name'); must(safeName('Café: "A"/B?') === 'cafe-a-b', safeName('Café: "A"/B?')); });
await test('colour parsing and ASCII output', () => { must(hexRgb('#fff')[0] === 255, 'hex'); must(ascii('中') === '\\u4e2d', 'ascii'); });
await test('field and size sheets', () => {
  const fieldDir = join(dir, 'field');
  write(join(fieldDir, 'logos', 'a.svg'), mark);
  write(join(fieldDir, 'index.json'), JSON.stringify({ items: [{ name: 'Sample', file: 'logos/a.svg', kind: 'icon', quality: 'good' }, { name: 'Sample 2', file: 'logos/a.svg', kind: 'logo', quality: 'low' }] }));
  const run = (...x) => spawnSync(process.execPath, [join(here, 'sheets.mjs'), ...x], { encoding: 'utf8' });
  const f = run('field', '--index', join(fieldDir, 'index.json'), '--out', join(dir, 'field.png'));
  must(f.status === 0, f.stderr.slice(0, 300));
  write(join(dir, 'mark.svg'), mark);
  const s = run('sizes', '--svg', join(dir, 'mark.svg'), '--out', join(dir, 'sizes.png'));
  must(s.status === 0, s.stderr.slice(0, 300));
  must(existsSync(join(dir, 'sizes.png')), 'no board');
});
await test('browser screenshot, if a browser exists', async () => {
  const b = findBrowser();
  if (!b) return 'skipped: no browser';
  write(join(dir, 'page.html'), `<!doctype html><meta charset="utf-8"><title>t</title><body style="margin:0;background:#5B7CFA"><img src="data:image/svg+xml;base64,${Buffer.from(mark).toString('base64')}" width="200"></body>`);
  const r = await screenshot(join(dir, 'page.html'), join(dir, 'page shot.png'), { width: 400, height: 300 });
  must(r.ok, `screenshot ${r.reason}`);
  must(rasterSize(readFileSync(join(dir, 'page shot.png')))[0] === 400, 'wrong width');
  return `${Math.round(r.ms / 100) / 10} s`;
});
if (a.network) {
  await test('collects competitors from three sources', async () => {
    const plan = join(dir, 'plan.json');
    write(plan, JSON.stringify({ apps: ['Calm'], play: ['com.calm.android'], sites: ['stripe.com', 'mailchimp.com'] }));
    const r = spawnSync(process.execPath, [join(here, 'competitors.mjs'), plan, '--out', join(dir, 'net'), '--budget', '60'], { encoding: 'utf8', timeout: 90000 });
    must(r.status === 0, (r.stderr || r.stdout).slice(0, 300));
    const index = readJson(join(dir, 'net', 'index.json'));
    const sources = new Set(index.items.map((i) => i.source));
    return `${index.items.length} logos from ${[...sources].join(', ')}; failed: ${Object.entries(index.done).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k}=${v}`).join(' ') || 'none'}`;
  });
}
try { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp folder */ }
for (const r of results) say(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `  (${r.note})` : ''}`);
const failed = results.filter((r) => !r.ok).length;
say(`${results.length - failed}/${results.length} passed on ${process.platform} ${process.arch} node ${process.version}`);
if (failed) process.exitCode = 1;
