// tools/snap.mjs — кадри з ЗАДАНОГО стану гри (а не з демо): щоб подивитись позу чи анімацію, до якої демо не доходить
// (шлях Мирона, удар Двічі при світлі). Стан = гра після прологу + JS, що його змінює (змінна s — стан, PRO — таймлайн).
//   node tools/snap.mjs OUTDIR "name::JS" ["name2::JS" ...]
//   напр.: node tools/snap.mjs frames/snap "hit::s.light=1;s.phase='lit';s.dv={st:'hit',x:1690,y:900,t0:s.t-0.3};s.camX=1000"
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const root = process.cwd(), req = createRequire(path.join(root, '../../.claude/skills/ref2game/scripts/render.mjs'));
const { chromium } = req('playwright');
const [out, ...jobs] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
// свій маленький http-сервер: картинки з file:// у WebGL не завантажити
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'] });
const tab = await browser.newPage({ viewport: { width: 960, height: 540 } });
tab.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await tab.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`);
await tab.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
for (const job of jobs) {
  const [name, js] = job.split('::');
  const d = await tab.evaluate((js) => {
    const PRO = SIM.STORY.PRO, s = SIM.create(); s.pt = PRO.END - 0.01; while (s.t < 0.2) SIM.step(s, {});   // одразу після прологу
    new Function('s', 'PRO', js)(s, PRO); SCENE.state = s; const url = window.__renderAt(s.t); SCENE.state = null; return url; }, js);
  const f = path.join(out, name + '.png'); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); console.log(f);
}
await browser.close(); srv.close();
