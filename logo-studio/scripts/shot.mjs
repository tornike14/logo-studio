// node shot.mjs page.html --out page.png [--width 1280] [--height 2600]
import { resolve } from 'node:path';
import { args, say } from './lib/core.mjs';
import { screenshot } from './lib/browser.mjs';

const a = args();
const r = await screenshot(resolve(a._[0]), resolve(a.out), { width: Number(a.width || 1280), height: Number(a.height || 2600) });
say(JSON.stringify({ out: resolve(a.out), ...r }));
if (!r.ok) process.exitCode = 1;
