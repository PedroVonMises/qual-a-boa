// Generates app icons from the brand mark. Usage:
//   npm i --no-save --prefix <dir> @resvg/resvg-js && RESVG_DIR=<dir> node scripts/make-icons.mjs
// RESVG_DIR is the folder whose node_modules holds @resvg/resvg-js (defaults to cwd).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve(process.env.RESVG_DIR ?? process.cwd(), 'noop.js'));
const { Resvg } = require('@resvg/resvg-js');

const out = resolve(import.meta.dirname, '../assets/images');
mkdirSync(out, { recursive: true });

const bulb = (pink, amber) => `
<g transform="translate(88 88) rotate(-45)">
  <g fill="none" stroke="${pink}" stroke-width="16" stroke-linecap="round">
    <path d="M29.1 54.7A62 62 0 1 0 -29.1 54.7"/><path d="M29.1 54.7L21 72M-29.1 54.7L-21 72"/>
  </g>
  <rect x="-21" y="78" width="42" height="13" rx="6.5" fill="${pink}"/>
  <rect x="-15" y="95" width="30" height="11" rx="5.5" fill="${pink}"/>
  <circle cx="0" cy="-2" r="13" fill="${amber}"/>
</g>`;
const wine =
  '<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6B1D3A"/>' +
  '<stop offset="1" stop-color="#3A1220"/></linearGradient></defs><rect width="200" height="200" fill="url(#w)"/>';
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${body}</svg>`;
// Centre the mark (its visual centre is about 88,88 in the 200 box) and scale it.
const place = (scale, inner) => {
  const t = 100 - 88 * scale;
  return `<g transform="translate(${t} ${t}) scale(${scale})">${inner}</g>`;
};

const lit = bulb('#FF4F81', '#F2A65A');
const files = {
  'icon.png': [1024, svg(wine + place(0.8, lit))],
  // Adaptive icon: content stays inside the central 66% safe zone.
  'android-icon-foreground.png': [1024, svg(place(0.62, lit))],
  'android-icon-background.png': [1024, svg(wine)],
  'android-icon-monochrome.png': [1024, svg(place(0.62, bulb('#FFFFFF', '#FFFFFF')))],
  'splash-icon.png': [1024, svg(place(0.9, lit))],
  'favicon.png': [96, svg(wine + place(0.85, lit))],
};

for (const [name, [size, source]] of Object.entries(files)) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(resolve(out, name), png);
  console.log(`wrote ${name} (${size}px)`);
}
