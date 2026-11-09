// live/hub.js — Ринкова площа (хаб — центральна локація, з якої вирушаєш на рівні й куди повертаєшся з добром).
// Тут: дані площі (будинки, ратуша, ялинка, ліхтарі, брами на вулиці) і її правила — речі з торби по черзі злітають
// на ялинку, а зірка на верхівці запускає фінал. PROG — прогрес гравця (що вже висить), зберігається в браузері.
// Як і sim.js: без Math.random і Date — стан площі залежить лише від вводу й часу (демо й перевірки бачать те саме).
(function (root) {
  const LV0 = root.LEVEL || require('./level.js');
  const GY = LV0.GY, ST_LV = root.LEVELS.street;

  // ---------------- ялинка ----------------
  // Точки — у частках текстури tree_square (u — зліва направо, v — згори вниз), виміряно сіткою (frames/tree_grid.png).
  // Прикраси висять під снігом кожного ярусу — там темна хвоя, кулька на ній читається.
  const TREE = { x: 1500, h: 800, top: [0.5, 0.035],
    orn: [[0.40, 0.30], [0.62, 0.42], [0.30, 0.55], [0.70, 0.66], [0.45, 0.80]],           // 5 прикрас Пекарської
    candy: [[0.56, 0.19], [0.36, 0.43], [0.73, 0.52], [0.22, 0.67], [0.55, 0.69], [0.84, 0.80], [0.16, 0.82], [0.64, 0.86]],
    tiers: [0.17, 0.27, 0.38, 0.50, 0.63, 0.76],                                              // лінії гірлянди
    gifts: [-175, 180] };                                                                     // подарунки під ялинкою (зсув x)
  TREE.w = TREE.h * LV0.TEX.tree_square[0] / LV0.TEX.tree_square[1];
  TREE.x0 = TREE.x - TREE.w / 2; TREE.y0 = GY - TREE.h + 8;                                  // лівий верхній кут спрайта (+8 — «вкопана»)
  TREE.pt = (u, v) => [TREE.x0 + u * TREE.w, TREE.y0 + v * TREE.h];
  TREE.half = (v) => Math.max(0.06, 0.1 + (v - 0.1) * 0.52);                                  // напівширина крони на висоті v (частки)
  // куди летить річ кожного виду: прикраса / цукерка — на гілку, подарунок — під ялинку, зірка — на верхівку
  const slotPos = (k, i) => k === 'orn' ? TREE.pt(...TREE.orn[i]) : k === 'candy' ? TREE.pt(...TREE.candy[i])
    : k === 'gift' ? [TREE.x + TREE.gifts[i], GY - 34] : TREE.pt(...TREE.top);
  const N_CANDY = TREE.candy.length;

  // ---------------- ратуша і брами ----------------
  const TH = { x: 1820, k: 0.66 };            // ратуша: лівий край і масштаб (менша за будинки вулиці — «стоїть у глибині площі»)
  TH.w = LV0.TEX.townhall[0] * TH.k; TH.h = LV0.TEX.townhall[1] * TH.k;
  TH.clock = [0.497, 0.427, 0.083];           // циферблат: центр (частки текстури) і радіус (частка ширини)
  // Брами — виходи з площі на рівні. to: куди веде (null — ще зачинено). post: false — табличка над дверима, без стовпа.
  const GATES = [
    { x: 190, to: 'street', name: 'Пекарська вулиця', dir: -1 },
    { x: TH.x + TH.w / 2, to: null, name: 'Ратушна вежа', post: false },
    { x: 3070, to: null, name: 'Дахи й димарі', dir: 1 },
    { x: 3790, to: null, name: 'Замерзла річка', dir: 1 },
  ];

  // ---------------- прогрес (PROG): що вже висить на ялинці і що лежить у торбі ----------------
  // У браузері — localStorage (переживає перезапуск), у node і в приватному вікні — просто в пам'яті.
  const KEY = 'yalynka.prog.v1';
  const blank = () => ({ orn: [0, 0, 0, 0, 0], gifts: [0, 0], star: 0, candy: 0, best: 0, bag: { orn: [], gifts: [], star: 0 }, lit: 0 });
  const PROG = { d: blank(), last: '' };
  PROG.load = () => { try { const s = root.localStorage && localStorage.getItem(KEY); if (s) PROG.d = Object.assign(blank(), JSON.parse(s)); } catch (e) {} return PROG.d; };
  PROG.write = () => { const s = JSON.stringify(PROG.d); if (s === PROG.last) return; PROG.last = s;
    try { if (root.localStorage) localStorage.setItem(KEY, s); } catch (e) {} };
  PROG.reset = () => { PROG.d = blank(); PROG.write(); };
  PROG.any = () => { const d = PROG.d; return d.orn.some(Boolean) || d.gifts.some(Boolean) || d.star || d.candy || d.bag.orn.length || d.bag.gifts.length || d.bag.star; };
  // Вулицю пройдено: усе зібране, чого ще нема ні на ялинці, ні в торбі, — кладемо в торбу.
  PROG.bank = (S) => { const d = PROG.d, b = d.bag;
    S.orn.forEach((g, i) => { if (g >= 0 && !d.orn[i] && !b.orn.includes(i)) b.orn.push(i); });
    [0, 1].forEach((i) => { if (S.gifts[i] >= 0 && !d.gifts[i] && !b.gifts.includes(i)) b.gifts.push(i); });
    if (S.gifts[2] >= 0 && !d.star) b.star = 1;                                              // третій «подарунок» вулиці — зірка
    d.best = Math.max(d.best, S.sw); PROG.write(); };
  // Площа щокадру повертає свій стан: що вже долетіло до ялинки (летить — теж рахуємо), що лишилось у торбі, чи сяє.
  PROG.sync = (S) => { const d = PROG.d, T = S.tree;
    d.orn = T.orn.map((v) => (v !== -1 ? 1 : 0)); d.gifts = T.gift.map((v) => (v !== -1 ? 1 : 0));
    d.star = T.star !== -1 ? 1 : 0; d.candy = T.candy.filter((v) => v !== -1).length;
    d.bag = { orn: [], gifts: [], star: 0 }; for (const q of S.bagQ) { if (q.k === 'orn') d.bag.orn.push(q.i); else if (q.k === 'gift') d.bag.gifts.push(q.i); else if (q.k === 'star') d.bag.star = 1; }
    d.lit = S.fin !== -1 ? 1 : 0; PROG.write(); };
  // Для перевірок: ?prog=bag — торба з усім добром вулиці (ялинка гола), ?prog=lit — ялинка вже сяє.
  PROG.dev = (mode) => { if (mode === 'bag') PROG.d = Object.assign(blank(), { best: ST_LV.SWEETS.length, bag: { orn: [0, 1, 2, 3, 4], gifts: [0, 1], star: 1 } });
    if (mode === 'lit') PROG.d = Object.assign(blank(), { orn: [1, 1, 1, 1, 1], gifts: [1, 1], star: 1, candy: N_CANDY, best: ST_LV.SWEETS.length, lit: 1 }); };

  // ---------------- правила площі ----------------
  const FLY = 0.8, FLY_STAR = 1.4, GAP = 0.42;   // скільки летить річ на ялинку, зірка; пауза між речами
  // Новий стан площі з прогресу p (те, що вже висить, — «давно», -100; порожнє місце — -1).
  function onInit(S, o) {
    const p = (o && o.prog) || PROG.d, old = (b) => (b ? -100 : -1);
    const candyGoal = Math.min(N_CANDY, Math.round(N_CANDY * Math.min(1, p.best / ST_LV.SWEETS.length)));
    S.tree = { orn: p.orn.map(old), gift: p.gifts.map(old), star: old(p.star), candy: TREE.candy.map((_, i) => old(i < p.candy)) };
    // черга з торби: спершу прикраси, далі подарунки й цукерки, зірка — останньою (вона запускає фінал)
    S.bagQ = [...p.bag.orn.map((i) => ({ k: 'orn', i })), ...p.bag.gifts.map((i) => ({ k: 'gift', i }))];
    for (let i = p.candy; i < candyGoal; i++) S.bagQ.push({ k: 'candy', i });
    if (p.bag.star) S.bagQ.push({ k: 'star', i: 0 });
    S.fin = p.lit ? -100 : -1; S.finEv = !!p.lit; S.hangT = -9; S.exit = null; S.finUI = 0;
  }
  function onStep(S, t) {
    // поруч із ялинкою речі з торби по одній злітають на свої місця
    if (S.bagQ.length && S.fin === -1 && S.faint < 0 && Math.abs(S.x - TREE.x) < 430 && t - S.hangT > GAP) {
      const q = S.bagQ.shift(), [tx, ty] = slotPos(q.k, q.i), fly = q.k === 'star' ? FLY_STAR : FLY;
      if (q.k === 'star') { S.tree.star = t + fly; S.fin = t + fly; } else S.tree[q.k][q.i] = t + fly;   // час, коли річ «сяде» на місце
      S.hangT = t + (q.k === 'star' ? 1 : 0);
      S.ev.push({ k: 'hang', t, x: S.x, y: S.y - 100, kind: q.k, i: q.i, tx, ty, fly });
    }
    // зірка сіла на верхівку → фінал: гірлянда загоряється хвилею, вікна, дзвони, феєрверк; через 7 с — екран фіналу
    if (S.fin >= 0 && !S.finEv && t >= S.fin) { S.finEv = true; S.ev.push({ k: 'fin', t, x: TREE.x, y: slotPos('star')[1] }); }
    if (S.fin >= 0 && !S.finUI && t > S.fin + 7) S.finUI = 1;
  }

  // ---------------- дані площі (ті самі поля, що в рівня вулиці) ----------------
  const HUB = {
    name: 'hub', HUB: true, GY, HK: LV0.HK, LAMP_H: LV0.LAMP_H, TEX: LV0.TEX,
    LEN: 3600, XMAX: 3850, START: 700, END: 1e9,
    // виступи ратуші (px текстури): карниз під вікнами, два краї даху — на них можна вистрибнути
    LEDGES: Object.assign({}, LV0.LEDGES, { townhall: [[28, 976, 900, 976], [10, 727, 362, 727], [566, 727, 918, 727]] }),
    HOUSES: [{ tex: 'house_bakery', x: 330, flip: 1 }, { tex: 'townhall', x: TH.x, k: TH.k, haze: 1 }, { tex: 'house_tall', x: 3150 }],
    PROPS: [{ tex: 'bench', x: 960, h: 100, top: 0.42 }, { tex: 'snowman', x: 2520, h: 170 }, { tex: 'stall', x: 2790, h: 300, top: 0.06 },
      { tex: 'bench', x: 3010, h: 100, top: 0.42 }, { tex: 'firtub', x: 3660, h: 190 }],
    LAMPS: [1110, 2640, 3560],
    // край кам'яної клумби під ялинкою — теж платформа (стати й «помилуватися»)
    SURFX: [[TREE.x - 0.24 * TREE.w, GY - 0.075 * TREE.h + 8, TREE.x + 0.24 * TREE.w, GY - 0.075 * TREE.h + 8]],
    SWEETS: [], ORNAMENTS: [], THIEVES: [], BULLIES: [], AMMO: [],
    GATES, TREE, TH, slotPos, onInit, onStep,
    HINT: 'Неси добро до ялинки. Брама «Пекарська вулиця» — ліворуч: підійди й натисни ↑',
  };
  root.LEVELS.hub = HUB;
  root.PROG = PROG; PROG.load();
  if (typeof module !== 'undefined') module.exports = HUB;
})(typeof window !== 'undefined' ? window : globalThis);
