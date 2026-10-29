// tools/render3d.mjs — проба «3D-персонаж у 2D-світі» (2026-10-29): знімає анімовану GLB-модель кадрами з прозорим фоном.
// Рендер у headless Chromium через three.js; далі кадри накладаємо на наш фон у Python (tools/comp3d.py).
//   node tools/render3d.mjs OUTDIR MODEL.glb STYLE YAW FRAMES
//   STYLE: std — звичайне світло (як модель з коробки); toon — 3 сходинки світла + темний контур (мультяшна стилізація)
//   YAW: поворот у градусах (0 — обличчям до глядача, 70 — майже профіль праворуч)
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const gl = path.resolve(process.cwd(), '../..'), req = createRequire(path.join(gl, '.claude/skills/ref2game/scripts/render.mjs'));
const { chromium } = req('playwright');
const [out, model, style = 'std', yaw = '60', frames = '24'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const rel = path.relative(gl, path.resolve(model)).split(path.sep).join('/');

// Сторінка-рендерер. Камера ортографічна (без перспективного спотворення — як у 2D, де розмір не залежить від відстані),
// трохи згори (~8°), як дивиться наша камера на кімнату.
const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/.claude/skills/ref2game/scripts/node_modules/three/build/three.module.js",
"three/addons/":"/.claude/skills/ref2game/scripts/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const W = 640, H = 960, STYLE = '${style}', YAW = ${+yaw} * Math.PI / 180;
const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
// Світло під нашу кімнату: тепла лампа згори-спереду-зліва, тьмяне тепле розсіяне, холодний місячний контур ззаду-справа
scene.add(new THREE.HemisphereLight(0xffd9a0, 0x2a2018, 0.9));
const key = new THREE.DirectionalLight(0xffc27a, 2.2); key.position.set(-2, 4, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x7f9fff, 0.9); rim.position.set(3, 2, -3); scene.add(rim);
const gltf = await new GLTFLoader().loadAsync('/${rel}');
const root = gltf.scene; root.rotation.y = YAW; scene.add(root);
// toon: кожну частину перефарбовуємо «мультяшним» матеріалом — світло не плавне, а 3 рівні (тінь / півтінь / світло)
const grad = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
const hulls = [];
root.traverse((o) => { if (!o.isMesh) return; o.frustumCulled = false;
  if (STYLE !== 'toon') return;
  const map = o.material.map; o.material = new THREE.MeshToonMaterial({ map, gradientMap: grad });
  // контур «вивернута оболонка»: копія сітки, роздута по нормалях і зафарбована темно-коричневим, видно лише її задні грані
  const t = size.y * 0.004, m = new THREE.MeshBasicMaterial({ color: 0x24170e, side: THREE.BackSide });
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n transformed += normalize(objectNormal) * ' + t.toFixed(5) + ';'); };
  const h = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, m) : new THREE.Mesh(o.geometry, m);
  if (o.isSkinnedMesh) h.bind(o.skeleton, o.bindMatrix); h.frustumCulled = false; hulls.push([o, h]); });
for (const [o, h] of hulls) o.parent.add(h);
const k = size.y * 1.12, cam = new THREE.OrthographicCamera(-k * W / H / 2, k * W / H / 2, k / 2, -k / 2, -50, 50);
cam.position.set(0, box.min.y + size.y * 0.53 + Math.sin(0.14) * 10, 10 * Math.cos(0.14)); cam.lookAt(0, box.min.y + size.y * 0.53, 0);
const mixer = new THREE.AnimationMixer(root), clip = gltf.animations[0];
if (clip) mixer.clipAction(clip).play();
let hips = null; root.traverse((o) => { if (!hips && o.isBone && /hip|pelvis/i.test(o.name)) hips = o; });
window.__info = { clips: gltf.animations.map((a) => [a.name, a.duration]), hips: hips && hips.name, size: size.toArray() };
// кадр i з n: ставимо час анімації, знімаємо зсув стегон по горизонталі (ходимо «на місці»), записуємо, скільки пройшли б
window.__frame = (i, n) => { const T = clip ? clip.duration * i / n : 0; mixer.setTime(T);
  root.position.set(0, 0, 0); root.updateMatrixWorld(true); let dx = 0;
  if (hips) { const p = hips.getWorldPosition(new THREE.Vector3()); dx = p.x; root.position.x = -p.x; root.position.z = -p.z; }
  r.render(scene, cam); return { url: r.domElement.toDataURL('image/png'), dx, pxPerUnit: H / k }; };
window.__ready = true;
</script></body></html>`;

const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/__r3d.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
  fs.readFile(path.join(gl, u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'] });
const tab = await browser.newPage({ viewport: { width: 640, height: 960 } });
tab.on('pageerror', (e) => console.error('PAGE ERROR:', e.message)); tab.on('console', (m) => m.type() === 'error' && console.error(m.text()));
await tab.goto(`http://127.0.0.1:${srv.address().port}/__r3d.html`);
await tab.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const info = await tab.evaluate(() => window.__info); console.log(JSON.stringify(info));
const n = +frames, meta = { info, frames: [] };
for (let i = 0; i < n; i++) {
  const f = await tab.evaluate(([i, n]) => window.__frame(i, n), [i, n]);
  fs.writeFileSync(path.join(out, `f${String(i).padStart(3, '0')}.png`), Buffer.from(f.url.split(',')[1], 'base64'));
  meta.frames.push({ dx: f.dx, pxPerUnit: f.pxPerUnit });
}
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1)); console.log(out, n, 'frames');
await browser.close(); srv.close();
