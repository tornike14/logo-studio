// Comparison images for looking at work.
//   node sheets.mjs field --index field/index.json --out field.png [--cols 8]
//   node sheets.mjs sizes --svg a.svg,b.svg --out board.png [--sizes 180,120,60,40,29,16]
import { readFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { args, write, readJson, say, MIME, sniff, encodePng } from './lib/core.mjs';
import { rasterise, png } from './lib/render.mjs';
import { labelPath } from './lib/text.mjs';

const a = args();
const mode = a._[0];
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
    body += `<image x="${x + inset}" y="${y + inset}" width="${tile - inset * 2}" height="${tile - inset * 2}" xlink:href="${dataUri(buf)}" clip-path="url(#c${i})"/>`;
    if (item.quality === 'low') body += `<circle cx="${x + tile - 8}" cy="${y + 8}" r="8" fill="#E5484D"/>`;
    body += `<path d="${labelPath(item.name.slice(0, 22), x + tile / 2, y + tile + 20, 13, 'middle')}" fill="#222222"/>`;
  });
  write(resolve(a.out), png(shell(W, H, body), W));
  say(JSON.stringify({ out: resolve(a.out), logos: items.length, lowQualityMarked: items.filter((i) => i.quality === 'low').length }));
} else if (mode === 'sizes') {
  const files = String(a.svg).split(',').map((f) => resolve(f));
  const sizes = String(a.sizes || '180,120,60,40,29,16').split(',').map(Number);
  const small = sizes.filter((z) => z <= 40);
  const zoom = 6;
  const rowH = Math.max(sizes[0], small.length ? Math.max(...small) * zoom : 0) + 70;
  const W = 40 + sizes.reduce((s, z) => s + z + 24, 0) + small.reduce((s, z) => s + z * zoom + 24, 0);
  const H = files.length * rowH;
  let body = `<rect width="${W}" height="${H}" fill="#E9E9EE"/>`;
  files.forEach((file, r) => {
    const svg = readFileSync(file, 'utf8');
    const top = r * rowH + 20;
    let x = 20;
    sizes.forEach((z, s) => {
      // Rendered at the true pixel size, so the board shows what a phone or a tab would show.
      const b = png(svg, z);
      body += `<clipPath id="r${r}s${s}"><rect x="${x}" y="${top}" width="${z}" height="${z}" rx="${z * 0.225}"/></clipPath><image x="${x}" y="${top}" width="${z}" height="${z}" xlink:href="${dataUri(Buffer.from(b))}" clip-path="url(#r${r}s${s})"/>`;
      body += `<path d="${labelPath(String(z), x, top + z + 16, 11)}" fill="#555555"/>`;
      x += z + 24;
    });
    small.forEach((z) => {
      const p = rasterise(svg, z);
      const big = new Uint8Array(p.width * p.height * zoom * zoom * 4);
      for (let y = 0; y < p.height * zoom; y++) for (let xx = 0; xx < p.width * zoom; xx++) {
        const from = (Math.floor(y / zoom) * p.width + Math.floor(xx / zoom)) * 4, to = (y * p.width * zoom + xx) * 4;
        for (let c = 0; c < 4; c++) big[to + c] = p.pixels[from + c];
      }
      body += `<image x="${x}" y="${top}" width="${p.width * zoom}" height="${p.height * zoom}" xlink:href="${dataUri(encodePng(big, p.width * zoom, p.height * zoom, 4))}"/>`;
      body += `<path d="${labelPath(`${z} px x${zoom}`, x, top + p.height * zoom + 16, 11)}" fill="#555555"/>`;
      x += p.width * zoom + 24;
    });
    body += `<path d="${labelPath(basename(file), 20, top + rowH - 28, 12)}" fill="#222222"/>`;
  });
  write(resolve(a.out), png(shell(W, H, body), W));
  say(JSON.stringify({ out: resolve(a.out), files: files.length, sizes }));
} else { say('usage: node sheets.mjs field|sizes ...'); process.exit(2); }
