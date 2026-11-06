// Comparison images for looking at work.
//   node sheets.mjs field --index field/index.json --out field.png [--cols 8]
//   node sheets.mjs sizes --svg a.svg,b.svg --out board.png [--sizes 180,120,60,40,29,16]
//   node sheets.mjs crop --in shot.png --box x,y,width,height --out logo.png
//   node sheets.mjs colours --index field/index.json       counts the colours a field uses
// sizes takes --wide for wordmarks (sizes become widths, default 320,200,120,80), and --plate "#141310" for a background.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { args, needFile, needs, write, readJson, say, MIME, sniff, encodePng, rasterSize } from './lib/core.mjs';
import { rasterise, png } from './lib/render.mjs';
import { labelPath } from './lib/text.mjs';

const a = args();
const mode = a._[0];
const usage = 'node sheets.mjs field|sizes|crop|colours ...  (see the top of sheets.mjs for each mode)';
needs(['field', 'sizes', 'crop', 'colours'].includes(mode), usage);
if (mode === 'field' || mode === 'colours') needFile(a.index, usage);
if (mode === 'sizes') { needs(typeof a.svg === 'string', usage); a.svg.split(',').forEach((f) => needFile(f, usage)); }
if (mode === 'crop') { needFile(a.in, usage); needs(typeof a.box === 'string', usage); }
if (mode !== 'colours') needs(typeof a.out === 'string', usage);
const dataUri = (buf) => `data:${MIME[sniff(buf)]};base64,${buf.toString('base64')}`;
const shell = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

