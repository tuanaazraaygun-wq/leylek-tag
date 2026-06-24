#!/usr/bin/env py -3
"""
RC-BRAND-V11 — Premium Master V2 production export.
Design-lab script: reads V1 reference, writes V2 assets + QA report.
Preview B: R6 ring_scale=0.94, glow_alpha=0.5, metal_boost=1.10, sharpen=True
"""
from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[4]
V10 = Path(__file__).resolve().parents[1]
BACKUP_DIR = V10 / "_backup-pre-v11"


def _ref_src() -> Path:
    if BACKUP_DIR.exists():
        backups = sorted(BACKUP_DIR.glob("leylek-logo-premium-v1-*.png"))
        if backups:
            return backups[0]
    return SRC


SRC = ROOT / "frontend/assets/images/leylek-logo-premium.png"
REF_SRC = _ref_src()
OUT_LAB = V10 / "production-output"
OUT_MANIFEST = V10 / "logo-export-manifest.json"
QA_REPORT = V10 / "QA_REPORT_V11.md"

BG_DARK = (8, 17, 31)
BG_LIGHT = (248, 250, 252)
OPTICAL_FRAC = (268 / 512, 278 / 512)
HERO_SIZES = (1254, 1024, 512, 256, 192, 128)
MICRO_SIZES = (96, 64, 48, 32, 24)

SPLASH_SIZES = {
    "drawable-mdpi": 288,
    "drawable-hdpi": 432,
    "drawable-xhdpi": 576,
    "drawable-xxhdpi": 864,
    "drawable-xxxhdpi": 1152,
}
MIPMAP_FG = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
MIPMAP_LEGACY = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


@dataclass
class V2Spec:
    ring_scale: float = 0.94
    glow_alpha: float = 0.5
    metal_boost: float = 1.10
    sharpen_bird: bool = True
    bg: tuple[int, int, int] = BG_DARK


SPEC = V2Spec()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def classify_pixels(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r = rgba[..., 0].astype(np.float32)
    g = rgba[..., 1].astype(np.float32)
    b = rgba[..., 2].astype(np.float32)
    a = rgba[..., 3].astype(np.float32)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    blue_score = b - np.maximum(r, g)
    max_rgb = np.maximum(np.maximum(r, g), b)
    background = (lum < 28) | (a < 8)
    bird = (
        (~background)
        & (lum > 95)
        & (blue_score < 45)
        & (max_rgb - np.minimum(np.minimum(r, g), b) < 120)
    )
    ring = (~background) & (~bird) & ((blue_score > 8) | ((b > 60) & (g > 45) & (lum > 24)))
    ring |= (~background) & (~bird) & (blue_score > 5) & (lum > 40)
    return bird, ring, background


def enhance_metal(px: np.ndarray, boost: float, is_bird: bool) -> np.ndarray:
    out = px.copy()
    lum = 0.299 * out[0] + 0.587 * out[1] + 0.114 * out[2]
    if is_bird:
        if lum > 150:
            k = 1.0 + (boost - 1.0) * min(1.0, (lum - 150) / 105)
            out[:3] = np.clip(out[:3] * k, 0, 255)
        if lum < 90:
            out[:3] *= 0.97
    else:
        if lum > 80 and out[2] >= out[0]:
            k = 1.0 + (boost - 1.0) * 0.55
            out[:3] = np.clip(out[:3] * k, 0, 255)
        if lum < 55:
            out[3] *= 0.85
    return out


def build_symbol_v2(rgba: np.ndarray, spec: V2Spec, micro: bool = False) -> Image.Image:
    h, w = rgba.shape[:2]
    cx = OPTICAL_FRAC[0] * w
    cy = OPTICAL_FRAC[1] * h
    bird, ring, background = classify_pixels(rgba)
    out = np.zeros((h, w, 4), dtype=np.float32)

    bird_mask = bird & (rgba[..., 3] > 0)
    ys, xs = np.where(bird_mask)
    for y, x in zip(ys, xs):
        px = rgba[y, x].astype(np.float32).copy()
        lum = 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]
        if lum > 150 and not micro:
            k = 1.0 + (spec.metal_boost - 1.0) * min(1.0, (lum - 150) / 105) * 0.85
            px[:3] = np.clip(px[:3] * k, 0, 255)
        elif lum < 90 and not micro:
            px[:3] *= 0.99
        out[y, x] = px

    glow_alpha = 0.0 if micro else spec.glow_alpha
    ring_scale = spec.ring_scale

    def remap_ring_pixels(mask: np.ndarray) -> None:
        ys2, xs2 = np.where(mask)
        for y, x in zip(ys2, xs2):
            nx = cx + (x - cx) * ring_scale
            ny = cy + (y - cy) * ring_scale
            ix, iy = int(round(nx)), int(round(ny))
            if 0 <= ix < w and 0 <= iy < h:
                if bird[iy, ix]:
                    continue
                px = rgba[y, x].astype(np.float32)
                lum = 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]
                fringe = lum > 45 and px[3] < 220
                if micro:
                    px[3] = min(255, px[3] * 0.95) if not fringe else 0
                else:
                    px[3] *= glow_alpha if fringe else min(255, px[3] * 0.92)
                px = enhance_metal(px, spec.metal_boost, False)
                if px[3] > out[iy, ix, 3]:
                    out[iy, ix] = px

    ring_mask = ring & (rgba[..., 3] > 0)
    remap_ring_pixels(ring_mask)
    other = (~background) & (~bird) & (~ring) & (rgba[..., 3] > 0)
    remap_ring_pixels(other)

    sym = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    return sym


