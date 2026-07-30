#!/usr/bin/env python3
"""Create exact RX-7 preset variants from geometry-verified yellow masters."""

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ATTACHMENTS = Path(r"C:\Users\krisc\.codex\codex-remote-attachments\019f6ad3-97da-7b10-9e90-cc7fd2c75051\6F2EC264-2D04-4C66-80D5-3791F1B76506")
DEFAULT_PRESETS = ROOT / "assets" / "mod_layers" / "rocket_bunny_rx7" / "presets"
PHOTO_SIZE = (1280, 545)

MASTER_FILES = {
    "rocket_bunny_bbs_lm_stock": "1.jpg",
    "competition_forged_stock": "2.jpg",
    "competition_te37_stock": "3.jpg",
}

RAMPS = {
    "factory": ("#24282e", "#9da3aa", "#ffffff"),
    "white": ("#555b63", "#d5d9de", "#ffffff"),
    "black": ("#020304", "#1f252c", "#77818d"),
    "yellow": ("#6b4500", "#ffc400", "#fff4aa"),
    "red": ("#3c0508", "#c81825", "#ffb0a8"),
    "blue": ("#031c43", "#1262b9", "#a7d8ff"),
    "purple": ("#25033c", "#7925a8", "#deb3ff"),
    "green": ("#02351c", "#14945a", "#a7f2c6"),
}

# The mask is limited to the vehicle envelope so yellow garage lights and wet
# pavement reflections stay unchanged. Color selection then isolates the paint.
CAR_POLYGON = [
    (272, 450), (294, 350), (344, 280), (525, 210), (616, 150),
    (900, 145), (1015, 170), (1125, 208), (1132, 404), (1078, 452),
    (926, 475), (661, 478), (438, 470),
]

def crop_photo(path: Path) -> Image.Image:
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if image.size != (1280, 720):
        image = ImageOps.fit(image, (1280, 720), method=Image.Resampling.LANCZOS)
    return image.crop((0, 0, *PHOTO_SIZE))


def paint_mask(image: Image.Image) -> Image.Image:
    hsv = image.convert("HSV")
    hue, saturation, value = hsv.split()
    hue_mask = hue.point(lambda pixel: 255 if 20 <= pixel <= 58 else 0)
    saturation_mask = saturation.point(lambda pixel: 255 if pixel >= 72 else 0)
    value_mask = value.point(lambda pixel: 255 if pixel >= 45 else 0)
    mask = Image.composite(hue_mask, Image.new("L", image.size), saturation_mask)
    mask = Image.composite(mask, Image.new("L", image.size), value_mask)

    envelope = Image.new("L", image.size)
    envelope_draw = ImageDraw.Draw(envelope)
    envelope_draw.polygon(CAR_POLYGON, fill=255)
    mask = Image.composite(mask, Image.new("L", image.size), envelope)
    # Close tiny JPEG gaps while retaining panel edges and wheel openings.
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    return mask


def recolor(image: Image.Image, mask: Image.Image, ramp: tuple[str, str, str]) -> Image.Image:
    shadow, midtone, highlight = ramp
    luminance = ImageOps.grayscale(image)
    tinted = ImageOps.colorize(
        luminance,
        black=shadow,
        mid=midtone,
        white=highlight,
        blackpoint=16,
        midpoint=128,
        whitepoint=244,
    )
    return Image.composite(tinted, image, mask)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_ATTACHMENTS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_PRESETS)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for combination, filename in MASTER_FILES.items():
        source = args.input_dir / filename
        master = crop_photo(source)
        mask = paint_mask(master)
        for paint, ramp in RAMPS.items():
            output = args.output_dir / f"{paint}_{combination}.png"
            result = master if paint == "yellow" else recolor(master, mask, ramp)
            result.save(output, "PNG", optimize=True)
            written.append(output)
    print(f"generated={len(written)}")
    for output in written:
        print(output)


if __name__ == "__main__":
    main()
