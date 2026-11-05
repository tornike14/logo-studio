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
await test('soft edges keep their true colour', () => {
  const r = rasterise('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.3" fill="#F4ECE0"/></svg>', 10);
  for (let i = 0; i < r.pixels.length; i += 4) if (r.pixels[i + 3] > 24 && r.pixels[i + 3] < 255) must(r.pixels[i] > 225, `dark edge: ${r.pixels[i]}`);
});
await test('letter outlines never hold invalid numbers', () => {
  const font = parseFont(readFileSync(join(here, '..', 'vendor', 'fonts', 'Poppins-Medium.ttf')));
  for (const word of ['PawPath', 'ledgerline', 'Illinois Mmw']) {
    const o = outline(font, word, 200);
    must(!/NaN|Infinity|undefined/.test(o.d), `bad path for ${word}`);
    must(!/NaN/.test(labelPath(word, 12.34, 56.78, 13)), `bad label for ${word}`);
  }
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
await test('builds and checks a page, and catches a bad one', () => {
  const b = join(dir, 'page');
  write(join(b, 'mark.svg'), mark);
  const items = Array.from({ length: 26 }, (_, i) => ({ name: `Rival ${i}`, file: 'logos/a.svg', kind: 'icon', quality: 'good' }));
  write(join(b, 'field', 'logos', 'a.svg'), mark);
  write(join(b, 'field', 'index.json'), JSON.stringify({ items }));
  const names = items.map((i) => i.name);
  const dark = { ground: '#141310', surface: '#1F1D19', ink: '#F2EEE8', inkSoft: '#A39E96', hair: '#2E2B26', accent: '#8EA5FF', warm: '#FF9A8B', wash: '#222A47' };
  const content = { schema: 1, brand: { name: 'Sample', surface: 'both', shape: 'icon', hasCurrentLogo: false }, page: { title: 'Sample Mark' }, theme: { ground: '#F6F1EA', surface: '#FFFFFF', ink: '#20222B', inkSoft: '#6B6873', hair: '#E4DDD2', accent: '#3657E0', warm: '#FF8A7A', wash: '#ECEFFE', dark }, assets: { m: { path: 'mark.svg', evidence: 'rendered' } }, sources: [{ id: 's', label: 'Source', url: 'https://example.com' }], sections: [
    { id: 'hero', mark: 'm', alt: 'Mark', eyebrow: 'Sample', title: 'A title', lede: 'Looked at {count} logos.', verdict: ['**One** point', 'Two'] },
    { id: 'field', title: 'Field', index: 'field/index.json', groups: [{ title: 'A', note: 'n', items: names.slice(0, 9) }, { title: 'B', note: 'n', items: names.slice(9, 18) }, { title: 'C', note: 'n', items: names.slice(18) }] },
    { id: 'gap', title: 'Gap', findings: [{ title: 'F', text: 'T', sources: ['s'] }], closest: [{ name: 'Rival 1', why: 'Why' }] },
    { id: 'idea', title: 'Idea', paragraphs: ['P'], principles: [{ title: 'A', text: 'a' }, { title: 'B', text: 'b' }, { title: 'C', text: 'c' }] },
    { id: 'construction', title: 'C', drawing: 'm', rows: [{ label: 'L', value: '[#123456] v' }] },
    { id: 'sizes', title: 'S', asset: 'm', sizes: [120, 29] },
    { id: 'appearances', title: 'A', items: [{ asset: 'm', title: 'Light' }] },
    { id: 'context', title: 'C', scenes: [{ type: 'browser', ours: 'm', title: 'T', caption: 'C', others: names.slice(0, 3) }, { type: 'phone', ours: 'm', title: 'T', caption: 'C', others: names.slice(0, 7) }, { type: 'avatars', ours: 'm', title: 'T', caption: 'C', others: names.slice(0, 4) }, { type: 'sign', ours: 'm', title: 'T', caption: 'C', others: [] }] },
    { id: 'system', omitReason: 'One mark only' },
    { id: 'motion', omitReason: 'Not needed' },
    { id: 'alternatives', title: 'A', items: [{ asset: 'm', title: 'X', note: 'n' }, { asset: 'm', title: 'Y', note: 'n' }] },
    { id: 'next', todo: ['T'], unverified: ['U'] },
    { id: 'sources', notes: ['N'] }] };
  const run = (script, ...x) => spawnSync(process.execPath, [join(here, script), ...x], { encoding: 'utf8' });
  write(join(b, 'content.json'), JSON.stringify(content));
  const built = run('build-page.mjs', join(b, 'content.json'), '--out', join(b, 'page.html'));
  must(built.status === 0, (built.stderr || built.stdout).slice(0, 400));
  const ok = run('check-page.mjs', join(b, 'content.json'), '--page', join(b, 'page.html'));
  must(ok.status === 0, ok.stdout.slice(0, 500));
  const html = readFileSync(join(b, 'page.html'), 'utf8');
  must(html.includes('Looked at 26 logos.') && html.includes('<b>One</b>'), 'count or bold missing');
  content.sections = content.sections.filter((x) => x.id !== 'idea');
  content.sections.find((x) => x.id === 'gap').findings[0] = { title: 'F', text: 'T' };
  write(join(b, 'bad.json'), JSON.stringify(content));
  const bad = run('check-page.mjs', join(b, 'bad.json'));
  must(bad.status === 1 && /idea/.test(bad.stdout) && /needs sources/.test(bad.stdout), 'bad page passed');
});
await test('exports the full pack', () => {
  const b = join(dir, 'pack');
  write(join(b, 'figure.svg'), mark);
  write(join(b, 'word.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120"><rect width="600" height="120" fill="#222"/></svg>');
  write(join(b, 'pack.json'), JSON.stringify({ brand: 'Sample', figure: 'figure.svg', wordmark: 'word.svg', ground: '#F6F1EA', surfaces: ['app', 'website'] }));
  const r = spawnSync(process.execPath, [join(here, 'export-pack.mjs'), join(b, 'pack.json')], { encoding: 'utf8' });
  must(r.status === 0, (r.stderr || r.stdout).slice(0, 400));
  const out = join(b, 'logo-pack');
  for (const f of ['web/favicon.ico', 'web/og-image.png', 'web/icon-512-maskable.png', 'app/ios/icon-1024.png', 'app/android/foreground.png', 'app/ios/AppIcon.icon/icon.json', 'source/lockup-horizontal.svg']) must(existsSync(join(out, f)), `missing ${f}`);
  must(readFileSync(join(out, 'app/ios/icon-1024.png'))[25] === 2, 'App Store icon has alpha');
  const og = rasterSize(readFileSync(join(out, 'web/og-image.png')));
  must(og[0] === 1200 && og[1] === 630, `share image is ${og}`);
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
