// src/building.js — будинок у розрізі (як ляльковий будиночок): поверхи, кімнати, перекриття, дах, небо.
// Координати світу = пікселі нашої мальованої лабораторії: вона займає x 0…3588, y 0…1080 (y — вгору, підлога лаби на y=0).
// Кімнати, для яких ще нема малюнка, — заглушки: кольорова «коробка» з назвою (крок 2 плану — намалювати їх у Meshy).
import * as THREE from 'three';

export const FH = 1080, SLAB = 60;                  // висота поверху і товщина перекриття між поверхами
export const LAB = { x: 0, w: 3588, floor: 0 };     // наша лабораторія — поверх 0
const floorY = (f) => f * (FH + SLAB);              // y підлоги поверху f
const X0 = -1100, X1 = 5700;                        // зовнішні стіни будинку (ліва / права)

// План будинку: поверх, x, ширина, назва, колір стін заглушки. Намальовані кімнати мають img (гуаш, Meshy 2026-10-29).
// Ширина кімнати ≈ ширина її картинки при висоті 1080: Meshy малює не ширше 16:9 (≈1920), тому довгий
// нижній поверх поділено на хол, майстерню й котельню. Сходова клітка — одна картинка на всі поверхи.
export const ROOMS = [
  { f: 1, x: X0, w: 1040, name: 'Сходи', img: 'assets/bg_stairs.jpg', dim: true },
  { f: 1, x: 0, w: 1900, name: 'Кабінет Шефа', img: 'assets/bg_chief.jpg' },   // Шеф не спить перед інспекцією — світло горить
  { f: 1, x: 1960, w: 1628, name: 'Архів', img: 'assets/bg_archive.jpg', dim: true },
  { f: 1, x: 3648, w: X1 - 3648, name: 'Бухгалтерія', img: 'assets/bg_accounting.jpg', dim: true },
  { f: 0, x: X0, w: 1040, name: 'Сходи', img: 'assets/bg_stairs.jpg', dim: true, flip: true },  // віддзеркалено — сходи «зигзагом»
  { f: 0, x: 0, w: 3588, name: 'Лабораторія №3', img: 'assets/lab.jpg' },
  { f: 0, x: 3648, w: X1 - 3648, name: 'Сусідня лабораторія', img: 'assets/bg_lab2.jpg', dim: true },
  { f: -1, x: X0, w: 1040, name: 'Сходи', img: 'assets/bg_stairs.jpg', dim: true },
  { f: -1, x: 0, w: 1920, name: 'Хол і вахта · вхід', img: 'assets/bg_hall.jpg', door: true },
  { f: -1, x: 1980, w: 1620, name: 'Майстерня', img: 'assets/bg_workshop.jpg', dim: true },
  { f: -1, x: 3660, w: X1 - 3660, name: 'Котельня', img: 'assets/bg_boiler.jpg', dim: true },
  { f: -2, x: X0, w: X1 - X0, name: 'Підвал · нірка пані Хвостенко', col: '#26241f' },   // поза кадром в Акті I — поки заглушка
];

