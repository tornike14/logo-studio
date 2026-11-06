// Collects real competitor logos. Cached and resumable: each run works for a time budget and is run
// again until it reports remaining 0, so a long list survives tool time limits.
//   node competitors.mjs plan.json --out field [--budget 90] [--retry-failed]
// plan.json: { "country": "us", "apps": ["Calm", {"term":"meditation","limit":10}, {"id":571800810}],
//              "play": ["com.calm.android"],
//              "sites": ["calm.com"], "files": [{"name":"Rival","path":"rival.png","replaces":"site:rival.com"}],
//              "images": [{"name":"Rival","url":"https://direct/link/to/logo.png","replaces":"site:rival.com"}],
//              "exclude": ["Wrong App"], "rename": {"Long Store Title":"Brand"} }
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { args, needFile, needs, readJson, writeJson, write, say, safeName, sniff, rasterSize, EXT } from './lib/core.mjs';
import { icoToPng } from './lib/ico.mjs';
import { rasterise } from './lib/render.mjs';
import { BLOCK_PAGE, HEADERS, WEB_TEXT_NOTICE, WITHHELD, cleanSvg, robotsVerdict, webText } from './lib/web.mjs';

const a = args();
const planPath = a._[0];
const usage = 'node competitors.mjs plan.json --out field [--budget 90] [--retry-failed]';
needFile(planPath, usage);
needs(typeof a.out === 'string', usage);
const plan = readJson(planPath);
const out = resolve(a.out);
const budgetMs = Number(a.budget || 90) * 1000;
const indexPath = join(out, 'index.json');
const started = Date.now();
const country = plan.country || 'us';
const today = new Date().toISOString().slice(0, 10);
mkdirSync(join(out, 'logos'), { recursive: true });
const state = existsSync(indexPath) ? readJson(indexPath) : { done: {}, items: [], appStoreAt: 0 };
const reason = (e) => (e?.name === 'TimeoutError' ? 'timeout' : String(e?.cause?.code || e?.code || e?.name || e));
const save = () => writeJson(indexPath, state);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (t) => t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
// Interface icons (menus, arrows, ticks) sit in the same headers as logos, and they are only a few short shapes.
function logoLike(svg) {
  if (/<use\b/i.test(svg)) return false;
  if (/menu|hamburger|chevron|arrow|close|search|cart|caret|toggle|icon-/i.test(svg.slice(0, 300))) return false;
  return [...svg.matchAll(/\sd="([^"]+)"/g)].reduce((n, m) => n + m[1].length, 0) >= 400;
}
const remainingMs = () => budgetMs - (Date.now() - started);

async function obey(url) {
  const verdict = await robotsVerdict(url);
  if (verdict !== 'ok') throw Object.assign(new Error(verdict), { code: verdict, obeyed: true });
}
// Apple's Search API is a documented service with its own limit, so `api` skips robots.txt for it. Everything else obeys it.
async function get(url, { timeout = 15000, api = false } = {}) {
  if (!api) await obey(url);
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
      if (!api && r.url && r.url !== url) await obey(r.url);
      return r;
    } catch (e) {
      if (attempt >= 1 || e.name === 'TimeoutError' || e.obeyed) throw e;
      await sleep(600);
    }
  }
}

// Saves an image and grades it. Favicons are often too small to judge a logo by, and the page must say so.
function store(buf, slug, meta) {
  let data = buf, type = sniff(buf), width = null, height = null;
  if (type === 'ico') {
    const r = icoToPng(buf);
    if (!r) return null;
    data = r.png; type = 'png';
  }
  if (!type) return null;
  if (type === 'svg') {
    data = Buffer.from(cleanSvg(data.toString('utf8')));
    if (!visible(data.toString('utf8'))) return null;
  } else [width, height] = rasterSize(data) || [null, null];
  const file = `logos/${slug}.${EXT[type]}`;
  write(join(out, file), data);
  const long = Math.max(width || 0, height || 0), short = Math.min(width || 0, height || 0);
  const quality = type === 'svg' || short >= 96 || (long >= 160 && short >= 32) ? 'good' : 'low';
  // The sheets cannot draw WebP, though browsers and the page can.
  return { ...meta, file, type, width, height, quality, ...(type === 'webp' ? { note: 'WebP: blank on sheets, shown on the page' } : {}) };
}
function visible(svg) {
  try {
    const r = rasterise(svg, 96);
    let on = 0;
    for (let i = 3; i < r.pixels.length; i += 4) if (r.pixels[i] > 32) on++;
    return on / (r.pixels.length / 4) > 0.01;
  } catch { return false; }
}

