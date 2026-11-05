// node check-page.mjs content.json [--page page.html]
// Reports every problem at once. It proves the page is complete and honest, not that the idea is good.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { args, readJson, say, sniff } from './lib/core.mjs';
import { MIN_COMPETITORS, SECTION_ORDER, countShown, fieldPick, loadField, themeProblems } from './lib/page.mjs';

const a = args();
const path = resolve(a._[0]);
const base = dirname(path);
const c = readJson(path);
const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };
const TOP = ['schema', 'brand', 'page', 'theme', 'assets', 'sources', 'sections'];
for (const k of Object.keys(c)) need(TOP.includes(k), `unknown top-level key: ${k}`);
need(c.schema === 1, 'schema must be 1');
need(['app', 'website', 'both', 'local', 'print'].includes(c.brand?.surface), 'brand.surface must be app, website, both, local or print');
need(['icon', 'wide'].includes(c.brand?.shape), 'brand.shape must be icon or wide');
need(c.brand?.name, 'brand.name is missing');
need(c.page?.title, 'page.title is missing');
problems.push(...themeProblems(c.theme || {}));

for (const [id, x] of Object.entries(c.assets || {})) {
  const file = resolve(base, x.path || '');
  if (!x.path || !existsSync(file)) { problems.push(`asset ${id}: file not found (${x.path})`); continue; }
  need(sniff(readFileSync(file)), `asset ${id}: not a readable image`);
  need(['fetched', 'rendered', 'approximated', 'user-supplied'].includes(x.evidence), `asset ${id}: evidence must be fetched, rendered, approximated or user-supplied`);
}
const refs = new Set(Object.keys(c.assets || {}));
const sourceIds = new Set((c.sources || []).map((s) => s.id));
const byId = Object.fromEntries((c.sections || []).map((s) => [s.id, s]));
for (const s of c.sections || []) need(SECTION_ORDER.includes(s.id), `unknown section: ${s.id}`);
for (const id of SECTION_ORDER) {
  const s = byId[id];
  need(s, `section missing: ${id}. Add it, or keep it with an omitReason.`);
  if (s?.omitReason) need(!['hero', 'field', 'gap', 'idea', 'sizes', 'next', 'sources'].includes(id), `section ${id} cannot be omitted`);
}
const use = (id, where) => need(refs.has(id), `${where}: unknown asset ${id}`);
const live = (id) => (byId[id] && !byId[id].omitReason ? byId[id] : null);
if (live('hero')) {
  const h = byId.hero;
  use(h.mark, 'hero.mark');
  need(h.verdict?.length >= 2, 'hero needs a verdict of at least two points');
}
let field = { items: [] };
if (live('field')) {
  const f = byId.field;
  try { field = loadField(c, base); } catch (e) { problems.push(`field index: ${e.message}`); }
  need(f.groups?.length >= 3, 'field needs at least three groups');
  const shown = f.groups ? countShown(f) : 0;
  const min = MIN_COMPETITORS[c.brand?.surface] ?? 12;
  if (shown < min) {
    if (f.thin) need(shown >= Math.ceil(min / 2), `field shows ${shown} competitors, under half the minimum of ${min} even for a thin field`);
    else problems.push(`field shows ${shown} competitors, the minimum for ${c.brand?.surface} is ${min}. Collect more, or explain with field.thin.`);
  }
  for (const g of f.groups || []) for (const item of g.items) {
    const e = typeof item === 'string' ? { name: item } : item;
    if (e.asset) use(e.asset, 'field'); else need(fieldPick(field, e.name), `field: ${e.name} is not in the competitor index`);
  }
}
if (live('gap')) {
  const g = byId.gap;
  for (const f of g.findings || []) need(f.opinion === true || f.sources?.length, `finding "${f.title}" needs sources or opinion: true`);
  for (const f of g.findings || []) for (const id of f.sources || []) need(sourceIds.has(id), `finding "${f.title}": unknown source ${id}`);
  need(g.closest?.length >= 1, 'gap needs the closest look-alikes. Uniqueness cannot be claimed without them.');
  for (const x of g.closest || []) { if (x.asset) use(x.asset, 'closest'); else need(fieldPick(field, x.name), `closest: ${x.name} is not in the competitor index`); }
}
if (live('idea')) need(byId.idea.principles?.length >= 3, 'idea needs at least three principles');
if (live('sizes')) { use(byId.sizes.asset, 'sizes.asset'); need(Math.max(...(byId.sizes.sizes || [0])) <= 360, 'sizes above 360 px overflow a phone screen'); }
if (live('construction')) use(byId.construction.drawing, 'construction.drawing');
for (const id of ['appearances', 'system', 'alternatives']) for (const x of live(id)?.items || []) use(x.asset, `${id}`);
if (live('alternatives')) need(byId.alternatives.items?.length >= 2, 'alternatives needs at least two real rejected concepts');
for (const s of live('context')?.scenes || []) {
  need(['phone', 'browser', 'avatars', 'sign'].includes(s.type), `context: unknown scene ${s.type}`);
  use(s.ours, 'context');
  for (const n of s.others || []) need(fieldPick(field, n), `context: ${n} is not in the competitor index`);
}
if (live('motion')) { use(byId.motion.svg, 'motion.svg'); need(['reveal', 'handoff', 'draw', 'custom', undefined].includes(byId.motion.preset), 'motion.preset must be reveal, handoff, draw or custom'); }
if (live('next')) need(byId.next.unverified?.length >= 1, 'next must say what was not verified');

if (a.page) {
  const html = readFileSync(resolve(a.page), 'utf8');
  need(html.startsWith('<!doctype html>') && /<meta charset="utf-8">/.test(html), 'page has no doctype or charset');
  need(!/\{\{|\{count\}/.test(html), 'page still holds a placeholder');
  need(html.length < 16 * 1024 * 1024, 'page is over 16 MB');
  const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|data:[a-z/+]+;base64,[A-Za-z0-9+/=]+/g, ' ').replace(/<[^>]+>/g, ' ');
  if (/lorem ipsum|TODO|TBD/.test(text)) problems.push('page text still holds placeholder words');
  // Absolute claims need the sample beside them.
  for (const m of text.matchAll(/[^.]*\b(unique|one of a kind|no other|nobody else|no one else|the only (?:icon|logo|mark|brand|app|one)|the first (?:icon|logo|mark|brand|app))\b[^.]*\./gi)) if (!/\b(here|these|this sample|sample|logos|looked at|in this field|of the)\b/i.test(m[0])) problems.push(`this absolute claim needs its sample: "${m[0].trim().slice(0, 90)}"`);
}
for (const p of problems) say(`PROBLEM  ${p}`);
say(problems.length ? `${problems.length} problem(s). Fix them and run again.` : 'Page check passed.');
if (problems.length) process.exitCode = 1;
