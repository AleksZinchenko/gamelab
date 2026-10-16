# tools/rig_lr.py — маріонетка з ОКРЕМИМИ лівими й правими кінцівками (у ракурсі 3/4 вони різні: дальня/ближня,
# ліве/праве взуття). partrig.py вміє лише «одна нога + одна рука на обидва боки», тому збираємо двічі:
# [тіло + ліва нога + ліва рука] і [тіло + права нога + права рука], і беремо з кожного збирання свою сторону.
#   python tools/rig_lr.py NAME SHEET --legs a,b --hipy f --sh L=x,y --sh R=x,y [--height 400] [--face right]
# Аркуш: 5 частин зліва направо — тіло, ліва нога, права нога, ліва рука, права рука.
import argparse, json, os, re, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage
ap = argparse.ArgumentParser(); ap.add_argument('name'); ap.add_argument('sheet'); ap.add_argument('--legs', required=True)
ap.add_argument('--hipy', required=True); ap.add_argument('--sh', action='append', default=[]); ap.add_argument('--height', default='400')
ap.add_argument('--face', default='right'); a = ap.parse_args()
SK = '../../.claude/skills/ref2game/scripts/partrig.py'
S = np.array(Image.open(a.sheet).convert('RGBA')); lab, n = ndimage.label(ndimage.binary_closing(S[:, :, 3] > 60, iterations=2))
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = list(np.argsort(-sizes)[:5] + 1)
keep.sort(key=lambda l: np.where(lab == l)[1].min())                       # зліва направо
body, legL, legR, armL, armR = keep
rig = {}
for side, (leg, arm) in {'L': (legL, armL), 'R': (legR, armR)}.items():
    T = S.copy(); T[~np.isin(lab, [body, leg, arm])] = 0                    # лишаємо тіло + кінцівки однієї сторони
    tmp = f'art/src/_{a.name}_{side}.png'; Image.fromarray(T).save(tmp)
    nm = f'{a.name}_{side.lower()}'
    args = [sys.executable, SK, nm, '--sheet', tmp, '--height', a.height, '--face', a.face, '--legs', a.legs, '--hipy', a.hipy]
    for s in a.sh: args += ['--sh', s]
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)
    js = open('live/rigs.js', encoding='utf-8').read(); R = json.loads(js[js.index('{'):js.rindex('}') + 1])[nm]
    for part in ['thigh', 'shin', 'foot', 'uarm', 'farm']:                   # частини своєї сторони → під спільне ім'я
        os.replace(f'art/gen/{nm}__{part}{side}.png', f'art/gen/{a.name}__{part}{side}.png')
    for k, v in R.items():
        if k.endswith(side) or (side == 'L' and not re.search(r'[LR]$', k)): rig[k] = v
    if side == 'L': os.replace(f'art/gen/{nm}__body.png', f'art/gen/{a.name}__body.png')
    for f in os.listdir('art/gen'):                                          # прибрати решту тимчасових частин
        if f.startswith(nm + '__') or f == nm + '.png': os.remove(os.path.join('art/gen', f))
js = open('live/rigs.js', encoding='utf-8').read(); ALL = json.loads(js[js.index('{'):js.rindex('}') + 1])
for k in [k for k in ALL if k.startswith(a.name + '_')]: del ALL[k]
ALL[a.name] = rig
open('live/rigs.js', 'w', encoding='utf-8').write('window.RIGS = ' + json.dumps(ALL) + ';\n')
print(a.name, json.dumps(rig)[:300])
