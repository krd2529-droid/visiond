from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFont
import math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "vx-paired-banner-master-v014585.png"
LOGO_SOURCE = ROOT / "public" / "assets" / "vx-logo-source-v014587.png"
TARGET = ROOT / "public" / "assets" / "visiond-bundle-promo.gif"
BOLD = r"C:\Windows\Fonts\LeelaUIb.ttf"

def font(size): return ImageFont.truetype(BOLD, size)

source = Image.open(SOURCE).convert("RGB")
crop_height = int(source.width / (1600 / 260))
top = max(0, (source.height - crop_height) // 2)
base = source.crop((0, top, source.width, top + crop_height)).resize((1600, 260), Image.Resampling.LANCZOS)
logo = Image.open(LOGO_SOURCE).convert("RGB").crop((115, 145, 910, 615)).resize((105, 62), Image.Resampling.LANCZOS)
logo_alpha = logo.convert("L").point(lambda value: 0 if value < 12 else min(235, (value - 8) * 3))
logo = logo.convert("RGBA")
logo.putalpha(logo_alpha)
cards = [(435, "5 ตะกร้า", "ลด 15%"), (620, "10 ตะกร้า", "ลด 25%"), (805, "20 ตะกร้า", "ลด 50%"), (990, "30 ตะกร้า", "ลด 75%")]
frames = []
for index in range(24):
    phase = index / 24
    frame = ImageEnhance.Brightness(base).enhance(0.96 + 0.035 * math.sin(phase * math.tau))
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((390, 18, 1210, 242), radius=24, fill=(0, 31, 32, 226), outline=(38, 189, 180, 255), width=2)
    layer.alpha_composite(logo, (405, 27))
    draw.text((815, 52), "จัดชุดยิ่งเยอะ ยิ่งลด", font=font(43), fill="white", anchor="mm")
    active = (index // 6) % 4
    for card_index, (x, title, discount) in enumerate(cards):
        fill = (17, 184, 176, 255) if card_index == active else (228, 235, 234, 255)
        ink = "white" if card_index == active else (3, 65, 61)
        outline = (255, 215, 126, 255) if card_index == active else (228, 235, 234, 255)
        draw.rounded_rectangle((x, 83, x + 170, 177), radius=15, fill=fill, outline=outline, width=3)
        draw.text((x + 85, 111), title, font=font(22), fill=ink, anchor="mm")
        draw.text((x + 85, 148), discount, font=font(29), fill=ink, anchor="mm")
    draw.text((800, 213), "เลือกสินค้าได้สูงสุด 30 ตะกร้า • ระบบคำนวณส่วนลดอัตโนมัติ", font=font(24), fill="white", anchor="mm")
    frames.append(Image.alpha_composite(frame.convert("RGBA"), layer).convert("P", palette=Image.Palette.ADAPTIVE, colors=128))

frames[0].save(TARGET, save_all=True, append_images=frames[1:], duration=90, loop=0, disposal=2, optimize=True)
print(f"created {TARGET} ({len(frames)} frames, {TARGET.stat().st_size} bytes)")
