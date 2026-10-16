# tools/split_arms.py — ділить верх персонажа на два шари: ТІЛО з «домальованим» місцем під руками і РУКИ окремо.
# Навіщо: рука, що махає, відкриває те, що було під нею, а генератор там нічого не малював → темні щілини.
# Домальовуємо просто: кожен піксель під рукою бере колір найближчого пікселя тіла поза рукою (продовження халата),
# потім легке розмиття всередині, щоб не було смуг. Прозорість теж з найближчого — за контуром тіла лишається прозоро.
#   python tools/split_arms.py NAME   (бере art/src/NAME_orig.png і полігони кісток з art/softbones.json → NAME + NAME_arms)
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
name = sys.argv[1]; cfg = json.load(open('art/softbones.json'))
src = Image.open(f'art/src/{name}_orig.png').convert('RGBA'); A = np.array(src).astype(np.float32); H, W = A.shape[:2]
mk = Image.new('L', (W, H), 0); d = ImageDraw.Draw(mk)
for b in cfg[name + '_arms']['bones']: d.polygon([tuple(p) for p in b['poly']], fill=255)
hard = np.array(mk) > 127
# шар рук: оригінальні пікселі в межах рук (м'який край на 2 px)
soft = np.array(mk.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
arms = A.copy(); arms[:, :, 3] *= soft
# тіло: під руками домальовуємо ПО РЯДКАХ. Для кожного відрізка руки в рядку дивимось на сусідів зліва й справа:
#  - тіло з обох боків → це всередині силуету: плавно переходимо від кольору лівого сусіда до правого;
#  - тіло лише з одного боку → продовжуємо його на D px (халат трохи «заходить» під руку), далі прозоро;
#  - порожньо з обох боків → прозоро. Так заливка ніколи не вилазить за контур тіла.
D = 34
grow = ndimage.binary_dilation(hard, iterations=2)
body = A.copy(); body[grow] = 0
for y in range(H):
    xs = np.where(grow[y])[0]
    if not len(xs): continue
    runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
    for r in runs:
        x0, x1 = r[0], r[-1]; Lp = A[y, x0 - 1] if x0 > 0 else np.zeros(4); Rp = A[y, x1 + 1] if x1 + 1 < W else np.zeros(4)
        lo, ro = Lp[3] > 128, Rp[3] > 128; n = x1 - x0 + 1
        if lo and ro: q = np.linspace(0, 1, n)[:, None]; body[y, x0:x1 + 1] = Lp * (1 - q) + Rp * q
        elif lo: m = min(n, D); body[y, x0:x0 + m] = Lp
        elif ro: m = min(n, D); body[y, x1 + 1 - m:x1 + 1] = Rp
blur = np.stack([ndimage.gaussian_filter(body[:, :, c], 2.5) for c in range(4)], -1)
body[grow] = blur[grow]
Image.fromarray(np.clip(body, 0, 255).astype(np.uint8)).save(f'art/gen/{name}.png')
Image.fromarray(np.clip(arms, 0, 255).astype(np.uint8)).save(f'art/gen/{name}_arms.png')
print('split', name, W, H)