if (mode === 'field') {
  const index = readJson(a.index);
  const base = dirname(resolve(a.index));
  const items = index.items;
  const cols = Number(a.cols || 8), cell = 170, tile = 120;
  const rows = Math.ceil(items.length / cols);
  const W = cols * cell, H = rows * (cell + 10) + 20;
  let body = `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
  items.forEach((item, i) => {
    const x = (i % cols) * cell + 25, y = Math.floor(i / cols) * (cell + 10) + 15;
    const buf = readFileSync(join(base, item.file));
    // A mid grey plate keeps both white and black logos visible.
    body += `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="26" fill="#D5D7DE"/>`;
    body += `<clipPath id="c${i}"><rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="26"/></clipPath>`;
    const inset = item.kind === 'logo' ? 12 : 0;
    if (sniff(buf) === 'webp') body += `<path d="${labelPath('WebP: see page', x + tile / 2, y + tile / 2, 12, 'middle')}" fill="#555555"/>`;
    else body += `<image x="${x + inset}" y="${y + inset}" width="${tile - inset * 2}" height="${tile - inset * 2}" xlink:href="${dataUri(buf)}" clip-path="url(#c${i})"/>`;
    if (item.quality === 'low') body += `<circle cx="${x + tile - 8}" cy="${y + 8}" r="8" fill="#E5484D"/>`;
    body += `<path d="${labelPath((/[a-z]/i.test(item.name) ? item.name : item.file.replace(/^.*\//, '')).slice(0, 22), x + tile / 2, y + tile + 20, 13, 'middle')}" fill="#222222"/>`;
  });
  write(resolve(a.out), png(shell(W, H, body), W));
  say(JSON.stringify({ out: resolve(a.out), logos: items.length, lowQualityMarked: items.filter((i) => i.quality === 'low').length }));
} else if (mode === 'sizes') {
  const files = String(a.svg).split(',').map((f) => resolve(f));
  const wide = Boolean(a.wide);
  const sizes = String(a.sizes || (wide ? '320,200,120,80' : '512,180,120,60,40,29,16')).split(',').map(Number);
  const small = sizes.filter((z) => z <= (wide ? 120 : 40));
  const zoom = wide ? 3 : 6;
  const measured = files.map((file) => {
    const svg = readFileSync(file, 'utf8');
    return { svg, file, renders: sizes.map((z) => rasterise(svg, z)), zooms: small.map((z) => rasterise(svg, z)) };
  });
  const tallest = Math.max(...measured.flatMap((m) => [...m.renders.map((r) => r.height), ...m.zooms.map((r) => r.height * zoom)]));
  const rowH = tallest + 70;
  const W = 40 + sizes.reduce((s, z) => s + z + 24, 0) + small.reduce((s, z) => s + z * zoom + 24, 0);
  const H = files.length * rowH;
  let body = `<rect width="${W}" height="${H}" fill="${a.plate || '#E9E9EE'}"/>`;
  measured.forEach((m, r) => {
    const top = r * rowH + 20;
    let x = 20;
    m.renders.forEach((p, s) => {
      // Rendered at the true pixel size, so the board shows what a phone or a tab would show.
      const uri = dataUri(encodePng(p.pixels, p.width, p.height, 4));
      const clip = wide ? '' : ` clip-path="url(#r${r}s${s})"`;
      if (!wide) body += `<clipPath id="r${r}s${s}"><rect x="${x}" y="${top}" width="${p.width}" height="${p.height}" rx="${p.width * 0.225}"/></clipPath>`;
      body += `<image x="${x}" y="${top}" width="${p.width}" height="${p.height}" xlink:href="${uri}"${clip}/>`;
      body += `<path d="${labelPath(String(sizes[s]), x, top + p.height + 16, 11)}" fill="#555555"/>`;
      x += p.width + 24;
    });
    m.zooms.forEach((p, s) => {
      const big = new Uint8Array(p.width * p.height * zoom * zoom * 4);
      for (let y = 0; y < p.height * zoom; y++) for (let xx = 0; xx < p.width * zoom; xx++) {
        const from = (Math.floor(y / zoom) * p.width + Math.floor(xx / zoom)) * 4, to = (y * p.width * zoom + xx) * 4;
        for (let c = 0; c < 4; c++) big[to + c] = p.pixels[from + c];
      }
      body += `<image x="${x}" y="${top}" width="${p.width * zoom}" height="${p.height * zoom}" xlink:href="${dataUri(encodePng(big, p.width * zoom, p.height * zoom, 4))}"/>`;
      body += `<path d="${labelPath(`${small[s]} x${zoom}`, x, top + p.height * zoom + 16, 11)}" fill="#555555"/>`;
      x += p.width * zoom + 24;
    });
    body += `<path d="${labelPath(basename(m.file), 20, top + rowH - 28, 12)}" fill="#222222"/>`;
  });
  write(resolve(a.out), png(shell(W, H, body), W));
  say(JSON.stringify({ out: resolve(a.out), files: files.length, sizes }));
} else if (mode === 'crop') {
  const buf = readFileSync(resolve(a.in));
  const [x, y, w, h] = String(a.box).split(',').map(Number);
  const size = rasterSize(buf);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><image width="${size[0]}" height="${size[1]}" xlink:href="${dataUri(buf)}"/></svg>`;
  write(resolve(a.out), png(svg, w));
  say(JSON.stringify({ out: resolve(a.out), width: w, height: h }));
} else if (mode === 'colours') {
  const index = readJson(a.index);
  const base = dirname(resolve(a.index));
  const names = [[20, 'red'], [45, 'orange'], [70, 'yellow'], [165, 'green'], [200, 'teal'], [260, 'blue'], [300, 'purple'], [345, 'pink'], [360, 'red']];
  const hueName = (h) => names.find(([limit]) => h < limit)[1];
  const totals = {}, examples = {};
  for (const item of index.items) {
    const buf = readFileSync(join(base, item.file));
    if (sniff(buf) === 'webp') continue;
    const [w, h] = rasterSize(buf) || [24, 24];
    const r = rasterise(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}"><image width="${w}" height="${h}" xlink:href="${dataUri(buf)}"/></svg>`, 24);
    const counts = {};
    for (let i = 0; i < r.pixels.length; i += 4) {
      if (r.pixels[i + 3] < 128) continue;
      const [cr, cg, cb] = [r.pixels[i] / 255, r.pixels[i + 1] / 255, r.pixels[i + 2] / 255];
      const max = Math.max(cr, cg, cb), min = Math.min(cr, cg, cb), d = max - min;
      let label;
      if (max > 0.92 && d < 0.1) label = 'white or pale';
      else if (max < 0.22) label = 'black or very dark';
      else if (d < 0.1) label = 'grey';
      else {
        const hue = (max === cr ? ((cg - cb) / d + 6) % 6 : max === cg ? (cb - cr) / d + 2 : (cr - cg) / d + 4) * 60;
        label = hueName(hue);
      }
      counts[label] = (counts[label] || 0) + 1;
    }
    const top = Object.entries(counts).sort((p, q) => q[1] - p[1])[0]?.[0] || 'unknown';
    const colour = Object.entries(counts).filter(([k]) => !/white|black|grey/.test(k)).sort((p, q) => q[1] - p[1])[0]?.[0] || top;
    totals[colour] = (totals[colour] || 0) + 1;
    (examples[colour] ||= []).push(item.name);
  }
  say(JSON.stringify({ note: 'The strongest colour in each logo. A rough guide: check it by eye.', counts: Object.fromEntries(Object.entries(totals).sort((p, q) => q[1] - p[1])), examples }, null, 2));
}
