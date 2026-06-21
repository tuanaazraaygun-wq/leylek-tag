/**
 * V7 Master Experience Studio — in-product mockup SVGs (design-lab only)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BG = '#0D1117';
const MAP = '#1A2332';
const CYAN = '#00D4AA';
const W = '#F5F7FA';
const MUT = '#4B5563';
const AMBER = '#FFB020';

function phoneFrame(id, w, h, rx, content, label) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 40} ${h + 80}" fill="none">
  <rect width="${w + 40}" height="${h + 80}" fill="#111"/>
  <rect x="20" y="20" width="${w}" height="${h}" rx="${rx}" fill="${BG}" stroke="${MUT}" stroke-width="2"/>
  <rect x="${20 + w/2 - 40}" y="28" width="80" height="6" rx="3" fill="#222"/>
  ${content}
  <text x="20" y="${h + 68}" fill="${MUT}" font-family="system-ui,sans-serif" font-size="11">${label}</text>
</svg>`;
}

mkdirSync(ROOT, { recursive: true });

// Shared mini logo mark
const miniLogo = `
  <g transform="translate(0,0)">
    <path d="M -20 8 C -28 20, -30 40, -18 52 C -6 60, 14 62, 32 54" stroke="${CYAN}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path fill="${W}" d="M -8 -18 C -10 -24, -4 -28, 2 -24 L 28 -18 L 42 -14 L 38 -10 L 12 -14 C 4 -12, 0 -6, -2 4 C -4 16, -4 28, -2 38 L 0 48 L -2 58 C -3 62, 0 64, 4 64 C 8 64, 10 60, 9 56 L 7 48"/>
    <circle cx="18" cy="-16" r="2.5" fill="${CYAN}"/>
  </g>`;

// Android home
writeFileSync(join(ROOT, 'android-home.svg'), phoneFrame('android', 360, 780, 28, `
  <rect x="20" y="20" width="360" height="780" rx="28" fill="${BG}"/>
  <text x="36" y="72" fill="${W}" font-size="14" font-weight="600">LeylekTAG</text>
  <g transform="translate(68, 120)">
    <rect width="72" height="72" rx="18" fill="${BG}" stroke="${MUT}"/>
    <g transform="translate(36, 42) scale(0.22)">${miniLogo}</g>
    <text x="36" y="88" text-anchor="middle" fill="${W}" font-size="10">LeylekTAG</text>
  </g>
  <g transform="translate(168, 120)">
    <rect width="72" height="72" rx="18" fill="#222"/>
  </g>
  <g transform="translate(268, 120)">
    <rect width="72" height="72" rx="18" fill="#222"/>
  </g>
  <rect x="36" y="680" width="328" height="4" rx="2" fill="${MUT}" opacity="0.4"/>
`, 'V7 — Android Home Screen · LC-2 icon @ squircle'));

// iPhone home
writeFileSync(join(ROOT, 'iphone-home.svg'), phoneFrame('ios', 360, 780, 44, `
  <rect x="20" y="20" width="360" height="780" rx="44" fill="${BG}"/>
  <g transform="translate(164, 140)">
    <rect width="72" height="72" rx="16" fill="${BG}" stroke="${CYAN}" stroke-width="1" opacity="0.3"/>
    <g transform="translate(36, 40) scale(0.24)">${miniLogo}</g>
  </g>
  <text x="200" y="240" text-anchor="middle" fill="${W}" font-size="11">LeylekTAG</text>
  <rect x="130" y="28" width="140" height="28" rx="14" fill="#000" opacity="0.6"/>
`, 'V7 — iPhone Home Screen · icon in Dynamic Island context'));

// Google Maps journey
const mapContent = `
  <rect x="20" y="48" width="360" height="500" fill="${MAP}"/>
  <path d="M 60 400 Q 120 320 180 280 T 340 180" stroke="${CYAN}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <g transform="translate(100, 360)">
    <path d="M -12 14 C -14 10, -8 6, 0 6 C 8 6, 14 10, 12 14" stroke="${W}" stroke-width="1.5" fill="none"/>
    <circle cx="0" cy="-4" r="4" fill="${W}"/>
  </g>
  <g transform="translate(280, 200)">
    <path d="M -14 12 C -16 8, -10 4, 0 4 C 10 4, 16 8, 14 12" stroke="${W}" stroke-width="1.5" fill="none"/>
    <rect x="-10" y="-2" width="20" height="8" rx="2" fill="${W}"/>
    <path d="M 0 -2 L 4 -8 L 10 -2" fill="${W}"/>
  </g>
  <g transform="translate(320, 160)">
    <line x1="0" y1="-8" x2="0" y2="12" stroke="${W}" stroke-width="2"/>
    <path d="M 0 -8 L 10 -4 L 0 0 Z" fill="${CYAN}"/>
  </g>
  <rect x="36" y="560" width="328" height="120" rx="16" fill="#121820" stroke="${MUT}"/>
  <text x="52" y="592" fill="${W}" font-size="13" font-weight="600">Yolculuk aktif</text>
  <text x="52" y="614" fill="${CYAN}" font-size="11">ETA 8 dk · 4.2 km</text>
  <rect x="52" y="628" width="80" height="28" rx="8" fill="${CYAN}" opacity="0.15"/>
  <text x="92" y="646" text-anchor="middle" fill="${CYAN}" font-size="10">Mesafe</text>
`;

writeFileSync(join(ROOT, 'google-maps-journey.svg'), phoneFrame('map', 360, 700, 28, mapContent, 'V7 — Journey on map · MEX markers + meridian route'));

writeFileSync(join(ROOT, 'journey-screen.svg'), phoneFrame('journey', 360, 700, 28, mapContent + `
  <rect x="36" y="500" width="48" height="48" rx="24" fill="#121820" stroke="${CYAN}" stroke-width="1"/>
  <g transform="translate(60, 524) scale(0.5)">${miniLogo.replace(/CYAN/g, CYAN)}</g>
`, 'V7 — Journey Screen · live map + ETA chip'));

// Offer screen
writeFileSync(join(ROOT, 'offer-screen.svg'), phoneFrame('offer', 360, 700, 28, `
  <rect x="20" y="48" width="360" height="200" fill="${MAP}"/>
  <rect x="36" y="260" width="328" height="180" rx="20" fill="#121820" stroke="${CYAN}" stroke-width="1" opacity="0.5"/>
  <text x="52" y="296" fill="${W}" font-size="16" font-weight="600">Yeni teklif</text>
  <text x="52" y="320" fill="${MUT}" font-size="12">Kadıköy → Beşiktaş · 42 ₺</text>
  <rect x="52" y="340" width="140" height="44" rx="12" fill="${CYAN}"/>
  <text x="122" y="368" text-anchor="middle" fill="${BG}" font-size="13" font-weight="600">Kabul</text>
  <rect x="204" y="340" width="140" height="44" rx="12" stroke="${MUT}" stroke-width="1"/>
  <text x="274" y="368" text-anchor="middle" fill="${W}" font-size="13">Reddet</text>
  <text x="52" y="480" fill="${MUT}" font-size="10">relay.ingress 260ms · offer.classic sonic</text>
`, 'V7 — Offer Screen · card + map preview + triad spec'));

// Splash
writeFileSync(join(ROOT, 'splash-in-phone.svg'), phoneFrame('splash', 360, 700, 28, `
  <rect x="20" y="48" width="360" height="652" fill="${BG}"/>
  <g transform="translate(200, 340) scale(0.55)">${miniLogo}</g>
  <ellipse cx="200" cy="340" rx="100" ry="30" stroke="${CYAN}" stroke-width="0.5" opacity="0.12" fill="none"/>
  <rect x="60" y="640" width="280" height="3" rx="1.5" fill="${MUT}" opacity="0.2"/>
`, 'V7 — Splash · presence.pulse + premium raster tier (concept)'));

// Notification
writeFileSync(join(ROOT, 'notification.svg'), phoneFrame('notif', 360, 200, 28, `
  <rect x="36" y="60" width="328" height="64" rx="16" fill="#121820" stroke="${MUT}"/>
  <circle cx="68" cy="92" r="12" fill="${BG}"/>
  <circle cx="68" cy="92" r="3" fill="${CYAN}"/>
  <path d="M 62 96 Q 68 92 74 96" stroke="${CYAN}" stroke-width="1" fill="none"/>
  <text x="92" y="88" fill="${W}" font-size="12" font-weight="600">LeylekTAG</text>
  <text x="92" y="106" fill="${MUT}" font-size="11">Yeni teklif · Kadıköy</text>
`, 'V7 — Notification · eye+arc @ 24px'));

// App Store
writeFileSync(join(ROOT, 'app-store-listing.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" fill="none">
  <rect width="800" height="400" fill="#F5F7FA"/>
  <text x="40" y="48" fill="#111" font-size="20" font-weight="600">App Store — Transport category grid</text>
  ${[0,1,2,3,4,5,6,7].map(i => `<rect x="${40 + (i%4)*180}" y="${80 + Math.floor(i/4)*140}" width="100" height="100" rx="22" fill="#ddd"/>`).join('')}
  <rect x="220" y="80" width="100" height="100" rx="22" fill="${BG}" stroke="${CYAN}" stroke-width="2"/>
  <g transform="translate(270, 130) scale(0.35)">${miniLogo}</g>
  <text x="270" y="200" text-anchor="middle" fill="#111" font-size="11" font-weight="600">LeylekTAG</text>
  <text x="40" y="360" fill="${MUT}" font-size="12">3-meter test: cyan arc mass distinguishes from gray grid</text>
</svg>`);

writeFileSync(join(ROOT, 'play-store-listing.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" fill="none">
  <rect width="800" height="400" fill="#F5F7FA"/>
  <text x="40" y="48" fill="#111" font-size="20" font-weight="600">Play Store — Similar apps row</text>
  ${[0,1,2,3,4,5].map(i => `<rect x="${40 + i*120}" y="100" width="80" height="80" rx="40" fill="#ddd"/>`).join('')}
  <rect x="280" y="100" width="80" height="80" rx="40" fill="${BG}" stroke="${CYAN}" stroke-width="2"/>
  <g transform="translate(320, 140) scale(0.28)">${miniLogo}</g>
</svg>`);

// Widget
writeFileSync(join(ROOT, 'widget.svg'), phoneFrame('widget', 360, 200, 28, `
  <rect x="36" y="70" width="328" height="100" rx="20" fill="#121820" stroke="${MUT}"/>
  <g transform="translate(72, 120) scale(0.2)">${miniLogo}</g>
  <text x="120" y="115" fill="${W}" font-size="14" font-weight="600">Yolculuk aktif</text>
  <text x="120" y="135" fill="${CYAN}" font-size="12">Sürücü 3 dk uzakta</text>
  <rect x="120" y="148" width="60" height="6" rx="3" fill="${CYAN}" opacity="0.3"/>
`, 'V7 — Widget · glance-readable state'));

// Watch concept
writeFileSync(join(ROOT, 'watch-concept.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">
  <rect x="40" y="20" width="120" height="200" rx="36" fill="#111" stroke="${MUT}"/>
  <rect x="52" y="60" width="96" height="120" rx="24" fill="${BG}"/>
  <g transform="translate(100, 110) scale(0.18)">${miniLogo}</g>
  <text x="100" y="150" text-anchor="middle" fill="${CYAN}" font-size="10">8 dk</text>
</svg>`);

// Car dashboard concept
writeFileSync(join(ROOT, 'car-dashboard-concept.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <rect width="640" height="360" fill="#0a0a0a"/>
  <rect x="40" y="40" width="560" height="280" rx="12" fill="${MAP}"/>
  <path d="M 120 260 Q 200 180 320 140 T 520 80" stroke="${CYAN}" stroke-width="6" fill="none"/>
  <g transform="translate(480, 100) scale(1.2)">
    <path d="M -14 12 C -16 8, -10 4, 0 4 C 10 4, 16 8, 14 12" stroke="${W}" stroke-width="2" fill="none"/>
    <rect x="-10" y="-2" width="20" height="8" rx="2" fill="${W}"/>
  </g>
  <rect x="60" y="260" width="200" height="48" rx="8" fill="#121820"/>
  <text x="80" y="290" fill="${W}" font-size="14">ETA 8 dk</text>
  <text x="40" y="340" fill="${MUT}" font-size="11">V7 — Car dashboard · high-contrast nav @ speed</text>
</svg>`);

console.log('V7 mockups generated');
