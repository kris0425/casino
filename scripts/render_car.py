#!/usr/bin/env python3
import argparse
import json
import os
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


CANVAS_SIZE = (1280, 720)
PHOTO_SIZE = (1280, 545)
PANEL_Y = PHOTO_SIZE[1]
PAINT_COLORS = {
    "factory": None,
    "white": "#f5f5f5",
    "black": "#15171b",
    "yellow": "#ffd21f",
    "red": "#d6242f",
    "blue": "#1565c0",
    "purple": "#7b1fa2",
    "green": "#149c55",
}

PAINT_RAMPS = {
    "white": ("#555b63", "#d5d9de", "#ffffff"),
    "black": ("#020304", "#1f252c", "#77818d"),
    "yellow": ("#6b4500", "#ffc400", "#fff4aa"),
    "red": ("#3c0508", "#c81825", "#ffb0a8"),
    "blue": ("#031c43", "#1262b9", "#a7d8ff"),
    "purple": ("#25033c", "#7925a8", "#deb3ff"),
    "green": ("#02351c", "#14945a", "#a7f2c6"),
}

UI_ACCENTS = {
    # Dark paint is attractive on the vehicle but unreadable on the dark UI.
    "black": "#ffc400",
}


def font(size, bold=False):
    candidates = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def load_rgba(path, size=None):
    image = Image.open(path)
    image = ImageOps.exif_transpose(image).convert("RGBA")
    if size and image.size != size:
        image = image.resize(size, Image.Resampling.LANCZOS)
    return image


def apply_paint(base, layer_root, paint_id):
    color = PAINT_COLORS.get(paint_id)
    mask_path = layer_root / "body_mask.png"
    if not color or not mask_path.exists():
        return base, False
    mask = Image.open(mask_path).convert("L")
    if mask.size != base.size:
        mask = mask.resize(base.size, Image.Resampling.LANCZOS)
    shadow, midtone, highlight = PAINT_RAMPS.get(paint_id, ("#222222", color, "#ffffff"))
    luminance = ImageOps.grayscale(base.convert("RGB"))
    tinted = ImageOps.colorize(
        luminance,
        black=shadow,
        mid=midtone,
        white=highlight,
        blackpoint=18,
        midpoint=128,
        whitepoint=240,
    ).convert("RGBA")
    return Image.composite(tinted, base, mask), True


def apply_layer(base, layer_root, category, option_id, variant_id=None):
    if option_id in (None, "stock", "none"):
        return base, False
    candidates = []
    if variant_id not in (None, "none"):
        candidates.append(layer_root / category / f"{variant_id}_{option_id}.png")
    candidates.append(layer_root / category / f"{option_id}.png")
    path = next((candidate for candidate in candidates if candidate.exists()), candidates[-1])
    if not path.exists():
        return base, False
    overlay = load_rgba(path)
    # A part layer is only safe when it was authored against this exact base.
    # Resizing a different camera/layout makes wheel arches and aero parts drift.
    if overlay.size != base.size:
        return base, False
    return Image.alpha_composite(base, overlay), True


def load_preset(layer_root, config):
    preset_id = "{}_{}_{}_{}.png".format(
        config.get("paint", "factory"),
        config.get("widebody", "stock"),
        config.get("wheels", "stock"),
        config.get("spoiler", "stock"),
    )
    preset_root = layer_root / "presets"
    path = preset_root / preset_id
    requested_parts = any(config.get(category, "stock") not in (None, "stock", "none") for category in ("widebody", "wheels", "spoiler"))
    widebody_paint_path = preset_root / "{}_{}_stock_stock.png".format(
        config.get("paint", "factory"),
        config.get("widebody", "stock"),
    )
    stock_paint_path = preset_root / f"{config.get('paint', 'factory')}_stock_stock_stock.png"
    if path.exists():
        exact_preset = load_rgba(path)
        if exact_preset.size == PHOTO_SIZE:
            return exact_preset, {"paint", "widebody", "wheels", "spoiler"}
    # Prefer the selected paint + widebody base, then composite wheel/spoiler
    # layers. This keeps the chosen kit when an exact wheel preset is absent.
    if requested_parts and widebody_paint_path.exists():
        widebody_preset = load_rgba(widebody_paint_path)
        if widebody_preset.size == PHOTO_SIZE:
            return widebody_preset, {"paint", "widebody"}
    # Otherwise begin with the verified stock-position paint image. Individual
    # layers are then applied only if their canvas matches.
    if requested_parts and stock_paint_path.exists():
        stock_preset = load_rgba(stock_paint_path)
        if stock_preset.size == PHOTO_SIZE:
            return stock_preset, {"paint"}
    return None, set()


