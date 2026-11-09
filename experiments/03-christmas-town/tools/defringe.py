# tools/defringe.py — знімає «наліпковий» світлий обідок і кольорову бахрому навколо спрайта.
# Чому: gpt-image на пласкому пурпуровому фоні іноді малює біле обведення, як у наліпки, а після вирізання фону
# по краю лишаються рожеві/зелені пікселі. На темному нічному небі гри це світиться.
# Як: шар за шаром (до --max проходів) дивимось на крайові непрозорі пікселі й прибираємо ті, що «підозрілі»:
# світлі й майже сірі, напівпрозорі або дивного кольору (пурпур, кислотний). Темний контур малюнка зупиняє очистку.
#   python tools/defringe.py IN.png [OUT.png] [--max 12]
import sys, argparse
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser(); ap.add_argument('inp'); ap.add_argument('out', nargs='?'); ap.add_argument('--max', type=int, default=12)
a = ap.parse_args()
im = np.array(Image.open(a.inp).convert('RGBA')).astype(np.float32)
rgb, al = im[..., :3] / 255, im[..., 3]
mx, mn = rgb.max(-1), rgb.min(-1)
lum = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
sat = (mx - mn) / np.maximum(mx, 1e-3)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# «підозрілі» пікселі: світло-сірі (обідок), пурпурові (залишок фону), кислотно-зелені/жовті (артефакт вирізання)
sus = ((lum > 0.60) & (sat < 0.30)) | ((r > g + 0.15) & (b > g + 0.15)) | ((g > b + 0.25) & (lum > 0.45) & (r < g + 0.1))
solid = al > 8
removed = 0
for i in range(a.max):
    # край = непрозорий піксель, у якого хоч один сусід прозорий
    edge = solid & ~ndimage.binary_erosion(solid, structure=np.ones((3, 3)), border_value=0)
    kill = edge & (sus | (al < 240))
    n = int(kill.sum())
    if n == 0: break
    solid &= ~kill; removed += n
# дрібні острівці (крапки бахроми, що відірвались від краю) — прибираємо все, що менше 40 px
lab, n = ndimage.label(solid); sizes = ndimage.sum(solid, lab, range(1, n + 1))
solid &= np.isin(lab, 1 + np.nonzero(sizes >= 40)[0])
im[..., 3] = np.where(solid, im[..., 3], 0)
Image.fromarray(im.astype(np.uint8)).save(a.out or a.inp)
print(f'{a.inp}: removed {removed} px in {i + 1} passes')
