# tools/stitch.py — зшиває дві половини фону кімнати в одну панораму по вертикальній трубі.
# Чому так: генератор малює максимум 16:9, а кімната ширша за екран. Шов ховаємо в трубу,
# яка є на обох половинах (стіна), а на підлозі робимо ширший плавний перехід, бо там шов не сховати.
# Результат ріжемо на дві текстури ≤ 2048 px (обмеження prep.py і старих телефонів).
import numpy as np
from PIL import Image

L = np.asarray(Image.open('art/src/bg_room_l.png').convert('RGB')).astype(np.float32)
R = np.asarray(Image.open('art/src/bg_room_r.png').convert('RGB')).astype(np.float32)
H = L.shape[0]
SEAM = 1788          # центр труби на лівій половині (виміряно по «мідних» стовпцях)
R_PIPE = 120         # центр тієї ж труби на правій половині
OFF = SEAM - R_PIPE  # де права половина стоїть у панорамі
W = OFF + R.shape[1]
FLOOR_Y = 800        # нижче — підлога

pan = np.zeros((H, W, 3), np.float32)
pan[:, :1920] = L
xs = np.arange(W)
for y in range(H):
    half = 10 if y < FLOOR_Y else 140                     # стіна: різкий шов у трубі; підлога: плавний перехід
    w = np.clip((xs - (SEAM - half)) / (2 * half), 0, 1)  # 0 = ліва картинка, 1 = права
    row_r = np.zeros((W, 3), np.float32); row_r[OFF:] = R[y]
    row_l = np.zeros((W, 3), np.float32); row_l[:1920] = L[y]
    pan[y] = row_l * (1 - w[:, None]) + row_r * w[:, None]
img = Image.fromarray(np.clip(pan, 0, 255).astype(np.uint8))
img.save('study/bg_room_pano.jpg', quality=90)             # повна панорама — для перегляду
mid = W // 2
img.crop((0, 0, mid, H)).save('art/gen/bg_room_a.png')     # ліва текстура
img.crop((mid, 0, W, H)).save('art/gen/bg_room_b.png')     # права текстура
print('panorama', W, 'x', H, '| textures', mid, W - mid)
