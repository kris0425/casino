from __future__ import annotations

import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


RESAMPLING = getattr(Image, "Resampling", Image)
PALETTE_ADAPTIVE = getattr(getattr(Image, "Palette", Image), "ADAPTIVE")


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "imagegen" / "lucky_wheel_chroma.png"
OUTPUT_DIR = ROOT / "assets" / "lucky_wheel"
DISC_OUTPUT = OUTPUT_DIR / "wheel_disc.png"
GIF_OUTPUTS = {
    "car": OUTPUT_DIR / "lucky_wheel_car.gif",
    "gold": OUTPUT_DIR / "lucky_wheel_gold.gif",
    "diamond": OUTPUT_DIR / "lucky_wheel_diamond.gif",
    "blank": OUTPUT_DIR / "lucky_wheel_blank.gif",
}

CANVAS_SIZE = 512
DISC_SIZE = 404
FRAME_COUNT = 36
STOP_TURNS = {
    # The source wheel has a car centered beneath the pointer. The other
    # offsets rotate a matching wedge into the fixed top pointer.
    "car": 5.0,
    "blank": 5.0 + 1 / 12,
    "diamond": 5.0 + 10 / 12,
    "gold": 5.0 + 11 / 12,
}


def edge_connected_chroma(source: Image.Image) -> Image.Image:
    """Remove only chroma pixels connected to the canvas edge.

    The source wheel intentionally contains purple prize wedges. A global
    chroma-key operation would damage those wedges, so the mask is flood-filled
    from the outer border and cannot cross the wheel's closed gold rim.
    """

    rgba = source.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    corner_samples = [
        pixels[0, 0][:3],
        pixels[width - 1, 0][:3],
        pixels[0, height - 1][:3],
        pixels[width - 1, height - 1][:3],
    ]
    key = tuple(sum(sample[channel] for sample in corner_samples) // 4 for channel in range(3))
    threshold_sq = 145 * 145

    def is_key(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return (
            (red - key[0]) ** 2
            + (green - key[1]) ** 2
            + (blue - key[2]) ** 2
            <= threshold_sq
        )

    queue: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not visited[index] and is_key(x, y):
            visited[index] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for index, marked in enumerate(visited):
        if marked:
            alpha_pixels[index % width, index // width] = 0

    rgba.putalpha(alpha)
    bbox = rgba.getbbox()
    if not bbox:
        raise RuntimeError("Chroma removal erased the complete wheel")
    return rgba.crop(bbox)


def radial_background() -> Image.Image:
    image = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (4, 8, 24, 255))
    pixels = image.load()
    center_x = CANVAS_SIZE / 2
    center_y = CANVAS_SIZE / 2 + 12
    radius = CANVAS_SIZE * 0.72
    for y in range(CANVAS_SIZE):
        for x in range(CANVAS_SIZE):
            distance = min(1.0, math.hypot(x - center_x, y - center_y) / radius)
            glow = (1.0 - distance) ** 2
            pixels[x, y] = (
                int(4 + 18 * glow),
                int(8 + 8 * glow),
                int(24 + 32 * glow),
                255,
            )
    return image


def draw_frame(
    frame_index: int,
    disc: Image.Image,
    background: Image.Image,
    total_turns: float,
) -> Image.Image:
    progress = frame_index / (FRAME_COUNT - 1)
    eased = 1 - (1 - progress) ** 3
    angle = -(total_turns * 360 * eased)
    wheel = disc.rotate(angle, resample=RESAMPLING.BICUBIC, expand=False)

    frame = background.copy()
    draw = ImageDraw.Draw(frame, "RGBA")
    center = (CANVAS_SIZE // 2, CANVAS_SIZE // 2 + 13)

    # Casino cabinet rings and chasing bulbs.
    for width, color, radius in [
        (18, (49, 26, 7, 255), 227),
        (8, (245, 178, 43, 255), 218),
        (3, (255, 236, 148, 255), 211),
    ]:
        draw.ellipse(
            (
                center[0] - radius,
                center[1] - radius,
                center[0] + radius,
                center[1] + radius,
            ),
            outline=color,
            width=width,
        )

    bulb_radius = 233
    for index in range(32):
        theta = math.radians(index * 360 / 32 - 90)
        x = center[0] + math.cos(theta) * bulb_radius
        y = center[1] + math.sin(theta) * bulb_radius
        hot = (index - frame_index * 2) % 8 in (0, 1)
        if hot:
            draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(255, 184, 35, 55))
        color = (255, 247, 186, 255) if hot else (139, 75, 18, 255)
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=color)

    position = (
        center[0] - DISC_SIZE // 2,
        center[1] - DISC_SIZE // 2,
    )
    frame.alpha_composite(wheel, position)

    # A fixed pointer makes the rotation easy to read.
    pointer_jiggle = int(math.sin(math.radians(angle * 1.1)) * (5 * (1 - progress)))
    pointer_x = center[0] + pointer_jiggle
    draw.polygon(
        [
            (pointer_x - 25, 17),
            (pointer_x + 25, 17),
            (pointer_x, 71),
        ],
        fill=(75, 30, 6, 255),
        outline=(255, 220, 105, 255),
    )
    draw.polygon(
        [
            (pointer_x - 15, 23),
            (pointer_x + 15, 23),
            (pointer_x, 60),
        ],
        fill=(236, 44, 67, 255),
    )

    # The last few frames flash to sell the final stop.
    if frame_index >= FRAME_COUNT - 4:
        flash = (frame_index - (FRAME_COUNT - 4) + 1) / 4
        overlay = Image.new("RGBA", frame.size, (255, 220, 90, int(35 * flash)))
        frame = Image.alpha_composite(frame, overlay)
        frame = ImageEnhance.Contrast(frame).enhance(1.0 + 0.08 * flash)

    return frame.convert("P", palette=PALETTE_ADAPTIVE, colors=192)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing generated wheel source: {SOURCE}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    transparent_disc = edge_connected_chroma(Image.open(SOURCE))
    transparent_disc.save(DISC_OUTPUT, optimize=True)

    disc = transparent_disc.resize((DISC_SIZE, DISC_SIZE), RESAMPLING.LANCZOS)
    background = radial_background()
    durations = (
        [55] * 18
        + [70] * 6
        + [95] * 4
        + [130, 170, 220, 300, 420, 650, 900, 1100]
    )
    print(f"Wrote {DISC_OUTPUT}")
    for result, output in GIF_OUTPUTS.items():
        frames = [
            draw_frame(index, disc, background, STOP_TURNS[result])
            for index in range(FRAME_COUNT)
        ]
        frames[0].save(
            output,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            optimize=True,
            disposal=2,
        )
        print(f"Wrote {output} ({output.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
