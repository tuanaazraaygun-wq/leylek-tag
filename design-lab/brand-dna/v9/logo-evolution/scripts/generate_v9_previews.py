#!/usr/bin/env py -3
"""BRAND-LOGO-EVO-2A — Premium evolution previews (design-lab only)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[5]
SRC = ROOT / "frontend/assets/images/leylek-logo-premium.png"
OUT = Path(__file__).resolve().parents[1] / "previews"
READABILITY = Path(__file__).resolve().parents[1] / "readability"

CANVAS = 1024
SAFE_FRAC = 0.72  # logo master uses slightly more canvas than adaptive icon
OPTICAL = (268 / 512, 278 / 512)


@dataclass
class PreviewSpec:
    name: str
    ring_scale: float
    glow_alpha: float
    bg: tuple[int, int, int]
    metal_boost: float
    sharpen_bird: bool
    radial_bg: bool
    label: str


PREVIEWS = [
    PreviewSpec(
        "preview-a.png",
        0.96,
        0.5,
        (8, 17, 31),
        1.06,
        False,
        False,
        "Preview A — Conservative (R4)",
    ),
    PreviewSpec(
        "preview-b.png",
        0.94,
        0.5,
        (8, 17, 31),
        1.10,
        True,
        False,
        "Preview B — Balanced ★ (R6)",
    ),
    PreviewSpec(
        "preview-c.png",
        0.94,
        0.4,
        (11, 18, 32),
        1.12,
        True,
        True,
        "Preview C — Premium polish (R6+)",
    ),
]


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


def build_symbol(rgba: np.ndarray, spec: PreviewSpec) -> Image.Image:
    h, w = rgba.shape[:2]
    cx = OPTICAL[0] * w
    cy = OPTICAL[1] * h
    bird, ring, background = classify_pixels(rgba)
    out = np.zeros((h, w, 4), dtype=np.float32)

    bird_mask = bird & (rgba[..., 3] > 0)
    for y, x in zip(*np.where(bird_mask)):
        px = enhance_metal(rgba[y, x].astype(np.float32), spec.metal_boost, True)
        out[y, x] = px

    ring_mask = ring & (rgba[..., 3] > 0)
    for y, x in zip(*np.where(ring_mask)):
        nx = cx + (x - cx) * spec.ring_scale
        ny = cy + (y - cy) * spec.ring_scale
        ix, iy = int(round(nx)), int(round(ny))
        if 0 <= ix < w and 0 <= iy < h:
            px = rgba[y, x].astype(np.float32)
            lum = 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]
            fringe = lum > 45 and px[3] < 220
            px[3] *= spec.glow_alpha if fringe else min(255, px[3] * 0.92)
            px = enhance_metal(px, spec.metal_boost, False)
            if px[3] > out[iy, ix, 3]:
                out[iy, ix] = px

    other = (~background) & (~bird) & (~ring) & (rgba[..., 3] > 0)
    for y, x in zip(*np.where(other)):
        nx = cx + (x - cx) * spec.ring_scale
        ny = cy + (y - cy) * spec.ring_scale
        ix, iy = int(round(nx)), int(round(ny))
        if 0 <= ix < w and 0 <= iy < h:
            px = rgba[y, x].astype(np.float32)
            px[3] *= spec.glow_alpha
            px = enhance_metal(px, spec.metal_boost, False)
            if px[3] > out[iy, ix, 3]:
                out[iy, ix] = px

    sym = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    if spec.sharpen_bird:
        sym = sym.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))
    return sym


def make_background(spec: PreviewSpec) -> Image.Image:
    bg = Image.new("RGB", (CANVAS, CANVAS), spec.bg)
    if not spec.radial_bg:
        return bg
    cx, cy = CANVAS // 2, CANVAS // 2
    px = bg.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / (CANVAS * 0.55)
            t = min(1.0, d)
            r = int(spec.bg[0] + t * 3)
            g = int(spec.bg[1] + t * 4)
            b = int(spec.bg[2] + t * 6)
            px[x, y] = (r, g, b)
    return bg


def fit_to_canvas(sym: Image.Image, spec: PreviewSpec) -> Image.Image:
    bbox = sym.getbbox()
    if not bbox:
        raise RuntimeError("empty symbol")
    cropped = sym.crop(bbox)
    safe = int(CANVAS * SAFE_FRAC)
    cw, ch = cropped.size
    scale = min(safe / cw, safe / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = make_background(spec).convert("RGBA")
    ox, oy = (CANVAS - nw) // 2, (CANVAS - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas.convert("RGB")


def comparison_grid(prod: Image.Image, previews: dict[str, Image.Image]) -> None:
    pad = 20
    w = pad + 4 * (CANVAS + pad)
    h = pad + CANVAS + 60
    grid = Image.new("RGB", (w, h), (8, 17, 31))
    draw = ImageDraw.Draw(grid)
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except OSError:
        font = ImageFont.load_default()
    items = [("Production", prod)] + [(PREVIEWS[i].label, previews[PREVIEWS[i].name]) for i in range(3)]
    for i, (label, img) in enumerate(items):
        x = pad + i * (CANVAS + pad)
        draw.rectangle((x, 0, x + CANVAS, 36), fill=(8, 17, 31))
        draw.text((x + 12, 8), label, fill=(186, 230, 253), font=font)
        grid.paste(img, (x, 40))
    grid.save(OUT / "comparison-grid.png", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    READABILITY.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    rgba = np.array(src)

    prod_fit = fit_to_canvas(
        Image.fromarray(rgba, "RGBA"),
        PreviewSpec("prod", 1.0, 1.0, (8, 17, 31), 1.0, False, False, "Production"),
    )

    out_map: dict[str, Image.Image] = {}
    for spec in PREVIEWS:
        sym = build_symbol(rgba, spec)
        img = fit_to_canvas(sym, spec)
        path = OUT / spec.name
        img.save(path, optimize=True)
        out_map[spec.name] = img
        print(f"wrote {path}")

    comparison_grid(prod_fit, out_map)

    ref = out_map["preview-b.png"]
    for size in (48, 72, 96, 192):
        small = ref.resize((size, size), Image.Resampling.LANCZOS)
        frame = Image.new("RGB", (size + 40, size + 64), (40, 48, 64))
        d = ImageDraw.Draw(frame)
        d.text((8, 8), f"Preview B @ {size}px", fill=(186, 201, 222))
        frame.paste(small, (20, 48))
        frame.save(READABILITY / f"{size}px.png", optimize=True)
        print(f"wrote {READABILITY / f'{size}px.png'}")


if __name__ == "__main__":
    main()
