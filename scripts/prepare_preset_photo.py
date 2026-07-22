#!/usr/bin/env python3
"""Extract the vehicle photo area from a generated garage card."""

import argparse
from pathlib import Path

from PIL import Image, ImageOps


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--crop-height", type=int, required=True)
    args = parser.parse_args()

    image = ImageOps.exif_transpose(Image.open(args.input)).convert("RGB")
    crop_height = max(1, min(args.crop_height, image.height))
    photo = image.crop((0, 0, image.width, crop_height))
    photo = photo.resize((1280, 570), Image.Resampling.LANCZOS)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    photo.save(output, "PNG", optimize=True)


if __name__ == "__main__":
    main()
