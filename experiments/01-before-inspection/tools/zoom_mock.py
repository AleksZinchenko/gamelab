"""
tools/zoom_mock.py — проба «віддалити камеру» (2026-10-29): кадри без нових картинок і без змін у грі.
1) знімаємо всю кімнату-панораму з героями (світло ввімкнене, інтерфейс прихований) смугами через tools/snap.mjs;
2) склеюємо смуги в одну широку картинку кімнати (3588×1080);
3) зменшуємо її і ставимо в макет «будинок у розрізі»: наша кімната — живий поверх, сусідні кімнати — заглушки
   (притемнені копії нашого ж фону: справжніх ще нема, вони лише показують, як заповниться екран).
  python tools/zoom_mock.py            → study/zoom/room_full.png, zoom_050.png, zoom_035.png
"""
import os, subprocess
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

OUT = "study/zoom"
RW, VW, VH, STRIP = 3588, 1920, 1080, 600          # ширина кімнати, екран гри, ширина однієї смуги

# Стан для знімка: світло є, Двічі вже виліз і стоїть, Ліна посеред кімнати, Мирон біля своєї шафи.
STATE = ("s.light=1;s.lightT=s.t-30;s.phase='lit';s.dv={st:'idle',x:1740,y:900,t0:s.t-5};"
         "s.lx=1300;s.ly=905;s.face=1;s.tx=null;s.bub=[];s.hintId=null;s.tut=3;")
# Ховаємо інтерфейс: після L.finish (кімната вже намальована) малювалки рюкзака/кнопок стають «порожніми».
NOHUD = ("if(!window.__nh){window.__nh=1;const L=LIB,K=['rrect','sprite','label','uiBox'],keep={};K.forEach(k=>keep[k]=L[k]);"
         "const f=L.finish,b=L.beginBG;L.finish=function(){const r=f.apply(this,arguments);K.forEach(k=>L[k]=()=>0);return r;};"
         "L.beginBG=function(){K.forEach(k=>L[k]=keep[k]);return b.apply(this,arguments);};}")


def shoot():
    # смуги беремо з середини кадру, де віньєтка (притемнення країв) найслабша — так шви не видно
    jobs, cuts = [], []
    for x0 in range(0, RW, STRIP):
        cam = max(0, min(RW - VW, x0 - (VW - STRIP) // 2))
        jobs.append(f"s{x0}::{NOHUD}{STATE}s.camX={cam};")
        cuts.append((x0, x0 - cam))
    subprocess.run(["node", "tools/snap.mjs", OUT + "/strips", *jobs], check=True)
    room = Image.new("RGB", (RW, VH))
    for x0, sx in cuts:
        w = min(STRIP, RW - x0)
        room.paste(Image.open(f"{OUT}/strips/s{x0}.png").convert("RGB").crop((sx, 0, sx + w, VH)), (x0, 0))
    room.save(f"{OUT}/room_full.png")
    return room


def ghost(src, w, h, seed):
    # кімната-заглушка: шматок нашого ж фону, віддзеркалений, притемнений і трохи розмитий
    x = (seed * 977) % max(1, src.width - w)
    g = src.crop((x, 0, x + w, src.height)).resize((w, h)).transpose(Image.FLIP_LEFT_RIGHT)
    g = ImageEnhance.Color(g).enhance(0.55)
    return ImageEnhance.Brightness(g.filter(ImageFilter.GaussianBlur(2))).enhance(0.55)


def house(room, k, name):
    # k — у скільки разів зменшуємо кімнату (1.0 = як зараз у грі)
    bg = Image.open("live/assets/bg_room_a.jpg").convert("RGB")
    rw, rh = int(RW * k), int(VH * k)
    slab = max(10, int(46 * k))                    # перекриття між поверхами (товщина)
    img = Image.new("RGB", (VW, VH), (14, 20, 36))  # нічне небо за будинком
    d = ImageDraw.Draw(img)
    # камера дивиться на середину нашої кімнати; кімната — середній поверх
    ox, oy = VW // 2 - rw // 2 + int(rw * 0.08), VH // 2 - rh // 2 + int(rh * 0.12)
    PAT = [0.55, 0.8, 0.45, 1.0, 0.6]              # ширини кімнат-заглушок (у частках нашої), щоб стіни не стояли в лінію
    for f in range(-2, 4):                         # поверхи: від'ємні — вище нашого, 0 — наш
        y = oy + f * (rh + slab)
        if y > VH or y + rh < 0:
            continue
        if f == -2:                                # дах над будинком
            d.polygon([(-100, y + rh + slab), (VW // 2, y + rh * 0.2), (VW + 100, y + rh + slab)], fill=(52, 38, 30))
            continue
        # кімнати-заглушки ряд за рядом; на нашому поверсі — лише ліворуч і праворуч від нашої кімнати
        for side in (-1, 1):
            x, i = (ox, 0) if side < 0 else (ox + rw + slab, 0)
            if f != 0:
                x, side = (ox - rw * 3, 1) if side < 0 else (VW + 1, 1)
            while (side > 0 and x < VW) or (side < 0 and x > 0):
                w = int(rw * PAT[(i + f * 2) % len(PAT)])
                gx = x - w - slab if side < 0 else x
                img.paste(ghost(bg, w, rh, i * 7 + f * 3 + side), (gx, y))
                d.rectangle([gx + w, y, gx + w + slab, y + rh], fill=(40, 30, 24))     # стіна між кімнатами
                x = gx if side < 0 else x + w + slab
                i += 1
        if f == 0:
            img.paste(room.resize((rw, rh), Image.LANCZOS), (ox, y))                # наша жива кімната
        d.rectangle([0, y + rh, VW, y + rh + slab], fill=(46, 34, 26))              # перекриття під поверхом
    # рамка навколо нашої кімнати і підпис масштабу
    d.rectangle([ox - 2, oy - 2, ox + rw + 2, oy + rh + 2], outline=(232, 196, 120), width=3)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 30)
    except OSError:
        font = None
    lina_h = int(400 * k)
    d.rectangle([20, 20, 760, 70], fill=(0, 0, 0))
    d.text((32, 26), f"масштаб {k:.2f} · Ліна ≈ {lina_h} px з 1080 · сусідні кімнати — заглушки", fill=(240, 230, 210), font=font)
    img.save(f"{OUT}/{name}.png")
    print(f"{OUT}/{name}.png")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    r = Image.open(f"{OUT}/room_full.png") if os.path.isfile(f"{OUT}/room_full.png") else shoot()
    house(r, 0.5, "zoom_050")
    house(r, 0.35, "zoom_035")
