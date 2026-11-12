# Обкладинка для itch.io: key art (art/gen/cover_itch.png) → обрізка до 630:500 по центру → назва гри як у меню
# (Trebuchet MS Bold, кремова з темно-червоним контуром, золоті зірочки) → 1260×1000 і 630×500 у builds/itch/.
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
src = Image.open('art/gen/cover_itch.png').convert('RGBA'); W, H = src.size
cw = round(H * 630 / 500); x0 = (W - cw) // 2 + 20                     # +20 — трохи правіше, щоб не різати банду
im = src.crop((x0, 0, x0 + cw, H)).resize((1260, 1000), Image.LANCZOS)
title, font = 'Ялинка до світанку', ImageFont.truetype('C:/Windows/Fonts/trebucbd.ttf', 96)
d = ImageDraw.Draw(im); tw = d.textlength(title, font=font); tx, ty = (1260 - tw) / 2, 22
# м'яке темне сяйво під назвою — щоб читалась на будь-якому небі
glow = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(glow).text((tx, ty), title, font=font, fill=(10, 8, 30, 230), stroke_width=18, stroke_fill=(10, 8, 30, 230))
im = Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(14)))
d = ImageDraw.Draw(im); d.text((tx, ty), title, font=font, fill='#ffe7b0', stroke_width=7, stroke_fill='#5a1018')
def star(cx, cy, r, col):                                              # п'ятикутна зірочка, як у меню
    pts = [(cx + (r if k % 2 == 0 else r * 0.45) * math.sin(k * math.pi / 5), cy - (r if k % 2 == 0 else r * 0.45) * math.cos(k * math.pi / 5)) for k in range(10)]
    d.polygon(pts, fill=col, outline='#5a1018', width=3)
star(tx - 46, ty + 62, 30, '#ffd66b'); star(tx + tw + 46, ty + 62, 30, '#ffd66b')
os.makedirs('../../builds/itch', exist_ok=True)
im.convert('RGB').save('../../builds/itch/cover_1260x1000.png'); im.convert('RGB').resize((630, 500), Image.LANCZOS).save('../../builds/itch/cover_630x500.png')
print('ok', tw)
