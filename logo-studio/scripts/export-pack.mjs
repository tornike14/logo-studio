// node export-pack.mjs pack.json
// Writes the full logo pack from a few SVG files. Run only after the logo is approved.
// pack.json fields are described in references/production-specs.md.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { args, encodePng, flatten, hexRgb, readJson, say, write, writeJson } from './lib/core.mjs';
import { opaquePng, png, rasterise } from './lib/render.mjs';
import { writeIco } from './lib/ico.mjs';

const a = args();
const packPath = resolve(a._[0]);
const base = dirname(packPath);
const p = readJson(packPath);
const out = resolve(base, p.out || 'logo-pack');
const surfaces = p.surfaces || ['app', 'website'];
const text = (f) => readFileSync(resolve(base, f), 'utf8').replace(/<\?xml[^>]*>/, '').trim();
const problems = [];
for (const k of ['brand', 'figure', 'ground']) if (!p[k]) problems.push(`pack.json needs ${k}`);
if (problems.length) { problems.forEach((m) => say(`PROBLEM  ${m}`)); process.exit(1); }

const figure = text(p.figure);
const darkFigure = p.figureDark ? text(p.figureDark) : figure;
const monoFigure = p.figureMono ? text(p.figureMono) : null;
const darkGround = p.groundDark || '#141310';
const viewBox = (svg) => (svg.match(/viewBox="([^"]+)"/)?.[1] || `0 0 ${svg.match(/width="(\d+)/)?.[1] || 1024} ${svg.match(/height="(\d+)/)?.[1] || 1024}`).split(/[\s,]+/).map(Number);
let uid = 0;
// Places one SVG inside another. Each copy gets its own ids, so gradients cannot clash.
function place(svg, x, y, w, h) {
  const prefix = `p${++uid}-`;
  const [vx, vy, vw, vh] = viewBox(svg);
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`).replace(/(xlink:)?href="#([^"]+)"/g, `$1href="#${prefix}$2"`);
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vx} ${vy} ${vw} ${vh}">${inner}</svg>`;
}
const doc = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>\n`;
const inset = (svg, scale, bg, size = 1024) => { const s = size * scale, o = (size - s) / 2; return doc(size, size, place(svg, o, o, s, s), bg); };
const file = (...parts) => join(out, ...parts);
if (existsSync(out) && a.clean) rmSync(out, { recursive: true, force: true });
const made = [];
const save = (path, data) => { write(file(path), data); made.push(path); };

// Single-colour art for tinted and monochrome uses. Without drawn art, the silhouette is the safe fallback.
function monoPixels(size) {
  if (monoFigure) return rasterise(monoFigure, size);
  const r = rasterise(figure, size);
  for (let i = 0; i < r.pixels.length; i += 4) { r.pixels[i] = r.pixels[i + 1] = r.pixels[i + 2] = 255; }
  return r;
}

const master = doc(1024, 1024, place(figure, 0, 0, 1024, 1024), p.ground);
const masterDark = doc(1024, 1024, place(darkFigure, 0, 0, 1024, 1024), darkGround);
save('source/mark.svg', master);
save('source/mark-dark.svg', masterDark);
save('source/figure.svg', figure + '\n');
if (monoFigure) save('source/figure-mono.svg', monoFigure + '\n');

if (p.wordmark) {
  const word = text(p.wordmark), wordDark = p.wordmarkDark ? text(p.wordmarkDark) : word;
  const [, , ww, wh] = viewBox(word);
  save('source/wordmark.svg', word + '\n');
  const H = 240, wH = 96, wW = (ww / wh) * wH, gap = 56, W = H + gap + wW;
  const lockup = (fig, wm, bg) => doc(Math.ceil(W), H, place(fig, 0, 0, H, H) + place(wm, H + gap, (H - wH) / 2, wW, wH), bg);
  save('source/lockup-horizontal.svg', lockup(figure, word));
  save('source/lockup-horizontal-dark.svg', lockup(darkFigure, wordDark));
  const SW = Math.ceil(Math.max(wW, 360)), SH = 360 + 48 + wH;
  save('source/lockup-stacked.svg', doc(SW, SH, place(figure, (SW - 360) / 2, 0, 360, 360) + place(word, (SW - wW) / 2, 408, wW, wH)));
  save('source/lockup-horizontal.png', png(lockup(figure, word), 1600));
  const ogScale = Math.min(760 / W, 1);
  if (surfaces.includes('website')) save('web/og-image.png', opaquePng(doc(1200, 630, place(lockup(figure, word), (1200 - W * 2 * ogScale) / 2, (630 - H * 2 * ogScale) / 2, W * 2 * ogScale, H * 2 * ogScale), p.ground), 1200, p.ground));
} else if (surfaces.includes('website')) save('web/og-image.png', opaquePng(doc(1200, 630, place(figure, 300, 15, 600, 600), p.ground), 1200, p.ground));

if (surfaces.includes('app')) {
  save('app/ios/icon-1024.png', opaquePng(master, 1024, p.ground));
  save('app/ios/icon-dark-1024.png', opaquePng(masterDark, 1024, darkGround));
  const m = monoPixels(1024);
  save('app/ios/icon-tinted-1024.png', encodePng(flatten(m.pixels, '#000000'), m.width, m.height, 3));
  // Android's safe zone is the middle 66%, so a full-size figure is scaled down to stay uncropped.
  const scale = p.androidScale ?? 0.92;
  save('app/android/foreground.png', png(inset(figure, scale), 1024));
  save('app/android/background.png', opaquePng(doc(1024, 1024, '', p.ground), 1024, p.ground));
  const small = monoPixels(Math.round(1024 * scale));
  const pad = doc(1024, 1024, `<image x="${(1024 - small.width) / 2}" y="${(1024 - small.height) / 2}" width="${small.width}" height="${small.height}" xlink:href="data:image/png;base64,${encodePng(small.pixels, small.width, small.height, 4).toString('base64')}"/>`);
  save('app/android/monochrome.png', png(pad, 1024));
  // One Icon Composer document for iOS 26. Layers are drawn back to front in pack.json.
  const layers = p.iosLayers || [{ name: 'mark', svg: p.figure, glass: true }];
  rmSync(file('app/ios/AppIcon.icon'), { recursive: true, force: true });
  const hex = (c) => { const [r, g, b] = hexRgb(c); return `srgb:${(r / 255).toFixed(5)},${(g / 255).toFixed(5)},${(b / 255).toFixed(5)},1.00000`; };
  const fills = (l) => { const s = []; if (l.fill) s.push({ value: { solid: hex(l.fill) } }); if (l.fillDark) s.push({ appearance: 'dark', value: { solid: hex(l.fillDark) } }); if (l.fillTinted) s.push({ appearance: 'tinted', value: { solid: hex(l.fillTinted) } }); return s; };
  const entry = (l) => {
    save(`app/ios/AppIcon.icon/Assets/${l.name}.svg`, text(l.svg) + '\n');
    const e = { 'image-name': `${l.name}.svg`, name: l.name, glass: l.glass !== false };
    if (fills(l).length) e['fill-specializations'] = fills(l);
    return e;
  };
  const front = layers.filter((l) => l.front), back = layers.filter((l) => !l.front);
  const group = (name, list, opacity) => ({ name, layers: list.slice().reverse().map(entry), shadow: { kind: 'neutral', opacity }, translucency: { enabled: false, value: 0.5 }, specular: true });
  const groups = [...(front.length ? [group('front', front, 0.4)] : []), ...(back.length ? [group('back', back, 0.25)] : [])];
  save('app/ios/AppIcon.icon/icon.json', JSON.stringify({ 'fill-specializations': [{ value: { solid: hex(p.ground) } }, { appearance: 'dark', value: { solid: hex(darkGround) } }], groups, 'supported-platforms': { squares: ['iOS'] } }, null, 2) + '\n');
}

if (surfaces.includes('website')) {
  save('web/favicon.svg', p.faviconSvg ? text(p.faviconSvg) + '\n' : master);
  const faviconSource = p.faviconSvg ? text(p.faviconSvg) : master;
  save('web/favicon.ico', writeIco([16, 32, 48].map((size) => ({ size, data: Buffer.from(png(faviconSource, size)) }))));
  save('web/apple-touch-icon.png', opaquePng(master, 180, p.ground));
  save('web/icon-192.png', png(master, 192));
  save('web/icon-512.png', png(master, 512));
  // Maskable icons keep their content inside the middle 80%.
  save('web/icon-512-maskable.png', opaquePng(inset(figure, 0.76, p.ground), 512, p.ground));
  save('web/site.webmanifest', JSON.stringify({ name: p.brand, short_name: p.shortName || p.brand, icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }], theme_color: p.ground, background_color: p.ground, display: 'standalone' }, null, 2) + '\n');
  save('web/head-snippet.html', `<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${p.ground}">\n<meta property="og:image" content="/og-image.png">\n`);
}
writeJson(file('manifest.json'), { brand: p.brand, made: new Date().toISOString().slice(0, 10), files: made });
say(JSON.stringify({ out, files: made.length, note: surfaces.includes('app') ? 'Run verify-ios.mjs on a Mac with Xcode to check AppIcon.icon. Elsewhere it is unverified, and the PNGs are the safe choice.' : undefined }, null, 2));
