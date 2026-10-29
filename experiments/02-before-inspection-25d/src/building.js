// src/building.js — будинок у розрізі (як ляльковий будиночок): кімнати, зріз стін і перекриттів, прорізи-переходи, дах, вежа.
// Координати світу = пікселі нашої мальованої лабораторії: вона займає x 0…3588, y 0…1080 (y — вгору, підлога лаби на y=0).
// Будинок навмисно «нерівний»: високий архів під власним фронтоном, горище, вежа, прибудова з поверхами, зсунутими
// на пів поверху, і шахта ліфта між ними. Прорізи в стінах і отвори в перекриттях показують, куди можна пройти.
import * as THREE from 'three';

export const FH = 1080, SLAB = 60;                  // висота поверху старого корпусу і товщина перекриття
export const LAB = { x: 0, w: 3588, floor: 0 };     // наша лабораторія — поверх 0
export const floorY = (f) => f * (FH + SLAB);       // y підлоги поверху f старого корпусу
const X0 = -1100, XM = 3588;                        // ліва стіна (сходи й вежа) і права стіна старого корпусу
const ST = { x: X0, w: 1040 };                      // сходова клітка
export const SHAFT = { x: XM + SLAB, w: 500, y0: -1560, y1: 2280 };   // шахта ліфта між корпусом і прибудовою
const AX = SHAFT.x + SHAFT.w + SLAB, AW = 1600, AH = 900, X1 = AX + AW;   // прибудова: нижчі кімнати 16:9
// підлоги прибудови: котельня напівпідвальна (нижче землі), далі кожен поверх на пів поверху нижче, ніж у старому корпусі
export const ANNEX_FLOORS = [-1500, -540, 420];
const GROUND = floorY(-1);                          // рівень землі = підлога холу
const TOWER = { y: floorY(2), h: 1820 };            // вежа над сходами
const DOME = 455;                                   // висота купола (верхні 25 % картинки вежі — намальовані ребра купола)
export const DH = 720;                              // висота дверного прорізу
const DIM = 0xaeb3c2;                               // «вимкнене світло»: колір множиться на картинку — темніше й холодніше

// Дах. Головний скат іде від вежі до гребеня над горищем; архів має власний фронтон (його верх намальований
// на картинці: краї на 25 % згори, гребінь посередині). Лінія даху — вища з двох; T — товщина покрівлі.
const T = 110;
const atticRoof = (x) => floorY(2) + 0.608 * (x <= 1930 ? x + 60 : 1990 - (x - 1930));
const ARCH = { x: 1960, w: 1628, y: floorY(1), h: 2141 };
const archRoof = (x) => ARCH.y + ARCH.h + T - Math.abs(x - (ARCH.x + ARCH.w / 2)) * 0.657;
export const roofAt = (x) => Math.max(atticRoof(x), x > 1800 && x < XM + 250 ? archRoof(x) : -1e9);

