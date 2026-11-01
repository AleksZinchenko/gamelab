// tools/avoid_test.mjs — перевірка обходу: Ліна йде крізь місце колеги / прямо на колегу, ми міряємо відстані.
//   node tools/avoid_test.mjs [frames/avoid.png]
// «ratio» — відстань між героями у частках їхніх п'ятен: < 1 — один «уліз» в іншого (так бути не має).
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.resolve(root, '.' + decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root + path.sep)) { r.writeHead(403); r.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const { chromium } = createRequire(path.join(root, '../../.claude/skills/ref2game/scripts/render.mjs'))('playwright');
const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
tab.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
// EXTRA=zoom=1.6 — додаткові параметри сторінки (наближена камера, щоб роздивитись обхід)
await tab.goto(`http://127.0.0.1:${srv.address().port}/?shot=1` + (process.env.EXTRA ? '&' + process.env.EXTRA : ''));
await tab.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });

// один сценарій: поставити Ліну в (x0, d0), послати в (x1, d1), стежити до зупинки
const run = (x0, d0, x1, d1) => tab.evaluate(([x0, d0, x1, d1]) => new Promise((done) => {
  const { lina } = window.__game; lina.x = x0; lina.d = d0; lina.walkTo(x1, d1);
  const min = {}; let dMin = 1, dMax = 0, t = 0;
  const id = setInterval(() => {
    t += 0.05; dMin = Math.min(dMin, lina.d); dMax = Math.max(dMax, lina.d);
    for (const o of lina.others) {
      const r = Math.hypot(lina.x - o.x, (lina.d - o.d) * 300 / 0.9) / (lina.foot + o.foot);
      const k = Object.keys(window.__game.cast).find((n) => window.__game.cast[n] === o);
      min[k] = Math.min(min[k] ?? 9, r);
    }
    if (!lina.target || t > 20) { clearInterval(id);
      done({ end: [Math.round(lina.x), +lina.d.toFixed(2)], face: lina.face, dRange: [+dMin.toFixed(2), +dMax.toFixed(2)], secs: +t.toFixed(1),
        minRatio: Object.fromEntries(Object.entries(min).map(([k, v]) => [k, +v.toFixed(2)])) }); }
  }, 50);
}), [x0, d0, x1, d1]);

const dv = await tab.evaluate(() => { const a = window.__game.cast.dvichi; return [a.x, a.d]; });
console.log('Двічі зараз:', dv.map((v) => +v.toFixed(2)));
console.log('1) крізь місце Двічі зліва направо:', JSON.stringify(await run(dv[0] - 500, dv[1], dv[0] + 500, dv[1])));
console.log('2) тап прямо на Мирона:', JSON.stringify(await run(2500, 0.6, 3080, 0.2)));
console.log('3) тап прямо на Академіка:', JSON.stringify(await run(1200, 0.5, 560, 0.02)));
// кадр посеред обходу: знову крізь Двічі і знімок через 2.5 с
const out = process.argv[2] || 'frames/avoid.png';
await tab.evaluate(() => { const { lina, cast } = window.__game; lina.x = cast.dvichi.x - 400; lina.d = cast.dvichi.d; lina.walkTo(cast.dvichi.x + 400, cast.dvichi.d); });
await tab.waitForTimeout(2500); fs.mkdirSync(path.dirname(out), { recursive: true }); await tab.screenshot({ path: out });
console.log(out);
await browser.close(); srv.close();