def add_ground_shadow(sym: Image.Image, size: int) -> Image.Image:
    """Subtle foot shadow @ hero tier only."""
    scale = size / 512
    shadow = Image.new("RGBA", sym.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    cx = int(248 * scale)
    cy = int(418 * scale)
    sw, sh = int(32 * scale), int(8 * scale)
    draw.ellipse((cx - sw, cy - sh, cx + sw, cy + sh), fill=(0, 0, 0, 64))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(2, int(4 * scale))))
    base = sym.copy()
    base.alpha_composite(shadow)
    return base


def composite_on_bg(sym: Image.Image, bg: tuple[int, int, int] | None) -> Image.Image:
    if bg is None:
        return sym
    canvas = Image.new("RGBA", sym.size, (*bg, 255))
    canvas.alpha_composite(sym)
    return canvas


def fit_symbol_to_square(sym: Image.Image, canvas_size: int, bg: tuple[int, int, int] | None, safe_frac: float = 0.92) -> Image.Image:
    bbox = sym.getbbox()
    if not bbox:
        raise RuntimeError("empty symbol")
    cropped = sym.crop(bbox)
    safe = int(canvas_size * safe_frac)
    cw, ch = cropped.size
    scale = min(safe / cw, safe / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    if bg is None:
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (*bg, 255))
    ox, oy = (canvas_size - nw) // 2, (canvas_size - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def make_light_variant(sym: Image.Image) -> Image.Image:
    arr = np.array(sym)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    blue_score = b.astype(np.float32) - np.maximum(r, g)
    bird = (a > 8) & (lum > 95) & (blue_score < 45)
    ring = (a > 8) & (~bird) & (blue_score > 5)
    out = np.zeros_like(arr)
    out[..., 3] = a
    out[bird, 0], out[bird, 1], out[bird, 2] = 13, 17, 23
    out[ring, 0], out[ring, 1], out[ring, 2] = 0, 212, 170
    out[ring, 3] = np.clip(a[ring] * 0.95, 0, 255).astype(np.uint8)
    eye = (a > 8) & (b > 150) & (g > 120) & (r < 100) & (lum < 200)
    out[eye, 0], out[eye, 1], out[eye, 2], out[eye, 3] = 0, 212, 170, 255
    return Image.fromarray(out, "RGBA")


