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
    orn: [[0.40, 0.30], [0.62, 0.42], [0.30, 0.55], [0.70, 0.66], [0.45, 0.80],             // 5 прикрас Пекарської
      [0.44, 0.21], [0.60, 0.31], [0.48, 0.45], [0.38, 0.66], [0.78, 0.70],                    // 5 прикрас з дахів
      [0.53, 0.36], [0.26, 0.47], [0.63, 0.55], [0.27, 0.75], [0.60, 0.78]],                   // 5 прикрас з річки
    candy: [[0.56, 0.19], [0.36, 0.43], [0.73, 0.52], [0.22, 0.67], [0.55, 0.69], [0.84, 0.80], [0.16, 0.82], [0.64, 0.86]],
    tiers: [0.17, 0.27, 0.38, 0.50, 0.63, 0.76],                                              // лінії гірлянди
    gifts: [-175, 180, -265, 270, -95, 95, -30, 36] };                                       // подарунки під ялинкою (зсув x): вулиця 0–1, дахи, річка, 3-й вулиці
  TREE.w = TREE.h * LV0.TEX.tree_square[0] / LV0.TEX.tree_square[1];
  TREE.x0 = TREE.x - TREE.w / 2; TREE.y0 = GY - TREE.h + 8;                                  // лівий верхній кут спрайта (+8 — «вкопана»)
  TREE.pt = (u, v) => [TREE.x0 + u * TREE.w, TREE.y0 + v * TREE.h];
  TREE.half = (v) => Math.max(0.06, 0.1 + (v - 0.1) * 0.52);                                  // напівширина крони на висоті v (частки)
  // куди летить річ кожного виду: прикраса / цукерка — на гілку, подарунок — під ялинку, зірка — на верхівку
  const slotPos = (k, i) => k === 'orn' ? TREE.pt(...TREE.orn[i]) : k === 'candy' ? TREE.pt(...TREE.candy[i])
    : k === 'gift' ? [TREE.x + TREE.gifts[i], GY - 34] : TREE.pt(...TREE.top);
  const N_CANDY = TREE.candy.length;
  // з якого рівня кожне місце на ялинці: прикраси 0–4 — вулиця, 5–9 — дахи, 10–14 — річка;
  // подарунки: вулиця — місця 0, 1 і 7 (третій з'явився, коли зірку забрав бос), дахи — 2–3, річка — 4–6; зірку несе бос вежі
  const OFF = { street: { orn: 0, gift: 0 }, roofs: { orn: 5, gift: 2 }, river: { orn: 10, gift: 4 }, tower: { orn: 15, gift: 0 } };
  const GSLOT = { street: [0, 1, 7] };
  TREE.ornKind = (slot) => { const lv = slot < 5 ? 'street' : slot < 10 ? 'roofs' : 'river', L = root.LEVELS[lv], q = L && L.ORNAMENTS[slot - OFF[lv].orn]; return q ? q[2] : 0; };

  // ---------------- ратуша і брами ----------------
  const TH = { x: 1820, k: 0.66 };            // ратуша: лівий край і масштаб (менша за будинки вулиці — «стоїть у глибині площі»)
  TH.w = LV0.TEX.townhall[0] * TH.k; TH.h = LV0.TEX.townhall[1] * TH.k;
  TH.clock = [0.497, 0.427, 0.083];           // циферблат: центр (частки текстури) і радіус (частка ширини)
  // Брами — виходи з площі на рівні. to: куди веде (null — ще зачинено). post: false — табличка над дверима, без стовпа.
  const GATES = [
    { x: 190, to: 'street', name: 'Пекарська вулиця', dir: -1 },
    { x: TH.x + TH.w / 2, to: 'tower', name: 'Ратушна вежа' },
    { x: 3070, to: 'roofs', name: 'Дахи й димарі', dir: 1 },
    { x: 3790, to: 'river', name: 'Замерзла річка', dir: 1 },
  ];

  // ---------------- фінал з бандою «Сірі Шарфи» (2026-11-11) ----------------
  // Після зірки банда несміливо сходиться до ялинки, Бурчак виходить із дверей ратуші. Тимко кидає кожному подарунок
  // (спершу Бурчакові, далі решті) — подарунок долітає, «пуф!» з іскор (за ним ховаємо підміну малюнка) — і Шарф
  // усміхається, шарф стає кольоровим. go — коли вирушає (с від запуску фіналу), x0 → tx — звідки й куди йде,
  // sp — швидкість, gift — коли Тимко кидає йому подарунок (перетворення — коли той долетить), box — який подарунок.
  const DOOR = TH.x + TH.w / 2;
  const GANG = [
    { kind: 'thief', x0: 260, tx: 1060, go: 1.5, sp: 170, gift: 8.1, box: 'gift_green' },
    { kind: 'snuffer', x0: 3300, tx: 2200, go: 2.2, sp: 190, gift: 8.6, box: 'gift_green' },   // праворуч від ратуші: біля пекарні його «просвічує» вітрина
    { kind: 'bully', x0: 3100, tx: 1950, go: 1.8, sp: 190, gift: 9.1, box: 'gift_red' },
    { kind: 'burchak', x0: DOOR, tx: 1790, go: 4.0, sp: 110, gift: 7.4, box: 'gift_red', door: true },
  ];
  const GIFT_FLY = 0.9, FIN_UI = 12.5;                // скільки летить подарунок; коли екран фіналу

  // ---------------- прогрес (PROG): що вже висить на ялинці і що лежить у торбі ----------------
  // У браузері — localStorage (переживає перезапуск), у node і в приватному вікні — просто в пам'яті.
  const KEY = 'yalynka.prog.v2';
  const blank = () => ({ orn: TREE.orn.map(() => 0), gifts: TREE.gifts.map(() => 0), star: 0, candy: 0, best: 0, bag: { orn: [], gifts: [], star: 0 }, lit: 0 });
  const PROG = { d: blank(), last: '' };
  PROG.load = () => { try { const s = root.localStorage && localStorage.getItem(KEY); if (s) PROG.d = Object.assign(blank(), JSON.parse(s)); } catch (e) {}
    // старе збереження (до річки) коротше — доповнюємо порожніми місцями, щоб нові слоти ялинки теж були
    PROG.d.orn = TREE.orn.map((_, i) => PROG.d.orn[i] || 0); PROG.d.gifts = TREE.gifts.map((_, i) => PROG.d.gifts[i] || 0); return PROG.d; };
  PROG.write = () => { const s = JSON.stringify(PROG.d); if (s === PROG.last) return; PROG.last = s;
    try { if (root.localStorage) localStorage.setItem(KEY, s); } catch (e) {} };
  PROG.reset = () => { PROG.d = blank(); PROG.write(); };
  PROG.any = () => { const d = PROG.d; return d.orn.some(Boolean) || d.gifts.some(Boolean) || d.star || d.candy || d.bag.orn.length || d.bag.gifts.length || d.bag.star; };
  // Рівень пройдено: усе зібране, чого ще нема ні на ялинці, ні в торбі, — кладемо в торбу (номери місць на ялинці).
  PROG.bank = (S, lv = 'street') => { const d = PROG.d, b = d.bag, o = OFF[lv] || OFF.street;
    S.orn.forEach((g, i) => { const k = o.orn + i; if (g >= 0 && !d.orn[k] && !b.orn.includes(k)) b.orn.push(k); });
    // подарунки рівня → їхні місця під ялинкою; у вежі єдиний «подарунок» — зірка (запускає фінал)
    if (lv === 'tower') { if (S.gifts[0] >= 0 && !d.star) b.star = 1; }
    else S.gifts.forEach((g, i) => { const k = GSLOT[lv] ? GSLOT[lv][i] : o.gift + i; if (g >= 0 && !d.gifts[k] && !b.gifts.includes(k)) b.gifts.push(k); });
    if (lv === 'street') d.best = Math.max(d.best, S.sw); PROG.write(); };
  // Площа щокадру повертає свій стан: що вже долетіло до ялинки (летить — теж рахуємо), що лишилось у торбі, чи сяє.
  PROG.sync = (S) => { const d = PROG.d, T = S.tree;
    d.orn = T.orn.map((v) => (v !== -1 ? 1 : 0)); d.gifts = T.gift.map((v) => (v !== -1 ? 1 : 0));
    d.star = T.star !== -1 ? 1 : 0; d.candy = T.candy.filter((v) => v !== -1).length;
    d.bag = { orn: [], gifts: [], star: 0 }; for (const q of S.bagQ) { if (q.k === 'orn') d.bag.orn.push(q.i); else if (q.k === 'gift') d.bag.gifts.push(q.i); else if (q.k === 'star') d.bag.star = 1; }
    d.lit = S.fin !== -1 ? 1 : 0; PROG.write(); };
  // Для перевірок: ?prog=bag — торба з усім добром вулиці (ялинка гола), ?prog=lit — ялинка вже сяє.
  PROG.dev = (mode) => { if (mode === 'bag') PROG.d = Object.assign(blank(), { best: ST_LV.SWEETS.length, bag: { orn: TREE.orn.map((_, i) => i), gifts: TREE.gifts.map((_, i) => i), star: 1 } });
    if (mode === 'lit') PROG.d = Object.assign(blank(), { orn: TREE.orn.map(() => 1), gifts: TREE.gifts.map(() => 1), star: 1, candy: N_CANDY, best: ST_LV.SWEETS.length, lit: 1 }); };

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
    // банда: на вже засяяній площі — одразу стоїть біля ялинки щаслива (Бурчак з подарунком); інакше — ще не прийшла
    S.gang = GANG.map((g) => ({ kind: g.kind, guest: true, x: p.lit ? g.tx : g.x0, y: GY, vx: 0, dist: 0, st: 'idle', stT: 0, hitT: -9, ph: 0,
      face: Math.sign(TREE.x - g.tx) || 1, on: !!p.lit, happy: !!p.lit, alpha: 1, gift: !!p.lit, box: g.box, thrown: !!p.lit }));   // gift — тримає подарунок, thrown — його вже кинули
  }
  // крок банди у фіналі: a — секунди від запуску фіналу
  function gangStep(S, t) {
    const a = t - S.fin, DT = root.SIM.DT;
    S.gang.forEach((e, i) => { const g = GANG[i]; if (a < g.go) return;
      e.on = true; if (g.door) e.alpha = Math.min(1, (a - g.go) / 0.5);                 // Бурчак проявляється у дверях ратуші
      const d = g.tx - e.x;
      if (Math.abs(d) > 2) { e.vx = Math.sign(d) * g.sp; e.x += e.vx * DT; e.dist += g.sp * DT; e.face = Math.sign(d); e.st = 'walk'; }
      else { e.vx = 0; e.st = 'idle'; e.face = g.kind === 'burchak' ? Math.sign(S.x - e.x) || -1 : Math.sign(TREE.x - e.x) || 1; }   // Бурчак дивиться на Тимка
      // Тимко кидає подарунок (дугою від героя до рук Шарфа)
      if (!e.thrown && a >= g.gift) { e.thrown = true;
        S.ev.push({ k: 'giftfly', t, x: S.x, y: S.y - 110, tx: g.tx - e.face * 10, ty: GY - (g.kind === 'bully' ? 120 : 150), fly: GIFT_FLY, box: g.box });
        S.ev.push({ k: 'toss', t, x: S.x, y: S.y - 100 }); }
      if (!e.happy && a >= g.gift + GIFT_FLY) { e.happy = true; e.stT = t; e.gift = true;
        S.ev.push({ k: g.kind === 'burchak' ? 'gift' : 'lamp', t, x: e.x, y: GY - 200 }); S.ev.push({ k: 'puff', t, x: e.x, y: GY - 150 }); } });
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
    if (S.fin >= 0) gangStep(S, t);                                                  // банда сходиться до ялинки
    if (S.fin >= 0 && !S.finUI && t > S.fin + FIN_UI) S.finUI = 1;                   // екран фіналу — після сцени з бандою
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
    GATES, TREE, TH, slotPos, onInit, onStep, GANG,
    HINT: 'Неси добро до ялинки. Брами на вулиці — ліворуч і праворуч: підійди й натисни ↑',
  };
  root.LEVELS.hub = HUB;
  root.PROG = PROG; PROG.load();
  if (typeof module !== 'undefined') module.exports = HUB;
})(typeof window !== 'undefined' ? window : globalThis);
