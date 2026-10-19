# tools/make_top.py — «верх» маріонетки з якоря, як у Ліни: ТІЛО = Meshy-версія якоря «без рук» (art/src/NAME_noarms.png),
# РУКИ = пікселі якоря всередині полігонів рук (art/softbones.json → NAME_top_arms, кістки 0 і 1). Ноги нижче поли
# прибираємо — їх малюють частини маріонетки (tools/rig_lr.py), що крокують під халатом.
#   python tools/make_top.py NAME --cut0 Y --cut1 Y
#   cut0..cut1 (px якоря) — смуга нижнього краю поли: тут лишаємо лише світлі пікселі (тканина халата), темні штани прибираємо;
#   нижче cut1 — прибираємо все. --belt Y: від пояса вниз прибираємо й темні штани між полами халата (велика темна пляма,
#   що дотикається до низу) — там видно стегна маріонетки, які крокують, а не намальовані нерухомі. Полігони рук у softbones.json — у px ВИХОДУ (якір, обрізаний по силуету з полем 3 px).
# Пише art/gen/NAME_top.png, art/gen/NAME_top_arms.png (+ art/src/NAME_top_orig.png для довідки) і друкує середину ступнів
# якоря (px виходу) — з неї в scene.js рахуємо зсув ox, щоб ноги маріонетки стали під ступні якоря.
import argparse, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ap = argparse.ArgumentParser(); ap.add_argument('name'); ap.add_argument('--cut0', type=int, required=True)
ap.add_argument('--cut1', type=int, required=True); ap.add_argument('--belt', type=int, default=0); a = ap.parse_args()
A = np.array(Image.open(f'art/gen/{a.name}_anchor.png').convert('RGBA')).astype(np.float32)
B = np.array(Image.open(f'art/src/{a.name}_noarms.png').convert('RGBA')).astype(np.float32)
# Meshy при редагуванні буває зсуває малюнок на піксель-два: шукаємо зсув, за якого голова збігається найкраще
ys, xs = np.where(A[:, :, 3] > 60); hy, hx = ys.min(), int(xs[ys < ys.min() + 200].mean())
win = (slice(hy + 20, hy + 220), slice(hx - 120, hx + 120))
best = min(((np.abs(np.roll(B, (dy, dx), (0, 1))[win][:, :, :3] - A[win][:, :, :3]).mean(), dy, dx)
            for dy in range(-4, 5) for dx in range(-4, 5)))
B = np.roll(B, best[1:], (0, 1)); print('noarms shift', best[1:])
# обрізка по силуету якоря з полем 3 px (низ — рівно по підошвах: так ступні якоря = низ текстури = низ маріонетки)
x0, y0, x1, y1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 1
A, B = A[y0:y1, x0:x1].copy(), B[y0:y1, x0:x1].copy(); H, W = A.shape[:2]
c0, c1 = a.cut0 - y0, a.cut1 - y0
lum = lambda I: I[:, :, :3] @ np.array([0.3, 0.55, 0.15], np.float32) / 255
from scipy import ndimage
if a.belt:                                               # штани між полами: темні пікселі від пояса до низу, зв'язані з низом
    dark = np.zeros((H, W), bool); dark[a.belt - y0:c1] = lum(B)[a.belt - y0:c1] < 0.42
    dark &= A[:, :, 3] > 60; lab, n = ndimage.label(ndimage.binary_opening(dark, iterations=2))
    keep = set(np.unique(lab[c1 - 3:c1][lab[c1 - 3:c1] > 0]))          # плями, що доходять до нижнього краю поли
    pants = ndimage.binary_dilation(np.isin(lab, list(keep)), iterations=2) & (np.arange(H)[:, None] >= a.belt - y0)
    # підкладка спинки халата (шар ПОЗАДУ ніг): на місці штанів — колір найближчої тканини халата, у тіні (×0.45), до поли
    inner = pants & (np.arange(H)[:, None] < c0)
    _, (iy, ix) = ndimage.distance_transform_edt(pants | (B[:, :, 3] < 60), return_indices=True)
    back = np.zeros_like(B); back[inner, :3] = B[iy[inner], ix[inner], :3] * 0.45; back[inner, 3] = 255
    Image.fromarray(back.astype(np.uint8)).save(f'art/gen/{a.name}_top__back.png')
    for I in (A, B): I[pants, 3] = 0
    print('pants px', int(pants.sum()))