// Текстура-заглушка: стіна, підлога, вікно і підпис «олівцем» — щоб на макеті було видно, що де буде
function stubTexture(r) {
  const k = 0.25, w = Math.round(r.w * k), h = Math.round(FH * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = r.col; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h * 0.78, w, h * 0.22);                  // підлога темніша за стіну
  g.fillStyle = 'rgba(6,9,18,0.5)'; g.fillRect(0, 0, w, h);                                // ніч: у сусідніх кімнатах темно — погляд іде на нашу
  if (r.f >= -1 && r.name !== 'Сходи') {                                                  // вікно (у підвалі вікон нема)
    const ww = 70, wx = w * 0.62;
    g.fillStyle = r.lit ? '#e9b765' : '#18233d'; g.fillRect(wx, h * 0.22, ww, ww * 1.3);
    g.strokeStyle = '#1b130c'; g.lineWidth = 5; g.strokeRect(wx, h * 0.22, ww, ww * 1.3);
  }
  if (r.name === 'Сходи') {                                                                // сходи — діагональ сходинок
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 6;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(20 + i * 26, h - 10 - i * 26); g.lineTo(46 + i * 26, h - 10 - i * 26); g.stroke(); }
  }
  g.fillStyle = 'rgba(240,228,205,0.55)'; g.font = 'bold 26px "Segoe Print", "Comic Sans MS", cursive';
  g.textAlign = 'center'; g.fillText(r.name, w / 2, h * 0.5);
  g.font = '16px "Segoe Print", "Comic Sans MS", cursive'; g.fillStyle = 'rgba(240,228,205,0.3)'; g.fillText('(заглушка)', w / 2, h * 0.5 + 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Площина-«картинка» в координатах світу: x, y — лівий нижній кут
function plane(scene, x, y, w, h, mat, z = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x + w / 2, y + h / 2, z); scene.add(m); return m;
}
const flat = (col, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: col, toneMapped: false }, o));

export async function buildHouse(scene) {
  const loader = new THREE.TextureLoader();
  // небо: темно-синя площина далеко позаду + місяць і зорі
  plane(scene, -8000, -6000, 20000, 14000, flat(0x0e1526), -60);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(150, 48), flat(0xf2e6b8)); moon.position.set(4600, 3300, -50); scene.add(moon);
  const sp = []; for (let i = 0; i < 160; i++) sp.push(-6000 + Math.random() * 16000, 2300 + Math.random() * 2500, -55);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 3, sizeAttenuation: false })));
  // земля: від рівня входу (поверх -1) донизу
  plane(scene, -8000, -6000, 20000, 6000 + floorY(-1), flat(0x1a140e), -40);
  // кімнати
  for (const r of ROOMS) {
    // dim — кімната без світла: трохи темніша й холодніша (колір матеріалу множиться на картинку), щоб погляд ішов на нашу лабу.
    // flip — дзеркальна картинка (текстура з повтором -1 по x)
    const mat = r.img ? flat(r.dim ? 0xaeb3c2 : 0xffffff, { map: loader.load(r.img, (t) => {
                          t.colorSpace = THREE.SRGBColorSpace;
                          if (r.flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; }
                        }) })
                      : flat(0xffffff, { map: stubTexture(r) });
    plane(scene, r.x, floorY(r.f), r.w, FH, mat, 0);
  }
  // перекриття між поверхами, стіни між кімнатами і зовнішні стіни — «зріз» будинку, темний, як у ляльковому будиночку
  const cut = flat(0x2c2017);
  for (let f = -2; f <= 2; f++) plane(scene, X0 - 80, floorY(f) - SLAB, X1 - X0 + 160, SLAB, cut, 2);
  for (const r of ROOMS) plane(scene, r.x + r.w, floorY(r.f), 60, FH, cut, 2);
  plane(scene, X0 - 80, floorY(-2), 80, floorY(2) - floorY(-2), cut, 2);
  plane(scene, X1, floorY(-2), 80, floorY(2) - floorY(-2), cut, 2);
  // двері входу в хол (поверх -1, ліва зовнішня стіна) — сюди вранці зайде інспектор Пильнюк
  plane(scene, X0 - 80, floorY(-1), 80, 620, flat(0x5a3d22), 3);
  // дах: трикутний фронтон над верхнім поверхом
  const top = floorY(2) - SLAB, s = new THREE.Shape();
  s.moveTo(X0 - 260, top); s.lineTo((X0 + X1) / 2, top + 1300); s.lineTo(X1 + 260, top); s.lineTo(X0 - 260, top);
  const roof = new THREE.Mesh(new THREE.ShapeGeometry(s), flat(0x3a2a1e)); roof.position.z = 2; scene.add(roof);
  return { bounds: [X0 - 80, X1 + 80] };
}
