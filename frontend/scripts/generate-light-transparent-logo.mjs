/**
 * One-shot: light-theme transparent Leylek symbol → leylek-logo-premium-transparent.png
 * Run: node frontend/scripts/generate-light-transparent-logo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVG_PATH = path.join(__dirname, 'leylek-symbol-light-transparent.svg');
const OUT_PATH = path.join(__dirname, '../assets/images/leylek-logo-premium-transparent.png');
const RENDER_SIZE = 1024;

const svg = fs.readFileSync(SVG_PATH);
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: RENDER_SIZE },
  background: 'transparent',
});
const png = resvg.render().asPng();

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, png);
console.log('wrote', OUT_PATH, `(${png.length} bytes)`);
