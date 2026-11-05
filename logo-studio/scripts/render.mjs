// node render.mjs in.svg --out out.png --width 1024 [--opaque "#FFFFFF"]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { args, write, say } from './lib/core.mjs';
import { png, opaquePng } from './lib/render.mjs';

const a = args();
const svg = readFileSync(a._[0], 'utf8');
const width = Number(a.width || 1024);
write(resolve(a.out), a.opaque ? opaquePng(svg, width, a.opaque === true ? '#FFFFFF' : a.opaque) : png(svg, width));
say(JSON.stringify({ out: resolve(a.out), width }));
