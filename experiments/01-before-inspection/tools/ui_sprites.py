# tools/ui_sprites.py — ріже аркуші інтерфейсу на спрайти й зменшує до розміру в грі.
# Піктограми лежать сіткою 4×3: межі рядків шукаємо в кожному стовпці окремо — по найпорожнішому горизонтальному
# рядку пікселів (так знак питання не «злипається» з кріслом під ним, а його крапка не відривається).
import numpy as np, os, subprocess, sys
from PIL import Image
OUT = 'art/gen'
def save(im, name, maxside):
    bb = im.getbbox(); im = im.crop(bb); k = min(1, maxside / max(im.size))
    im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).save(f'{OUT}/{name}.png')
def grid(sheet, names, maxside=180):
    im = Image.open(sheet).convert('RGBA'); A = np.asarray(im)[:, :, 3].astype(float); H, W = A.shape
    for c in range(4):
        x0, x1 = W * c // 4, W * (c + 1) // 4; col = A[:, x0:x1].sum(1)
        cut = lambda lo, hi: lo + int(np.argmin(col[lo:hi]))                       # найпорожніший рядок пікселів
        ys = [0, cut(int(H * 0.25), int(H * 0.42)), cut(int(H * 0.58), int(H * 0.75)), H]
        for r in range(3):
            save(im.crop((x0, ys[r], x1, ys[r + 1])), names[r * 4 + c], maxside)
grid('art/ui/picto_a_a.png', 'p_wrench p_ruler p_cup p_sandwich p_bulb p_pi p_q p_x p_ok p_tube p_chair p_bolt'.split())
grid('art/ui/picto_b_a.png', 'p_clock p_building p_stamp p_rat p_axel p_legs p_bag p_eye p_beard p_phone p_zzz p_arrow'.split())
# рамки бульбашок і предмети — окремими компонентами (між ними широкі проміжки)
SK = '../../.claude/skills/ref2game/scripts/slice.py'
subprocess.run([sys.executable, SK, 'art/ui/bubble_frames_a.png', 'bub_round,bub_oval,bub_t1,bub_t2,bub_t3', '--out', 'art/ui/cut', '--order', 'reading'], check=True)
subprocess.run([sys.executable, SK, 'art/src/items_hud.png', 'it_ruler,it_cup,it_wrench,hud_bag,hud_note', '--out', 'art/ui/cut', '--order', 'x', '--dilate', '8'], check=True)
for n, m in [('bub_round', 420), ('bub_oval', 620), ('bub_t1', 70), ('bub_t2', 54), ('bub_t3', 36),
             ('it_ruler', 200), ('it_cup', 200), ('it_wrench', 200), ('hud_bag', 200), ('hud_note', 200)]:
    save(Image.open(f'art/ui/cut/{n}.png').convert('RGBA'), n, m)
print('ok')
