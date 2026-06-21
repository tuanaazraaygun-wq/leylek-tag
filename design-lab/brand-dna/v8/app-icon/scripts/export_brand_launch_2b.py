#!/usr/bin/env py -3
"""BRAND-LAUNCH-2B — Export premium Family A launcher + native splash assets."""
from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
SRC = ROOT / "frontend/assets/images/leylek-logo-premium.png"
ADAPTIVE_OUT = ROOT / "frontend/assets/images/adaptive-icon-foreground.png"
IOS_OUT = ROOT / "frontend/assets/ios.premium.logo.png"
ANDROID_RES = ROOT / "frontend/android/app/src/main/res"
BACKUP = ROOT / "frontend/assets/images/_backup-pre-brand-launch-20260621"

BG = (8, 17, 31, 255)
CANVAS = 1024
ADAPTIVE_SAFE_FRAC = 0.66
SPLASH_SAFE_FRAC = 0.72
IOS_SAFE_FRAC = 0.80
RING_SCALE = 0.94  # R6 launcher-safe
OPTICAL = (268 / 512, 278 / 512)
GLOW_ALPHA = 0.5
OPTICAL_SHIFT_Y = 6

DENSITIES: dict[str, int] = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


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


def build_symbol(rgba: np.ndarray, ring_scale: float) -> Image.Image:
    h, w = rgba.shape[:2]
    cx = OPTICAL[0] * w
    cy = OPTICAL[1] * h
    bird, ring, background = classify_pixels(rgba)
    out = np.zeros((h, w, 4), dtype=np.float32)

    bird_mask = bird & (rgba[..., 3] > 0)
    ys, xs = np.where(bird_mask)
    for y, x in zip(ys, xs):
        out[y, x] = rgba[y, x].astype(np.float32)

    ring_mask = ring & (rgba[..., 3] > 0)
    ys, xs = np.where(ring_mask)
    for y, x in zip(ys, xs):
        nx = cx + (x - cx) * ring_scale
        ny = cy + (y - cy) * ring_scale
        ix = int(round(nx))
        iy = int(round(ny))
        if 0 <= ix < w and 0 <= iy < h:
            px = rgba[y, x].astype(np.float32)
            px[3] *= GLOW_ALPHA
            if px[3] > out[iy, ix, 3]:
                out[iy, ix] = px

    other = (~background) & (~bird) & (~ring) & (rgba[..., 3] > 0)
    ys, xs = np.where(other)
    for y, x in zip(ys, xs):
        nx = cx + (x - cx) * ring_scale
        ny = cy + (y - cy) * ring_scale
        ix = int(round(nx))
        iy = int(round(ny))
        if 0 <= ix < w and 0 <= iy < h:
            px = rgba[y, x].astype(np.float32)
            px[3] *= GLOW_ALPHA
            if px[3] > out[iy, ix, 3]:
                out[iy, ix] = px

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def fit_symbol_to_canvas(
    sym: Image.Image,
    canvas_size: int,
    safe_frac: float,
    *,
    transparent: bool,
    optical_shift_y: int = 0,
) -> Image.Image:
    bbox = sym.getbbox()
    if not bbox:
        raise RuntimeError("Empty symbol bbox")
    cropped = sym.crop(bbox)
    safe = int(canvas_size * safe_frac)
    cw, ch = cropped.size
    scale = min(safe / cw, safe / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    bg = (0, 0, 0, 0) if transparent else BG
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg)
    ox = (canvas_size - nw) // 2
    oy = (canvas_size - nh) // 2 + optical_shift_y
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def composite_launcher(fg: Image.Image, size: int) -> Image.Image:
    layer = fg.resize((size, size), Image.Resampling.LANCZOS)
    bg = Image.new("RGBA", (size, size), BG)
    bg.paste(layer, (0, 0), layer)
    return bg.convert("RGB")


def backup_assets() -> None:
    BACKUP.mkdir(parents=True, exist_ok=True)
    android_backup = BACKUP / "android-res"
    android_backup.mkdir(exist_ok=True)

    for name in ("adaptive-icon-foreground.png", "ios.premium.logo.png"):
        src = ROOT / "frontend/assets/images" / name
        if src.exists():
            shutil.copy2(src, BACKUP / name)

    for pattern in ("drawable-*", "mipmap-*"):
        for folder in sorted(ANDROID_RES.glob(pattern)):
            if folder.name.startswith("_backup"):
                continue
            for png in folder.glob("*.png"):
                if "splashscreen_logo" in png.name or png.name.startswith("ic_launcher"):
                    rel = folder.name + "/" + png.name
                    dest = android_backup / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(png, dest)
    print(f"backup -> {BACKUP}")


def main() -> None:
    backup_assets()

    src = Image.open(SRC).convert("RGBA")
    rgba = np.array(src)
    sym = build_symbol(rgba, RING_SCALE)

    adaptive = fit_symbol_to_canvas(
        sym,
        CANVAS,
        ADAPTIVE_SAFE_FRAC,
        transparent=True,
        optical_shift_y=OPTICAL_SHIFT_Y,
    )
    adaptive.save(ADAPTIVE_OUT, "PNG", optimize=True)
    print(f"wrote {ADAPTIVE_OUT} {adaptive.size} {adaptive.mode}")

    ios = fit_symbol_to_canvas(
        sym,
        CANVAS,
        IOS_SAFE_FRAC,
        transparent=False,
        optical_shift_y=OPTICAL_SHIFT_Y,
    )
    ios.convert("RGB").save(IOS_OUT, "PNG", optimize=True)
    print(f"wrote {IOS_OUT}")

    for density, size in DENSITIES.items():
        fg = fit_symbol_to_canvas(
            sym,
            size,
            ADAPTIVE_SAFE_FRAC,
            transparent=True,
            optical_shift_y=max(1, round(OPTICAL_SHIFT_Y * size / CANVAS)),
        )
        fg_path = ANDROID_RES / f"mipmap-{density}" / "ic_launcher_foreground.png"
        fg_path.parent.mkdir(parents=True, exist_ok=True)
        fg.save(fg_path, "PNG", optimize=True)

        launcher = composite_launcher(adaptive, size)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            out = ANDROID_RES / f"mipmap-{density}" / name
            launcher.save(out, "PNG", optimize=True)

        splash = fit_symbol_to_canvas(
            sym,
            size,
            SPLASH_SAFE_FRAC,
            transparent=True,
            optical_shift_y=max(1, round(OPTICAL_SHIFT_Y * size / CANVAS)),
        )
        splash_path = ANDROID_RES / f"drawable-{density}" / "splashscreen_logo.png"
        splash_path.parent.mkdir(parents=True, exist_ok=True)
        splash.save(splash_path, "PNG", optimize=True)
        print(f"wrote mipmap-{density} + drawable-{density} @ {size}px")

    print("BRAND-LAUNCH-2B export complete")


if __name__ == "__main__":
    main()