const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '');
// Every word from a site or a store passes through here before anything can read it.
function tidy(item) {
  const out = { ...item };
  const fallback = item.packageId || (item.appId ? `App ${item.appId}` : item.sourceUrl ? new URL(item.sourceUrl).hostname : 'Unnamed');
  for (const key of ['name', 'fullName', 'seller', 'genre', 'siteTitle', 'flag', 'note']) {
    if (out[key] === undefined || out[key] === null) continue;
    if (out[key] === WITHHELD) { out.withheld = true; continue; }
    const t = webText(out[key], { max: key === 'name' ? 40 : 120, fallback: key === 'name' ? fallback : WITHHELD });
    out[key] = t.text;
    if (t.withheld) out.withheld = true;
  }
  return out;
}
function push(raw) {
  const item = tidy(raw);
  // Pages refer to logos by name, so two different apps may not share one.
  let name = item.name;
  if (state.items.some((i) => i.name === name)) {
    const tag = item.withheld ? item.source : String(item.seller || item.source).split(/[\s,]/)[0];
    name = `${item.name} (${tag})`;
    for (let n = 2; state.items.some((i) => i.name === name); n++) name = `${item.name} (${tag} ${n})`;
  }
  state.items.push({ date: today, ...item, name });
}

async function appStore(entry) {
  const id = entry.id;
  const term = typeof entry === 'string' ? entry : entry.term;
  const exact = typeof entry === 'string';
  const limit = exact ? 1 : entry.limit || 10;
  const wait = state.appStoreAt + 3200 - Date.now();
  if (wait > 0) await sleep(wait);
  state.appStoreAt = Date.now();
  const url = id ? `https://itunes.apple.com/lookup?${new URLSearchParams({ id: String(id), country })}` : `https://itunes.apple.com/search?${new URLSearchParams({ term, entity: 'software', limit: String(limit), country })}`;
  const r = await get(url, { api: true });
  if (!r.ok) throw Object.assign(new Error('http'), { code: `http-${r.status}` });
  const { results } = await r.json();
  let added = 0;
  for (const app of results) {
    const title = app.trackName;
    // A name search returns the closest app even when the wanted one does not exist.
    const weak = exact && !norm(title).includes(norm(term).slice(0, 12)) && !norm(term).includes(norm(title.split(/[:\u2013\u2014-]/)[0]));
    if (state.items.some((i) => i.appId === app.trackId)) continue;
    const img = await get(app.artworkUrl512, { api: true });
    const item = store(Buffer.from(await img.arrayBuffer()), `app-${app.trackId}`, { name: title.split(/\s*[:\u2013\u2014]\s+|\s+[-|&]\s+/)[0].trim(), fullName: title, query: id ? `id ${id}` : term, source: 'app-store', sourceUrl: app.trackViewUrl, seller: app.sellerName, genre: app.primaryGenreName, ratings: app.userRatingCount ?? 0, appId: app.trackId, kind: 'icon', evidence: 'fetched', ...(weak ? { flag: `searched "${term}", got "${title}"` } : {}) });
    if (item) { push(item); added++; }
  }
  if (!added) throw Object.assign(new Error('none'), { code: results.length ? 'already-collected' : 'no-match' });
}

