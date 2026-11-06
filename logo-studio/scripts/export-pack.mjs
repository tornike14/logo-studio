// node export-pack.mjs pack.json
// Writes the full logo pack from a few SVG files. Run only after the logo is approved.
// pack.json fields are described in references/production-specs.md.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { args, encodePng, flatten, hexRgb, needFile, readJson, say, write, writeJson } from './lib/core.mjs';
import { opaquePng, png, rasterise } from './lib/render.mjs';
import { writeIco } from './lib/ico.mjs';

const a = args();
const packPath = needFile(a._[0], 'node export-pack.mjs pack.json [--ios-preview]');
const base = dirname(packPath);
const p = readJson(packPath);
const out = resolve(base, p.out || 'logo-pack');
// --ios-preview writes only AppIcon.icon, so a Mac can render it for the page before anything is approved.
const surfaces = a['ios-preview'] ? ['ios-preview'] : p.surfaces || ['app', 'website'];
const text = (f) => readFileSync(resolve(base, f), 'utf8').replace(/<\?xml[^>]*>/, '').trim();
const problems = [];
for (const k of ['brand', 'figure', 'ground']) if (!p[k]) problems.push(`pack.json needs ${k}`);
if (problems.length) { problems.forEach((m) => say(`PROBLEM  ${m}`)); process.exit(1); }

const figure = text(p.figure);
// The icon's figure can be made for a dark ground, so lockups on white may need their own version.
const figureOnLight = p.figureOnLight ? text(p.figureOnLight) : figure;
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
const warnings = [];
const save = (path, data) => { write(file(path), data); made.push(path); };

// Single-colour art for tinted and monochrome uses. Without drawn art, the silhouette is the safe fallback.
function monoPixels(size) {
  if (monoFigure) return rasterise(monoFigure, size);
  const r = rasterise(figure, size);
  for (let i = 0; i < r.pixels.length; i += 4) { r.pixels[i] = r.pixels[i + 1] = r.pixels[i + 2] = 255; }
  return r;
}

// How far the art reaches from the centre, as a share of the canvas width.
function reach(svg) {
  const r = rasterise(svg, 128), half = (r.width - 1) / 2;
  let far = 0;
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (r.pixels[(y * r.width + x) * 4 + 3] > 32) far = Math.max(far, Math.hypot(x - half, y - half));
  return far / r.width;
}

const preview = surfaces.includes('ios-preview');
const master = doc(1024, 1024, place(figure, 0, 0, 1024, 1024), p.ground);
const masterDark = doc(1024, 1024, place(darkFigure, 0, 0, 1024, 1024), darkGround);
if (!preview) {
  save('source/mark.svg', master);
  save('source/mark-dark.svg', masterDark);
  save('source/figure.svg', figure + '\n');
  if (monoFigure) save('source/figure-mono.svg', monoFigure + '\n');
}

if (p.wordmark && !preview) {
  const word = text(p.wordmark), wordDark = p.wordmarkDark ? text(p.wordmarkDark) : word;
  const [, , ww, wh] = viewBox(word);
  save('source/wordmark.svg', word + '\n');
  if (p.wordmarkDark) save('source/wordmark-dark.svg', wordDark + '\n');
  const H = 240, wH = 96, wW = (ww / wh) * wH, gap = 56, W = H + gap + wW;
  const lockup = (fig, wm, bg) => doc(Math.ceil(W), H, place(fig, 0, 0, H, H) + place(wm, H + gap, (H - wH) / 2, wW, wH), bg);
  // Set lockups to false when the icon is a letter of the word, since the pair would repeat that letter.
  if (p.lockups !== false) {
  save('source/lockup-horizontal.svg', lockup(figureOnLight, word));
  save('source/lockup-horizontal-dark.svg', lockup(darkFigure, wordDark));
  const SW = Math.ceil(Math.max(wW, 360)), SH = 360 + 48 + wH;
  save('source/lockup-stacked.svg', doc(SW, SH, place(figureOnLight, (SW - 360) / 2, 0, 360, 360) + place(word, (SW - wW) / 2, 408, wW, wH)));
  save('source/lockup-horizontal.png', png(lockup(figureOnLight, word), 1600));
  }
  // The share image keeps the lockup inside generous margins, whatever the length of the name.
  // On a dark ground the word has to be the light version, or it vanishes.
  const [gr, gg, gb] = hexRgb(p.ground);
  const darkGroundShare = 0.299 * gr + 0.587 * gg + 0.114 * gb < 128;
  if (darkGroundShare && !p.wordmarkDark) warnings.push('The ground is dark, so the share image needs wordmarkDark, or the word will not show.');
  const ogScale = Math.min(960 / W, 300 / H);
  if (surfaces.includes('website')) save('web/og-image.png', opaquePng(doc(1200, 630, (p.lockups === false ? (() => { const s = Math.min(900 / wW, 220 / wH); return place(darkGroundShare ? wordDark : word, (1200 - wW * s) / 2, (630 - wH * s) / 2, wW * s, wH * s); })() : place(lockup(darkGroundShare ? figure : figureOnLight, darkGroundShare ? wordDark : word), (1200 - W * ogScale) / 2, (630 - H * ogScale) / 2, W * ogScale, H * ogScale)), p.ground), 1200, p.ground));
} else if (surfaces.includes('website') && !p.wordmark) save('web/og-image.png', opaquePng(doc(1200, 630, place(figure, 300, 15, 600, 600), p.ground), 1200, p.ground));

