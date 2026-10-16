# tools/gen_raw.py — генерація БЕЗ біблії стилю гри (gen.py завжди додає гуашеву біблію, а піктограми в бульбашках
# мають інший стиль — олівцеві замальовки, як думки героїв у Machinarium). Викликає наш Meshy-плагін напряму.
#   python tools/gen_raw.py NAME PROMPT_FILE OUT.png [--ref IMG ...] [--size 1536x1024]
import sys, os, json, argparse
SK = os.path.join(os.path.dirname(__file__), '..', '..', '..', '.claude', 'skills', 'ref2game')
sys.path.insert(0, os.path.join(SK, 'scripts')); sys.path.insert(0, os.path.join(SK, 'providers'))
import meshy
ap = argparse.ArgumentParser(); ap.add_argument('name'); ap.add_argument('prompt'); ap.add_argument('out')
ap.add_argument('--ref', action='append', default=[]); ap.add_argument('--size', default='1536x1024')
a = ap.parse_args(); w, h = map(int, a.size.split('x'))
r = meshy.generate(open(a.prompt, encoding='utf-8').read(), a.ref, (w, h), False, None, a.out, {'_name': a.name}, False)
print(json.dumps(r)[:160])
