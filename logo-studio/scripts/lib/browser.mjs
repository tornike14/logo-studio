// Finds a Chromium browser and takes screenshots. A browser is optional: nothing else needs it.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

export function findBrowser() {
  const e = process.env;
  const win = [e['ProgramFiles(x86)'], e.ProgramFiles, e.LOCALAPPDATA].filter(Boolean).flatMap((d) => [
    join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(d, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  ]);
  const mac = ['Google Chrome.app/Contents/MacOS/Google Chrome', 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Brave Browser.app/Contents/MacOS/Brave Browser', 'Chromium.app/Contents/MacOS/Chromium'].map((p) => join('/Applications', p));
  const linux = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium'];
  const list = { win32: win, darwin: mac, linux }[process.platform] || linux;
  return e.LOGO_STUDIO_BROWSER || list.find((p) => existsSync(p)) || null;
}

function stop(child) {
  // Edge can stay alive after saving, and it spawns helpers, so the whole tree has to go.
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* already gone */ } } }
}

export async function screenshot(htmlPath, out, { width = 1280, height = 2600, timeoutMs = 40000, browser = findBrowser() } = {}) {
  if (!browser) return { ok: false, reason: 'no-browser' };
  mkdirSync(dirname(out), { recursive: true });
  rmSync(out, { force: true });
  const profile = mkdtempSync(join(tmpdir(), 'logo-studio-'));
  const child = spawn(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1', `--user-data-dir=${profile}`, `--window-size=${width},${height}`, `--screenshot=${out}`, pathToFileURL(htmlPath).href], { stdio: 'ignore', detached: process.platform !== 'win32', windowsHide: true });
  let failed = null;
  child.on('error', (e) => { failed = e.message; });
  const started = Date.now();
  let last = -1, stable = 0;
  while (Date.now() - started < timeoutMs && !failed) {
    await new Promise((r) => setTimeout(r, 250));
    const size = existsSync(out) ? statSync(out).size : -1;
    stable = size > 0 && size === last ? stable + 1 : 0;
    last = size;
    if (stable >= 3) break;
  }
  stop(child);
  await new Promise((r) => setTimeout(r, 200));
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* a locked temp folder is harmless */ }
  const ok = stable >= 3;
  return { ok, reason: ok ? undefined : failed || 'timeout', ms: Date.now() - started };
}
