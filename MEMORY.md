# MEMORY.md

Стабільні факти та рішення по проєкту. Оновлювати, коли щось змінюється; застаріле — видаляти.

## Користувач і цілі
- GitHub: AleksZinchenko. Вайбкодер, вчиться. Паралельно — `computer-vision-playground`, `nav-playground`.
- Ціль лабораторії — експерименти з розробкою і дизайном ігор для ПК та мобільних.

## Репозиторій
- `gamelab` — https://github.com/AleksZinchenko/gamelab, `main`, коміти напряму.

## Рішення
- 2026-10-14: проєкт створено без рушія; вибір рушія — перша задача (кандидати: Godot 4, Flutter + Flame, Unity).
- 2026-10-14: обрали Unity (вже встановлений), але одразу відклали — спершу пробуємо скіл **ref2game**
  (studioigor, MIT, з відео «2D-графика кодом — реально?»): референс → 2D-гра в браузері, арт генерує нейромережа, рух — код.
- 2026-10-14: генератор для ref2game — Meshy API (`gpt-image-2`, image-to-image з референсами), а не Codex:
  Codex залогінений API-ключем OpenAI (платно за кожен виклик), а Meshy Pro вже оплачений (спільно з AssetFactory).

## Середовище
- Локально: Windows 11, NVIDIA RTX 3050 Laptop (4 ГБ VRAM).
- Встановлено: Unity 6000.5.4f1 (Win/Android/WebGL), Flutter 3.32.8, Python 3.13, Node 22, ffmpeg, Codex CLI.

## Граблі (на які вже наступали — не повторювати)
- PowerShell `@'…'@` у Bash-інструменті ламає повідомлення коміта (див. CLAUDE.md, розділ «Коміти»).
- `python3` у Windows — заглушка Microsoft Store, а не Python. Скрипти викликати через `python`.
- Консоль Windows у cp1251: Python падає з `UnicodeEncodeError` на символах типу `→`. Ліки — `PYTHONUTF8=1`
  (прописано в `.claude/settings.json`; у вже запущеній сесії — `export PYTHONUTF8=1` перед командою).
- Node ESM: `new URL(import.meta.url).pathname` на Windows дає `/C:/...` → «MODULE_NOT_FOUND». Тільки `fileURLToPath`.
- Скіли/скрипти «для macOS і Linux» (ref2game) перед використанням проганяти на тестовому проєкті в scratchpad.
