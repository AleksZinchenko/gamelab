"""
meshy -- image provider plugin for ref2game gen.py (додано в gamelab, не з оригінального скіла).

Як підключити в ігровому проєкті:
  1. скопіювати цей файл у <project>/art/providers/meshy.py;
  2. у <project>/ref2game.json поставити "generator": {"provider": "meshy", ...};
  3. ключ MESHY_API_KEY — зі змінної середовища або з файла .env (шукаємо вгору від папки проєкту,
     тобто підійде gamelab/.env, який не йде в git).

Що знаємо про API (офіційні доки, перевірено 2026-10-14):
  - https://docs.meshy.ai/en/api/text-to-image   POST /openapi/v1/text-to-image   (без референсів)
  - https://docs.meshy.ai/en/api/image-to-image  POST /openapi/v1/image-to-image  (1..5 референсів)
  - авторизація: "Authorization: Bearer <key>";
  - обидва ендпоінти асинхронні: POST повертає {"result": "<task id>"}, далі GET .../<id> поки
    status не стане SUCCEEDED (інші: PENDING, IN_PROGRESS, FAILED, CANCELED); картинка — image_urls[0];
  - референси: reference_image_urls — публічні URL або data URI (jpg/png/webp, до 20 МБ кожен);
  - розмір задається ТІЛЬКИ через aspect_ratio; для gpt-image-*: 1:1 16:9 9:16 4:3 3:4 3:2 2:3;
  - прозорість: remove_background=true -> RGBA PNG (це вирізання фону після генерації, не "чесна" альфа);
  - вартість у кредитах за картинку: gpt-image-2 — 9 (text-to-image) / 12 (image-to-image);
    nano-banana — 3 / 3. Кредити спільні з AssetFactory (тариф Pro, 1000 кр/міс).
  НЕ перевірено: ліміт довжини промпту, ліміти частоти запитів (429), seed (у доках його нема).
"""
import os

from gen import GenError, data_uri, download, env_key, http_json, poll, say

API_BASE = "https://api.meshy.ai/openapi/v1"
ENV = ["MESHY_API_KEY"]
ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]   # для gpt-image-*; у nano-banana нема 3:2 і 2:3

CAPS = {
    "native_alpha": True,       # remove_background=true віддає RGBA PNG
    "max_refs": 5,              # reference_image_urls: 1..5
    "sizes": ASPECTS,           # gen.py сам підбере найближче співвідношення сторін і потім підріже/відмасштабує
    "edit": True,               # референси реально впливають на результат (image-to-image)
    "env": ENV,
    "default_model": "gpt-image-2",
}


def _load_dotenv():
    """Якщо ключа нема в середовищі — шукаємо .env від поточної папки вгору і беремо MESHY_API_KEY звідти."""
    if os.environ.get("MESHY_API_KEY"):
        return
    d = os.path.abspath(os.getcwd())
    while True:
        p = os.path.join(d, ".env")
        if os.path.isfile(p):
            with open(p, encoding="utf-8") as f:
                for line in f:
                    k, sep, v = line.strip().partition("=")
                    if sep and k.strip() == "MESHY_API_KEY" and v.strip():
                        os.environ["MESHY_API_KEY"] = v.strip().strip('"').strip("'")
                        return
        parent = os.path.dirname(d)
        if parent == d:
            return
        d = parent


# gen.py check перевіряє змінні середовища ще ДО виклику плагіна — тому читаємо .env одразу при імпорті
_load_dotenv()


def _auth(dry_run):
    return {"Authorization": "Bearer " + env_key(*ENV, dry_run=dry_run)}


def _aspect(size):
    """(w, h) -> найближчий дозволений aspect_ratio (за логарифмом відношення, як у gen.py)."""
    import math
    r = size[0] / size[1]
    return min(ASPECTS, key=lambda a: abs(math.log(r / (int(a.split(":")[0]) / int(a.split(":")[1])))))


def generate(prompt, refs, size, transparent, model, out_raw, opts, dry_run):
    model = model or CAPS["default_model"]
    # з референсами — image-to-image (так стиль тримається), без них — дешевший text-to-image
    kind = "image-to-image" if refs else "text-to-image"
    body = {"ai_model": model, "prompt": prompt, "aspect_ratio": _aspect(size)}
    if transparent:
        body["remove_background"] = True
    if refs:
        # data URI замість завантаження файлів кудись: доки це дозволяють; 2048 px з запасом під 20 МБ
        body["reference_image_urls"] = [data_uri(r, max_edge=2048) for r in refs[:CAPS["max_refs"]]]
    body.update(opts.get("params") or {})          # ручні/неперевірені поля з ref2game.json
    r = http_json("POST", f"{API_BASE}/{kind}", body, _auth(dry_run),
                  timeout=float(opts.get("timeout", 120)), dry_run=dry_run)
    if dry_run:
        return {"dry_run": True}
    task_id = r.json.get("result")
    if not task_id:
        raise GenError(f"meshy: no task id in {str(r.json)[:300]}")
    say(f"meshy {kind} task {task_id} submitted ({model}, {body['aspect_ratio']})", name=opts.get("_name"))

    def check():
        s = http_json("GET", f"{API_BASE}/{kind}/{task_id}", None, _auth(False)).json
        st = s.get("status")
        if st == "SUCCEEDED":
            return s
        if st in ("FAILED", "CANCELED"):
            raise GenError(f"meshy task {task_id} {st}: {str(s.get('task_error') or s)[:400]}")
        return None

    s = poll(check, timeout=float(opts.get("timeout", 900)), label=f"meshy {task_id}")
    urls = s.get("image_urls") or []
    if not urls:
        raise GenError(f"meshy task {task_id}: no image_urls in {str(s)[:400]}")
    say(f"meshy task {task_id}: {s.get('consumed_credits', '?')} credits", name=opts.get("_name"))
    return {"path": download(urls[0], out_raw), "native_alpha": bool(transparent),
            "request_id": task_id, "model": model}


def check():
    """Безкоштовна перевірка ключа: список останніх задач (нічого не генерує, кредити не витрачає)."""
    try:
        http_json("GET", f"{API_BASE}/image-to-image?page_size=1", None, _auth(False), retries=0, timeout=15)
        return True, "key accepted"
    except GenError as e:
        return False, str(e)[:80]