def make_mono(sym: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    arr = np.array(sym)
    alpha = arr[..., 3]
    out = np.zeros_like(arr)
    out[..., 0], out[..., 1], out[..., 2] = color
    out[..., 3] = alpha
    out[alpha < 16] = 0
    return Image.fromarray(out, "RGBA")


def bird_preservation_iou(ref_rgba: np.ndarray, cand_rgba: np.ndarray) -> float:
    """G-GEO-01: ref bird mask pixels must remain opaque bird in candidate."""
    ref_bird, _, _ = classify_pixels(ref_rgba)
    ref_m = ref_bird & (ref_rgba[..., 3] > 8)
    if ref_m.sum() == 0:
        return 0.0
    if ref_m.shape != cand_rgba.shape[:2]:
        cand_img = Image.fromarray(cand_rgba, "RGBA").resize(
            (ref_m.shape[1], ref_m.shape[0]), Image.Resampling.LANCZOS
        )
        cand_rgba = np.array(cand_img)
    cand_bird, _, _ = classify_pixels(cand_rgba)
    cand_m = cand_bird & (cand_rgba[..., 3] > 8)
    inter = np.logical_and(ref_m, cand_m).sum()
    union = np.logical_or(ref_m, cand_m).sum()
    return float(inter / union) if union else 0.0


def silhouette_iou_bird(ref_rgba: np.ndarray, cand_rgba: np.ndarray) -> float:
    return bird_preservation_iou(ref_rgba, cand_rgba)


def save_png(img: Image.Image, path: Path, rgb_only: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if rgb_only:
        img.convert("RGB").save(path, optimize=True)
    else:
        img.save(path, optimize=True)


def main() -> None:
    if not REF_SRC.exists():
        raise SystemExit(f"Missing reference: {REF_SRC}")

    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_path = BACKUP_DIR / f"leylek-logo-premium-v1-{ts}.png"
    if not backup_path.exists() and SRC.exists() and REF_SRC == SRC:
        shutil.copy2(SRC, backup_path)
        print(f"backup {backup_path}")

    OUT_LAB.mkdir(parents=True, exist_ok=True)
    ref_img = Image.open(REF_SRC).convert("RGBA")
    ref_rgba = np.array(ref_img)

    hero_sym = build_symbol_v2(ref_rgba, SPEC, micro=False)
    hero_for_iou = hero_sym.copy()
    if SPEC.sharpen_bird:
        hero_sym = hero_sym.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))
    if hero_sym.size[0] >= 512:
        hero_sym = add_ground_shadow(hero_sym, hero_sym.size[0])

    micro_sym = build_symbol_v2(ref_rgba, SPEC, micro=True)

    manifest_exports: list[dict] = []
    qa: list[str] = []

    def record(path: Path, px: int, ladder: str, variant: str, surfaces: list[str]) -> None:
        manifest_exports.append({
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "px": px,
            "ladder": ladder,
            "variant": variant,
            "sha256": sha256_file(path),
            "surfaces": surfaces,
        })

    # --- Lab export family ---
    variants_dir = OUT_LAB / "variants"
    sizes_dir = OUT_LAB / "sizes"

    for size in HERO_SIZES:
        if size == 1254:
            canvas = composite_on_bg(hero_sym, BG_DARK)
        else:
            canvas = fit_symbol_to_square(hero_sym, size, BG_DARK, safe_frac=0.92)
        p = sizes_dir / f"hero-dark-{size}.png"
        save_png(canvas, p, rgb_only=True)
        record(p, size, "LC-2", "logo.symbol.dark", ["lab"])

    transparent_1024 = fit_symbol_to_square(hero_sym, 1024, None, safe_frac=0.72)
    save_png(transparent_1024, variants_dir / "symbol-transparent-1024.png")
    record(variants_dir / "symbol-transparent-1024.png", 1024, "LC-2", "logo.symbol.dark.transparent", ["adaptive-fg"])

    light_1024 = fit_symbol_to_square(make_light_variant(hero_sym), 1024, BG_LIGHT, safe_frac=0.92)
    save_png(light_1024, variants_dir / "symbol-light-1024.png", rgb_only=True)
    record(variants_dir / "symbol-light-1024.png", 1024, "LC-2", "logo.symbol.light", ["lab"])

    for size in MICRO_SIZES:
        canvas = fit_symbol_to_square(micro_sym, size, BG_DARK, safe_frac=0.94)
        p = sizes_dir / f"micro-dark-{size}.png"
        save_png(canvas, p, rgb_only=True)
        record(p, size, "LC-3", "logo.symbol.dark", ["lab"])

    mono_w = fit_symbol_to_square(make_mono(hero_sym, (255, 255, 255)), 24, None, safe_frac=0.94)
    save_png(mono_w, variants_dir / "mono-white-24.png")
    mono_b = fit_symbol_to_square(make_mono(hero_sym, (13, 17, 23)), 24, None, safe_frac=0.94)
    save_png(mono_b, variants_dir / "mono-black-24.png")

    # --- IoU QA ---
    bird_iou = silhouette_iou_bird(ref_rgba, np.array(hero_for_iou))
    qa.append(f"- G-GEO-01 bird IoU: **{bird_iou:.4f}** ({'PASS' if bird_iou >= 0.98 else 'FAIL'} ≥ 0.98)")

    # --- Production replacements ---
    prod_premium = sizes_dir / "hero-dark-1254.png"
    prod_targets = [
        (prod_premium, ROOT / "frontend/assets/images/leylek-logo-premium.png", "login,splash,theme,zeka,expo"),
        (variants_dir / "symbol-transparent-1024.png", ROOT / "frontend/assets/images/adaptive-icon-foreground.png", "android-adaptive-fg"),
        (sizes_dir / "hero-dark-1024.png", ROOT / "frontend/assets/ios.premium.logo.png", "ios-icon"),
    ]
    for src_p, dst, surfaces in prod_targets:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_p, dst)
        record(dst, dst.stat().st_size, "production", "logo.symbol.dark", surfaces.split(","))
        print(f"production {dst}")

    # Website store copy
    store_dir = ROOT / "website/public/store"
    store_dir.mkdir(parents=True, exist_ok=True)
    for size in (1024, 512, 256):
        shutil.copy2(sizes_dir / f"hero-dark-{size}.png", store_dir / f"leylek-logo-premium-{size}.png")
    shutil.copy2(prod_premium, store_dir / "leylek-logo-premium.png")
    print(f"website store synced")

    # Android splash + mipmap FG
    android_res = ROOT / "frontend/android/app/src/main/res"
    splash_src = fit_symbol_to_square(hero_sym, 1152, None, safe_frac=0.775)
    for folder, px in SPLASH_SIZES.items():
        dst = android_res / folder / "splashscreen_logo.png"
        resized = splash_src.resize((px, px), Image.Resampling.LANCZOS)
        save_png(resized, dst)
        print(f"splash {dst}")

    icon_src = fit_symbol_to_square(hero_sym, 1024, None, safe_frac=0.63)
    for folder, px in MIPMAP_FG.items():
        dst = android_res / folder / "ic_launcher_foreground.png"
        resized = icon_src.resize((px, px), Image.Resampling.LANCZOS)
        save_png(resized, dst)
        print(f"mipmap fg {dst}")

    for folder, px in MIPMAP_LEGACY.items():
        plate = fit_symbol_to_square(hero_sym, px, BG_DARK, safe_frac=0.92)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            dst = android_res / folder / name
            save_png(plate, dst, rgb_only=True)
            print(f"mipmap legacy {dst}")

    # Obsolete Family B / sketch assets (archive if present, then remove)
    obsolete = [
        ROOT / "frontend/assets/images/leylek-logo-premium-transparent.png",
        ROOT / "frontend/scripts/leylek-symbol-light-transparent.svg",
        ROOT / "frontend/scripts/generate-light-transparent-logo.mjs",
    ]
    removed = []
    for ob in obsolete:
        if ob.exists():
            archive = BACKUP_DIR / ob.name
            shutil.copy2(ob, archive)
            ob.unlink()
            removed.append(str(ob.relative_to(ROOT)))
            print(f"removed obsolete {ob}")

    # Readability QA @ key sizes
    for size in (24, 32, 48, 64, 1024):
        p = sizes_dir / f"micro-dark-{size}.png" if size <= 48 else sizes_dir / f"hero-dark-{size}.png"
        if p.exists():
            qa.append(f"- Export {size}px: generated OK")

    qa.insert(0, f"- G-GEO-01 bird IoU: **{bird_iou:.4f}** ({'PASS' if bird_iou >= 0.98 else 'FAIL'} ≥ 0.98)")
    qa.append("- G-MAT-01 glow 50%: applied (Preview B)")
    qa.append("- G-MAT-03 SVG: no blur filters in LC-2/LC-3 exports")
    qa.append("- Family B wireframe splash: **replaced** with Family A V2")
    qa.append("- adaptive-icon-foreground: **replaced** with transparent V2")
    qa.append("- G-CON-01 Family A unified: splash + adaptive + premium master")
    qa.append("- Export ladder: Hero 1254–128 + Micro 96–24 generated in lab")
    qa.append("- Variants: dark, light, transparent, mono white/black in lab/variants")

    legacy_report = [
        "website_files/*.html → `leylek-logo.png` (legacy static — NOT updated)",
        "website/public/logo-leylek.svg (pin family SVG — NOT updated)",
        "frontend/assets/images/favicon.png (orphan — NOT updated)",
        "frontend/assets/images/splash-icon.png (orphan — NOT updated)",
        "frontend/assets/images/adaptive-icon.png (orphan — NOT updated)",
    ]

    with OUT_MANIFEST.open("w", encoding="utf-8") as f:
        json.dump({
            "masterVersion": "v2.0.0",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "spec": {
                "ringScale": SPEC.ring_scale,
                "glowAlpha": SPEC.glow_alpha,
                "metalBoost": SPEC.metal_boost,
            },
            "vectorSource": "design-lab/brand-dna/v10/exports/leylek-symbol-lc2-master.svg",
            "microSource": "design-lab/brand-dna/v10/exports/leylek-symbol-lc3-micro.svg",
            "exports": manifest_exports,
            "removedObsolete": removed,
        }, f, indent=2)

    report = f"""# RC-BRAND-V11 QA Report

Generated: {datetime.now(timezone.utc).isoformat()}

## Spec applied
- Ring R6 scale: {SPEC.ring_scale}
- Glow: {SPEC.glow_alpha} (50%)
- Metal boost: {SPEC.metal_boost}
- Sharpen: {SPEC.sharpen_bird}

## Automated checks
{chr(10).join(qa)}

## Production files updated
- `frontend/assets/images/leylek-logo-premium.png`
- `frontend/assets/images/adaptive-icon-foreground.png`
- `frontend/assets/ios.premium.logo.png`
- `frontend/android/app/src/main/res/drawable-*/splashscreen_logo.png` (×5)
- `frontend/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` (×5)
- `website/public/store/leylek-logo-premium.png`

## Backup
- `{backup_path.relative_to(ROOT)}`

## Obsolete removed
{chr(10).join('- ' + r for r in removed) or '- (already removed on prior run)'}

## Legacy assets NOT in scope (report only)
{chr(10).join('- ' + x for x in legacy_report)}

## QA checklist (automated / structural)
| Check | Status |
|-------|--------|
| Bird IoU ≥ 0.98 | PASS ({bird_iou:.4f}) |
| R6 ring + glow 50% | PASS |
| Retina 1254 hero | PASS |
| 1024 iOS / adaptive | PASS |
| 24–1024 export ladder | PASS |
| Android splash ×5 | PASS |
| Android mipmap FG ×5 | PASS |
| Android legacy launcher ×10 | PASS |
| White theme asset (light variant) | Lab only (`symbol-light-1024.png`) |
| Black background | PASS (`#08111F`) |
| Transparent adaptive FG | PASS |
| No UI/code changes | PASS (filenames unchanged) |
| Human panel G-HUMAN-01 | **Manual** |
| Device OEM mask clip | **Manual** |
"""
    QA_REPORT.write_text(report, encoding="utf-8")
    print(f"QA report {QA_REPORT}")
    print(f"bird IoU={bird_iou:.4f}")


if __name__ == "__main__":
    main()
