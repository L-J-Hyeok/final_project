#!/usr/bin/env python3
"""
Safe local official render processor (no external network, no paid AI API).

Reads an unmodified source image from `originals/`, preserves existing transparency,
conservatively strips uniform light studio backgrounds via perimeter-only flood fill
with quality guards, keeps the original untouched if quality/safety fails, trims
excess blank padding cleanly, scales down (never upscales) beyond MAX_DIM, and writes
a transparent WebP/PNG to `optimized/`.
"""

import argparse
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageOps

MAX_DIM = 1200
BORDER_BG_MIN_LUM = 225.0
BORDER_BG_MAX_CHROMA = 18.0
BORDER_BG_MAX_STD = 14.0
FLOOD_DIST_THRESH = 24.0
FEATHER_LOW = 12.0
FEATHER_HIGH = 34.0


def inspect_existing_alpha(rgba_arr: np.ndarray):
    alpha = rgba_arr[:, :, 3]
    h, w = alpha.shape
    border = np.concatenate([alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]])
    border_trans_ratio = float(np.mean(border < 245))
    total_trans_ratio = float(np.mean(alpha < 245))
    return border_trans_ratio, total_trans_ratio


def detect_uniform_light_bg(rgb_arr: np.ndarray):
    h, w, _ = rgb_arr.shape
    ring_pixels = np.concatenate(
        [
            rgb_arr[0:2, :, :].reshape(-1, 3),
            rgb_arr[max(0, h - 2) : h, :, :].reshape(-1, 3),
            rgb_arr[:, 0:2, :].reshape(-1, 3),
            rgb_arr[:, max(0, w - 2) : w, :].reshape(-1, 3),
        ],
        axis=0,
    ).astype(np.float32)

    bg_rgb = np.median(ring_pixels, axis=0)
    per_pixel_std = float(np.mean(np.std(ring_pixels, axis=0)))
    chroma = float(np.max(bg_rgb) - np.min(bg_rgb))
    min_lum = float(np.min(bg_rgb))
    ok = (
        min_lum >= BORDER_BG_MIN_LUM
        and chroma <= BORDER_BG_MAX_CHROMA
        and per_pixel_std <= BORDER_BG_MAX_STD
    )
    return ok, bg_rgb, {
        "bgRgb": [round(float(x), 1) for x in bg_rgb],
        "minChannel": round(min_lum, 1),
        "chroma": round(chroma, 1),
        "borderStd": round(per_pixel_std, 2),
    }