// Кімнати: x, y, w, h (лівий нижній кут і розмір у світі), картинка, tint (колір-множник), flip (дзеркально),
// clip (обрис замість прямокутника — під скосом даху), glow — вогники для decor.js: [u, v, радіус, колір, характер]
// (u, v — частки ширини/висоти картинки від лівого нижнього кута; характер: lamp — рівне, flicker — мерехтить,
// secret — інколи гасне, ніби хтось пройшов перед світлом).
export const ROOMS = [
  // сходова клітка, 4 поверхи: марш іде вгору праворуч в отвір у стелі; на непарних поверхах дзеркально — виходить зигзаг
  ...[-2, -1, 0, 1].map((f) => ({ name: 'Сходи', x: ST.x, y: floorY(f), w: ST.w, h: FH, img: 'assets/bg_stairs.jpg',
    tint: DIM, flip: Math.abs(f) % 2 === 1, stairs: true })),
  { name: 'Вежа Академіка', x: ST.x, y: TOWER.y, w: ST.w, h: TOWER.h, img: 'assets/bg_tower.jpg', dome: true,
    glow: [[0.7, 0.627, 120, 0xffb060, 'flicker']] },
  { name: 'Кабінет Шефа', x: 0, y: floorY(1), w: 1900, h: FH, img: 'assets/bg_chief.jpg',     // Шеф не спить перед інспекцією
    glow: [[0.515, 0.845, 260, 0xffc070, 'lamp'], [0.435, 0.465, 140, 0xffd080, 'lamp']] },
  { name: 'Архів', ...ARCH, img: 'assets/bg_archive2.jpg',
    clip: [[ARCH.x, ARCH.y], [ARCH.x + ARCH.w, ARCH.y], [ARCH.x + ARCH.w, archRoof(ARCH.x + ARCH.w) - T],
           [ARCH.x + ARCH.w / 2, ARCH.y + ARCH.h], [ARCH.x, archRoof(ARCH.x) - T]],
    glow: [[0.39, 0.25, 170, 0xffc070, 'lamp'], [0.765, 0.2, 200, 0xff9a40, 'secret']] },
  { name: 'Горище', x: 0, y: floorY(2), w: 1900, h: 1100, img: 'assets/bg_attic.jpg',
    clip: [[121, floorY(2)], [1900, floorY(2)], [1900, atticRoof(1900) - T]] },
  { name: 'Лабораторія №3', x: 0, y: 0, w: LAB.w, h: FH, img: 'assets/lab.jpg' },
  { name: 'Хол і вахта · вхід', x: 0, y: floorY(-1), w: 1920, h: FH, img: 'assets/bg_hall.jpg',
    glow: [[0.42, 0.51, 150, 0xffc080, 'lamp']] },
  { name: 'Майстерня', x: 1980, y: floorY(-1), w: XM - 1980, h: FH, img: 'assets/bg_workshop.jpg', tint: DIM,
    glow: [[0.121, 0.687, 110, 0xffc080, 'flicker']] },
  { name: 'Підвал · щиток і нірка пані Хвостенко', x: 0, y: floorY(-2), w: 1920, h: FH, img: 'assets/bg_cellar.jpg',
    glow: [[0.73, 0.19, 90, 0xffa040, 'flicker']] },
  { name: 'Підвал', x: 1980, y: floorY(-2), w: XM - 1980, h: FH, img: 'assets/bg_cellar.jpg', flip: true, tint: 0x8a8580 },
  // прибудова: власні кольори й світло (зелений екран, фіолетові прилади, вогонь котла)
  { name: 'Котельня', x: AX, y: ANNEX_FLOORS[0], w: AW, h: AH, img: 'assets/bg_boiler.jpg',
    glow: [[0.24, 0.40, 160, 0xff7a20, 'flicker']] },
  { name: 'Сусідня лабораторія', x: AX, y: ANNEX_FLOORS[1], w: AW, h: AH, img: 'assets/bg_lab2b.jpg',
    glow: [[0.132, 0.486, 90, 0x60d0ff, 'lamp'], [0.203, 0.474, 80, 0xb070ff, 'lamp'], [0.5, 0.657, 80, 0x90e0ff, 'flicker'],
           [0.65, 0.67, 110, 0xc090ff, 'flicker']] },
  { name: 'Бухгалтерія', x: AX, y: ANNEX_FLOORS[2], w: AW, h: AH, img: 'assets/bg_accounting2.jpg',
    glow: [[0.68, 0.5, 120, 0x60ff90, 'lamp']] },
];
// де на картинці сходів марш заходить в отвір у стелі (частки ширини) — там прорізаємо перекриття
const STAIR_HOLE = [0.62, 0.95];

// Детермінований «випадок»: однакова «рука художника» щоразу (інакше краї стін змінювались би після кожного перезавантаження)
let seed = 20261029;
function rnd() { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

// Прямокутник з нерівними краями — зріз стіни, ніби намальований пензлем, а не під лінійку
function wob(x, y, w, h, a = 7) {
  const pts = [];
  const edge = (x1, y1, x2, y2) => {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 90));
    const nx = y1 - y2, ny = x2 - x1, l = Math.hypot(nx, ny) || 1;
    for (let i = 0; i < n; i++) { const j = i ? (rnd() - 0.5) * 2 * a : 0;
      pts.push([x1 + (x2 - x1) * i / n + nx / l * j, y1 + (y2 - y1) * i / n + ny / l * j]); }
  };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
  return pts;
}

