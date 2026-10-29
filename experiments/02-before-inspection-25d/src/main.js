// src/main.js — головний файл: рендерер three.js, камера «будинок у розрізі», світло, дотики, ігровий цикл.
// Ігровий цикл (game loop): кожен кадр — оновити світ на dt секунд (рух, анімації) і намалювати.
import * as THREE from 'three';
import { buildHouse, LAB, FH } from './building.js';
import { Actor, depthAt } from './actor.js';

const VW = 1920, VH = 1080, ZOOM = 0.35;          // «екран» гри 16:9; ZOOM 0.35 — кімната займає третину висоти (рішення 2026-10-29)
const q = new URLSearchParams(location.search);

// Рендерер: малює в <canvas>. Колір виводимо в sRGB, без тонмапінгу — мальовані фони мають лишитись точно як намальовані
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: q.has('shot') });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();

// Камера ортографічна: розмір не залежить від відстані (як у 2D), видима ширина = 1920 / 0.35 ≈ 5486 px світу
const cam = new THREE.OrthographicCamera(-VW / ZOOM / 2, VW / ZOOM / 2, VH / ZOOM / 2, -VH / ZOOM / 2, 1, 20000);
const CAM_Y = 840;                                 // центр кадру по висоті: видно наш поверх, верхній цілком і пів нижнього
cam.position.set(LAB.w / 2, CAM_Y, 5000);

// Світло тільки для 3D-героїв (мальовані кімнати «незасвічувані»): тепла лампа згори-спереду-зліва,
// тьмяне тепле розсіяне світло кімнати і холодний місячний контур ззаду-справа — під гаму нашого малюнка
scene.add(new THREE.HemisphereLight(0xffd9a0, 0x2a2018, 0.9));
const key = new THREE.DirectionalLight(0xffc27a, 2.2); key.position.set(-2, 4, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x7f9fff, 0.9); rim.position.set(3, 2, -3); scene.add(rim);

// Розмір полотна: найбільший 16:9, що влазить у вікно (решта — чорні смуги), як у грі з 01
function fit() {
  const w = Math.min(innerWidth, innerHeight * VW / VH), h = w * VH / VW;
  renderer.setSize(w, h); const c = renderer.domElement.style;
  c.position = 'absolute'; c.left = (innerWidth - w) / 2 + 'px'; c.top = (innerHeight - h) / 2 + 'px';
}
addEventListener('resize', fit); fit();

await buildHouse(scene);
const lina = await Actor.load('assets/lina.glb', scene);

// Позначка дотику: кільце, що розходиться і зникає — гравець бачить, що гра його «почула» (дрібний juice)
const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40),
  new THREE.MeshBasicMaterial({ color: 0xf3d9a0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
ring.position.z = 30; scene.add(ring); let ringT = 9;

// Дотик/клік: екранні координати → координати світу; якщо в нашій лабі — героїня йде туди.
// Клік на підлогу задає і x, і глибину; клік на стіну — лише x (глибина лишається).
function tap(px, py) {
  const r = renderer.domElement.getBoundingClientRect();
  const p = new THREE.Vector3((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1, 0).unproject(cam);
  if (p.x < LAB.x || p.x > LAB.x + LAB.w || p.y < 0 || p.y > FH) return;
  const d = depthAt(p.y);
  lina.walkTo(THREE.MathUtils.clamp(p.x, 120, LAB.w - 120), d ?? lina.d);
  ring.position.x = p.x; ring.position.y = d === null ? 170 : p.y; ringT = 0;
}
addEventListener('pointerdown', (e) => tap(e.clientX, e.clientY));

// ?auto=1 — демо без гравця: Ліна ходить по кімнаті сама (для запису відео і перевірки)
const AUTO = [[2600, 0.2], [2000, 0.9], [700, 0.5], [1300, 0.3]]; let autoI = 0, autoT = 1;

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);       // dt — скільки секунд минуло з минулого кадру (не більше 0.1 — після «заморозки» вкладки)
  if (q.has('auto') && !lina.target && (autoT -= dt) < 0) { const [x, d] = AUTO[autoI++ % AUTO.length]; lina.walkTo(x, d); autoT = 1.2; }
  lina.update(dt);
  // камера ледь їде за героїнею (на 15 %): вся лаба й так у кадрі, а легкий рух робить сцену живою
  cam.position.x += (LAB.w / 2 + (lina.x - LAB.w / 2) * 0.15 - cam.position.x) * Math.min(1, dt * 3);
  ringT += dt; ring.material.opacity = Math.max(0, 0.8 - ringT * 1.6); ring.scale.setScalar(30 + ringT * 120);
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
window.__ready = true;
frame();