async function play(entry) {
  // Google's robots.txt forbids its search pages, so an app is reached only by its package id.
  const id = typeof entry === 'string' ? entry : entry.id;
  if (!/^[\w]+(\.[\w]+)+$/.test(id || '')) throw Object.assign(new Error('play-needs-package-id'), { code: 'play-needs-package-id' });
  if (state.items.some((i) => i.packageId === id)) return;
  const url = `https://play.google.com/store/apps/details?id=${id}&hl=en&gl=${country.toUpperCase()}`;
  const page = await get(url);
  if (!page.ok) throw Object.assign(new Error('http'), { code: `http-${page.status}` });
  const h = await page.text();
  const m = h.match(/property="og:image" content="([^"]+)"/) || h.match(/content="([^"]+)" property="og:image"/);
  const title = decode(h.match(/<title[^>]*>([^<]+)/)?.[1] || id).replace(/\s*-\s*Apps on Google Play.*/, '');
  if (!m) throw Object.assign(new Error('no-image'), { code: 'no-image' });
  const img = await get(m[1].replace(/&amp;/g, '&').replace(/=w\d+.*$/, '=w512'));
  const item = store(Buffer.from(await img.arrayBuffer()), `play-${safeName(id)}`, { name: title.split(/\s*[:–—]\s+|\s+[-|]\s+/)[0], fullName: title, source: 'google-play', sourceUrl: url, packageId: id, kind: 'icon', evidence: 'fetched' });
  if (!item) throw Object.assign(new Error('unreadable'), { code: 'unreadable-image' });
  push(item);
}

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
function siteCandidates(html, base) {
  const list = [];
  const abs = (u) => { try { return new URL(u.replace(/&amp;/g, '&'), base).href; } catch { return null; } };
  const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] || html.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] || '';
  for (const m of header.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], 'src') || attr(m[0], 'data-src') || attr(m[0], 'srcset')?.split(/[\s,]/)[0];
    if (src && !src.startsWith('data:') && /logo|brand/i.test(m[0])) list.push({ url: abs(src), kind: 'logo', score: 3000 });
  }
  // Only a home link whose content is the SVG itself counts, or the first menu icon would pass as a logo.
  const homeLink = header.match(/<a\b[^>]*href=["'](?:\/|https?:\/\/[^"'/]+\/?)["'][^>]*>\s*(?:<(?:span|div|h1|picture)\b[^>]*>\s*)*(<svg\b[\s\S]*?<\/svg>)/i)?.[1];
  const namedSvg = [...header.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)].map((m) => m[0]).find((s) => /logo|brand/i.test(s.slice(0, 500)));
  for (const svg of [namedSvg, homeLink]) if (svg && logoLike(svg)) list.push({ inline: svg, kind: 'logo', score: 3500 });
  const ld = html.match(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"(https?:[^"]+)"/i)?.[1];
  if (ld) list.push({ url: abs(ld.replace(/\\\//g, '/')), kind: 'logo', score: 2500 });
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(m[0], 'rel') || '', href = attr(m[0], 'href'), size = Number(attr(m[0], 'sizes')?.match(/\d+/)?.[0] || 0);
    if (!href) continue;
    if (/apple-touch-icon/i.test(rel)) list.push({ url: abs(href), kind: 'icon', score: 1000 + size });
    else if (/\bicon\b/i.test(rel)) list.push({ url: abs(href), kind: 'icon', score: /\.svg/i.test(href) ? 900 : size || 16 });
  }
  list.push({ url: abs('/apple-touch-icon.png'), kind: 'icon', score: 5 }, { url: abs('/favicon.ico'), kind: 'icon', score: 4 });
  return list.filter((c) => c.url || c.inline).sort((x, y) => y.score - x.score);
}

async function site(domain) {
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  const page = await get(url);
  const html = await page.text();
  const host = new URL(page.url).hostname.replace(/^www\./, '');
  const title = decode(html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)/i)?.[1] || html.match(/<title[^>]*>([^<]+)/i)?.[1] || '');
  const blocked = !page.ok || BLOCK_PAGE.test(title);
  const fromHost = host.split('.')[0].replace(/^./, (c) => c.toUpperCase());
  // Page titles are often slogans. The brand is the part that matches the web address, if any part does.
  const parts = title.split(/\s+[|\u2013\u2014:-]\s+|\s+with\s+|,\s+/);
  const root = norm(host.split('.')[0]);
  const named = parts.find((t) => norm(t) === root) || title.match(new RegExp(`\\b${host.split('.')[0]}\\b`, 'i'))?.[0];
  const name = blocked || !title ? fromHost : named || (parts[0].length <= 24 ? parts[0].trim() : fromHost);
  const meta = { name: name.slice(0, 40), source: 'website', sourceUrl: page.url, siteTitle: title.slice(0, 80), ...(blocked ? { note: 'site blocked automated reading, check by hand' } : {}) };
  const found = [];
  const seen = new Set();
  for (const c of siteCandidates(html, page.url)) {
    if (found.some((f) => f.quality === 'good') && (found.some((f) => f.kind === 'logo') || c.kind === 'icon')) break;
    if (c.url && seen.has(c.url)) continue;
    seen.add(c.url);
    try {
      let buf;
      if (c.inline) buf = Buffer.from(c.inline);
      else { const r = await get(c.url, { timeout: 10000 }); if (!r.ok) continue; buf = Buffer.from(await r.arrayBuffer()); }
      const stored = store(buf, `site-${safeName(host)}-${c.kind}-${found.length}`, { ...meta, kind: c.kind, assetUrl: c.url || page.url, evidence: 'fetched' });
      if (stored) found.push(stored);
    } catch { /* one bad image should not lose the site */ }
    if (found.length >= 3) break;
  }
  // "No image" would read as a missing logo, when the truth is that the site turned the tool away.
  if (!found.length) { const code = blocked ? 'site-blocked' : 'no-image'; throw Object.assign(new Error(code), { code }); }
  const rank = (f) => (f.quality === 'good' ? 2 : 0) + (f.kind === 'logo' ? 1 : 0);
  found.sort((x, y) => rank(y) - rank(x));
  push({ ...found[0], alternates: found.slice(1).map((f) => f.file) });
}

