// src/decor.js — «живий фон» будинку: вогники ламп (рівні, мерехтливі, таємничі), світло з прочинених дверей,
// двері, ляда в підвал і ліфт, що сам їздить шахтою. Усе це — код поверх мальованих кімнат: дешево, а будинок дихає.
// Навіщо: гравець має бачити, що кімнати з'єднані (двері, світло, ліфт), і що в будинку щось відбувається (інтрига).
import * as THREE from 'three';
import { DH, floorY } from './building.js';

// м'яка кругла пляма світла: білий центр → прозорий край (колір задає матеріал)
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
// світло з дверного прорізу: яскраве біля прорізу, згасає вбік і вгору (як віяло світла на підлозі й стіні)
function spillTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 256, 0); h.addColorStop(0, 'rgba(255,255,255,0.9)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h; g.fillRect(0, 0, 256, 128);
  g.globalCompositeOperation = 'destination-in';               // згори світло слабшає: прибираємо верх градієнтом прозорості
  const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.8)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = v; g.fillRect(0, 0, 256, 128); return new THREE.CanvasTexture(c);
}
// «додавальне» змішування: світло додається до картинки під ним і освітлює її, а не замальовує
const light = (map, col, opacity) => new THREE.MeshBasicMaterial({ map, color: col, transparent: true, opacity,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

export function buildDecor(scene, house) {
  const loader = new THREE.TextureLoader();
  const sprite = (url, x, y, w, h, z = 1) => {                 // спрайт з прозорістю, x, y — лівий нижній кут
    const t = loader.load(url, (q) => { q.colorSpace = THREE.SRGBColorSpace; });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    m.position.set(x + w / 2, y + h / 2, z); scene.add(m); return m;
  };

  // вогники: кожен має свій «характер» і власний зсув у часі, щоб не блимали хором
  const gt = glowTexture();
  const glows = house.glows.map((g) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(g.r * 2, g.r * 2), light(gt, g.col, 0.4));
    m.position.set(g.x, g.y, 0.5); scene.add(m);
    return { m, kind: g.kind, t: Math.random() * 100, dip: 0, next: 4 + Math.random() * 8 };
  });

  // світло з прочинених дверей у темну кімнату + самі двері (спрайт прочинених дверей біля прорізу)
  const st = spillTexture();
  for (const s of house.spills) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(700, DH + 60), light(st, s.col, 0.32));
    m.position.set(s.x + s.dir * 350, s.y + (DH + 60) / 2, 0.4); m.scale.x = s.dir; scene.add(m);
  }
  for (const d of house.doors) sprite('assets/props/door.png', d.side < 0 ? d.x - 130 : d.x + 60, d.y + 40, 130, DH - 40);   // двері майже з ребра — вузькі

  // ляда в підлозі майстерні (відчинена) і драбина з підвалу до неї
  const hc = house.hatch;
  sprite('assets/props/hatch.png', hc.x - 20, hc.y - 20, hc.w + 40, (hc.w + 40) * 340 / 345, 1);
  sprite('assets/props/ladder.png', hc.x + 10, floorY(-2) + 60, hc.w - 20, hc.y - floorY(-2) - 60, 1);

  // ліфт: кабіна їздить між зупинками (поверхи старого корпусу і зсунуті поверхи прибудови), чекає, їде далі.
  // Хто ним катається вночі? — інтрига, і заразом видно, що шахта з'єднує обидві частини будинку
  const L = house.lift, cw = L.w - 160, ch = cw * 410 / 277;
  const cab = sprite('assets/props/lift.png', L.x + 80, L.stops[2], cw, ch, 0.6);
  const lift = { y: L.stops[2], to: L.stops[2], wait: 3 };

  return function update(dt) {
    for (const g of glows) {
      g.t += dt; let k;
      if (g.kind === 'lamp') k = 0.42 + 0.03 * Math.sin(g.t * 1.3);                       // рівне тепле світло, ледь «дихає»
      else if (g.kind === 'flicker') {                                                   // мерехтить: шум + інколи майже гасне
        k = 0.36 + 0.06 * Math.sin(g.t * 11) * Math.sin(g.t * 7.3);
        if ((g.next -= dt) < 0) { g.dip = 0.25; g.next = 2 + Math.random() * 7; }
        if (g.dip > 0) { g.dip -= dt; k *= 0.35 + Math.random() * 0.4; }
      } else {                                                                            // secret: хтось проходить перед світлом
        k = 0.5 + 0.05 * Math.sin(g.t * 2);
        if ((g.next -= dt) < 0) { g.dip = 1.2; g.next = 7 + Math.random() * 9; }
        if (g.dip > 0) { g.dip -= dt; k *= 1 - Math.sin(Math.PI * g.dip / 1.2) * 0.85; }
      }
      g.m.material.opacity = k;
    }
    // ліфт: стоїть wait секунд, потім їде до випадкової іншої зупинки, плавно гальмуючи
    if (lift.y === lift.to) {
      if ((lift.wait -= dt) < 0) {
        const o = L.stops.filter((s) => s !== lift.to); lift.to = o[Math.floor(Math.random() * o.length)];
        lift.wait = 3 + Math.random() * 6;
      }
    } else {
      const d = lift.to - lift.y, v = Math.min(240, 40 + Math.abs(d) * 1.2) * dt;
      lift.y = Math.abs(d) <= v ? lift.to : lift.y + Math.sign(d) * v;
    }
    cab.position.y = lift.y + 20 + ch / 2;
  };
}
