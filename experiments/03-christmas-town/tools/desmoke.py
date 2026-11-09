# tools/desmoke.py — перефарбовує «фіолетовий» напівпрозорий дим (пурпурове тло просвітило крізь нього при вирізанні)
# у сіро-блакитний: яскравість лишається, відтінок — холодний димчастий.   python tools/desmoke.py IN.png OUT.png
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); px = im.load(); n = 0
for y in range(im.size[1]):
    for x in range(im.size[0]):
        r, g, b, a = px[x, y]
        if a and r > g * 1.25 and b > g * 1.15 and r > 60:          # пурпурний: червоного й синього помітно більше за зелений
            l = (r + g + b) / 3; px[x, y] = (int(l * 0.82), int(l * 0.88), int(min(255, l * 1.05)), a); n += 1
im.save(sys.argv[2]); print('recoloured', n)