if (surfaces.includes('app') || surfaces.includes('ios-preview')) {
  if (surfaces.includes('app')) {
  save('app/ios/icon-1024.png', opaquePng(master, 1024, p.ground));
  save('app/ios/icon-dark-1024.png', opaquePng(masterDark, 1024, darkGround));
  const m = monoPixels(1024);
  save('app/ios/icon-tinted-1024.png', encodePng(flatten(m.pixels, '#000000'), m.width, m.height, 3));
  // Android keeps the middle 66% safe. androidScale shrinks the figure, and the warning below says if that is not enough.
  const scale = p.androidScale ?? 0.92;
  if (reach(figure) * scale > 0.335) warnings.push(`At androidScale ${scale} the figure leaves the Android safe circle and may be cropped. Check foreground.png, or set androidScale.`);
  save('app/android/foreground.png', png(inset(figure, scale), 1024));
  save('app/android/background.png', opaquePng(doc(1024, 1024, '', p.ground), 1024, p.ground));
  const small = monoPixels(Math.round(1024 * scale));
  const pad = doc(1024, 1024, `<image x="${(1024 - small.width) / 2}" y="${(1024 - small.height) / 2}" width="${small.width}" height="${small.height}" xlink:href="data:image/png;base64,${encodePng(small.pixels, small.width, small.height, 4).toString('base64')}"/>`);
  save('app/android/monochrome.png', png(pad, 1024));
  }
  // One Icon Composer document for iOS 26. Layers are drawn back to front in pack.json.
  const layers = p.iosLayers || [{ name: 'mark', svg: p.figure, glass: true }];
  rmSync(file('app/ios/AppIcon.icon'), { recursive: true, force: true });
  const hex = (c) => { const [r, g, b] = hexRgb(c); return `srgb:${(r / 255).toFixed(5)},${(g / 255).toFixed(5)},${(b / 255).toFixed(5)},1.00000`; };
  const fills = (l) => { const s = []; if (l.fill) s.push({ value: { solid: hex(l.fill) } }); if (l.fillDark) s.push({ appearance: 'dark', value: { solid: hex(l.fillDark) } }); if (l.fillTinted) s.push({ appearance: 'tinted', value: { solid: hex(l.fillTinted) } }); return s; };
  const entry = (l) => {
    // Icon Composer fills whole shapes, so a stroke with a tint or dark fill closes up its holes.
    if (/\sstroke=/.test(text(l.svg)) && fills(l).length) warnings.push(`Layer ${l.name} uses a stroke. Redraw it as a filled outline, or tinted and clear icons will fill its holes.`);
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
  // Maskable icons keep their content inside the middle 80%. Full-bleed art sets maskableScale to 1.
  const maskable = p.maskableScale ?? 0.76;
  if (reach(figure) * maskable > 0.405) warnings.push(`At maskableScale ${maskable} the figure leaves the maskable safe circle. Check icon-512-maskable.png, or set maskableScale.`);
  save('web/icon-512-maskable.png', opaquePng(inset(figure, maskable, p.ground), 512, p.ground));
  save('web/site.webmanifest', JSON.stringify({ name: p.brand, short_name: p.shortName || p.brand, icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }], theme_color: p.ground, background_color: p.ground, display: 'standalone' }, null, 2) + '\n');
  save('web/head-snippet.html', `<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${p.ground}">\n<meta property="og:image" content="/og-image.png">\n`);
}
if (surfaces.includes('print') || surfaces.includes('sign')) {
  // Vector art for a sign maker, plus a large image for proofs. CMYK and PDF come from the print shop's software.
  // signArt is a drawn sign layout. Without one, the figure and word are paired on the ground.
  if (p.signArt) {
    const art = text(p.signArt);
    const [, , sw] = viewBox(art);
    save('print/sign.svg', art + '\n');
    save('print/sign-proof.png', opaquePng(art, Math.max(4000, sw), p.ground));
  } else if (p.wordmark) {
    const [gr, gg, gb] = hexRgb(p.ground);
    const dark = 0.299 * gr + 0.587 * gg + 0.114 * gb < 128;
    const art = text(dark && p.wordmarkDark ? p.wordmarkDark : p.wordmark);
    const fig = dark ? figure : figureOnLight;
    const [, , ww, wh] = viewBox(art);
    const H = 240, wH = 96, wW = (ww / wh) * wH, gap = 56, W = Math.ceil(H + gap + wW);
    const sign = doc(W + 120, H + 120, place(fig, 60, 60, H, H) + place(art, 60 + H + gap, 60 + (H - wH) / 2, wW, wH), p.ground);
    save('print/sign-on-ground.svg', sign);
    save('print/sign-proof.png', opaquePng(sign, 4000, p.ground));
  }
  save('print/mark-on-ground.svg', master);
  save('print/mark-proof.png', opaquePng(master, 3000, p.ground));
}
// Extra drawn art, such as a second-script wordmark or a stacked sign layout, travels with the pack.
for (const extra of p.extraSources || []) save(`source/${extra.replace(/^.*[\\/]/, '')}`, readFileSync(resolve(base, extra)));
writeJson(file('manifest.json'), { brand: p.brand, made: new Date().toISOString().slice(0, 10), files: made });
say(JSON.stringify({ out, files: made.length, warnings, note: surfaces.includes('app') ? 'Run verify-ios.mjs on a Mac with Xcode to check AppIcon.icon. Elsewhere it is unverified, and the PNGs are the safe choice.' : undefined }, null, 2));
