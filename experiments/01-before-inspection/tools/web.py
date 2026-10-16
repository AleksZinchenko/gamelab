# tools/web.py — запускати ПІСЛЯ prep.py: стискає текстури для телефона й повільного тунелю.
# 1) великі непрозорі фони → JPEG (гра бере їх замість PNG, список — SCENE.JPG у live/scene.js): ~3 МБ → ~350 КБ;
# 2) дрібні спрайти інтерфейсу (піктограми, бульбашки, предмети) → PNG з палітрою 128 кольорів: у ~3 рази менші,
#    на око різниці нема (олівець і гуаш мають мало відтінків).
import glob, os
from PIL import Image
for n in ('bg_room_a', 'bg_room_b'):
    Image.open(f'live/assets/{n}.png').convert('RGB').save(f'live/assets/{n}.jpg', quality=86, optimize=True, progressive=True)
before = after = 0
for f in glob.glob('live/assets/p_*.png') + glob.glob('live/assets/bub_*.png') + glob.glob('live/assets/it_*.png') + glob.glob('live/assets/hud_*.png'):
    before += os.path.getsize(f)
    Image.open(f).convert('RGBA').quantize(128, method=Image.FASTOCTREE).save(f, optimize=True)
    after += os.path.getsize(f)
print(f'jpg фони; ui png {before // 1024} КБ → {after // 1024} КБ')
