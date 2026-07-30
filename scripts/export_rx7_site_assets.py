#!/usr/bin/env python3
"""Export the repaired RX-7 exact presets as web-optimized JPEG files."""

import argparse
from pathlib import Path

from PIL import Image


COMBINATIONS = (
    "rocket_bunny_bbs_lm_stock",
    "competition_forged_stock",
    "competition_te37_stock",
)
PAINTS = ("factory", "white", "black", "yellow", "red", "blue", "purple", "green")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    for paint in PAINTS:
        for combination in COMBINATIONS:
            source = args.input_dir / f"{paint}_{combination}.png"
            output = args.output_dir / f"{paint}_{combination}.jpg"
            image = Image.open(source).convert("RGB")
            if image.size != (1280, 545):
                raise ValueError(f"Unexpected image size for {source}: {image.size}")
            image.save(output, "JPEG", quality=89, optimize=True, progressive=True, subsampling=1)
            written += 1
    print(f"generated={written}")


if __name__ == "__main__":
    main()
