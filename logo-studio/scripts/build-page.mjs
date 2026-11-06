// node build-page.mjs content.json --out page.html
// Writes page.html, a complete local file, and page.artifact.html, the same page for publishing.
import { dirname, resolve } from 'node:path';
import { args, needFile, needs, readJson, say, write } from './lib/core.mjs';
import { buildPage } from './lib/page.mjs';

const a = args();
const usage = 'node build-page.mjs content.json --out page.html';
const path = needFile(a._[0], usage);
needs(a.out === undefined || typeof a.out === 'string', usage);
const out = resolve(a.out || 'page.html');
const { full, fragment, count } = buildPage(readJson(path), dirname(path));
write(out, full);
write(out.replace(/\.html$/, '.artifact.html'), fragment);
say(JSON.stringify({ out, artifact: out.replace(/\.html$/, '.artifact.html'), competitors: count, kb: Math.round(full.length / 1024) }));
