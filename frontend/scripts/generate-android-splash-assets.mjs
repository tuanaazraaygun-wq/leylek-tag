/**
 * Regenerate Android splashscreen_logo.png from V12 transparent dark master.
 * Run: node frontend/scripts/generate-android-splash-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, '..');
const SRC = path.join(FRONTEND, 'assets/images/leylek-logo-premium-dark.png');
const RES_DIR = path.join(FRONTEND, 'android/app/src/main/res');
const SPLASH_SCALE = 0.775;

const SPLASH_SIZES = {
  'drawable-mdpi': 288,
  'drawable-hdpi': 432,
  'drawable-xhdpi': 576,
  'drawable-xxhdpi': 864,
  'drawable-xxxhdpi': 1152,
};

async function composeSplash(canvasSize) {
  const symbolSize = Math.max(1, Math.round(canvasSize * SPLASH_SCALE));
  const supersample = Math.max(symbolSize * 4, 512);
  const symbolBuf = await sharp(SRC)
    .resize(supersample, supersample, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(symbolSize, symbolSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const left = Math.round((canvasSize - symbolSize) / 2);
  const top = Math.round((canvasSize - symbolSize) / 2);

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: symbolBuf, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Missing source asset: ${SRC}`);
  }

  for (const [folder, size] of Object.entries(SPLASH_SIZES)) {
    const outPath = path.join(RES_DIR, folder, 'splashscreen_logo.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const buf = await composeSplash(size);
    fs.writeFileSync(outPath, buf);
    console.log('wrote', path.relative(FRONTEND, outPath));
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
