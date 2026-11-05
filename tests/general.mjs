// The skill must stay general: nothing from the brand it was first built for may ship in it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../logo-studio/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const banned = /Big Why|\borbs?\b|\bDepth\b|\bstoic\b|Tornike|big-why/;
const bad = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'vendor') continue;
    if (statSync(path).isDirectory()) walk(path);
    else readFileSync(path, 'utf8').split('\n').forEach((line, i) => { if (banned.test(line)) bad.push(`${path}:${i + 1}`); });
  }
};
walk(root);
const skill = readFileSync(join(root, 'SKILL.md'), 'utf8');
const front = skill.match(/^---\n([\s\S]*?)\n---/)[1];
const keys = front.split('\n').filter((l) => /^[a-z-]+:/.test(l)).map((l) => l.split(':')[0]);
const allowed = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);
for (const k of keys) if (!allowed.has(k)) bad.push(`frontmatter key not allowed: ${k}`);
const description = front.match(/description: (.*)/)[1];
if (description.length > 1024 || /[<>]/.test(description)) bad.push('description breaks the packaging rules');
for (const line of bad) console.log(`FAIL ${line}`);
console.log(bad.length ? `${bad.length} problem(s)` : 'skill is general, frontmatter is valid');
if (bad.length) process.exitCode = 1;
