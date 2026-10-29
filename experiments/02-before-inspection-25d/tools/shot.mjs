// tools/shot.mjs — сервер гри + перевірка в headless Chromium: знімок екрана і (за потреби) відео демо-режиму.
//   node tools/shot.mjs serve [PORT]          — просто сервер для браузера (за замовчуванням 8931)
//   node tools/shot.mjs shot OUT.png [SECS]   — відкрити гру з ?auto=1, почекати SECS с, зняти кадр
//   node tools/shot.mjs video OUT.mp4 SECS    — записати демо SECS с у відео (Playwright пише webm → ffmpeg у mp4)
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { createRequire } from 'module';
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };
// свій сервер: Python-овий на Windows іноді віддає .js як text/plain, і браузер відмовляється запускати модулі
const srv = http.createServer((q, r) => { let f;
  try { f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); } catch { f = ''; }
  // безпека: віддаємо лише файли з папки гри. Без цієї перевірки запит «/../../.env» віддав би ключ Meshy —
  // а гру ми іноді відкриваємо назовні через тунель (localhost.run)
  if (!f.startsWith(root + path.sep)) { r.writeHead(403); r.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); r.end(d); }); });
const [cmd, out, arg] = process.argv.slice(2);
await new Promise((r) => srv.listen(cmd === 'serve' ? +(out || 8931) : 0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
if (cmd === 'serve') { console.log('serving', url); }
else {
  const req = createRequire(path.join(root, '../../.claude/skills/ref2game/scripts/render.mjs'));
  const { chromium } = req('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const vdir = path.join(root, 'frames', '_video');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(cmd === 'video' ? { recordVideo: { dir: vdir, size: { width: 1280, height: 720 } } } : {}) });
  const tab = await ctx.newPage();
  tab.on('pageerror', (e) => console.error('PAGE ERROR:', e.message)); tab.on('console', (m) => m.type() === 'error' && console.error(m.text()));
  await tab.goto(url + '?auto=1&shot=1');
  await tab.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await tab.waitForTimeout(+(arg || 3) * 1000);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  if (cmd === 'shot') await tab.screenshot({ path: out });
  const vid = cmd === 'video' ? tab.video() : null;
  await ctx.close(); await browser.close(); srv.close();
  if (vid) { const w = await vid.path(); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', w, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', out]); fs.rmSync(vdir, { recursive: true, force: true }); }
  console.log(out);
}
