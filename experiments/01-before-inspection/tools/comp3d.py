"""
tools/comp3d.py — накладає кадри 3D-Ліни (tools/render3d.mjs) на нашу кімнату (study/zoom/room_full.png).
  python tools/comp3d.py still   → study/3d/compare.png: 2D-Ліна поруч із 3D-варіантами (як є / мультяшна / «мазки»)
  python tools/comp3d.py video   → study/3d/walk_house.mp4: 3D-Ліна йде через кімнату в макеті будинку (масштаб 0.5)
"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from zoom_mock import house   # макет «будинок у розрізі» з проби камери

ROOM = Image.open("study/zoom/room_full.png").convert("RGBA")
LINA_H, FLOOR = 400, 905          # 2D-Ліна: 400 px заввишки, ступні на y=905 (sizes.js / sim.js)
FONT = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 26)


def frames(d):
    return [Image.open(f"study/3d/{d}/{f}").convert("RGBA") for f in sorted(os.listdir(f"study/3d/{d}")) if f.endswith(".png")]


def fit(fr, h=LINA_H):
    # спільний масштаб для всієї анімації: за висотою найвищого кадру, щоб персонаж не «дихав» розміром
    top = min(f.getbbox()[1] for f in fr); bot = max(f.getbbox()[3] for f in fr)
    k = h / (bot - top)
    return [f.resize((int(f.width * k), int(f.height * k)), Image.LANCZOS) for f in fr], int(bot * k)


def paint(f, size=7):
    # «мазки»: модальний фільтр бере найчастіший колір у квадраті size×size — дрібні деталі зливаються в плями,
    # як від широкого пензля. Робимо на великому кадрі, до зменшення.
    rgb = f.convert("RGB").filter(ImageFilter.ModeFilter(size))
    a = f.getchannel("A").filter(ImageFilter.MedianFilter(5))
    return Image.merge("RGBA", (*rgb.split(), a))


def put(img, f, base, wx, cam=0, floor=FLOOR):
    # ставимо кадр так, щоб ступні (нижній край) були на підлозі в точці wx
    img.alpha_composite(f, (int(wx - cam - f.width / 2), int(floor - base)))


def still():
    cam = 880
    img = ROOM.crop((cam, 0, cam + 1920, 1080))
    std, b1 = fit(frames("idle_std")[:1]); toon, b2 = fit(frames("idle_toon")[:1])
    pnt, b3 = fit([paint(f) for f in frames("idle_toon")[:1]])
    for f, b, x in ((std[0], b1, 1560), (toon[0], b2, 2080), (pnt[0], b3, 2440)):
        put(img, f, b, x, cam)
    d = ImageDraw.Draw(img)
    for x, s in ((1300, "2D-маріонетка (зараз)"), (1560, "3D як є"), (2080, "3D мультяшна"), (2440, "3D + «мазки»")):
        w = d.textlength(s, font=FONT); d.rectangle([x - cam - w / 2 - 8, 950, x - cam + w / 2 + 8, 990], fill=(0, 0, 0))
        d.text((x - cam - w / 2, 952), s, fill=(240, 230, 210), font=FONT)
    img.convert("RGB").save("study/3d/compare.png"); print("study/3d/compare.png")


def video(style="walk_toon", k=0.5, fps=24, secs=5):
    fr = frames(style)
    if "toon" in style:                           # мультяшний варіант відео — одразу з «мазками»
        fr = [paint(f) for f in fr]
    fr, base = fit(fr)
    speed = 260                                   # px/с у світі кімнати: підібрано, щоб ступні не ковзали
    os.makedirs("study/3d/vid", exist_ok=True)
    for i in range(fps * secs):
        t = i / fps
        room = ROOM.copy()
        put(room, fr[int(t * len(fr) / 1.0667) % len(fr)], base, 1850 + speed * t)   # 1.0667 с — довжина циклу ходи
        house(room.convert("RGB"), k, "_frame")
        os.replace("study/zoom/_frame.png", f"study/3d/vid/{i:04d}.png")
    out = f"study/3d/{style}_house.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", "study/3d/vid/%04d.png",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", out], check=True)
    print(out)


if __name__ == "__main__":
    still() if sys.argv[1] == "still" else video(*sys.argv[2:3])
