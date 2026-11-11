# Ріже аркуші містян (art/gen/folk_{a,b}_{sad,happy}.png) на 6 фігур за діапазонами стовпців.
# Межі знайдено за прозорими проміжками і «стрибком» верхнього краю (санчата низькі — там кінчається ліхтарник).
# Пари, що на аркуші торкаються (мама з донькою, дівчинка з листоношею), ріжемо разом — одна фігура.
from PIL import Image
import numpy as np
from scipy import ndimage
CUTS = {
    'folk_a_sad':   [('baker', 91, 445), ('grandpa', 573, 904), ('mother', 1029, 1425)],
    'folk_a_happy': [('baker', 55, 460), ('grandpa', 479, 923), ('mother', 965, 1456)],
    'folk_b_sad':   [('lamplighter', 93, None), ('kids', None, 779), ('postman', 830, 1427)],
    'folk_b_happy': [('lamplighter', 75, None), ('kids', None, 796), ('postman', 910, 1478)],
}
for sheet, parts in CUTS.items():
    im = Image.open(f'art/gen/{sheet}.png').convert('RGBA'); a = np.array(im)[:, :, 3] > 40
    top = [int(np.argmax(a[:, x])) if a[:, x].any() else 99999 for x in range(a.shape[1])]
    # межа ліхтарник | санчата: перший стовпчик після 400, де верх фігури нижче 450 px (там лише низькі санчата)
    split = next(x for x in range(400, 900) if top[x] > 450)
    state = sheet.split('_')[-1]
    # зв'язні плями альфи: кожну віддаємо фігурі за її центром; низькі плями (верх нижче 650 px — санчата) — дітям,
    # бо санчата заїжджають під ліхтарника; крихти < 40 px викидаємо
    lab, n = ndimage.label(a); owner = {}
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        if (lab[sl] == k).sum() < 40: continue
        cx = (sl[1].start + sl[1].stop) / 2
        for name, x0, x1 in parts:
            x0 = split if x0 is None else x0; x1 = split if x1 is None else x1
            if x0 <= cx < x1: owner[k] = 'kids' if name == 'lamplighter' and sl[0].start > 650 else name
    px = np.array(im)
    for name, _, _ in parts:
        mask = np.isin(lab, [k for k, o in owner.items() if o == name])
        rows = np.where(mask.any(1))[0]; cols = np.where(mask.any(0))[0]
        box = (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)
        q = px.copy(); q[~mask] = 0                                        # лише пікселі своєї фігури
        out = Image.fromarray(q).crop(box); out.save(f'art/gen/folk_{name}_{state}.png'); print(sheet, name, box, out.size)
