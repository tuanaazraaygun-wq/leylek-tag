#!/usr/bin/env py -3
"""
RC-BRAND-V12 — In-app transparent light/dark material masters.
Does NOT replace leylek-logo-premium.png (splash/icon baked V11).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_v11_production import (  # noqa: E402
    BG_DARK,
    SPEC,
    V2Spec,
    build_symbol_v2,
    classify_pixels,
    fit_symbol_to_square,
    save_png,
    sha256_file,
)

ROOT = Path(__file__).resolve().parents[4]
REF_SRC = ROOT / "frontend/assets/images/leylek-logo-premium.png"
OUT_DARK = ROOT / "frontend/assets/images/leylek-logo-premium-dark.png"
OUT_LIGHT = ROOT / "frontend/assets/images/leylek-logo-premium-light.png"
OUT_LAB = Path(__file__).resolve().parents[1] / "production-output" / "v12"
QA_REPORT = Path(__file__).resolve().parents[1] / "QA_REPORT_V12.md"

INAPP_CANVAS = 512
SAFE_FRAC = 0.88

# Graphite bird (light master) — LC-2 birdGradientLight
GRAPHITE_HI = np.array([27, 27, 30], dtype=np.float32)  # #1B1B1E
GRAPHITE_LO = np.array([13, 17, 23], dtype=np.float32)  # #0D1117
WING_HI = np.array([45, 48, 54], dtype=np.float32)
EYE_CYAN = np.array([0, 212, 170], dtype=np.uint8)


def build_dark_transparent_symbol(ref_rgba: np.ndarray, spec: V2Spec) -> Image.Image:
    """Silver bird + premium ring, no ground shadow, no baked plate."""
    sym = build_symbol_v2(ref_rgba, spec, micro=False)
    sym = sym.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))
    arr = np.array(sym, dtype=np.float32)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    bird, ring, background = classify_pixels(arr.astype(np.uint8))

    # Remove baked #08111F plate bleed and outer dark glow fringe.
    dr = np.abs(r - BG_DARK[0])
    dg = np.abs(g - BG_DARK[1])
    db = np.abs(b - BG_DARK[2])
    plate = (a > 0) & (dr < 22) & (dg < 22) & (db < 22) & (~bird) & (~ring)
    dark_fringe = (a > 0) & (a < 140) & (lum < 48) & (~bird)
    arr[plate, 3] = 0
    arr[dark_fringe, 3] *= 0.15

    # Tighten ring outer glow for in-app (50% → ~35% on fringe only).
    ring_fringe = ring & (a > 0) & (a < 200) & (lum > 40) & (lum < 130)
    arr[ring_fringe, 3] *= 0.72

    arr[background, 3] = 0
    arr[a < 6, 3] = 0

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def make_light_variant_v12(sym: Image.Image) -> Image.Image:
    """Graphite metallic bird + original premium blue ring, transparent, no halo."""
    arr = np.array(sym.convert("RGBA"), dtype=np.float32)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    blue_score = b - np.maximum(r, g)

    bird, ring, background = classify_pixels(arr.astype(np.uint8))
    bird_m = bird & (a > 8)
    ring_m = ring & (a > 8)
    eye_m = (
        (a > 8)
        & (b > 140)
        & (g > 100)
        & (r < 110)
        & (blue_score > 20)
        & (~bird_m)
    )

    out = np.zeros_like(arr)

    # Ring: preserve V2 premium blue gradient from dark master geometry.
    for y, x in zip(*np.where(ring_m)):
        out[y, x] = arr[y, x]
        if arr[y, x, 3] < 220:
            out[y, x, 3] *= 0.92

    # Kill ring glow fringe (no halo on white UI).
    ring_lum = 0.299 * out[..., 0] + 0.587 * out[..., 1] + 0.114 * out[..., 2]
    ring_fringe = ring_m & (out[..., 3] > 0) & (out[..., 3] < 160) & (ring_lum < 100)
    out[ring_fringe, 3] *= 0.25

    # Bird: graphite metal from silhouette luminance.
    ys, xs = np.where(bird_m)
    for y, x in zip(ys, xs):
        t = float(np.clip((lum[y, x] - 85) / 130, 0, 1))
        base = GRAPHITE_LO * (1 - t) + GRAPHITE_HI * t
        if blue_score[y, x] < 20 and lum[y, x] > 140:
            base = base * 0.92 + WING_HI * 0.08
        out[y, x, :3] = base
        out[y, x, 3] = min(255, a[y, x] * 0.98)

    # Wing highlight stroke (locked geometry — bright edge on graphite).
    wing_hint = bird_m & (lum > 128) & (b.astype(np.float32) < r + 25)
    out[wing_hint, :3] = np.clip(out[wing_hint, :3] * 0.85 + WING_HI * 0.15, 0, 255)

    # Eye accent — same position/size as dark master.
    out[eye_m, :3] = EYE_CYAN
    out[eye_m, 3] = 255

    # Other accent pixels (cyan dot core).
    accent = (a > 8) & (~bird_m) & (~ring_m) & (b > 150) & (g > 120) & (r < 100)
    out[accent, :3] = EYE_CYAN
    out[accent, 3] = np.clip(a[accent], 200, 255)

    out[background, 3] = 0
    out[out[..., 3] < 8, 3] = 0

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def validate_transparency(img: Image.Image, label: str) -> dict:
    arr = np.array(img.convert("RGBA"))
    a = arr[..., 3]
    corners = [tuple(arr[0, 0]), tuple(arr[0, -1]), tuple(arr[-1, 0]), tuple(arr[-1, -1])]
    corner_alpha = [c[3] for c in corners]
    bbox = img.getbbox()
    opaque_outside = 0
    if bbox:
        x0, y0, x1, y1 = bbox
        mask = np.zeros(a.shape, dtype=bool)
        mask[y0:y1, x0:x1] = True
        opaque_outside = int(np.sum((a > 16) & (~mask)))
    # Plate test: composite on white, count near-black pixels outside bbox.
    on_white = Image.new("RGBA", img.size, (255, 255, 255, 255))
    on_white.alpha_composite(img)
    ow = np.array(on_white.convert("RGB"))
    olum = ow[..., 0].astype(np.float32) + ow[..., 1] + ow[..., 2]
    if bbox:
        plate_mask = np.ones(a.shape, dtype=bool)
        plate_mask[y0:y1, x0:x1] = False
        dark_square = int(np.sum(plate_mask & (olum < 60)))
    else:
        dark_square = int(np.sum(olum < 60))
    return {
        "label": label,
        "has_alpha": img.mode == "RGBA",
        "corner_alpha": [int(x) for x in corner_alpha],
        "corners_transparent": all(x == 0 for x in corner_alpha),
        "bbox": list(bbox) if bbox else None,
        "opaque_pixels_outside_bbox": int(opaque_outside),
        "dark_pixels_outside_symbol_on_white": int(dark_square),
    }


def main() -> None:
    if not REF_SRC.exists():
        raise SystemExit(f"Missing reference: {REF_SRC}")

    ref_rgba = np.array(Image.open(REF_SRC).convert("RGBA"))
    spec = V2Spec(glow_alpha=0.5, ring_scale=0.94, metal_boost=1.10, sharpen_bird=True)

    dark_sym = build_dark_transparent_symbol(ref_rgba, spec)
    light_sym = make_light_variant_v12(dark_sym)

    dark_out = fit_symbol_to_square(dark_sym, INAPP_CANVAS, None, safe_frac=SAFE_FRAC)
    light_out = fit_symbol_to_square(light_sym, INAPP_CANVAS, None, safe_frac=SAFE_FRAC)

    OUT_LAB.mkdir(parents=True, exist_ok=True)
    save_png(dark_out, OUT_LAB / "symbol-dark-transparent-512.png")
    save_png(light_out, OUT_LAB / "symbol-light-transparent-512.png")
    save_png(dark_out, OUT_DARK)
    save_png(light_out, OUT_LIGHT)

    val_dark = validate_transparency(dark_out, "dark")
    val_light = validate_transparency(light_out, "light")

    qa_lines = [
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Outputs",
        f"- `{OUT_DARK.relative_to(ROOT)}`",
        f"- `{OUT_LIGHT.relative_to(ROOT)}`",
        f"- Lab copies under `{OUT_LAB.relative_to(ROOT)}`",
        "",
        "## Validation",
        f"- Dark corners transparent: **{val_dark['corners_transparent']}**",
        f"- Light corners transparent: **{val_light['corners_transparent']}**",
        f"- Dark opaque outside bbox: **{val_dark['opaque_pixels_outside_bbox']}**",
        f"- Light opaque outside bbox: **{val_light['opaque_pixels_outside_bbox']}**",
        f"- Dark square bleed on white (outside symbol): **{val_dark['dark_pixels_outside_symbol_on_white']}**",
        f"- Light square bleed on white (outside symbol): **{val_light['dark_pixels_outside_symbol_on_white']}**",
        "",
        "## Unchanged",
        "- `leylek-logo-premium.png` (splash/icon baked V11)",
    ]

    manifest = {
        "masterVersion": "v12.0.0-inapp",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "spec": {"ringScale": 0.94, "glowAlpha": 0.5, "metalBoost": 1.10},
        "exports": [
            {
                "path": str(OUT_DARK.relative_to(ROOT)).replace("\\", "/"),
                "variant": "logo.symbol.dark.transparent.inapp",
                "sha256": sha256_file(OUT_DARK),
                "px": INAPP_CANVAS,
            },
            {
                "path": str(OUT_LIGHT.relative_to(ROOT)).replace("\\", "/"),
                "variant": "logo.symbol.light.transparent.inapp",
                "sha256": sha256_file(OUT_LIGHT),
                "px": INAPP_CANVAS,
            },
        ],
        "validation": {"dark": val_dark, "light": val_light},
    }

    (OUT_LAB / "v12-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    QA_REPORT.write_text("# RC-BRAND-V12 QA Report\n\n" + "\n".join(qa_lines), encoding="utf-8")

    print(f"wrote {OUT_DARK}")
    print(f"wrote {OUT_LIGHT}")
    print(json.dumps(manifest["validation"], indent=2))


if __name__ == "__main__":
    main()
