# Перевірка архіву гри перед завантаженням на itch.io (чи інший Linux-хостинг).
# Windows не розрізняє регістр у назвах файлів (Hero.png = hero.png), а сервери itch — розрізняють:
# якщо код просить "Hero.png", а в архіві "hero.png", локально все працює, а на itch картинка/звук не завантажиться.
# Запуск: python tools/casecheck.py ../../builds/itch/yalynka-itch.zip
import zipfile, re, sys

z = zipfile.ZipFile(sys.argv[1])
# усі файли в архіві (папки пропускаємо — вони закінчуються на '/')
names = set(n for n in z.namelist() if not n.endswith('/'))
# той самий список, але ключ — назва малими літерами: так знайдемо «майже збіги»
low = {n.lower(): n for n in names}
bad = 0
for n in names:
    # посилання на файли шукаємо лише в коді й даних
    if not n.endswith(('.js', '.html', '.json')):
        continue
    s = z.read(n).decode('utf-8', 'ignore')
    # рядки в лапках, схожі на шлях до файлу з відомим розширенням
    for m in set(re.findall(r'''["'`]([\w./-]+\.(?:png|jpg|jpeg|webp|ogg|mp3|wav|js|json|woff2?|ttf))["'`]''', s)):
        p = m.lstrip('./')
        if p in names:
            continue  # точний збіг — усе гаразд
        if p.lower() in low:
            # файл є, але з іншим регістром — на itch це буде «не знайдено»
            print('CASE MISMATCH', n, m, '->', low[p.lower()])
            bad += 1
print('files', len(names), 'case problems', bad)
sys.exit(1 if bad else 0)
