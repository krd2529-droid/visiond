from pathlib import Path
from PIL import Image, ImageEnhance
import math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "vx-paired-banner-master-v014585.png"
TARGET = ROOT / "public" / "assets" / "vx-home-banner-v014583.gif"

source = Image.open(SOURCE).convert("RGB")
crop_height = int(source.width / (1600 / 260))
top = max(0, (source.height - crop_height) // 2)
base = source.crop((0, top, source.width, top + crop_height)).resize((1600, 260), Image.Resampling.LANCZOS)
frames = []
palette = base.convert("P", palette=Image.Palette.ADAPTIVE, colors=96)
for index in range(24):
    phase = index / 24
    frame = ImageEnhance.Brightness(base).enhance(0.96 + 0.035 * math.sin(phase * math.tau))
    frames.append(frame.quantize(palette=palette))

frames[0].save(TARGET, save_all=True, append_images=frames[1:], duration=90, loop=0, disposal=2, optimize=True)
print(f"created {TARGET} ({len(frames)} frames, {TARGET.stat().st_size} bytes)")
