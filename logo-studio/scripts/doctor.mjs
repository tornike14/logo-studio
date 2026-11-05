// First step of every run: reports this computer's abilities and which platform notes to read.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { arch, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { say, write, SKILL_ROOT, sniff, args } from './lib/core.mjs';
import { findBrowser } from './lib/browser.mjs';

const a = args();
const major = Number(process.versions.node.split('.')[0]);
const notes = { darwin: 'platform-mac.md', win32: 'platform-windows.md' }[platform()] || 'platform-linux.md';
const report = { os: platform(), arch: arch(), node: process.version, nodeOk: major >= 18, platformNotes: join(SKILL_ROOT, 'references', notes), browser: findBrowser(), appleTools: { ictool: null, actool: null }, renderOk: false, tempWritable: false, network: 'skipped' };

if (platform() === 'darwin') {
  const ictool = '/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool';
  if (existsSync(ictool)) report.appleTools.ictool = ictool;
  const actool = spawnSync('xcrun', ['--find', 'actool'], { encoding: 'utf8' });
  if (actool.status === 0) report.appleTools.actool = actool.stdout.trim();
}
try {
  const { png } = await import('./lib/render.mjs');
  report.renderOk = sniff(png('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>', 16)) === 'png';
} catch (e) { report.renderError = e.message; }
try { write(join(tmpdir(), `logo-studio-${process.pid}.test`), 'ok'); report.tempWritable = true; } catch (e) { report.tempError = e.message; }
if (!a.offline) {
  try {
    const r = await fetch('https://itunes.apple.com/search?term=notes&entity=software&limit=1&country=us', { signal: AbortSignal.timeout(10000) });
    report.network = r.ok ? 'ok' : `http-${r.status}`;
  } catch (e) { report.network = e.cause?.code || e.name; }
}
report.ready = report.nodeOk && report.renderOk && report.tempWritable;
say(JSON.stringify(report, null, 2));
if (!report.ready) process.exitCode = 1;