def clean_asset_name(value):
    value = str(value or "Vehicle")
    # Noto CJK does not include every emoji. Remove only unsupported leading
    # decoration so Discord cards do not start with a tofu square.
    return re.sub(r"^[^0-9A-Za-z\u3400-\u9fff]+", "", value).strip() or "Vehicle"


def rating_bar(draw, x, y, label, value, color):
    draw.text((x, y), label, font=font(25, True), fill="#ffffff")
    start = x + 95
    for index in range(5):
        fill = color if index < value else "#39404b"
        draw.rounded_rectangle((start + index * 38, y + 3, start + index * 38 + 28, y + 25), radius=6, fill=fill)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--layers", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--config", default="{}")
    parser.add_argument("--config-file")
    args = parser.parse_args()

    config = json.loads(Path(args.config_file).read_text(encoding="utf-8") if args.config_file else args.config)
    layer_root = Path(args.layers)
    base = load_rgba(args.base)
    applied = []

    preset, preset_applied = load_preset(layer_root, config)
    missing_layers = []
    if preset is not None:
        base = preset
        applied.extend(preset_applied)
    else:
        base, changed = apply_paint(base, layer_root, config.get("paint", "factory"))
        if changed:
            applied.append("paint")
    for category in ("widebody", "wheels", "spoiler"):
        if category in preset_applied:
            continue
        option_id = config.get(category, "stock")
        variant_id = config.get("widebody", "stock") if category == "wheels" else None
        base, changed = apply_layer(base, layer_root, category, option_id, variant_id)
        if changed:
            applied.append(category)
        elif option_id not in (None, "stock", "none"):
            missing_layers.append(category)

    photo = ImageOps.fit(base, PHOTO_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    canvas = Image.new("RGBA", CANVAS_SIZE, "#11151b")
    canvas.alpha_composite(photo, (0, 0))

    accent = UI_ACCENTS.get(config.get("paint")) or PAINT_COLORS.get(config.get("paint")) or "#7c4dff"
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, PANEL_Y, 1280, 720), fill="#171c24")
    draw.rectangle((0, PANEL_Y, 12, 720), fill=accent)
    draw.text((32, 560), clean_asset_name(config.get("asset_name", "Vehicle")), font=font(31, True), fill="#ffffff")

    labels = config.get("labels", {})
    exterior_line_1 = "烤漆：{}　輪框：{}".format(labels.get("paint", "原廠"), labels.get("wheels", "原廠"))
    exterior_line_2 = "尾翼：{}　寬體：{}".format(labels.get("spoiler", "原廠"), labels.get("widebody", "原廠"))
    draw.text((32, 607), exterior_line_1, font=font(18), fill="#cbd2dc")
    draw.text((32, 637), exterior_line_2, font=font(18), fill="#cbd2dc")
    draw.text((32, 675), "引擎：{}　懸吊：{}".format(labels.get("engine", "原廠"), labels.get("suspension", "原廠")), font=font(18), fill="#9fa9b8")

    stats = config.get("stats", {})
    rating_bar(draw, 790, 563, "速度", int(stats.get("speed", 1)), accent)
    rating_bar(draw, 790, 613, "加速", int(stats.get("acceleration", 1)), accent)
    rating_bar(draw, 790, 663, "操控", int(stats.get("handling", 1)), accent)

    if missing_layers:
        draw.rounded_rectangle((925, 495, 1250, 535), radius=10, fill="#11151bcc", outline="#e0a800")
        draw.text((944, 501), "此外觀素材正在重新校準", font=font(18, True), fill="#ffd54f")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(".tmp.png")
    canvas.convert("RGB").save(temp, "PNG", optimize=True)
    temp.replace(output)


if __name__ == "__main__":
    main()