async function importImage(entry) {
  const r = await get(entry.url);
  if (!r.ok) throw Object.assign(new Error('http'), { code: `http-${r.status}` });
  const item = store(Buffer.from(await r.arrayBuffer()), `image-${safeName(entry.name)}`, { name: entry.name, source: 'direct link', sourceUrl: entry.url, kind: entry.kind || 'logo', evidence: 'fetched' });
  if (!item) throw Object.assign(new Error('unreadable'), { code: 'unreadable-image' });
  // A square image is an avatar or icon, and fills its tile.
  if (!entry.kind && item.width && item.width === item.height) item.kind = 'icon';
  push(item);
  if (entry.replaces) state.done[entry.replaces] = 'ok';
}

function importFile(entry) {
  const from = resolve(dirname(planPath), entry.path);
  const item = store(readFileSync(from), `file-${safeName(entry.name)}`, { name: entry.name, source: entry.url ? 'saved' : 'supplied', sourceUrl: entry.url || null, kind: entry.kind || 'logo', evidence: entry.url ? 'fetched' : 'user-supplied' });
  if (!item) throw Object.assign(new Error('unreadable'), { code: 'unreadable-image' });
  push(item);
  if (entry.replaces) state.done[entry.replaces] = 'ok';
}

const jobs = [
  ...(plan.files || []).map((e) => [`file:${e.name}`, () => importFile(e)]),
  ...(plan.images || []).map((e) => [`image:${e.name}`, () => importImage(e)]),
  ...(plan.apps || []).map((e) => [`app:${e.id || e.term || e}`, () => appStore(e)]),
  ...(plan.play || []).map((e) => [`play:${e.id || e.term || e}`, () => play(e)]),
  ...(plan.sites || []).map((e) => [`site:${e}`, () => site(e)]),
];
const pending = jobs.filter(([key]) => !state.done[key] || (a['retry-failed'] && state.done[key] !== 'ok'));
let ran = 0;
for (const [key, job] of pending) {
  if (remainingMs() < 4000) break;
  try { await job(); state.done[key] = 'ok'; } catch (e) { state.done[key] = reason(e); }
  ran++;
  save();
}
// Curation lives in the plan, so a repeat run cannot bring back what was removed.
const excluded = new Set(plan.exclude || []);
// A collection started by an older version may hold raw text, so everything is cleaned again here.
state.items = state.items.map(tidy).filter((i) => !excluded.has(i.name) && !excluded.has(i.fullName) && !excluded.has(i.file));
for (const [from, to] of Object.entries(plan.rename || {})) for (const i of state.items) if (i.name === from || i.fullName === from) i.name = to;
save();
const SOFT = new Set(['already-collected']);
const current = new Set(jobs.map(([key]) => key));
const problems = Object.entries(state.done).filter(([k, v]) => v !== 'ok' && !SOFT.has(v) && current.has(k));
const turnedAway = ([, v]) => String(v).startsWith('robots-') || v === 'site-blocked';
const failed = problems.filter((p) => !turnedAway(p)).map(([k, v]) => `${k} (${v})`);
const refused = problems.filter(turnedAway).map(([k, v]) => `${k} (${v})`);
const left = jobs.filter(([key]) => !state.done[key]).length;
const seen = {};
for (const i of state.items) (seen[norm(i.name.replace(/\s*\(.*\)$/, ''))] ||= []).push(i.name);
const report = {
  notice: WEB_TEXT_NOTICE,
  collected: state.items.length,
  good: state.items.filter((i) => i.quality === 'good').length,
  low: state.items.filter((i) => i.quality === 'low').map((i) => i.name),
  checkTheseMatches: state.items.filter((i) => i.flag).map((i) => i.flag),
  sameBrandTwice: Object.values(seen).filter((v) => v.length > 1),
  notes: state.items.filter((i) => i.note).map((i) => `${i.name}: ${i.note}`),
  // A guessed web address can belong to a different company, so each title needs a glance.
  siteTitles: state.items.filter((i) => i.siteTitle).map((i) => `${i.name} <- ${new URL(i.sourceUrl).hostname}: ${i.siteTitle}`),
  // Text that tried to address an agent was replaced, and the logo beside it needs a hard look.
  withheldText: state.items.filter((i) => i.withheld).map((i) => `${i.name} <- ${i.source}`),
  ranThisTime: ran, remaining: left, failed, refused, index: indexPath,
};
say(JSON.stringify(report, null, 2));
if (left) say('MORE TO DO: run the same command again.');
