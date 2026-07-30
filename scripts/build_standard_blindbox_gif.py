from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "blindbox"
BASE_PATH = ASSET_DIR / "standard_pack_preview.png"
OPEN_PATH = ASSET_DIR / "standard_pack_open_keyframe.png"
OUTPUT_PATH = ASSET_DIR / "standard_pack_opening.gif"
SIZE = (640, 480)


def cover(image: Image.Image) -> Image.Image:
    source = image.convert("RGB")
    source_ratio = source.width / source.height
    target_ratio = SIZE[0] / SIZE[1]
    if source_ratio > target_ratio:
        width = round(source.height * target_ratio)
        left = (source.width - width) // 2
        source = source.crop((left, 0, left + width, source.height))
    elif source_ratio < target_ratio:
        height = round(source.width / target_ratio)
        top = (source.height - height) // 2
        source = source.crop((0, top, source.width, top + height))
    return source.resize(SIZE, Image.Resampling.LANCZOS)


def offset_frame(image: Image.Image, x: int, y: int) -> Image.Image:
    frame = Image.new("RGB", SIZE, (10, 9, 25))
    frame.paste(image, (x, y))
    if x > 0:
        frame.paste(image.crop((0, 0, x, SIZE[1])), (0, y))
    elif x < 0:
        frame.paste(image.crop((SIZE[0] + x, 0, SIZE[0], SIZE[1])), (SIZE[0] + x, y))
    return frame


def glow_frame(image: Image.Image, strength: float) -> Image.Image:
    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    center = (320, 285)
    for radius in range(150, 8, -8):
        falloff = 1 - radius / 150
        alpha = round(70 * strength * falloff)
        color = (255, 190 + round(55 * falloff), 70, alpha)
        draw.ellipse(
            (
                center[0] - radius,
                center[1] - radius * 0.55,
                center[0] + radius,
                center[1] + radius * 0.55,
            ),
            fill=color,
        )
    return Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")


def quantize(frame: Image.Image) -> Image.Image:
    return frame.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)


def main() -> None:
    base = cover(Image.open(BASE_PATH))
    opened = cover(Image.open(OPEN_PATH))
    frames: list[Image.Image] = []
    durations: list[int] = []

    def add(frame: Image.Image, duration: int) -> None:
        frames.append(quantize(frame))
        durations.append(duration)

    add(ImageEnhance.Brightness(base).enhance(0.82), 300)
    add(base, 240)
    add(ImageEnhance.Brightness(base).enhance(1.08), 180)

    for x, y in ((-4, 0), (5, -1), (-7, 1), (7, -2), (-5, 1), (4, 0), (-2, 0), (0, 0)):
        add(offset_frame(base, x, y), 70)

    for strength in (0.25, 0.48, 0.72, 1.0):
        add(glow_frame(base, strength), 95)

    white = Image.new("RGB", SIZE, "white")
    add(Image.blend(opened, white, 0.22), 75)
    add(Image.blend(opened, white, 0.62), 80)
    add(Image.blend(opened, white, 0.88), 90)
    add(Image.blend(opened, white, 0.35), 110)
    add(opened, 950)

    frames[0].save(
        OUTPUT_PATH,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"{OUTPUT_PATH} | {OUTPUT_PATH.stat().st_size} bytes | {sum(durations)} ms | {len(frames)} frames")


if __name__ == "__main__":
    main()
