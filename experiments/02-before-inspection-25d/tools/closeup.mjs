// tools/closeup.mjs — кадри героя зблизька: стійка → жест → хода. Для перевірки рук, хвату предметів, жестів:
// на загальному плані (0.35) герой ~140 px і дрібниць не видно.
//   node tools/closeup.mjs OUT_DIR WHO GEST [N] [STEP_MS]     WHO: dvichi | miron | akademik; GEST — назва жесту з cast.js
//   ZOOM=1.5 node tools/closeup.mjs …                          (за замовчуванням 2.0; високому Мирону — 1.5, інакше ріже голову)
// Кадри: f00 — стійка, далі N кадрів жесту через STEP мс, потім 3 кадри ходи. Склеїти в рядок:
//   ffmpeg -i OUT_DIR/f%02d.png -vf "scale=300:-1,tile=12x1" row.png
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const root = process.cwd(), [out, who, gest, N = '8', STEP = '250'] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };
// свій маленький сервер (як у shot.mjs): лише файли з папки гри
const srv = http.createServer((q, r) => { const f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root + path.sep)) { r.writeHead(403); r.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const { chromium } = createRequire(path.join(root, '../../.claude/skills/ref2game/scripts/render.mjs'))('playwright');
const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
tab.on('pageerror', (e) => console.error('PAGE ERROR:', e.message)); tab.on('console', (m) => m.type() === 'error' && console.error(m.text()));
// наближена камера (?zoom>1) стежить за Ліною — тож Ліну ховаємо і щокадру ставимо туди, де наш герой
await tab.goto(`http://127.0.0.1:${srv.address().port}/?shot=1&zoom=${process.env.ZOOM || 2.0}`);
await tab.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await tab.evaluate((who) => { const { lina, cast } = window.__game, h = cast[who]; window.__h = h;
  lina.tilt.visible = lina.shadow.visible = false; for (const a of [lina, cast.dvichi, cast.miron]) a.others = [];
  h.target = null; h.x = 2300; h.d = 0.5; h.face = 1; setInterval(() => { lina.x = h.x; }, 16); }, who);
fs.mkdirSync(out, { recursive: true }); let k = 0;
const snap = () => tab.screenshot({ path: `${out}/f${String(k++).padStart(2, '0')}.png`, clip: { x: 390, y: 0, width: 500, height: 720 } });
await tab.waitForTimeout(1500); await snap();
await tab.evaluate((g) => window.__h.gesture(g, 1), gest);
for (let i = 0; i < +N; i++) { await tab.waitForTimeout(+STEP); await snap(); }
await tab.evaluate(() => window.__h.walkTo(3000, 0.5)); await tab.waitForTimeout(600);
for (let i = 0; i < 3; i++) { await snap(); await tab.waitForTimeout(250); }
await browser.close(); srv.close();
console.log(out);
