// Mac with Xcode only: checks AppIcon.icon with Apple's own tools and renders every iOS appearance.
//   node verify-ios.mjs path/to/AppIcon.icon --out renders
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { args, say } from './lib/core.mjs';

const a = args();
const doc = resolve(a._[0]);
const out = resolve(a.out || 'ios-renders');
const ictool = '/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool';
if (process.platform !== 'darwin' || !existsSync(ictool)) { say(JSON.stringify({ verified: false, reason: 'needs a Mac with Xcode 26. This is an optional extra check.' })); process.exit(0); }
mkdirSync(out, { recursive: true });
const renders = [];
for (const rendition of ['Default', 'Dark', 'TintedLight', 'TintedDark', 'ClearLight', 'ClearDark']) {
  const file = join(out, `${rendition}.png`);
  const r = spawnSync(ictool, [doc, '--export-image', '--output-file', file, '--platform', 'iOS', '--rendition', rendition, '--width', '512', '--height', '512', '--scale', '1', '--tint-color', '0.6', '--tint-strength', '0.8'], { encoding: 'utf8' });
  renders.push({ rendition, ok: r.status === 0 && existsSync(file), file });
}
const compiled = join(out, 'compiled');
mkdirSync(compiled, { recursive: true });
const ac = spawnSync('xcrun', ['actool', doc, '--compile', compiled, '--platform', 'iphoneos', '--minimum-deployment-target', '16.4', '--target-device', 'iphone', '--app-icon', 'AppIcon', '--output-partial-info-plist', join(out, 'partial.plist'), '--output-format', 'human-readable-text'], { encoding: 'utf8' });
const compiledOk = existsSync(join(compiled, 'Assets.car'));
say(JSON.stringify({ verified: compiledOk && renders.every((r) => r.ok), compiledOk, renders, actoolError: compiledOk ? undefined : ac.stdout.slice(-400) }, null, 2));
