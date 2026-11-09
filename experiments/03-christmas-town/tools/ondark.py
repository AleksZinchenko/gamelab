# tools/ondark.py — кладе спрайти з прозорістю на темно-синій фон (як нічне небо в грі), щоб побачити обідки/бахрому.
#   python tools/ondark.py OUT.png a.png b.png ...
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGBA') for f in files]
# масштаб так, щоб найвищий спрайт був 420 px — усі на одному аркуші, поруч
k = 420 / max(i.size[1] for i in ims)
ims = [i.resize((max(1, int(i.size[0] * k)), max(1, int(i.size[1] * k))), Image.NEAREST) for i in ims]
W = sum(i.size[0] for i in ims) + 20 * (len(ims) + 1)
sheet = Image.new('RGBA', (W, 460), (11, 19, 38, 255))   # колір неба з референсу
x = 20
for i in ims:
    sheet.alpha_composite(i, (x, 20)); x += i.size[0] + 20
sheet.convert('RGB').save(out); print(out, sheet.size)
