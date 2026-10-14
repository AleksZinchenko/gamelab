# SESSIONS.md

Журнал сесій, новіші — зверху. Формат: дата, що зроблено, що лишилось / наступний крок.

## 2026-10-14 — вибір підходу, скіл ref2game
- Обговорили рушії (Godot / Flutter+Flame / Unity) і Amanita Design (Flash/AIR → Unity з 2019).
- Вибрали Unity, але відклали: беремо скіл ref2game з відео studioigor.
- Скіл у `.claude/skills/ref2game/` (upstream `61d8f9e`), виправлено під Windows: python3→python, serve.sh без lsof,
  fileURLToPath у .mjs, PYTHONUTF8. Пробний проєкт у scratchpad: сервер, livecheck, render, qa — працюють.
- Написано плагін `providers/meshy.py` (Meshy text/image-to-image, gpt-image-2); ключ у `.env`, перевірка ключа ок.
  Справжніх генерацій ще не було — кредити не витрачались.
- Далі: придумати референс → `experiments/01-...` → `/ref2game`.

## 2026-10-14 — створення проєкту
- Створено каркас: `README.md`, `CLAUDE.md`, `MEMORY.md`, `SESSIONS.md`, `ROADMAP.md`, `.gitignore`.
- Публічний репо https://github.com/AleksZinchenko/gamelab.
- Далі: обрати рушій і зробити перший експеримент.