for I in (A, B):
    band = np.zeros((H, W), bool); band[c0:c1] = True
    I[band & (lum(I) < 0.42), 3] = 0                      # у смузі поли: темне (штани, тінь між ногами) — геть
    I[c1:, :, 3] = 0                                     # нижче поли — ноги маріонетки
Image.fromarray(A.astype(np.uint8)).save(f'art/src/{a.name}_top_orig.png')
Image.fromarray(B.astype(np.uint8)).save(f'art/gen/{a.name}_top.png')
# Руки. М'які кістки гарні лише для малих махів: на великому куті (замах ключем, пробірка до рота) рука тягнеться «локшиною».
# Тому ДАЛЬНЯ рука (кістка 1) — шар м'яких кісток, а БЛИЖНЯ (кістка 0) — два жорсткі шматки «вирізанки»: плече й передпліччя.
# У спокої шматки = пікселі якоря на своїх місцях (малюнок не змінюється), а повертатися можуть на будь-який кут.
cfg = json.load(open('art/softbones.json'))[a.name + '_top_arms']['bones']
def poly_mask(poly):
    mk = Image.new('L', (W, H), 0); ImageDraw.Draw(mk).polygon([tuple(p) for p in poly], fill=255); return np.array(mk) > 127
def save_layer(mask, path, blur=1.5):                    # пікселі якоря під маскою, край м'який на blur px
    soft = np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))).astype(np.float32) / 255
    L = A.copy(); L[:, :, 3] *= soft; Image.fromarray(L.astype(np.uint8)).save(path)
save_layer(poly_mask(cfg[1]['poly']), f'art/gen/{a.name}_top_arms.png')
near, Sh, El, Tip = poly_mask(cfg[0]['poly']), np.array(cfg[0]['root'], float), np.array(cfg[2]['root'], float), np.array(cfg[0]['tip'], float)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); ax = (Tip - Sh) / np.linalg.norm(Tip - Sh)
t = (xx - Sh[0]) * ax[0] + (yy - Sh[1]) * ax[1]; tE = float((El - Sh) @ ax)          # відстань уздовж руки від плеча
wid = lambda c: float(near[np.abs(t - c) < 3].sum() / 6)                   # приблизна ширина рукава біля точки (px)
rS, rE = 0.55 * wid(40), 0.5 * wid(tE)                                              # радіуси «куль» суглобів: плеча й ліктя
disc = lambda c, r: (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r
alpha = A[:, :, 3] > 60
# плече: від верху до ліктя (+6 px заходу) + кругла «шапка» плеча (на ній рука провертається, як на кульовому суглобі)
save_layer((near & (t <= tE + 6)) | (disc(Sh, rS) & alpha), f'art/gen/{a.name}_top__armU.png')
# передпліччя: від ліктя (−6 px) до кисті + кругла голівка ліктя (лише в межах рукава), щоб на згині не було щілини
save_layer(near & ((t >= tE - 6) | disc(El, rE)), f'art/gen/{a.name}_top__armF.png')
print('joints r', round(rS, 1), round(rE, 1))
# середина ступнів якоря: середнє x непрозорих пікселів у нижніх 3% висоти
F = np.array(Image.open(f'art/gen/{a.name}_anchor.png').convert('RGBA'))[y0:y1, x0:x1, 3] > 60
fy, fx = np.where(F[int(H * 0.97):]); print(a.name, 'top', W, H, 'feet_cx', round(float(fx.mean()), 1))
