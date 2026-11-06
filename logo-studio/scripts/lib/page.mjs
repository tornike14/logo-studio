// Turns a content file into the page. Structure lives here and in assets/page-template.html, so every
// brand gets the same page. The content file holds words and file paths only.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { MIME, SKILL_ROOT, hexRgb, readJson, rasterSize, sniff } from './core.mjs';
import { icoToPng } from './ico.mjs';
import { png } from './render.mjs';

export const SECTION_ORDER = ['hero', 'field', 'gap', 'idea', 'construction', 'sizes', 'appearances', 'context', 'system', 'motion', 'alternatives', 'next', 'sources'];
export const MIN_COMPETITORS = { app: 20, website: 12, both: 24, local: 8, print: 8 };

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function prose(t, ctx = {}) {
  return esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[#([0-9a-fA-F]{6})\]/g, (_, h) => `<span class="chip" style="background:#${h}"></span>#${h}`)
    .replace(/\{count\}/g, () => String(ctx.count ?? ''));
}

function dataUri(file, thumb) {
  let buf = readFileSync(file);
  let type = sniff(buf);
  if (type === 'ico') { buf = icoToPng(buf).png; type = 'png'; }
  if (!type) throw new Error(`not an image: ${file}`);
  const size = rasterSize(buf);
  if (thumb && type !== 'webp' && size && Math.max(...size) > thumb * 1.4) {
    const [w, h] = size;
    const inner = `data:${MIME[type]};base64,${buf.toString('base64')}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}"><image width="${w}" height="${h}" xlink:href="${inner}"/></svg>`;
    return `data:image/png;base64,${Buffer.from(png(svg, w >= h ? thumb : Math.round(thumb * (w / h)))).toString('base64')}`;
  }
  return `data:${MIME[type]};base64,${buf.toString('base64')}`;
}

function contrast(a, b) {
  const lum = (hex) => { const [r, g, bl] = hexRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export function themeProblems(theme) {
  const out = [];
  for (const [label, t] of [['light', theme], ['dark', theme.dark || {}]]) {
    for (const k of ['ground', 'surface', 'ink', 'inkSoft', 'hair', 'accent', 'warm', 'wash']) if (!/^#[0-9a-fA-F]{6}$/.test(t[k] || '')) out.push(`theme.${label === 'dark' ? 'dark.' : ''}${k} must be a #RRGGBB colour`);
    if (t.plate !== undefined && !/^#[0-9a-fA-F]{6}$/.test(t.plate)) out.push(`theme.${label === 'dark' ? 'dark.' : ''}plate must be a #RRGGBB colour`);
    if (out.length) continue;
    if (contrast(t.ink, t.ground) < 7) out.push(`${label}: ink on ground contrast ${contrast(t.ink, t.ground).toFixed(1)} is under 7`);
    if (contrast(t.inkSoft, t.surface) < 4.5) out.push(`${label}: soft text on surface contrast ${contrast(t.inkSoft, t.surface).toFixed(1)} is under 4.5`);
    if (contrast(t.accent, t.ground) < 3) out.push(`${label}: accent on ground contrast ${contrast(t.accent, t.ground).toFixed(1)} is under 3`);
  }
  return out;
}
function tokens(theme) {
  // Text on the accent is whichever of white or ink reads better, so a pale accent cannot hide a button label.
  const onAccent = (t) => (contrast(t.accent, '#FFFFFF') >= contrast(t.accent, '#15151A') ? '#FFFFFF' : '#15151A');
  const vars = (t) => `--ground:${t.ground};--surface:${t.surface};--ink:${t.ink};--ink-soft:${t.inkSoft};--hair:${t.hair};--accent:${t.accent};--blue:${t.accent};--coral:${t.warm};--wash:${t.wash};--plate:${t.plate || '#D5D7DE'};--on-accent:${onAccent(t)}`;
  const display = { rounded: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, "Segoe UI", sans-serif', sans: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif', serif: 'ui-serif, "New York", Georgia, "Times New Roman", serif' }[theme.font || 'rounded'];
  const font = `--display: ${display};--body: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif;--mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  return `:root{${vars(theme)};${font}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(theme.dark)};color-scheme:dark}}
:root[data-theme="dark"]{${vars(theme.dark)};color-scheme:dark}
.on-dark{display:none!important}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .on-dark{display:block!important}:root:not([data-theme="light"]) .on-light{display:none!important}}
:root[data-theme="dark"] .on-dark{display:block!important}:root[data-theme="dark"] .on-light{display:none!important}`;
}

export function loadField(content, baseDir) {
  const field = content.sections.find((s) => s.id === 'field');
  if (!field || !field.index) return { items: [], base: baseDir };
  const path = resolve(baseDir, field.index);
  return { items: readJson(path).items, base: dirname(path) };
}
export function fieldPick(field, name) {
  return field.items.find((i) => i.name === name) || field.items.find((i) => i.file === name) || field.items.find((i) => (i.fullName || '').startsWith(name));
}
// Distinct competitors actually shown on the page.
export function countShown(section) {
  return new Set(section.groups.filter((g) => !g.control).flatMap((g) => g.items.filter((i) => typeof i === 'string' || !i.ours).map((i) => (typeof i === 'string' ? i : i.name || i.asset)))).size;
}

export function buildPage(content, baseDir) {
  const field = loadField(content, baseDir);
  const asset = (id, thumb) => {
    const a = content.assets[id];
    if (!a) throw new Error(`unknown asset: ${id}`);
    return dataUri(resolve(baseDir, a.path), thumb);
  };
  const logo = (name) => { const it = fieldPick(field, name); if (!it) throw new Error(`not in the field: ${name}`); return { src: dataUri(join(field.base, it.file), 132), it }; };
  const fieldSection = content.sections.find((s) => s.id === 'field');
  const ctx = { count: fieldSection ? countShown(fieldSection) : 0 };
  const P = (t) => prose(t, ctx);
  const tag = (o) => (o.opinion ? '<span class="tag">Our read</span>' : o.sources?.length ? `<span class="tag">${o.sources.map((id) => { const s = content.sources.find((x) => x.id === id); return s?.url ? `<a href="${esc(s.url)}">${esc(s.label)}</a>` : esc(s?.label || id); }).join(' · ')}</span>` : '');
  const themed = (id, dark, alt, extra = '') => (dark ? `<img class="on-light" src="${asset(id)}" alt="${esc(alt)}"${extra}><img class="on-dark" src="${asset(dark)}" alt="${esc(alt)}"${extra}>` : `<img src="${asset(id)}" alt="${esc(alt)}"${extra}>`);
  const variants = (items) => `<div class="variants">${items.map((v) => `<figure class="variant">${themed(v.asset, v.assetDark, v.alt || v.title)}<figcaption><b>${P(v.title)}</b>${v.note ? P(v.note) : ''}</figcaption></figure>`).join('')}</div>`;
  let n = 0;
  const head = (s, fallback) => { n++; return `<div class="col"><span class="eyebrow">${n} · ${esc(s.label || fallback)}</span><h2>${P(s.title)}</h2>${(s.intro ? [].concat(s.intro) : []).map((p) => `<p>${P(p)}</p>`).join('')}</div>`; };
  const scene = {
    phone: (c) => {
      const cells = c.others.map((name) => { const l = logo(name); return `<div class="hs"><img src="${l.src}" alt=""><span>${esc(l.it.name)}</span></div>`; });
      cells.splice(c.position ?? 6, 0, `<div class="hs ours"><img src="${asset(c.ours)}" alt=""><span>${esc(content.brand.name)}</span></div>`);
      return `<figure class="phone-wrap"><div class="phone"><div class="screen">${cells.join('')}</div></div><figcaption><b>${P(c.title)}</b> ${P(c.caption)}</figcaption></figure>`;
    },
    browser: (c) => {
      const tabs = c.others.slice(0, 3).map((name) => { const l = logo(name); return `<div class="tabx"><img src="${l.src}" alt=""><span>${esc(l.it.name)}</span></div>`; });
      tabs.splice(1, 0, `<div class="tabx on"><img src="${asset(c.favicon || c.ours)}" alt=""><span>${esc(content.brand.name)}</span></div>`);
      return `<figure class="scene-wrap"><div class="browser"><div class="tabs">${tabs.join('')}</div><div class="sitehead">${themed(c.ours, c.oursDark, '')}</div></div><figcaption><b>${P(c.title)}</b> ${P(c.caption)}</figcaption></figure>`;
    },
    avatars: (c) => `<figure class="scene-wrap"><div class="avatars">${[...c.others.slice(0, 2).map((name) => `<img src="${logo(name).src}" alt="">`), `<img src="${asset(c.ours)}" alt="">`, ...c.others.slice(2, 4).map((name) => `<img src="${logo(name).src}" alt="">`)].join('')}</div><figcaption><b>${P(c.title)}</b> ${P(c.caption)}</figcaption></figure>`,
    sign: (c) => `<figure class="scene-wrap"><div class="sign"><img src="${asset(c.ours)}" alt=""></div><figcaption><b>${P(c.title)}</b> ${P(c.caption)}</figcaption></figure>`,
  };
  const render = {
    hero: (s) => `<section class="hero"><div class="mark"><img class="on-light" src="${asset(s.mark)}" alt="${esc(s.alt)}"><img class="on-dark" src="${asset(s.markDark || s.mark)}" alt="${esc(s.alt)}"></div><div class="copy"><span class="eyebrow">${esc(s.eyebrow)}</span><h1>${P(s.title)}</h1><p class="lede">${P(s.lede)}</p><div class="verdict"><ol>${s.verdict.map((v) => `<li>${P(v)}</li>`).join('')}</ol></div></div></section>`,
    field: (s) => {
      const groups = s.groups.map((g) => {
        const tiles = g.items.map((item) => {
          const e = typeof item === 'string' ? { name: item } : item;
          if (e.asset) return `<figure class="app ${e.ours ? 'ours' : ''}"><img src="${asset(e.asset, 132)}" alt="" loading="lazy"><figcaption>${esc(e.label)}</figcaption></figure>`;
          const l = logo(e.name);
          return `<figure class="app ${l.it.kind === 'logo' ? 'wide' : ''}"><img src="${l.src}" alt="" loading="lazy"><figcaption>${esc(e.label || l.it.name)}</figcaption></figure>`;
        }).join('');
        return `<section class="group"><header><h3>${P(g.title)}${g.control ? '<span class="control">Comparison group</span>' : ''}</h3><span class="count">${g.items.length}</span></header><p>${P(g.note)}</p><div class="apps">${tiles}</div></section>`;
      }).join('');
      const thin = s.thin ? `<p class="thin"><b>Thin field.</b> ${P(s.thin)}</p>` : '';
      return `<section class="stack">${head(s, 'The field')}${thin}<div class="groups">${groups}</div></section>`;
    },
    gap: (s) => `<section class="stack">${head(s, 'What is missing')}<div class="findings">${s.findings.map((f) => `<div class="finding"><h3>${P(f.title)}</h3><p>${P(f.text)}</p>${tag(f)}</div>`).join('')}</div>${s.closest?.length ? `<h3>Closest look-alikes</h3><div class="closest">${s.closest.map((c) => (c.asset ? `<div class="look"><img src="${asset(c.asset, 132)}" alt=""><p><b>${esc(c.label)}</b>${P(c.why)}</p></div>` : (() => { const l = logo(c.name); return `<div class="look"><img src="${l.src}" alt=""><p><b>${esc(l.it.name)}</b>${P(c.why)}</p></div>`; })())).join('')}</div>` : ''}${s.pair ? `<div class="pair"><div class="two">${s.pair.items.map((i) => `<figure><img src="${i.asset ? asset(i.asset, 192) : logo(i.name).src}" alt="${esc(i.label)}">${esc(i.label)}</figure>`).join('')}</div><p>${P(s.pair.text)}</p></div>` : ''}</section>`,
    idea: (s) => `<section class="stack"><div class="col"><span class="eyebrow">${++n} · ${esc(s.label || 'The idea')}</span><h2>${P(s.title)}</h2>${s.paragraphs.map((p) => `<p>${P(p)}</p>`).join('')}</div>${s.quote ? `<blockquote>${P(s.quote)}</blockquote>` : ''}<div class="principles">${s.principles.map((p) => `<div class="principle"><h3>${P(p.title)}</h3><p>${P(p.text)}</p></div>`).join('')}</div></section>`,
    construction: (s) => `<section class="stack">${head(s, 'Construction')}<div class="construct"><img src="${asset(s.drawing)}" alt="${esc(s.alt || 'Construction drawing')}"><dl class="spec">${s.rows.map((r) => `<div><dt>${P(r.label)}</dt><dd>${P(r.value)}</dd></div>`).join('')}</dl></div></section>`,
    sizes: (s) => { const wide = s.shape === 'wide' || content.brand.shape === 'wide'; return `<section class="stack">${head(s, 'Sizes')}<div class="sizes">${s.sizes.map((z) => `<div class="sz">${themed(s.asset, s.assetDark, '', ` style="width:${z}px;height:${wide ? 'auto' : `${z}px`};border-radius:${wide ? 0 : Math.round(z * 0.225)}px"`)}<span>${z} px</span></div>`).join('')}${(s.extras || []).map((x) => `<div class="sz"><img src="${asset(x.asset)}" style="width:${x.size}px;height:${x.size}px" alt=""><span>${esc(x.label)}</span></div>`).join('')}</div></section>`; },
    appearances: (s) => `<section class="stack">${head(s, 'Appearances')}${variants(s.items)}</section>`,
    context: (s) => `<section class="stack">${head(s, 'In context')}<div class="phones">${s.scenes.map((c) => scene[c.type](c)).join('')}</div></section>`,
    system: (s) => `<section class="stack">${head(s, 'The system')}${variants(s.items)}</section>`,
    motion: (s) => {
      const svg = readFileSync(resolve(baseDir, content.assets[s.svg].path), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<svg\b/, '<svg aria-label="Logo animation"');
      const hero = s.heroTo || {};
      const preset = s.preset || 'reveal';
      // handoff moves named layers, draw traces .draw strokes, reveal works on any art, custom means the SVG holds its own CSS for .stage.go.
      const css = preset === 'handoff' ? `<style>.stage.go .out{opacity:0;transform:scale(1.25)}.stage.go .hero-layer{transform:translate(${hero.x || 0}px,${hero.y || 0}px) scale(${hero.scale || 1})}</style>` : '';
      n++;
      return `<section class="motion"><div class="stage ${esc(preset)}" id="stage" style="background:${esc(s.stage || content.theme.ground)}">${css}${svg}</div><div class="col" style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">${n} · ${esc(s.label || 'Motion')}</span><h2>${P(s.title)}</h2><p>${P(s.text)}</p><button class="play" id="play" type="button">${esc(s.button || 'Play')}</button></div></section>`;
    },
    alternatives: (s) => `<section class="stack">${head(s, 'Considered and set aside')}<div class="alts">${s.items.map((i) => `<div class="alt"><img src="${asset(i.asset)}" alt="${esc(i.title)}"><h3>${P(i.title)}</h3><p>${P(i.note)}</p></div>`).join('')}</div></section>`,
    next: (s) => `<section class="next"><div class="box"><h3>To make it real</h3><ul>${s.todo.map((t) => `<li>${P(t)}</li>`).join('')}</ul></div><div class="box"><h3>Not verified yet</h3><ul>${s.unverified.map((t) => `<li>${P(t)}</li>`).join('')}</ul></div></section>`,
    sources: (s) => `<section class="sources"><span class="eyebrow">Sources</span>${(s.notes || []).map((t) => `<span>${P(t)}</span>`).join('')}${content.sources.map((x) => (x.url ? `<a href="${esc(x.url)}">${esc(x.label)}</a>` : `<span>${esc(x.label)}</span>`)).join('')}</section>`,
  };
  const body = SECTION_ORDER.map((id) => { const s = content.sections.find((x) => x.id === id); return s && !s.omitReason ? render[id](s) : ''; }).filter(Boolean).join('\n\n');
  const template = readFileSync(join(SKILL_ROOT, 'assets', 'page-template.html'), 'utf8');
  const values = { TITLE: esc(content.page.title), TOKENS: tokens(content.theme), SHAPE: content.brand.shape || 'icon', SECTIONS: body };
  const fragment = template.replace(/\{\{(TITLE|TOKENS|SHAPE|SECTIONS)\}\}/g, (_, k) => values[k]);
  const full = `<!doctype html>\n<html lang="${esc(content.page.lang || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${fragment}</html>\n`;
  return { full, fragment, count: ctx.count };
}
