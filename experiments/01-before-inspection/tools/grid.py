# tools/grid.py — допоміжне: накладає на картинку сітку з підписами координат (кожні STEP px), щоб на око
# знімати координати точок (плечі, лікті, полігони рук) для art/softbones.json. Нічого в грі не змінює.
#   python tools/grid.py IN.png OUT.png [--box x0,y0,x1,y1] [--step 50] [--scale 1]
import argparse
from PIL import Image, ImageDraw
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--box', default='')
ap.add_argument('--step', type=int, default=50); ap.add_argument('--scale', type=float, default=1); a = ap.parse_args()
im = Image.open(a.src).convert('RGBA'); x0, y0, x1, y1 = map(int, a.box.split(',')) if a.box else (0, 0, *im.size)
bg = Image.new('RGBA', im.size, (90, 90, 110, 255)); bg.alpha_composite(im); im = bg.crop((x0, y0, x1, y1))
d = ImageDraw.Draw(im)
for x in range((x0 // a.step + 1) * a.step, x1, a.step):                    # вертикальні лінії з підписом x
    d.line([(x - x0, 0), (x - x0, y1 - y0)], fill=(0, 255, 255, 140)); d.text((x - x0 + 2, 2), str(x), fill=(255, 255, 0, 255))
for y in range((y0 // a.step + 1) * a.step, y1, a.step):                    # горизонтальні лінії з підписом y
    d.line([(0, y - y0), (x1 - x0, y - y0)], fill=(0, 255, 255, 140)); d.text((2, y - y0 + 2), str(y), fill=(255, 255, 0, 255))
if a.scale != 1: im = im.resize((int(im.width * a.scale), int(im.height * a.scale)))
im.convert('RGB').save(a.out)
