/**
 * B5.5 Visual Sketch Lab — SVG generator (design-lab only)
 * Monochrome wireframes · no PNG export
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const W = '#FFFFFF';
const BG = '#000000';
const MUT = '#666666';

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function logoSvg(id, title, opts = {}) {
  const {
    arcW = 20,
    arcPath = 'M 132 188 C 96 248, 88 328, 118 388 C 152 438, 224 448, 296 424 C 360 402, 408 344, 416 272',
    bodyPath = 'M 212 136 C 208 128, 216 122, 226 126 C 232 129, 238 133, 246 134 C 260 136, 276 140, 292 143 L 328 149 L 356 155 C 358 158, 354 161, 338 160 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z',
    legPath = 'M 262 332 C 252 326, 244 332, 240 342 C 236 352, 242 362, 252 364 C 262 366, 268 358, 266 348 C 265 344, 264 338, 262 332 Z',
    wingPath = 'M 262 224 C 278 230, 296 246, 308 268 C 316 282, 318 298, 310 312',
    wingW = 4,
    eyeX = 292,
    eyeY = 166,
    eyeR = 5.5,
    tx = 0,
    ty = 0,
    wireframe = false,
    showGuides = false,
  } = opts;

  const fill = wireframe ? 'none' : W;
  const bodyStroke = wireframe ? W : 'none';
  const bodySW = wireframe ? 2 : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- B5.5 Logo Sketch ${id} — ${title} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="${BG}"/>
  ${showGuides ? `<circle cx="256" cy="256" r="220" stroke="${MUT}" stroke-width="1" stroke-dasharray="6 4" opacity="0.5"/>
  <line x1="256" y1="0" x2="256" y2="512" stroke="${MUT}" stroke-width="0.5" opacity="0.35"/>
  <line x1="0" y1="278" x2="512" y2="278" stroke="${MUT}" stroke-width="0.5" opacity="0.35"/>` : ''}
  <g transform="translate(${tx}, ${ty})">
    <path fill="none" stroke="${W}" stroke-width="${arcW}" stroke-linecap="round" stroke-linejoin="round" d="${arcPath}"/>
    <path fill="${fill}" stroke="${bodyStroke}" stroke-width="${bodySW}" d="${bodyPath}"/>
    <path fill="${fill}" stroke="${bodyStroke}" stroke-width="${bodySW}" d="${legPath}"/>
    <path fill="none" stroke="${W}" stroke-width="${wingW}" stroke-linecap="round" d="${wingPath}"/>
    <circle fill="${W}" cx="${eyeX}" cy="${eyeY}" r="${eyeR}"/>
  </g>
  <text x="16" y="496" fill="${MUT}" font-family="monospace" font-size="11">${id} ${title}</text>
</svg>`;
}

function logoInner(opts) {
  return logoSvg('x', '', opts).match(/<g transform="translate\([^"]*\)">([\s\S]*?)<\/g>/)[1].trim();
}

const neckA = 'M 212 136 C 206 126, 218 118, 230 124 C 238 128, 244 132, 252 134';
const neckB = 'M 212 136 C 210 128, 220 120, 228 126 C 234 130, 240 134, 248 136';
const neckC = 'M 212 136 C 214 130, 218 124, 226 128 C 232 132, 240 136, 248 138';
const bodyRest = ' C 260 136, 276 140, 292 143 L 328 149 L 356 155 C 358 158, 354 161, 338 160 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z';

const beakLong = ' L 364 153 C 366 156, 360 160, 344 159 L 306 156';
const beakStd = ' L 356 155 C 358 158, 354 161, 338 160 L 306 156';

const arcWide = 'M 120 180 C 82 248, 78 332, 112 396 C 148 448, 228 458, 304 430 C 368 406, 412 340, 420 264';
const arcTight = 'M 140 192 C 108 252, 96 324, 124 382 C 158 432, 222 442, 290 418 C 352 396, 400 348, 408 278';
const arcFlat = 'M 128 200 C 94 260, 90 330, 120 390 C 156 440, 226 450, 298 426 C 358 404, 404 348, 412 276';

const logoSketches = [
  { id: 'LS-01', title: 'Baseline faithful', opts: {} },
  { id: 'LS-02', title: 'Neck S-curve A', opts: { bodyPath: neckA + bodyRest.replace(/^ C 260/, ' C 260') } },
  { id: 'LS-03', title: 'Neck S-curve B', opts: { bodyPath: neckB + bodyRest.substring(bodyRest.indexOf(' C 260')) } },
  { id: 'LS-04', title: 'Neck S-curve C', opts: { bodyPath: neckC + bodyRest.substring(bodyRest.indexOf(' C 260')) } },
  { id: 'LS-05', title: 'Neck slender mid', opts: { bodyPath: neckB + ' C 258 136, 272 142, 288 145 L 324 151 L 356 155 C 358 158, 354 161, 338 160 L 304 156 C 292 155, 284 160, 278 170 C 272 182, 266 198, 262 216 C 258 236, 256 256, 256 276 C 256 296, 258 314, 262 330 L 266 350 L 264 392 C 263 400, 267 406, 274 406 C 281 406, 285 400, 284 392 L 282 348 C 278 332, 274 316, 272 300 C 268 280, 266 260, 266 240 C 266 220, 270 202, 276 186 C 270 180, 262 174, 254 168 C 246 160, 238 152, 230 146 C 224 142, 216 138, 212 136 Z' } },
  { id: 'LS-06', title: 'Head crest soft', opts: { bodyPath: 'M 210 134 C 204 124, 214 118, 224 122 C 230 125, 236 128, 242 130 C 248 132, 254 134, 260 136, 276 140, 292 143 L 328 149 L 356 155 C 358 158, 354 161, 338 160 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 210 134 Z' } },
  { id: 'LS-07', title: 'Beak extend +8', opts: { bodyPath: neckB + ' C 260 136, 276 140, 292 143 L 330 149 L 364 153 C 366 156, 360 160, 344 159 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z' } },
  { id: 'LS-08', title: 'Beak level upper', opts: { bodyPath: neckB + ' C 260 136, 276 140, 292 143 L 328 149 L 362 152 C 364 154, 360 157, 346 156 L 308 154 C 296 153, 288 158, 282 168 C 276 180, 270 196, 266 214 C 262 234, 260 254, 260 274 C 260 294, 262 312, 266 328 L 270 348 L 268 392 C 267 400, 271 406, 278 406 C 285 406, 289 400, 288 392 L 286 348 C 282 332, 278 316, 276 300 C 272 280, 270 260, 270 240 C 270 220, 274 202, 280 186 C 274 180, 266 174, 258 168 C 250 160, 242 152, 234 146 C 228 142, 220 138, 212 136 Z' } },
  { id: 'LS-09', title: 'Beak tip micro-drop', opts: { bodyPath: neckB + ' C 260 136, 276 140, 292 143 L 328 149 L 358 158 C 360 161, 354 163, 340 160 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z' } },
  { id: 'LS-10', title: 'Eye anchor lock', opts: { eyeX: 292, eyeY: 166, eyeR: 5.5, showGuides: true } },
  { id: 'LS-11', title: 'Wing separation +1', opts: { wingW: 5, wingPath: 'M 260 220 C 276 226, 298 244, 312 268 C 320 284, 322 300, 312 316' } },
  { id: 'LS-12', title: 'Wing quiet curve', opts: { wingW: 3, wingPath: 'M 264 228 C 278 232, 292 248, 302 268 C 308 280, 306 294, 298 306' } },
  { id: 'LS-13', title: 'Wing energy wide', opts: { wingW: 4, wingPath: 'M 258 218 C 280 224, 304 248, 318 276 C 324 292, 322 308, 308 322' } },
  { id: 'LS-14', title: 'Arc mass +2', opts: { arcW: 22, arcPath: arcWide } },
  { id: 'LS-15', title: 'Arc mass baseline', opts: { arcW: 20 } },
  { id: 'LS-16', title: 'Arc gap wide', opts: { arcW: 20, arcPath: arcWide } },
  { id: 'LS-17', title: 'Arc tight cradle', opts: { arcW: 18, arcPath: arcTight } },
  { id: 'LS-18', title: 'Arc flat base', opts: { arcW: 20, arcPath: arcFlat } },
  { id: 'LS-19', title: 'Leg signature bold', opts: { legPath: 'M 260 330 C 248 322, 238 330, 234 342 C 230 354, 238 366, 250 368 C 262 370, 270 360, 268 348 C 266 342, 264 336, 260 330 Z' } },
  { id: 'LS-20', title: 'Negative space beak', opts: { bodyPath: neckB + ' C 260 136, 276 140, 292 143 L 328 149 L 356 155 C 358 158, 354 161, 338 160 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z', wingPath: 'M 268 210 C 272 200, 278 192, 286 188' } },
  { id: 'LS-21', title: 'Optical center nudge', opts: { tx: 4, ty: 6 } },
  { id: 'LS-22', title: 'Optical center low', opts: { tx: 0, ty: 8 } },
  { id: 'LS-23', title: 'Optical center high', opts: { tx: 0, ty: -4 } },
  { id: 'LS-24', title: 'Balance left micro', opts: { tx: -3, ty: 4 } },
  { id: 'LS-25', title: 'Wireframe construction', opts: { wireframe: true, showGuides: true } },
  { id: 'LS-26', title: 'Small-tier eye +0.5', opts: { eyeR: 6, arcW: 22 } },
  { id: 'LS-27', title: 'Combined neck+beak', opts: { bodyPath: neckC + ' C 258 136, 274 140, 290 143 L 332 149 L 364 153 C 366 156, 360 160, 344 159 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z' } },
  { id: 'LS-28', title: 'Combined arc+wing', opts: { arcW: 22, arcPath: arcWide, wingW: 5, wingPath: 'M 260 220 C 278 226, 300 246, 314 270 C 322 286, 320 302, 308 316' } },
  { id: 'LS-29', title: 'Timeless meridian', opts: { tx: 4, ty: 6, arcW: 20, bodyPath: neckB + ' C 260 136, 276 140, 292 143 L 330 149 L 364 153 C 366 156, 360 160, 344 159 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z' } },
  { id: 'LS-30', title: 'Horizon small-ready', opts: { eyeR: 6, arcW: 22, legPath: 'M 262 332 C 254 328, 248 334, 246 342 C 244 350, 250 356, 258 356 C 264 356, 268 350, 266 344 Z', tx: 2, ty: 4 } },
];

function appIconSvg(id, title, scale, ty, showMasks) {
  const s = scale;
  const logo = logoInner({ tx: 4, ty: 6, arcW: 20 });
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- B5.5 App Icon ${id} — ${title} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <rect width="1024" height="1024" fill="${BG}"/>
  ${showMasks ? `
  <rect x="112" y="112" width="800" height="800" rx="180" stroke="${MUT}" stroke-width="2" stroke-dasharray="8 6" fill="none" opacity="0.45"/>
  <circle cx="512" cy="512" r="400" stroke="${MUT}" stroke-width="2" stroke-dasharray="8 6" fill="none" opacity="0.35"/>
  <rect x="192" y="192" width="640" height="640" rx="128" stroke="${MUT}" stroke-width="1.5" stroke-dasharray="6 4" fill="none" opacity="0.3"/>` : ''}
  <g transform="translate(512, ${512 + ty}) scale(${s}) translate(-256, -278)">
    ${logo.trim()}
  </g>
  <text x="24" y="1000" fill="${MUT}" font-family="monospace" font-size="20">${id} ${title}</text>
</svg>`;
}

const appIcons = [
  { id: 'AI-01', title: 'Home 72% safe', scale: 1.45, ty: 0, masks: true },
  { id: 'AI-02', title: 'Home 68% compact', scale: 1.35, ty: 8, masks: true },
  { id: 'AI-03', title: 'iOS squircle fit', scale: 1.42, ty: 12, masks: true },
  { id: 'AI-04', title: 'Android adaptive', scale: 1.38, ty: 6, masks: true },
  { id: 'AI-05', title: 'Notification 24px sim', scale: 0.28, ty: 0, masks: false },
  { id: 'AI-06', title: 'Launcher bold arc', scale: 1.48, ty: 4, masks: true },
  { id: 'AI-07', title: 'Optical nudge icon', scale: 1.44, ty: 16, masks: true },
  { id: 'AI-08', title: 'Micro eye boost', scale: 1.4, ty: 8, masks: true },
  { id: 'AI-09', title: 'Arc-forward weight', scale: 1.46, ty: -4, masks: true },
  { id: 'AI-10', title: 'Balanced timeless', scale: 1.43, ty: 10, masks: true },
];

function markerSvg(id, title, drawFn) {
  const body = drawFn();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- B5.5 Marker ${id} — ${title} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <rect width="48" height="48" fill="${BG}"/>
  ${body}
  <text x="2" y="47" fill="${MUT}" font-family="monospace" font-size="4">${id}</text>
</svg>`;
}

const arcFoot = `<path d="M 8 38 C 6 34, 10 30, 16 28 C 24 26, 32 26, 40 28 C 44 30, 46 34, 42 38" stroke="${W}" stroke-width="2" fill="none" stroke-linecap="round"/>`;

const markers = [
  { id: 'MK-01', title: 'Passenger neutral A', fn: () => `${arcFoot}<circle cx="24" cy="14" r="4" fill="${W}"/><path d="M 24 18 L 24 32 M 18 26 L 30 26 M 20 36 L 24 32 L 28 36" stroke="${W}" stroke-width="2" stroke-linecap="round"/>` },
  { id: 'MK-02', title: 'Passenger dot active', fn: () => `${arcFoot}<circle cx="24" cy="14" r="4" fill="${W}"/><circle cx="24" cy="22" r="1.5" fill="${W}"/><path d="M 18 26 L 30 26 M 20 36 L 24 30 L 28 36" stroke="${W}" stroke-width="2" stroke-linecap="round"/>` },
  { id: 'MK-03', title: 'Driver car wedge', fn: () => `${arcFoot}<rect x="12" y="18" width="24" height="14" rx="3" fill="${W}"/><path d="M 24 18 L 28 14 L 36 18" fill="${W}"/>` },
  { id: 'MK-04', title: 'Driver car wide', fn: () => `${arcFoot}<path d="M 10 32 L 14 20 L 34 20 L 38 32 Z" fill="${W}"/><path d="M 24 20 L 27 16 L 32 20" fill="${BG}"/>` },
  { id: 'MK-05', title: 'Motorcycle lean', fn: () => `${arcFoot}<ellipse cx="24" cy="26" rx="6" ry="10" fill="${W}"/><circle cx="18" cy="32" r="3" fill="${W}"/><circle cx="30" cy="32" r="3" fill="${W}"/>` },
  { id: 'MK-06', title: 'Motorcycle narrow', fn: () => `${arcFoot}<path d="M 22 16 L 26 32 M 18 32 A 4 4 0 0 0 26 32 M 30 32 A 4 4 0 0 0 22 32" stroke="${W}" stroke-width="2" fill="none"/>` },
  { id: 'MK-07', title: 'Pickup arc pin', fn: () => `${arcFoot}<path d="M 24 12 L 20 22 L 24 20 L 28 22 Z" fill="${W}"/><line x1="24" y1="20" x2="24" y2="28" stroke="${W}" stroke-width="2"/>` },
  { id: 'MK-08', title: 'Pickup lift dot', fn: () => `<circle cx="24" cy="12" r="3" fill="${W}"/>${arcFoot}<line x1="24" y1="15" x2="24" y2="26" stroke="${W}" stroke-width="2"/>` },
  { id: 'MK-09', title: 'Destination pennant', fn: () => `${arcFoot}<line x1="24" y1="14" x2="24" y2="36" stroke="${W}" stroke-width="2"/><path d="M 24 14 L 34 18 L 24 22 Z" fill="${W}"/>` },
  { id: 'MK-10', title: 'Destination flag minimal', fn: () => `${arcFoot}<path d="M 22 16 L 22 34 M 22 16 L 32 20 L 22 24" stroke="${W}" stroke-width="2" fill="none"/>` },
  { id: 'MK-11', title: 'Journey arc path', fn: () => `${arcFoot}<path d="M 10 24 Q 24 16 38 24" stroke="${W}" stroke-width="2" fill="none"/><polygon points="36,22 40,24 36,26" fill="${W}"/>` },
  { id: 'MK-12', title: 'Journey dual dot', fn: () => `${arcFoot}<circle cx="14" cy="24" r="2" fill="${W}"/><circle cx="34" cy="24" r="2" fill="${W}"/><path d="M 16 24 Q 24 18 32 24" stroke="${W}" stroke-width="1.5" fill="none"/>` },
  { id: 'MK-13', title: 'Quick match lock', fn: () => `${arcFoot}<circle cx="18" cy="22" r="3" fill="${W}"/><circle cx="30" cy="22" r="3" fill="${W}"/><circle cx="24" cy="28" r="2" fill="${W}"/>` },
  { id: 'MK-14', title: 'Quick match bridge', fn: () => `${arcFoot}<path d="M 16 22 L 32 22 M 24 22 L 24 28" stroke="${W}" stroke-width="2"/><circle cx="24" cy="30" r="2" fill="${W}"/>` },
  { id: 'MK-15', title: 'Trusted double ring', fn: () => `<circle cx="24" cy="24" r="14" stroke="${W}" stroke-width="1.5" fill="none" opacity="0.5"/>${arcFoot}<rect x="14" y="20" width="20" height="10" rx="2" fill="${W}"/>` },
  { id: 'MK-16', title: 'Trusted car halo', fn: () => `<ellipse cx="24" cy="24" rx="16" ry="12" stroke="${W}" stroke-width="1" fill="none" opacity="0.4"/>${arcFoot}<path d="M 14 30 L 18 22 L 30 22 L 34 30 Z" fill="${W}"/>` },
  { id: 'MK-17', title: 'Offline desaturate', fn: () => `<g opacity="0.45">${arcFoot}<rect x="14" y="20" width="20" height="10" rx="2" fill="${W}"/></g><path d="M 12 12 L 36 36" stroke="${MUT}" stroke-width="1" stroke-dasharray="2 2"/>` },
  { id: 'MK-18', title: 'Offline dashed ring', fn: () => `<circle cx="24" cy="24" r="12" stroke="${MUT}" stroke-width="1" stroke-dasharray="3 2" fill="none"/>${arcFoot}<rect x="14" y="20" width="20" height="10" rx="2" fill="${W}" opacity="0.5"/>` },
  { id: 'MK-19', title: 'Searching pulse', fn: () => `<circle cx="24" cy="22" r="6" stroke="${W}" stroke-width="1" fill="none" opacity="0.35"/><circle cx="24" cy="22" r="10" stroke="${W}" stroke-width="1" fill="none" opacity="0.25"/>${arcFoot}<circle cx="24" cy="22" r="2" fill="${W}"/>` },
  { id: 'MK-20', title: 'Cluster count arc', fn: () => `${arcFoot}<rect x="16" y="18" width="16" height="12" rx="2" fill="${W}"/><text x="24" y="27" text-anchor="middle" fill="${BG}" font-family="monospace" font-size="8" font-weight="bold">3</text>` },
];

function splashSvg(id, title, logoY, logoScale, extra) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- B5.5 Splash ${id} — ${title} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" fill="none">
  <rect width="390" height="844" fill="${BG}"/>
  ${extra || ''}
  <g transform="translate(195, ${logoY}) scale(${logoScale}) translate(-256, -278)">
    ${logoInner({ tx: 4, ty: 6 })}
  </g>
  <text x="16" y="828" fill="${MUT}" font-family="monospace" font-size="12">${id} ${title}</text>
</svg>`;
}

const splashes = [
  { id: 'SP-01', title: 'Center classic 38%', y: 380, s: 0.29, extra: '' },
  { id: 'SP-02', title: 'Center low breathe', y: 420, s: 0.32, extra: `<ellipse cx="195" cy="420" rx="120" ry="40" stroke="${MUT}" stroke-width="1" opacity="0.2" fill="none"/>` },
  { id: 'SP-03', title: 'Upper third hero', y: 280, s: 0.26, extra: '' },
  { id: 'SP-04', title: 'Golden ratio 0.382', y: 322, s: 0.28, extra: `<line x1="0" y1="322" x2="390" y2="322" stroke="${MUT}" stroke-width="0.5" opacity="0.3"/>` },
  { id: 'SP-05', title: 'Arc pulse hint', y: 400, s: 0.3, extra: `<circle cx="195" cy="400" r="100" stroke="${MUT}" stroke-width="1" opacity="0.15" fill="none"/>` },
  { id: 'SP-06', title: 'Compact cold start', y: 360, s: 0.24, extra: '' },
  { id: 'SP-07', title: 'Wide presence', y: 390, s: 0.34, extra: '' },
  { id: 'SP-08', title: 'Optical nudge up', y: 350, s: 0.29, extra: '' },
  { id: 'SP-09', title: 'Motion arc trail', y: 400, s: 0.3, extra: `<path d="M 80 480 Q 195 520 310 480" stroke="${MUT}" stroke-width="1" stroke-dasharray="4 4" opacity="0.25" fill="none"/>` },
  { id: 'SP-10', title: 'Premium calm hold', y: 400, s: 0.28, extra: `<rect x="24" y="700" width="342" height="4" rx="2" fill="${MUT}" opacity="0.15"/>` },
];

function zoomSheetSvg() {
  const sizes = [16, 18, 20];
  const finals = ['LS-01', 'LS-21', 'LS-30'];
  let content = '';
  finals.forEach((ls, col) => {
    sizes.forEach((sz, row) => {
      const x = 40 + col * 200;
      const y = 60 + row * 180;
      const sc = sz / 512;
      content += `<g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="${sz + 20}" height="${sz + 40}" fill="#111" stroke="${MUT}"/>
        <g transform="translate(10, 10) scale(${sc})">
          ${logoInner({ tx: 4, ty: 6 })}
        </g>
        <text x="10" y="${sz + 32}" fill="${MUT}" font-size="10">${ls} @${sz}px</text>
      </g>`;
    });
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 620" fill="none">
  <rect width="680" height="620" fill="${BG}"/>
  <text x="20" y="30" fill="${W}" font-family="sans-serif" font-size="16">B5.5 Logo Small-Size Comparison Sheet</text>
  ${content}
</svg>`;
}

function logoComparisonSheet() {
  const picks = [
    { ls: 'LS-01', label: 'Current baseline', opts: {} },
    { ls: 'LS-21', label: 'Candidate 1', opts: { tx: 4, ty: 6 } },
    { ls: 'LS-29', label: 'Candidate 2', opts: { tx: 4, ty: 6, arcW: 20, bodyPath: neckB + ' C 260 136, 276 140, 292 143 L 330 149 L 364 153 C 366 156, 360 160, 344 159 L 306 156 C 294 155, 286 159, 280 168 C 274 180, 268 196, 264 214 C 260 234, 258 254, 258 274 C 258 294, 260 312, 264 328 L 268 348 L 266 392 C 265 400, 269 406, 276 406 C 283 406, 287 400, 286 392 L 284 348 C 280 332, 276 316, 274 300 C 270 280, 268 260, 268 240 C 268 220, 272 202, 278 186 C 272 180, 264 174, 256 168 C 248 160, 240 152, 232 146 C 226 142, 218 138, 212 136 Z' } },
    { ls: 'LS-30', label: 'Candidate 3', opts: { eyeR: 6, arcW: 22, tx: 2, ty: 4, legPath: 'M 262 332 C 254 328, 248 334, 246 342 C 244 350, 250 356, 258 356 C 264 356, 268 350, 266 344 Z' } },
  ];
  let cols = '';
  picks.forEach(({ ls, label, opts }, i) => {
    const x = 20 + i * 130;
    cols += `<g transform="translate(${x}, 50)">
      <rect width="120" height="120" fill="#111" stroke="${MUT}"/>
      <g transform="translate(10, 10) scale(0.195)">
        ${logoInner(opts)}
      </g>
      <text x="60" y="140" text-anchor="middle" fill="${W}" font-size="9">${label}</text>
      <text x="60" y="152" text-anchor="middle" fill="${MUT}" font-size="8">${ls}</text>
    </g>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 180" fill="none">
  <rect width="560" height="180" fill="${BG}"/>
  <text x="20" y="24" fill="${W}" font-size="14">Human Review — Logo Comparison (open SVG side by side)</text>
  ${cols}
</svg>`;
}

function markerComparisonSheet() {
  const picks = ['MK-03', 'MK-05', 'MK-09', 'MK-19'];
  let out = '';
  [16, 18, 20].forEach((zoom, zi) => {
    const scale = zoom / 48;
    picks.forEach((mk, mi) => {
      const m = markers.find(x => x.id === mk);
      const x = 20 + mi * 120;
      const y = 50 + zi * 100;
      out += `<g transform="translate(${x}, ${y})">
        <text x="0" y="-4" fill="${MUT}" font-size="8">z${16 + zi * 2}</text>
        <g transform="scale(${scale})">${m.fn()}</g>
      </g>`;
    });
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 360" fill="none">
  <rect width="520" height="360" fill="${BG}"/>
  <text x="16" y="24" fill="${W}" font-size="13">Marker Zoom 16 / 18 / 20 Comparison</text>
  ${out}
</svg>`;
}

// Generate all files
ensureDir(join(ROOT, 'logo'));
logoSketches.forEach(({ id, title, opts }) => {
  writeFileSync(join(ROOT, 'logo', `${id.toLowerCase()}.svg`), logoSvg(id, title, opts));
});

ensureDir(join(ROOT, 'app-icon'));
appIcons.forEach(({ id, title, scale, ty, masks }) => {
  writeFileSync(join(ROOT, 'app-icon', `${id.toLowerCase()}.svg`), appIconSvg(id, title, scale, ty, masks));
});

ensureDir(join(ROOT, 'markers'));
markers.forEach(({ id, title, fn }) => {
  writeFileSync(join(ROOT, 'markers', `${id.toLowerCase()}.svg`), markerSvg(id, title, fn));
});

ensureDir(join(ROOT, 'splash'));
splashes.forEach(({ id, title, y, s, extra }) => {
  writeFileSync(join(ROOT, 'splash', `${id.toLowerCase()}.svg`), splashSvg(id, title, y, s, extra));
});

ensureDir(join(ROOT, 'sheets'));
writeFileSync(join(ROOT, 'sheets', 'logo-small-size-sheet.svg'), zoomSheetSvg());
writeFileSync(join(ROOT, 'sheets', 'logo-human-review-sheet.svg'), logoComparisonSheet());
writeFileSync(join(ROOT, 'sheets', 'marker-zoom-sheet.svg'), markerComparisonSheet());

// App icon size ladder sheet
const iconSizes = [24, 32, 48, 64];
let iconLadder = '';
['AI-03', 'AI-07', 'AI-10'].forEach((ai, ci) => {
  iconSizes.forEach((sz, ri) => {
    const sc = (sz / 1024) * 3.2;
    const x = 30 + ci * 160;
    const y = 50 + ri * 90;
    iconLadder += `<g transform="translate(${x}, ${y})">
      <rect width="${sz + 16}" height="${sz + 24}" fill="#111" stroke="${MUT}"/>
      <g transform="translate(8, 8) scale(${sc})">
        ${logoInner({ tx: 4, ty: 6 })}
      </g>
      <text x="4" y="${sz + 20}" fill="${MUT}" font-size="8">${ai} ${sz}px</text>
    </g>`;
  });
});
writeFileSync(join(ROOT, 'sheets', 'app-icon-size-ladder.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 420" fill="none">
  <rect width="520" height="420" fill="${BG}"/>
  <text x="16" y="28" fill="${W}" font-size="14">App Icon Readability Ladder</text>
  ${iconLadder}
</svg>`);

// Marker family full board (11 types @ 48px)
const familyPicks = [
  ['Passenger', 'MK-01'], ['Driver', 'MK-03'], ['Motor', 'MK-05'], ['Pickup', 'MK-07'],
  ['Destination', 'MK-09'], ['Journey', 'MK-11'], ['Quick Match', 'MK-13'],
  ['Trusted', 'MK-15'], ['Offline', 'MK-17'], ['Searching', 'MK-19'], ['Cluster', 'MK-20'],
];
let familyGrid = '';
familyPicks.forEach(([label, mkId], i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 20 + col * 120;
  const y = 50 + row * 110;
  const m = markers.find(x => x.id === mkId);
  familyGrid += `<g transform="translate(${x}, ${y})">
    <rect width="56" height="56" fill="#111" stroke="${MUT}"/>
    <g transform="translate(4, 4)">${m.fn()}</g>
    <text x="28" y="68" text-anchor="middle" fill="${W}" font-size="8">${label}</text>
    <text x="28" y="78" text-anchor="middle" fill="${MUT}" font-size="7">${mkId}</text>
  </g>`;
});
writeFileSync(join(ROOT, 'sheets', 'marker-family-board.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 380" fill="none">
  <rect width="500" height="380" fill="${BG}"/>
  <text x="16" y="28" fill="${W}" font-size="14">B5.5 Marker Family Board (48px)</text>
  ${familyGrid}
</svg>`);

// Splash comparison strip
let splashStrip = '';
splashes.forEach(({ id, title, y, s, extra }, i) => {
  const x = 10 + i * 78;
  splashStrip += `<g transform="translate(${x}, 40)">
    <rect width="72" height="156" fill="#111" stroke="${MUT}"/>
    <g transform="translate(36, ${60 + (y - 380) * 0.08}) scale(${s * 0.35}) translate(-256, -278)">
      ${logoInner({ tx: 4, ty: 6 })}
    </g>
    <text x="36" y="148" text-anchor="middle" fill="${MUT}" font-size="6">${id}</text>
  </g>`;
});
writeFileSync(join(ROOT, 'sheets', 'splash-comparison-strip.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 210" fill="none">
  <rect width="800" height="210" fill="${BG}"/>
  <text x="16" y="24" fill="${W}" font-size="14">Splash Composition Strip (10 concepts)</text>
  ${splashStrip}
</svg>`);

console.log('B5.5 generated:', logoSketches.length, 'logos,', appIcons.length, 'icons,', markers.length, 'markers,', splashes.length, 'splashes');
