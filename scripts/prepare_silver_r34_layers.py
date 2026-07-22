#!/usr/bin/env python3
"""Align generated pixel-art parts to the silver R34 reference canvas."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


LAYER_SIZE = (1536, 1024)


def paste_scaled(canvas, source, box, scale, position):
    part = source.crop(box)
    size = (max(1, round(part.width * scale)), max(1, round(part.height * scale)))
    part = part.resize(size, Image.Resampling.NEAREST)
    canvas.alpha_composite(part, position)


def align_spoiler(source):
    output = Image.new("RGBA", LAYER_SIZE, (0, 0, 0, 0))
    bbox = source.getchannel("A").getbbox()
    if bbox:
        paste_scaled(output, source, bbox, 0.42, (1150, 365))
    return output


def align_widebody(source):
    output = Image.new("RGBA", LAYER_SIZE, (0, 0, 0, 0))
    # Visible front arch, side skirt, and rear arch are positioned
    # independently because the generated donor kit used a different wheelbase.
    # Wheel centres on the 1536x1024 layer canvas are approximately
    # (1020, 732) and (1365, 660). Scale around those anchors so the inner
    # opening clears the tyre instead of covering it.
    paste_scaled(output, source, (470, 400, 850, 770), 1.05, (805, 470))
    paste_scaled(output, source, (750, 650, 1330, 810), 0.75, (875, 705))
    paste_scaled(output, source, (1230, 390, 1510, 740), 1.00, (1215, 450))
    # Remove a donor-kit mounting tab below the skirt; it is not a visible
    # part of the R34 widebody and otherwise appears to float under the car.
    output.paste((0, 0, 0, 0), (1080, 780, 1220, 920))
    return output


def make_body_mask(base):
    base = ImageOps.exif_transpose(base).convert("RGB")
    mask = Image.new("L", base.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon([
        (230, 690), (230, 555), (280, 485), (505, 410), (650, 390),
        (805, 405), (900, 365), (1025, 350), (1135, 390), (1190, 455),
        (1205, 555), (1170, 620), (1090, 655), (925, 660), (760, 690),
    ], fill=255)

    # Roof rails and pillars are separate from the lower body silhouette.
    draw.polygon([
        (500, 415), (635, 315), (875, 300), (1015, 335), (1105, 395),
        (1080, 440), (930, 420), (895, 365), (655, 345), (520, 430),
    ], fill=255)

    # Preserve glass, lamps, grilles, tyres, and the original shadow detail.
    draw.polygon([(515, 405), (650, 330), (885, 315), (910, 410)], fill=0)
    draw.polygon([(910, 365), (1025, 350), (1100, 395), (1080, 430), (930, 415)], fill=0)
    draw.ellipse((776, 500, 925, 720), fill=0)
    draw.ellipse((1080, 455, 1205, 655), fill=0)
    draw.polygon([(270, 500), (335, 495), (335, 565), (265, 565)], fill=0)
    draw.polygon([(340, 510), (550, 505), (550, 563), (338, 563)], fill=0)
    draw.polygon([(560, 495), (735, 490), (735, 562), (558, 562)], fill=0)
    draw.polygon([(315, 580), (555, 580), (555, 680), (300, 675)], fill=0)
    draw.polygon([(585, 585), (715, 585), (715, 660), (580, 660)], fill=0)

    # The renderer derives highlights and shadows from the original luminance,
    # so the complete panel mask can be recoloured without patchy blue remnants.
    return mask.filter(ImageFilter.GaussianBlur(0.6))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--spoiler-source", required=True)
    parser.add_argument("--widebody-source", required=True)
    parser.add_argument("--output-root", required=True)
    args = parser.parse_args()

    root = Path(args.output_root)
    (root / "spoiler").mkdir(parents=True, exist_ok=True)
    (root / "widebody").mkdir(parents=True, exist_ok=True)

    spoiler = Image.open(args.spoiler_source).convert("RGBA")
    widebody = Image.open(args.widebody_source).convert("RGBA")
    align_spoiler(spoiler).save(root / "spoiler" / "gt_wing.png", optimize=True)
    align_widebody(widebody).save(root / "widebody" / "liberty_walk.png", optimize=True)
    make_body_mask(Image.open(args.base)).save(root / "body_mask.png", optimize=True)


if __name__ == "__main__":
    main()
