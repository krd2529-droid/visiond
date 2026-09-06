from pathlib import Path
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter
import math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "vx-home-banner-base-v014583.png"
TARGET = ROOT / "public" / "assets" / "vx-home-banner-v014583.gif"
base = Image.open(SOURCE).convert("RGB").resize((1200, 400), Image.Resampling.LANCZOS)
frames = []
for i in range(24):
    phase = i / 24
    frame = ImageEnhance.Brightness(base).enhance(0.91 + 0.05 * math.sin(phase * math.tau))
    glow = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    x = int(-150 + phase * 670)
    draw.polygon([(x, 25), (x + 80, 25), (x - 25, 380), (x - 105, 380)], fill=(119, 255, 242, 42))
    strength = int(80 + 100 * (0.5 + 0.5 * math.sin(phase * math.tau * 2)))
    for sx, sy in [(75, 60), (430, 80), (1140, 60), (1065, 335)]:
        radius = 5 + int(4 * (0.5 + 0.5 * math.sin(phase * math.tau + sx)))
        draw.line((sx-radius*3, sy, sx+radius*3, sy), fill=(130,255,239,strength), width=2)
        draw.line((sx, sy-radius*3, sx, sy+radius*3), fill=(255,244,184,strength), width=2)
    glow = glow.filter(ImageFilter.GaussianBlur(4))
    frames.append(Image.alpha_composite(frame.convert("RGBA"), glow).convert("P", palette=Image.Palette.ADAPTIVE, colors=64))
frames[0].save(TARGET, save_all=True, append_images=frames[1:], duration=90, loop=0, disposal=2, optimize=True)
print(f"created {TARGET} ({len(frames)} frames, {TARGET.stat().st_size} bytes)")
