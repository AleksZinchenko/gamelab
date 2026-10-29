"""
tools/meshy3d.py — 3D через Meshy API: картинка → 3D-модель → скелет (риг) → анімації з бібліотеки.
Проба «3D-персонаж у нашому світі» (2026-10-29). Кожен крок асинхронний: POST дає id задачі, далі чекаємо SUCCEEDED.

  python tools/meshy3d.py model IMG.png OUTDIR          # image-to-3D (30 кр: меш + текстура 2K)
  python tools/meshy3d.py rig MODEL_TASK_ID OUTDIR [ЗРІСТ_М]  # автоскелет (5 кр), у комплекті хода й біг
  python tools/meshy3d.py anim RIG_TASK_ID OUTDIR 12,34 # анімації з бібліотеки (3 кр за кожну)
  python tools/meshy3d.py lib SEARCH                    # пошук у бібліотеці анімацій (безкоштовно)
Ключ MESHY_API_KEY — з gamelab/.env (шукаємо вгору від поточної папки).
"""
import base64, json, os, sys, time, urllib.request

API = "https://api.meshy.ai/openapi/v1"


def key():
    # ключ не в git: читаємо змінну середовища або .env з батьківських папок
    if os.environ.get("MESHY_API_KEY"):
        return os.environ["MESHY_API_KEY"]
    d = os.getcwd()
    while True:
        p = os.path.join(d, ".env")
        if os.path.isfile(p):
            for line in open(p, encoding="utf-8"):
                k, _, v = line.strip().partition("=")
                if k.strip() == "MESHY_API_KEY":
                    return v.strip().strip('"').strip("'")
        if os.path.dirname(d) == d:
            sys.exit("нема MESHY_API_KEY")
        d = os.path.dirname(d)


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Bearer " + key(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:   # Meshy пояснює помилку в тілі відповіді — показуємо його
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')}")


def wait(kind, tid):
    # опитуємо задачу раз на 10 с, поки не завершиться; друкуємо прогрес, щоб було видно, що живе
    while True:
        t = call("GET", f"/{kind}/{tid}")
        print(f"  {kind} {tid}: {t['status']} {t.get('progress', '')}%", flush=True)
        if t["status"] == "SUCCEEDED":
            return t
        if t["status"] in ("FAILED", "CANCELED"):
            sys.exit(f"задача впала: {t.get('task_error')}")
        time.sleep(10)


def fetch(url, out):
    # посилання Meshy тимчасові (expires_at) — одразу качаємо файли до себе
    os.makedirs(os.path.dirname(out), exist_ok=True)
    urllib.request.urlretrieve(url, out)
    print("  ->", out)


def main():
    cmd, *a = sys.argv[1:]
    if cmd == "model":
        img, out = a
        uri = "data:image/png;base64," + base64.b64encode(open(img, "rb").read()).decode()
        # pose_mode a-pose — Meshy розставляє руки під кутом від тіла: так автоскелету легше знайти руки й ноги.
        # enable_pbr вимкнено: нам потрібен лише «намальований» колір, без металевості/шорсткості
        tid = call("POST", "/image-to-3d", {"image_url": uri, "ai_model": "latest", "should_texture": True,
                   "texture_resolution": "2k", "enable_pbr": False, "pose_mode": "a-pose",
                   "target_formats": ["glb"], "multi_view_thumbnails": True})["result"]
        print("model task", tid, flush=True)
        t = wait("image-to-3d", tid)
        fetch(t["model_urls"]["glb"], os.path.join(out, "model.glb"))
        for side, u in (t.get("thumbnail_urls") or {"front": t["thumbnail_url"]}).items():
            fetch(u, os.path.join(out, f"thumb_{side}.png"))
        json.dump(t, open(os.path.join(out, "model_task.json"), "w"), indent=1)
    elif cmd == "remesh":
        # спрощення сітки (5 кр): скелет приймає до 320 тис. трикутників, а image-to-3D дає ~900 тис.
        mid, out, n = a
        tid = call("POST", "/remesh", {"input_task_id": mid, "target_polycount": int(n), "target_formats": ["glb"]})["result"]
        print("remesh task", tid, flush=True)
        t = wait("remesh", tid)
        fetch(t["model_urls"]["glb"], os.path.join(out, "remeshed.glb"))
        json.dump(t, open(os.path.join(out, "remesh_task.json"), "w"), indent=1)
    elif cmd == "rig":
        # зріст у метрах (за замовчуванням 1.6 — Ліна): скелет підганяє пропорції кісток під реальний розмір
        mid, out, *h = a
        tid = call("POST", "/rigging", {"input_task_id": mid, "height_meters": float(h[0]) if h else 1.6})["result"]
        print("rig task", tid, flush=True)
        t = wait("rigging", tid)
        r = t["result"]
        fetch(r["rigged_character_glb_url"], os.path.join(out, "rigged.glb"))
        for name, v in (r.get("basic_animations") or {}).items():   # хода й біг, що йдуть у комплекті
            if isinstance(v, str) and v.endswith(".glb") or "glb_url" in name and "armature" not in name:
                fetch(v, os.path.join(out, f"{name}.glb"))
        json.dump(t, open(os.path.join(out, "rig_task.json"), "w"), indent=1)
    elif cmd == "anim":
        rid, out, ids = a
        tid = call("POST", "/animations", {"rig_task_id": rid, "action_ids": [int(i) for i in ids.split(",")]})["result"]
        print("anim task", tid, flush=True)
        t = wait("animations", tid)
        fetch(t["result"]["animation_glb_url"], os.path.join(out, f"anim_{ids.replace(',', '_')}.glb"))
        json.dump(t, open(os.path.join(out, f"anim_{ids.replace(',', '_')}.json"), "w"), indent=1)
    elif cmd == "lib":
        # «lib слово» — пошук за назвою; «lib cat:WalkAndRun» — уся категорія. Друкуємо: id | назва | підкатегорія | прев'ю
        q = f"category={a[0][4:]}" if a[0].startswith("cat:") else "search=" + urllib.parse.quote(a[0])
        res = call("GET", f"/animations/library?{q}&page_size=500")
        for x in (res if isinstance(res, list) else res.get("data", res.get("result", []))):
            print(x["action_id"], "|", x["name"], "|", x.get("sub_category"), "|", x.get("preview_url"))


if __name__ == "__main__":
    import urllib.parse
    main()