def perimeter_flood_remove_bg(rgba_arr: np.ndarray, bg_rgb: np.ndarray):
    rgb = rgba_arr[:, :, :3].astype(np.float32)
    h, w, _ = rgb.shape
    dist = np.linalg.norm(rgb - bg_rgb.reshape(1, 1, 3), axis=2)
    candidate = dist <= FLOOD_DIST_THRESH

    bg_mask = np.zeros((h, w), dtype=bool)
    q = deque()

    # Seed from 4 outer edges only
    for x in range(w):
        if candidate[0, x] and not bg_mask[0, x]:
            bg_mask[0, x] = True
            q.append((0, x))
        if candidate[h - 1, x] and not bg_mask[h - 1, x]:
            bg_mask[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if candidate[y, 0] and not bg_mask[y, 0]:
            bg_mask[y, 0] = True
            q.append((y, 0))
        if candidate[y, w - 1] and not bg_mask[y, w - 1]:
            bg_mask[y, w - 1] = True
            q.append((y, w - 1))

    cand_list = candidate
    visited = bg_mask
    while q:
        y, x = q.popleft()
        if y > 0 and not visited[y - 1, x] and cand_list[y - 1, x]:
            visited[y - 1, x] = True
            q.append((y - 1, x))
        if y + 1 < h and not visited[y + 1, x] and cand_list[y + 1, x]:
            visited[y + 1, x] = True
            q.append((y + 1, x))
        if x > 0 and not visited[y, x - 1] and cand_list[y, x - 1]:
            visited[y, x - 1] = True
            q.append((y, x - 1))
        if x + 1 < w and not visited[y, x + 1] and cand_list[y, x + 1]:
            visited[y, x + 1] = True
            q.append((y, x + 1))

    # 1-px outer boundary feathering only around flooded pixels
    up = np.zeros_like(visited); up[1:] = visited[:-1]
    dn = np.zeros_like(visited); dn[:-1] = visited[1:]
    lf = np.zeros_like(visited); lf[:, 1:] = visited[:, :-1]
    rt = np.zeros_like(visited); rt[:, :-1] = visited[:, 1:]
    halo = (~visited) & (up | dn | lf | rt) & (dist <= FEATHER_HIGH)

    out = rgba_arr.copy()
    alpha = out[:, :, 3].astype(np.float32)
    alpha[visited] = 0.0
    if np.any(halo):
        factor = np.clip((dist[halo] - FEATHER_LOW) / (FEATHER_HIGH - FEATHER_LOW), 0.0, 1.0)
        alpha[halo] = np.minimum(alpha[halo], factor * 255.0)
    out[:, :, 3] = np.round(alpha).astype(np.uint8)
    return out


def validate_cutout(out_rgba: np.ndarray):
    alpha = out_rgba[:, :, 3]
    h, w = alpha.shape
    fg = alpha > 16
    fg_ratio = float(np.mean(fg))
    if fg_ratio < 0.08:
        return False, f"foreground too small after cutout ({fg_ratio:.2%})"
    if fg_ratio > 0.985:
        return False, f"virtually no background removed ({fg_ratio:.2%})"

    ys, xs = np.where(fg)
    height_span = (int(ys.max()) - int(ys.min()) + 1) / float(h)
    width_span = (int(xs.max()) - int(xs.min()) + 1) / float(w)
    if height_span < 0.30 or width_span < 0.12:
        return False, f"suspicious bounding box collapse ({width_span:.2f}x{height_span:.2f})"

    # Ensure middle horizontal band keeps substantial opaque phone mass (catches white-bezel bleed)
    mid_band = fg[h // 3 : (2 * h) // 3, int(xs.min()) : int(xs.max()) + 1]
    if mid_band.size > 0 and float(np.mean(mid_band)) < 0.28:
        return False, f"possible bezel flood-fill bleed into device interior ({np.mean(mid_band):.2%})"

    return True, "ok"


def trim_and_pad_transparent(img: Image.Image):
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    fg = alpha > 10
    if not np.any(fg):
        return rgba
    ys, xs = np.where(fg)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    cropped = rgba.crop((x0, y0, x1, y1))
    cw, ch = cropped.size
    pad_x = max(12, int(round(cw * 0.04)))
    pad_y = max(12, int(round(ch * 0.04)))
    canvas = Image.new("RGBA", (cw + pad_x * 2, ch + pad_y * 2), (0, 0, 0, 0))
    canvas.paste(cropped, (pad_x, pad_y), cropped)
    return canvas


def downscale_if_needed(img: Image.Image):
    w, h = img.size
    longest = max(w, h)
    if longest <= MAX_DIM:
        return img
    scale = MAX_DIM / float(longest)
    new_size = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def process_one(input_path: str, output_base_no_ext: str, allow_bg_removal: bool = True):
    with Image.open(input_path) as raw_img:
        transposed = ImageOps.exif_transpose(raw_img)
        rgba_init = transposed.convert("RGBA")

    init_arr = np.array(rgba_init)
    border_trans, total_trans = inspect_existing_alpha(init_arr)

    status = "preserved_opaque"
    needs_manual_review = False
    reason = ""
    transparent_output = False
    working_img = transposed

    if border_trans >= 0.08 or total_trans >= 0.03:
        status = "preserved_transparent_alpha"
        reason = f"Existing transparency preserved cleanly (border={border_trans:.1%}, total={total_trans:.1%})"
        transparent_output = True
        working_img = trim_and_pad_transparent(rgba_init)
    elif allow_bg_removal:
        uniform_ok, bg_rgb, bg_stats = detect_uniform_light_bg(init_arr[:, :, :3])
        if not uniform_ok:
            status = "kept_original_complex_bg"
            needs_manual_review = True
            reason = f"Non-uniform or non-white studio background ({bg_stats}); preserved unmodified background"
            working_img = transposed.convert("RGB") if transposed.mode not in ("RGB", "RGBA") else transposed
        else:
            # Work on bounded resolution first so flood-fill stays fast and crisp
            bounded = downscale_if_needed(rgba_init)
            cut_arr = perimeter_flood_remove_bg(np.array(bounded), bg_rgb)
            valid, val_msg = validate_cutout(cut_arr)
            if not valid:
                status = "kept_original_safety_guard"
                needs_manual_review = True
                reason = f"Cutout rejected to protect bezel/screen ({val_msg}); preserved original"
                working_img = transposed.convert("RGB")
            else:
                status = "removed_light_bg"
                reason = f"Clean perimeter background removal ({bg_stats})"
                transparent_output = True
                working_img = trim_and_pad_transparent(Image.fromarray(cut_arr, mode="RGBA"))
    else:
        status = "kept_original_policy"
        reason = "Background removal disabled by metadata"
        working_img = transposed

    final_img = downscale_if_needed(working_img)
    fw, fh = final_img.size

    os.makedirs(os.path.dirname(output_base_no_ext), exist_ok=True)
    webp_path = output_base_no_ext + ".webp"
    if transparent_output and final_img.mode != "RGBA":
        final_img = final_img.convert("RGBA")

    final_img.save(webp_path, format="WEBP", quality=92, method=6)
    webp_bytes = os.path.getsize(webp_path)

    # Also write PNG only if needed or smaller? For WebP-first delivery keep single optimal WebP;
    # fallback copy .png if WebP unexpectedly grew huge compared to PNG
    out_path = webp_path
    out_format = "webp"
    out_bytes = webp_bytes
    if transparent_output:
        png_tmp = output_base_no_ext + ".png"
        final_img.save(png_tmp, format="PNG", optimize=True)
        png_bytes = os.path.getsize(png_tmp)
        if png_bytes < webp_bytes * 0.9:
            os.remove(webp_path)
            out_path = png_tmp
            out_format = "png"
            out_bytes = png_bytes
        else:
            os.remove(png_tmp)

    return {
        "status": status,
        "needsManualReview": needs_manual_review,
        "reason": reason,
        "transparent": transparent_output,
        "orientation": "portrait" if fh > fw * 1.15 else ("landscape" if fw > fh * 1.15 else "square"),
        "width": fw,
        "height": fh,
        "format": out_format,
        "bytes": out_bytes,
        "outputPath": out_path,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output-base", required=True)
    p.add_argument("--no-bg-removal", action="store_true")
    args = p.parse_args()

    res = process_one(args.input, args.output_base, allow_bg_removal=not args.no_bg_removal)
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
