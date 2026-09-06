from pathlib import Path
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter
import math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "vx-home-banner-base-v014583.png"
TARGET = ROOT / "public" / "assets" / "vx-home-banner-v014583.gif"
source = Image.open(SOURCE).convert("RGB")
target_ratio = 1600 / 260
crop_height = int(source.width / target_ratio)
top = (source.height - crop_height) // 2
base = source.crop((0, top, source.width, top + crop_height)).resize((1600, 260), Image.Resampling.LANCZOS)
teal = Image.new("RGB", base.size, (20, 155, 145))
base = Image.blend(ImageEnhance.Brightness(base).enhance(1.7), teal, 0.42)
frames = []
for i in range(24):
    phase = i / 24
    frame = ImageEnhance.Brightness(base).enhance(0.91 + 0.05 * math.sin(phase * math.tau))
    glow = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    x = int(-180 + phase * 900)
    draw.polygon([(x, 12), (x + 85, 12), (x - 20, 248), (x - 105, 248)], fill=(119, 255, 242, 48))
    strength = int(80 + 100 * (0.5 + 0.5 * math.sin(phase * math.tau * 2)))
    for sx, sy in [(80, 42), (530, 58), (1510, 42), (1420, 220)]:
        radius = 5 + int(4 * (0.5 + 0.5 * math.sin(phase * math.tau + sx)))
        draw.line((sx-radius*3, sy, sx+radius*3, sy), fill=(130,255,239,strength), width=2)
        draw.line((sx, sy-radius*3, sx, sy+radius*3), fill=(255,244,184,strength), width=2)
    glow = glow.filter(ImageFilter.GaussianBlur(4))
    frames.append(Image.alpha_composite(frame.convert("RGBA"), glow).convert("P", palette=Image.Palette.ADAPTIVE, colors=64))
frames[0].save(TARGET, save_all=True, append_images=frames[1:], duration=90, loop=0, disposal=2, optimize=True)
print(f"created {TARGET} ({len(frames)} frames, {TARGET.stat().st_size} bytes)")
