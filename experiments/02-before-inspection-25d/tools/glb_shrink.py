"""
tools/glb_shrink.py — готує GLB-модель з Meshy для гри: менші текстури, без зайвого, усі рухи в одному файлі.
Meshy віддає 2048×2048 PNG (колір, нормалі, шорсткість) і кожну анімацію окремим файлом з копією всієї моделі (~13 МБ).
Герою заввишки ~140 px на екрані досить кольору 1024 у JPEG; карта нормалей (дрібний рельєф) і тангенти не видні.
(gltf-transform на Windows падає на libvips, тому робимо самі: GLB — це JSON-опис + один бінарний блок.)
  python tools/glb_shrink.py OUT.glb BASE.glb [ANIM.glb ...] [--color 1024] [--quality 88]
  BASE — модель з першою анімацією (хода); з ANIM-файлів беремо лише анімації (кістки шукаємо за іменами).
"""
import argparse, io, json, struct
from PIL import Image


def load(path):
    # GLB: заголовок 12 байт, далі чанки [довжина, тип, дані]; перший — JSON, другий — BIN.
    # Одразу ріжемо BIN на шматки за bufferViews — так їх легко міняти, додавати й викидати.
    raw = open(path, "rb").read()
    pos, js, bin_ = 12, None, b""
    while pos < len(raw):
        ln, kind = struct.unpack_from("<II", raw, pos)
        if kind == 0x4E4F534A:
            js = json.loads(raw[pos + 8:pos + 8 + ln])
        elif kind == 0x004E4942:
            bin_ = raw[pos + 8:pos + 8 + ln]
        pos += 8 + ln
    views = [bin_[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in js["bufferViews"]]
    return js, views, len(raw)


def strip_extras(js):
    # прибираємо карту нормалей і текстуру металевість/шорсткість, а з сітки — тангенти (потрібні лише для нормалей)
    for m in js.get("materials", []):
        m.pop("normalTexture", None)
        pbr = m.setdefault("pbrMetallicRoughness", {})
        pbr.pop("metallicRoughnessTexture", None)
        pbr["metallicFactor"], pbr["roughnessFactor"] = 0.0, 0.9    # матова «фарба», без металевого блиску
    for me in js.get("meshes", []):
        for p in me["primitives"]:
            p["attributes"].pop("TANGENT", None)


def add_anims(js, views, js2, views2):
    # копіюємо анімації з іншого файлу: їхні accessors і bufferViews дописуємо в кінець, вузли зіставляємо за іменами
    by_name = {n.get("name"): i for i, n in enumerate(js["nodes"])}
    acc_map = {}

    def copy_acc(i):
        if i not in acc_map:
            a = dict(js2["accessors"][i]); bv = dict(js2["bufferViews"][a["bufferView"]])
            views.append(views2[a["bufferView"]]); js["bufferViews"].append(bv)
            a["bufferView"] = len(js["bufferViews"]) - 1
            js["accessors"].append(a); acc_map[i] = len(js["accessors"]) - 1
        return acc_map[i]

    for an in js2.get("animations", []):
        new = {"name": an.get("name"), "samplers": [], "channels": []}
        for s in an["samplers"]:
            new["samplers"].append(dict(s, input=copy_acc(s["input"]), output=copy_acc(s["output"])))
        for c in an["channels"]:
            nm = js2["nodes"][c["target"]["node"]].get("name")
            if nm in by_name:
                new["channels"].append({"sampler": c["sampler"], "target": dict(c["target"], node=by_name[nm])})
        js.setdefault("animations", []).append(new)


def save(path, js, views, color, quality):
    # 1) картинки: стискаємо колір у JPEG, решту картинок викидаємо, якщо на них більше ніхто не посилається
    used = {js["textures"][t["index"]]["source"]
            for m in js.get("materials", []) for t in [m.get("pbrMetallicRoughness", {}).get("baseColorTexture")] if t}
    for i, im in enumerate(js.get("images", [])):
        if i in used:
            pic = Image.open(io.BytesIO(views[im["bufferView"]])).convert("RGB").resize((color, color), Image.LANCZOS)
            buf = io.BytesIO(); pic.save(buf, "JPEG", quality=quality)
            views[im["bufferView"]] = buf.getvalue(); im["mimeType"] = "image/jpeg"   # JPEG підтримує сам glTF
        else:
            views[im["bufferView"]] = b""
    # 2) викидаємо дані, на які ніхто не посилається (тангенти тощо): збираємо «живі» accessors і bufferViews
    live_acc = set()
    for me in js.get("meshes", []):
        for p in me["primitives"]:
            live_acc |= set(p["attributes"].values()); live_acc |= {p["indices"]} if "indices" in p else set()
    for sk in js.get("skins", []):
        if "inverseBindMatrices" in sk:
            live_acc.add(sk["inverseBindMatrices"])
    for an in js.get("animations", []):
        for s in an["samplers"]:
            live_acc |= {s["input"], s["output"]}
    for i in range(len(js["accessors"])):
        if i not in live_acc:
            views[js["accessors"][i]["bufferView"]] = b""
    # 3) збираємо бінарний блок: кожен шматок на межі 4 байтів (вимога формату), зсуви перераховуємо
    out = bytearray()
    for k, bv in enumerate(js["bufferViews"]):
        out += b"\0" * (-len(out) % 4)
        bv["byteOffset"], bv["byteLength"], bv["buffer"] = len(out), len(views[k]), 0
        out += views[k]
    out += b"\0" * (-len(out) % 4)
    js["buffers"] = [{"byteLength": len(out)}]
    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * (-len(jb) % 4)                          # JSON доповнюємо пробілами до кратності 4
    total = 12 + 8 + len(jb) + 8 + len(out)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A) + jb)
        f.write(struct.pack("<II", len(out), 0x004E4942) + out)
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dst"); ap.add_argument("base"); ap.add_argument("anims", nargs="*")
    ap.add_argument("--color", type=int, default=1024); ap.add_argument("--quality", type=int, default=88)
    a = ap.parse_args()
    js, views, size0 = load(a.base)
    strip_extras(js)
    for p in a.anims:
        js2, views2, _ = load(p)
        add_anims(js, views, js2, views2)
    total = save(a.dst, js, views, a.color, a.quality)
    print(f"{a.dst}: {size0 / 1e6:.1f} МБ → {total / 1e6:.1f} МБ, анімації: {[x['name'] for x in js['animations']]}")


if __name__ == "__main__":
    main()
