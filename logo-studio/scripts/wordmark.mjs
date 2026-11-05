// node wordmark.mjs --text "Harbor" --font google:poppins/Poppins-SemiBold.ttf --out wordmark.svg [--color "#20222B"] [--tracking 0]
// --font is a local .ttf/.otf/.woff path, or google:<family>/<file> for an open-licensed Google Font.
// The result is outlines only, so it looks the same everywhere and needs no font installed.
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { args, say, safeName, write } from './lib/core.mjs';
import { outline, parseFont } from './lib/text.mjs';

const a = args();
if (!a.text || !a.font || !a.out) { say('usage: node wordmark.mjs --text "Name" --font <file or google:family/file.ttf> --out wordmark.svg'); process.exit(2); }
let file = String(a.font);
if (file.startsWith('google:')) {
  const rel = file.slice(7);
  file = join(tmpdir(), `logo-studio-font-${safeName(rel)}.ttf`);
  if (!existsSync(file)) {
    const url = `https://github.com/google/fonts/raw/main/ofl/${rel.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) { say(`Font not found: ${url}. Only fonts under Google Fonts' ofl folder are supported.`); process.exit(1); }
    write(file, Buffer.from(await r.arrayBuffer()));
  }
}
const font = parseFont(readFileSync(resolve(file)));
const size = 200;
const o = outline(font, String(a.text), size, Number(a.tracking || 0));
if (o.missing.length) { say(`This font has no glyph for: ${[...new Set(o.missing)].join(' ')}. Choose a font that covers these letters.`); process.exit(1); }
// Connected scripts need shaping, which this tool does not do.
if (/[֐-ࣿऀ-෿฀-࿿]/.test(a.text)) say('WARNING: this script needs text shaping, so letters may not connect correctly. Check the result by eye.');
const { x1, y1, x2, y2 } = o.box;
const w = Math.ceil(x2 - x1), h = Math.ceil(y2 - y1);
write(resolve(a.out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path transform="translate(${-x1} ${-y1})" d="${o.d}" fill="${a.color || '#111111'}"/></svg>\n`);
say(JSON.stringify({ out: resolve(a.out), width: w, height: h }));