// Багатокутник → сітка; uvf перетворює точку світу на координати текстури (для кімнат — частка картинки, для зрізу — плитка)
function poly(scene, pts, mat, z, uvf = (x, y) => [x / 600, y / 600]) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))));
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const [u, v] = uvf(p.getX(i), p.getY(i)); uv.setXY(i, u, v); }
  const m = new THREE.Mesh(g, mat); m.position.z = z; scene.add(m); return m;
}
const flat = (col, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: col, toneMapped: false }, o));

export async function buildHouse(scene) {
  const loader = new THREE.TextureLoader();
  const tex = (url, f) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; if (f) f(t); });
  const sec = tex('assets/bg_section.jpg', (t) => { t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; });  // дзеркальний повтор ховає шви
  const cut = flat(0xffffff, { map: sec });                  // зріз стін і перекриттів — стара цегла
  const roofMat = flat(0x9a7466, { map: sec });               // покрівля — та сама цегла, темніша й червоніша
  const voidMat = flat(0x3e322c, { map: sec });               // «нутро» будинку: видно в прорізах і отворах
  const out = { glows: [], doors: [], spills: [] };

  // небо: темно-синя площина далеко позаду + місяць і зорі
  poly(scene, wob(-9000, -7000, 22000, 16000, 0), flat(0x0e1526), -60);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(150, 48), flat(0xf2e6b8)); moon.position.set(5200, 4300, -50); scene.add(moon);
  const sp = []; for (let i = 0; i < 220; i++) sp.push(-7000 + rnd() * 18000, 2400 + rnd() * 3500, -55);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 3, sizeAttenuation: false })));
  // земля від рівня входу донизу
  poly(scene, [[-9000, -7000], [13000, -7000], [13000, GROUND], [-9000, GROUND]], flat(0x1a140e), -40);

  // «нутро» за кімнатами (z -1): старий корпус, горище під дахом, вежа, шахта, прибудова
  poly(scene, wob(X0 - 80, floorY(-2) - SLAB, XM + 140 - X0, floorY(2) - floorY(-2) + SLAB, 0), voidMat, -1);
  poly(scene, [[-60, floorY(2) - SLAB], ...roofLine(-60, XM + SLAB), [XM + SLAB, floorY(2) - SLAB]], voidMat, -1);
  poly(scene, wob(X0 - 80, TOWER.y, ST.w + 140, TOWER.h - DOME + 20, 0), voidMat, -1);
  poly(scene, wob(SHAFT.x, SHAFT.y0, SHAFT.w + SLAB, SHAFT.y1 - SHAFT.y0, 0), voidMat, -1);
  poly(scene, wob(AX - SLAB, ANNEX_FLOORS[0] - SLAB, AW + 2 * SLAB, ANNEX_FLOORS[2] + AH - ANNEX_FLOORS[0] + 2 * SLAB, 0), voidMat, -1);

  // кімнати: картинка на багатокутнику (прямокутник або обрис під дахом / куполом)
  for (const r of ROOMS) {
    const map = tex(r.img, r.flip ? (t) => { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; } : null);
    const pts = r.dome ? domeOutline(r) : r.clip || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    poly(scene, pts, flat(r.tint ?? 0xffffff, { map }), 0, (x, y) => [(x - r.x) / r.w, (y - r.y) / r.h]);
    for (const [u, v, rad, col, kind] of r.glow || []) out.glows.push({ x: r.x + u * r.w, y: r.y + v * r.h, r: rad, col, kind });
  }
  // шахта ліфта: вузька картинка, що повторюється вгору (рейки, троси, цегла)
  const shaftTileH = SHAFT.w * 1080 / 608;
  poly(scene, [[SHAFT.x, SHAFT.y0], [SHAFT.x + SHAFT.w, SHAFT.y0], [SHAFT.x + SHAFT.w, SHAFT.y1], [SHAFT.x, SHAFT.y1]],
    flat(0xc8c8d0, { map: tex('assets/bg_shaft.jpg', (t) => { t.wrapT = THREE.RepeatWrapping; }) }), 0,
    (x, y) => [(x - SHAFT.x) / SHAFT.w, (y - SHAFT.y0) / shaftTileH]);

  // ---- зріз: перекриття (горизонталі) з отворами і стіни (вертикалі) з дверними прорізами ----
  // перекриття від x0 до x1 на висоті y, з отворами [a, b]. Верх рівний (це підлога), а низ — нерівний і товщий
  // місцями (обсипана цегла, провислі балки): так поверхи не виглядають розкресленими під лінійку
  const slabPiece = (a, b, y) => {
    const pts = [[a, y + SLAB], [b, y + SLAB]];
    for (let x = b; x >= a; x -= 70) pts.push([x, y - 8 - rnd() * 26 - (rnd() < 0.12 ? 30 : 0)]);
    pts.push([a, y - 10]); poly(scene, pts, cut, 2);
  };
  const slab = (x0, x1, y, holes = []) => {
    let a = x0;
    for (const [h0, h1] of [...holes].sort((p, q) => p[0] - q[0])) { if (h0 > a) slabPiece(a, h0, y); a = h1; }
    if (x1 > a) slabPiece(a, x1, y);
  };
  const wall = (x, y0, y1, doors = [], w = SLAB) => {   // стіна від y0 до y1, дверні прорізи висотою DH від підлог doors
    let a = y0;
    for (const d of [...doors].sort((p, q) => p - q)) { if (d > a) poly(scene, wob(x, a, w, d - a, 11), cut, 2); a = d + DH; }
    if (y1 > a) poly(scene, wob(x, a, w, y1 - a, 11), cut, 2);
  };
  // отвір у перекритті над сходами поверху f: там, де марш іде в стелю (у дзеркальних — з іншого боку)
  const stairHole = (f) => {
    const r = ROOMS.find((q) => q.stairs && q.y === floorY(f));
    if (!r) return [];
    return [(r.flip ? [1 - STAIR_HOLE[1], 1 - STAIR_HOLE[0]] : STAIR_HOLE).map((k) => ST.x + k * ST.w)];
  };
  // старий корпус: перекриття над кожним поверхом (у сходах — отвір для маршу; у майстерні — ляда в підвал)
  const HATCH = [3180, 3400];
  slab(X0 - 80, XM + SLAB, floorY(-2) - SLAB);
  slab(X0 - 80, XM + SLAB, floorY(-1) - SLAB, [...stairHole(-2), HATCH]);
  slab(X0 - 80, XM + SLAB, floorY(0) - SLAB, stairHole(-1));
  slab(X0 - 80, XM + SLAB, floorY(1) - SLAB, stairHole(0));
  slab(X0 - 80, ARCH.x, floorY(2) - SLAB, stairHole(1));          // над архівом перекриття нема — він на два поверхи
  // отвір над сходами — темний проліт: намальований марш заходить у темряву і «виходить» на поверх вище
  for (const f of [-2, -1, 0, 1]) { const [a, b] = stairHole(f)[0]; poly(scene, wob(a, floorY(f + 1) - SLAB - 6, b - a, SLAB + 6, 4), flat(0x0d0907), 1.5); }
  // вертикалі старого корпусу
  const towerTop = TOWER.y + TOWER.h - DOME;
  wall(X0 - 80, floorY(-2) - SLAB, towerTop, [], 80);                                    // зовнішня ліва (вхід — окремо нижче)
  wall(-60, floorY(-2), towerTop, [floorY(-2), floorY(-1), floorY(0), floorY(1)]);       // сходи ↔ кімнати
  wall(1900, floorY(1), roofAt(1930), [floorY(1), floorY(2)]);                           // кабінет ↔ архів, горище ↔ галерея архіву
  wall(1920, floorY(-1), floorY(0) - SLAB, [floorY(-1)]);                                // хол ↔ майстерня
  wall(1920, floorY(-2), floorY(-1) - SLAB, [floorY(-2)]);                               // підвал ↔ підвал
  wall(XM, floorY(-2) - SLAB, roofAt(XM + 30), [floorY(-1), floorY(0), floorY(1)]);      // корпус ↔ шахта ліфта
  // шахта і прибудова: перекриття прибудови зсунуті відносно старого корпусу — горизонталі не йдуть в одну лінію
  slab(SHAFT.x, SHAFT.x + SHAFT.w, SHAFT.y0);
  wall(SHAFT.x + SHAFT.w, SHAFT.y0, SHAFT.y1, ANNEX_FLOORS);                             // шахта ↔ прибудова
  for (const y of ANNEX_FLOORS) slab(AX, X1 + SLAB, y - SLAB);
  slab(AX, X1 + SLAB, ANNEX_FLOORS[2] + AH);
  wall(X1, ANNEX_FLOORS[0] - SLAB, ANNEX_FLOORS[2] + AH + SLAB);
  poly(scene, wob(XM, SHAFT.y1, SHAFT.w + 2 * SLAB, 300), cut, 2);                      // машинне відділення ліфта над шахтою

  // ---- дах ----
  const line = roofLine(-180, XM + 220);
  poly(scene, [...line, ...line.map(([x, y]) => [x, y - T]).reverse()], roofMat, 3);   // смуга покрівлі вздовж лінії даху
  // вежа: купол з обрисом над намальованими ребрами, шпиль
  const cx = ST.x + ST.w / 2;
  poly(scene, [...domeArc(cx, towerTop, ST.w / 2 + 80, DOME + 80), ...domeArc(cx, towerTop, ST.w / 2, DOME).reverse()], roofMat, 3);
  const top = towerTop + DOME + 80;
  poly(scene, [[cx - 40, top - 10], [cx + 40, top - 10], [cx, top + 260]], roofMat, 3);
  // прибудова: односхилий дах від шахти донизу праворуч, під ним — клин зрізу
  const ly0 = ANNEX_FLOORS[2] + AH + SLAB, lx0 = AX, lx1 = X1 + 200, lyTop = ly0 + 480;
  poly(scene, [[lx0, ly0], [X1 + SLAB, ly0], [lx0, lyTop - 20]], voidMat, -1);
  poly(scene, [[lx0, lyTop], [lx1, ly0 - 40], [lx1, ly0 - 130], [lx0, lyTop - 90]], roofMat, 3);

  // вхід: двері в лівій зовнішній стіні на рівні землі (сюди вранці зайде інспектор Пильнюк)
  poly(scene, wob(X0 - 80, floorY(-1), 80, 620, 3), flat(0x5a3d22), 3);

  // для decor.js: прочинені двері (side — у який бік від стіни відчинені), світло з освітленої кімнати в темну, ляда, шахта
  out.doors.push({ x: -60, y: floorY(1), side: -1 }, { x: -60, y: floorY(0), side: -1 }, { x: -60, y: floorY(-1), side: -1 },
                 { x: 1900, y: floorY(1), side: 1 }, { x: 1920, y: floorY(-1), side: 1 });
  out.spills.push({ x: 1960, y: floorY(1), dir: 1, col: 0xffb060 },      // з кабінету Шефа в архів
                  { x: -60, y: floorY(1), dir: -1, col: 0xffb060 },      // з кабінету на сходи
                  { x: -60, y: floorY(0), dir: -1, col: 0xffc080 },      // з нашої лаби на сходи
                  { x: 1980, y: floorY(-1), dir: 1, col: 0xffc080 });    // з холу в майстерню
  out.hatch = { x: HATCH[0], y: floorY(-1), w: HATCH[1] - HATCH[0] };
  out.lift = { x: SHAFT.x, w: SHAFT.w, stops: [floorY(-1), floorY(0), floorY(1), ...ANNEX_FLOORS].sort((a, b) => a - b) };
  out.bounds = [X0 - 80, X1 + SLAB];
  return out;
}

// точки лінії даху від xa до xb (крок 20 px — вистачає, щоб злами гребенів і ендови були на місці)
function roofLine(xa, xb) { const p = []; for (let x = xa; x < xb; x += 20) p.push([x, roofAt(x)]); p.push([xb, roofAt(xb)]); return p; }
// дуга купола: півеліпс від правого краю до лівого
function domeArc(cx, cy, rx, ry) { const p = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
// обрис вежі: прямокутник, зверху — купол
function domeOutline(r) { return [[r.x, r.y], [r.x + r.w, r.y], ...domeArc(r.x + r.w / 2, r.y + r.h - DOME, r.w / 2, DOME)]; }
