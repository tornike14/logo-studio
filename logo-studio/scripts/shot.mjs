// Screenshots a page so it can be looked at.
//   node shot.mjs page.html --out shots/desktop.png --width 1280 --scheme light
// The whole page is captured as slices: shots/desktop-1.png, -2.png and so on. Look at all of them.
//   --go plays the page's motion first. --scale 3 gives a sharper image for cropping a logo.
//   --height 900 takes one image of that height from the top. A web address needs --height.
//   A web address obeys that site's robots.txt. --own-site skips the check for the user's own site.
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { args, encodePng, needFile, needs, say, write } from './lib/core.mjs';
import { dumpDom, findBrowser, screenshot } from './lib/browser.mjs';
import { rasterise } from './lib/render.mjs';
import { BLOCK_PAGE, HEADERS, USER_AGENT, robotsVerdict } from './lib/web.mjs';

const a = args();
const usage = 'node shot.mjs page.html --out shots/desktop.png --width 1280 --scheme light [--go] [--scale 2] [--height 900]';
const remote = /^https?:/.test(a._[0] || '');
const page = remote ? a._[0] : needFile(a._[0], usage);
needs(typeof a.out === 'string', usage);
needs(a.width === undefined || Number(a.width) >= 100, usage, '--width must be a number of pixels, 100 or more.');
needs(a.height === undefined || Number(a.height) >= 50, usage, '--height must be a number of pixels, 50 or more.');
needs(a.scale === undefined || Number(a.scale) > 0, usage, '--scale must be a number above 0.');
needs(a.scheme === undefined || a.scheme === 'light' || a.scheme === 'dark', usage, '--scheme must be light or dark.');
// A refusal stops here, because a browser would otherwise return a screenshot of the firewall and call it a success.
async function refusal() {
  const verdict = await robotsVerdict(page);
  if (verdict !== 'ok') return verdict;
  try {
    const r = await fetch(page, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const title = (await r.text()).match(/<title[^>]*>([^<]+)/i)?.[1] || '';
    return [401, 403, 429, 503].includes(r.status) || BLOCK_PAGE.test(title) ? 'site-blocked' : null;
  } catch (e) { return String(e?.cause?.code || e?.name || 'unreachable'); }
}
if (remote && !a['own-site']) {
  const reason = await refusal();
  if (reason) { say(JSON.stringify({ ok: false, reason, note: 'Do not work around this. Ask the user for the logo, or list the site as not collected.' })); process.exit(1); }
}
const out = resolve(a.out);
const width = Number(a.width || 1280), scheme = a.scheme || 'light', scale = Number(a.scale || 1);
if (!findBrowser()) { say(JSON.stringify({ ok: false, reason: 'no-browser', note: 'The page could not be checked by eye on this computer.' })); process.exit(1); }

// Browsers refuse windows narrower than about 500 px, so narrow pages are viewed through a sized frame.
const windowWidth = Math.max(width, 520);
function crop(file, w, h) {
  const b = readFileSync(file).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${windowWidth}" height="${h}" xlink:href="data:image/png;base64,${b}"/></svg>`;
  const r = rasterise(svg, w);
  write(file, encodePng(r.pixels, r.width, r.height, 4));
}
const dir = remote ? tmpdir() : dirname(page);
const copy = join(dir, `.shot-${process.pid}.html`), frame = join(dir, `.frame-${process.pid}.html`);
const frameHtml = (src, h, top, report) => `<!doctype html><meta charset="utf-8"><body style="margin:0;overflow:hidden;background:#777">${report ? "<script>addEventListener('message',(e)=>document.body.setAttribute('data-h',e.data))</script>" : ''}<iframe src="${src}" width="${width}" height="${h}" style="border:0;position:absolute;left:0;top:${-top}px"></iframe></body>`;
try {
  if (remote || a.height) {
    const h = Number(a.height || 900);
    const src = remote ? page : pathToFileURL(page).href;
    write(frame, frameHtml(src, h, 0));
    const r = await screenshot(remote && width >= 520 ? page : frame, out, { width: windowWidth, height: h, scheme, scale, waitMs: a.go ? 1000 : 0, userAgent: remote ? USER_AGENT : undefined });
    if (r.ok && width < 520) crop(out, width, h);
    say(JSON.stringify({ out, width, scheme, ...r }));
    if (!r.ok) process.exitCode = 1;
  } else {
    // A screenshot cannot wait for an animation, so --go jumps straight to its end state.
    const ending = a.go ? "<style>.stage *{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important}</style>" : '';
    const inject = `${ending}<script>addEventListener('load',()=>{parent.postMessage(document.documentElement.scrollHeight,'*');${a.go ? "document.getElementById('stage')?.classList.add('go');" : ''}});</script>`;
    write(copy, readFileSync(page, 'utf8') + inject);
    const src = pathToFileURL(copy).href;
    write(frame, frameHtml(src, 900, 0, true));
    const dom = await dumpDom(frame, { width: windowWidth, height: 900, scheme });
    const total = Number(dom?.match(/data-h="(\d+)"/)?.[1] || 0);
    if (!total) throw new Error('could not measure the page');
    const slice = 2400, files = [];
    for (let i = 0, top = 0; top < total; i++, top += slice) {
      const h = Math.min(slice, total - top), file = out.replace(/\.png$/i, `-${i + 1}.png`);
      write(frame, frameHtml(src, total, top));
      const r = await screenshot(frame, file, { width: windowWidth, height: h, scheme, scale, waitMs: a.go ? 1000 : 0 });
      if (!r.ok) throw new Error(`screenshot failed: ${r.reason}`);
      if (width < 520) crop(file, width, h);
      files.push(file);
    }
    say(JSON.stringify({ ok: true, width, scheme, pageHeight: total, slices: files }, null, 2));
  }
} catch (e) {
  say(JSON.stringify({ ok: false, reason: e.message }));
  process.exitCode = 1;
} finally {
  rmSync(copy, { force: true });
  rmSync(frame, { force: true });
}
