from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "public" / "assets" / "visiond-bundle-promo.gif"
FONT = ImageFont.truetype(r"C:\Windows\Fonts\tahomabd.ttf", 29)
CARDS = [
    ((440, 143, 590, 181), "ลด 15%", (20, 185, 184), (255, 255, 255)),
    ((623, 143, 773, 181), "ลด 25%", (220, 227, 229), (0, 72, 69)),
    ((805, 143, 955, 181), "ลด 50%", (220, 227, 229), (0, 72, 69)),
    ((987, 143, 1137, 181), "ลด 75%", (220, 227, 229), (0, 72, 69)),
]

source = Image.open(TARGET)
frames = []
durations = []
for index in range(source.n_frames):
    source.seek(index)
    frame = source.convert("RGB")
    draw = ImageDraw.Draw(frame)
    for box, text, background, foreground in CARDS:
        draw.rectangle(box, fill=background)
        center_x = (box[0] + box[2]) // 2
        center_y = (box[1] + box[3]) // 2
        draw.text((center_x, center_y), text, font=FONT, fill=foreground, anchor="mm", stroke_width=0)
    frames.append(frame)
    durations.append(source.info.get("duration", 1000))

frames[0].save(
    TARGET,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=source.info.get("loop", 0),
    disposal=2,
    optimize=False,
)
print(f"updated {TARGET} ({len(frames)} frames, {frames[0].size[0]}x{frames[0].size[1]})")
