#!/usr/bin/env py -3
"""Generate BRAND-APPICON-1B lab candidates from production premium login logo.

Read-only on production assets. Outputs under design-lab/.../candidates/ only.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[5]
SRC = ROOT / "frontend/assets/images/leylek-logo-premium.png"
OUT = Path(__file__).resolve().parents[1] / "candidates"

BG = (8, 17, 31, 255)  # #08111F premium soft black
CANVAS = 1024
SAFE_FRAC = 0.66  # Android adaptive safe diameter / canvas
OPTICAL = (268 / 512, 278 / 512)  # constitution optical center
GLOW_ALPHA = 0.5

CANDIDATES = {
    "candidate-r4.png": 0.96,
    "candidate-r6.png": 0.94,
    "candidate-r8.png": 0.92,
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
    # Residual bright cyan glow often tagged as ring
    ring |= (~background) & (~bird) & (blue_score > 5) & (lum > 40)

    return bird, ring, background


def build_symbol(rgba: np.ndarray, ring_scale: float) -> Image.Image:
    h, w = rgba.shape[:2]
    cx = OPTICAL[0] * w
    cy = OPTICAL[1] * h

    bird, ring, background = classify_pixels(rgba)
    out = np.zeros((h, w, 4), dtype=np.float32)

    # Bird: fixed position
    bird_mask = bird & (rgba[..., 3] > 0)
    ys, xs = np.where(bird_mask)
    for y, x in zip(ys, xs):
        out[y, x] = rgba[y, x].astype(np.float32)

    # Ring + glow: scale toward optical center, reduce glow alpha
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
            # Max blend for overlapping ring pixels
            existing = out[iy, ix, 3]
            if px[3] > existing:
                out[iy, ix] = px

    # Any unclassified non-bg detail (edge metal highlights on arc border)
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

    sym = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    return sym


def fit_to_canvas(sym: Image.Image) -> Image.Image:
    bbox = sym.getbbox()
    if not bbox:
        raise RuntimeError("Empty symbol bbox")
    cropped = sym.crop(bbox)

    safe = int(CANVAS * SAFE_FRAC)
    cw, ch = cropped.size
    scale = min(safe / cw, safe / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), BG)
    ox = (CANVAS - nw) // 2
    oy = (CANVAS - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas.convert("RGB")


def add_label(img: Image.Image, text: str) -> Image.Image:
    out = img.copy()
    draw = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype("arial.ttf", 28)
    except OSError:
        font = ImageFont.load_default()
    draw.rectangle((0, 0, CANVAS, 44), fill=BG)
    draw.text((16, 10), text, fill=(186, 230, 253), font=font)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    rgba = np.array(src)

    icons: dict[str, Image.Image] = {}
    for name, scale in CANDIDATES.items():
        sym = build_symbol(rgba, scale)
        icon = fit_to_canvas(sym)
        path = OUT / name
        icon.save(path, "PNG", optimize=True)
        icons[name] = icon
        print(f"wrote {path} ring_scale={scale}")

    # Preview grid (3 columns)
    pad = 24
    cell = CANVAS
    grid_w = pad + 3 * (cell + pad)
    grid_h = pad + cell + pad + 40
    grid = Image.new("RGB", (grid_w, grid_h), BG)
    labels = ["R4 −4% ring", "R6 −6% ring ★", "R8 −8% ring"]
    for i, (name, label) in enumerate(zip(CANDIDATES.keys(), labels)):
        x = pad + i * (cell + pad)
        labeled = add_label(icons[name], label)
        grid.paste(labeled, (x, pad))
    grid.save(OUT / "preview-grid.png", "PNG", optimize=True)
    print(f"wrote {OUT / 'preview-grid.png'}")

    # Size previews from recommended R6
    r6 = icons["candidate-r6.png"]
    for size in (48, 72, 96, 192):
        prev = r6.resize((size, size), Image.Resampling.LANCZOS)
        # Checkerboard margin for transparency check (icon is opaque RGB)
        frame = Image.new("RGB", (size + 32, size + 56), (40, 48, 64))
        draw = ImageDraw.Draw(frame)
        draw.text((8, 8), f"R6 @ {size}px", fill=(186, 201, 222))
        frame.paste(prev, (16, 40))
        path = OUT / f"{size}px-preview.png"
        frame.save(path, "PNG", optimize=True)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
