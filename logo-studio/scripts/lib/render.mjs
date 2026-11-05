// SVG to pixels through resvg compiled to WebAssembly, so it behaves the same on every computer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { VENDOR, encodePng, flatten } from './core.mjs';

const { initWasm, Resvg } = await import(pathToFileURL(join(VENDOR, 'resvg.mjs')).href);
await initWasm(readFileSync(join(VENDOR, 'index_bg.wasm')));

export function rasterise(svg, width) {
  // System fonts are off on purpose: text must be outlined, or a logo would change between computers.
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render();
  // resvg hands back colours already multiplied by alpha. Left that way, soft edges go dark.
  const pixels = r.pixels;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a === 0 || a === 255) continue;
    pixels[i] = Math.min(255, Math.round((pixels[i] * 255) / a));
    pixels[i + 1] = Math.min(255, Math.round((pixels[i + 1] * 255) / a));
    pixels[i + 2] = Math.min(255, Math.round((pixels[i + 2] * 255) / a));
  }
  return { pixels, width: r.width, height: r.height };
}
export function png(svg, width) {
  const r = rasterise(svg, width);
  return encodePng(r.pixels, r.width, r.height, 4);
}
export function opaquePng(svg, width, background) {
  const r = rasterise(svg, width);
  return encodePng(flatten(r.pixels, background), r.width, r.height, 3);
}
