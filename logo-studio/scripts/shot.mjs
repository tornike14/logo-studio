// node shot.mjs page.html --out page.png [--width 1280] [--height 2600] [--scheme light|dark]
// A web address works too, which is useful for logos on sites that block automated reading.
// Browsers refuse windows narrower than about 500 px, so a phone width is shown through a sized frame.
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { args, say, write } from './lib/core.mjs';
import { screenshot } from './lib/browser.mjs';

const a = args();
const remote = /^https?:/.test(a._[0]);
const page = remote ? a._[0] : resolve(a._[0]);
const width = Number(a.width || 1280), height = Number(a.height || 2600), scheme = a.scheme || 'light';
let target = page, frame = null;
if (width < 500) {
  frame = join(remote ? tmpdir() : dirname(page), `.frame-${process.pid}.html`);
  write(frame, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#777"><iframe src="${remote ? page : pathToFileURL(page).href}" width="${width}" height="${height}" style="border:0;display:block"></iframe></body>`);
  target = frame;
}
const r = await screenshot(target, resolve(a.out), { width: Math.max(width, 520), height, scheme });
if (frame) rmSync(frame, { force: true });
say(JSON.stringify({ out: resolve(a.out), width, scheme, ...r }));
if (!r.ok) process.exitCode = 1;
