// node render.mjs in.svg --out out.png --width 1024 [--opaque "#FFFFFF"]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { args, needFile, needs, write, say } from './lib/core.mjs';
import { png, opaquePng } from './lib/render.mjs';

const a = args();
const usage = 'node render.mjs in.svg --out out.png --width 1024 [--opaque "#FFFFFF"]';
const input = needFile(a._[0], usage);
needs(typeof a.out === 'string', usage);
const svg = readFileSync(input, 'utf8');
const width = Number(a.width || 1024);
write(resolve(a.out), a.opaque ? opaquePng(svg, width, a.opaque === true ? '#FFFFFF' : a.opaque) : png(svg, width));
say(JSON.stringify({ out: resolve(a.out), width }));
