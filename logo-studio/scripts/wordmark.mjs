// node wordmark.mjs --text "Harbor" --font google:poppins/Poppins-SemiBold.ttf --out wordmark.svg [--color "#20222B"] [--tracking 0]
// --font is a local .ttf/.otf path, or gf:"Family Name":700 for any weight of a Google Font.
// --text-file reads the text from a UTF-8 file, the safe way to pass non-English text.
// The result is outlines only, so it looks the same everywhere and needs no font installed.
//   --glyphs letters.json also writes each letter's path and position, for optical kerning or redrawn letters.
//   node wordmark.mjs --list <family>  lists the font files Google Fonts has for a family, such as ibmplexsans.
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { args, say, safeName, write } from './lib/core.mjs';
import { glyphs, outline, parseFont } from './lib/text.mjs';

const a = args();
if (a['text-file']) a.text = readFileSync(resolve(a['text-file']), 'utf8').replace(/^\uFEFF/, '').trim();
if (a.list) {
  const r = await fetch(`https://api.github.com/repos/google/fonts/contents/ofl/${encodeURIComponent(a.list)}`, { headers: { 'user-agent': 'logo-studio' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) { say(`No family "${a.list}" in Google Fonts' ofl folder. Family names are lowercase with no spaces.`); process.exit(1); }
  const items = await r.json();
  const files = items.filter((f) => /\.(ttf|otf)$/i.test(f.name)).map((f) => f.name);
  say(JSON.stringify({ family: a.list, files, hasStaticFolder: items.some((f) => f.name === 'static') }, null, 2));
  if (files.some((f) => f.includes('['))) say('Files with [wght] are variable fonts. Only their default weight can be drawn. Look in the static folder or another family for other weights.');
  process.exit(0);
}
if (!a.text || !a.font || !a.out) { say('usage: node wordmark.mjs --text "Name" --font <file or gf:"Family Name":700> --out wordmark.svg'); process.exit(2); }
let file = String(a.font);
if (file.startsWith('gf:')) {
  // Google's stylesheet service hands older browsers one static file for one weight.
  const [, family, weight = '400'] = file.match(/^gf:"?([^":]+)"?(?::(\d+))?$/) || [];
  if (!family) { say('Write Google Fonts as gf:"Family Name":700'); process.exit(2); }
  file = join(tmpdir(), `logo-studio-font-${safeName(family)}-${weight}.ttf`);
  if (!existsSync(file)) {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}`, { headers: { 'user-agent': 'Mozilla/4.0' }, signal: AbortSignal.timeout(20000) });
    const url = (await css.text()).match(/url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!css.ok || !url) { say(`Google Fonts has no ${family} at weight ${weight}.`); process.exit(1); }
    write(file, Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(30000) })).arrayBuffer()));
  }
} else if (file.startsWith('google:')) {
  const rel = file.slice(7);
  file = join(tmpdir(), `logo-studio-font-${safeName(rel)}.ttf`);
  if (!existsSync(file)) {
    const url = `https://github.com/google/fonts/raw/main/ofl/${rel.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) { say(`Font not found: ${url}. Only fonts under Google Fonts' ofl folder are supported.`); process.exit(1); }
    write(file, Buffer.from(await r.arrayBuffer()));
  }
}
let font;
try { font = parseFont(readFileSync(resolve(file))); } catch (e) { say(`This font could not be read: ${e.message}. Choose another font.`); process.exit(1); }
if (font.tables.fvar) say('NOTE: this is a variable font, so only its default weight is drawn.');
const size = 200;
const o = outline(font, String(a.text), size, Number(a.tracking || 0));
if (o.missing.length) { say(`This font has no glyph for: ${[...new Set(o.missing)].join(' ')}. Choose a font that covers these letters.`); process.exit(1); }
// Connected scripts need shaping, which this tool does not do.
if (/[֐-ࣿऀ-෿฀-࿿]/.test(a.text)) say('WARNING: this script needs text shaping, so letters may not connect correctly. Check the result by eye.');
const { x1, y1, x2, y2 } = o.box;
const w = Math.ceil(x2 - x1), h = Math.ceil(y2 - y1);
write(resolve(a.out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path transform="translate(${-x1} ${-y1})" d="${o.d}" fill="${a.color || '#111111'}"/></svg>\n`);
if (a.glyphs) write(resolve(a.glyphs), JSON.stringify({ size, offsetX: -x1, offsetY: -y1, letters: glyphs(font, String(a.text), size, Number(a.tracking || 0)) }, null, 1));
say(JSON.stringify({ out: resolve(a.out), width: w, height: h }));
