// live/river.js — рівень 3 «Замерзла річка й старий млин»: ДАНІ рівня + його власні правила (onInit / onStep).
// Що тут нового: лід (ковзко — розгін і гальмування слабкі), протоки з водою (упав — мінус рукавичка, назад на берег),
// крижини, що пливуть туди-сюди, і колесо млина з дошками-платформами (рухомі платформи — moving platforms:
// стоїш на такій — вона везе тебе з собою). Ніч: темно, світять лише ліхтарі, вікна й сам герой. Гасильники банди
// підходять до запаленого ліхтаря й гасять його; влучиш шишкою в ліхтар або кинеш поруч хлопавку — він знову світить.
// Як і sim.js: без Math.random і Date — положення крижин і колеса залежать лише від часу рівня S.t.
(function (root) {
  const LV0 = root.LEVEL || require('./level.js');
  const GY = LV0.GY, HK = LV0.HK, DT = 1 / 120;
  const up = (h) => GY - h;

  // розміри нових текстур (для node, де картинок нема)
  Object.assign(LV0.TEX, { mill: [420, 862], boathouse: [317, 307], footbridge: [377, 261], jetty: [296, 148], boat: [449, 161],
    mooring: [137, 280], boulder: [278, 178], reeds: [237, 278], millwheel: [431, 446], floe_s: [142, 93], floe_m: [280, 99], floe_l: [453, 100] });
  // Платформи будівель у px текстури (виміряно сіткою frames/g_river.png): млин — кам'яний цоколь і балкон;
  // повітка — два скати даху (пологі, стати можна); міст і пірс — настил.
  const LEDGES = Object.assign({}, LV0.LEDGES, {
    mill: [[67, 608, 391, 608], [134, 384, 328, 384]],
    boathouse: [[5, 134, 158, 18], [158, 18, 312, 134]],
    footbridge: [[0, 80, 377, 80]],
    jetty: [[0, 6, 296, 6]],
  });

  // ---------------- берег, лід і вода ----------------
  // Протоки з відкритою водою: [x0, x1]. Між ними — суходіл: берег (сніг) або лід (ковзко).
  const WATER = [[3000, 3700], [4300, 5600], [6600, 7400], [7800, 8380]];
  const ICE = [[1450, 3000], [5600, 6600]];
  const LEN = 9400;
  // Суходіл = усе, крім проток; кожен шматок ще ділимо на берег і лід → [x0, x1, лід?]
  const GROUND = [];
  { let x = -600; for (const [a, b] of [...WATER, [LEN + 600, LEN + 600]]) { if (a > x) GROUND.push([x, a]); x = b; } }
  const SPLIT = [];
  for (const [a, b] of GROUND) { let x = a;
    for (const [i0, i1] of ICE) { if (i1 <= x || i0 >= b) continue; if (i0 > x) SPLIT.push([x, i0, 0]); SPLIT.push([Math.max(x, i0), Math.min(b, i1), 1]); x = Math.min(b, i1); }
    if (x < b) SPLIT.push([x, b, 0]); }

  // Будівлі: повітка на березі, пірс над першою протокою, міст посеред другої, млин наприкінці.
  // base — y низу спрайта: стовпи пірса й мосту стоять у воді (нижче за GY), цоколь млина трохи «вкопаний».
  const HOUSES = [
    { tex: 'boathouse', x: 900 },                                // 0  дах −242…−397: прикраса на гребені
    { tex: 'jetty', x: 2760, base: GY + 40 },                    // 1  настил −159: розбіг до першої крижини
    { tex: 'footbridge', x: 4500, base: GY + 50 },               // 2  настил −203: посеред другої протоки
    { tex: 'mill', x: 8400, base: GY + 30 },                     // 3  цоколь −326, балкон −639
  ];
  // Рухомі платформи. Крижина: центр c, розмах A, період P (с), фаза ph. Колесо: центр, радіус, 4 дошки, період.
  const FK = 1.1;                                                 // масштаб крижин (px екрана на px текстури)
  const FLOES = [
    { tex: 'floe_m', c: 3350, A: 171, P: 6, ph: 0 },
    { tex: 'floe_s', c: 5320, A: 188, P: 4.6, ph: 1.2 },          // з мосту на берег не дострибнеш — лише через неї
    { tex: 'floe_l', c: 7000, A: 126, P: 5.5, ph: 2.1 },
  ].map((f) => Object.assign(f, { w: LV0.TEX[f.tex][0] * FK, h: LV0.TEX[f.tex][1] * FK }));
  const WHEEL = { x: 8090, y: up(320), R: 240, P: 9, n: 4, pw: 110 };
  const MOVERS = [...FLOES.map((f, i) => ({ id: 'f' + i, ice: true })), ...Array.from({ length: WHEEL.n }, (_, k) => ({ id: 'w' + k }))];
  // де мають бути рухомі платформи в момент t: [x центру, y верху]
  const floeAt = (f, t) => [f.c + f.A * Math.sin(2 * Math.PI * t / f.P + f.ph), GY - 8 + 3 * Math.sin(t * 1.3 + f.ph * 3)];
  const plankAt = (k, t) => { const a = 2 * Math.PI * t / WHEEL.P + k * 2 * Math.PI / WHEEL.n;     // кут росте — колесо крутиться за годинниковою
    return [WHEEL.x + WHEEL.R * Math.cos(a), WHEEL.y + WHEEL.R * Math.sin(a)]; };

  // ліхтарі-чекпоінти (на березі й на льоду) і гасильники: x, межі обходу [a, b]
  const LAMPS = [600, 2300, 4000, 5900, 7600, 8700];
  const SNUFFERS = [{ x: 2500, a: 1900, b: 2700 }, { x: 6150, a: 5700, b: 6400 }, { x: 7700, a: 7420, b: 7790 }];
  const PROPS = [
    { tex: 'boat', x: 1950, h: 120, top: 0.3 }, { tex: 'boulder', x: 4180, h: 110, top: 0.12 },
    { tex: 'mooring', x: 5640, h: 150, top: 0.04 }, { tex: 'mooring', x: 7440, h: 130, top: 0.04 },
    ...[300, 1380, 3780, 5720, 7520, 8480].map((x, i) => ({ tex: 'reeds', x, h: 110 + 20 * (i % 2) })),
  ];

  // ---------------- що збирати ----------------
  const SWEETS = [];
  const row = (x0, y, n, dx = 70) => { for (let i = 0; i < n; i++) SWEETS.push([x0 + i * dx, y]); };
  const arc = (x0, y0, x1, y1, h, n) => { for (let i = 1; i < n; i++) { const u = i / n;
    SWEETS.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - 4 * h * u * (1 - u)]); } };
  row(350, up(70), 4); arc(800, up(70), 1010, up(330), 90, 3); row(1020, up(300), 2, 60); row(1220, up(300), 2, 60);   // на дах повітки
  row(1500, up(70), 5, 80); row(1870, up(150), 3, 70); row(2200, up(70), 4, 90); row(2780, up(230), 5, 80);              // ковзанка, човен, пірс
  row(3720, up(70), 4, 70); row(4000, up(70), 3, 70); arc(4250, up(70), 4560, up(273), 80, 3); row(4580, up(273), 6, 70); // міст
  row(5680, up(70), 4, 80); row(6000, up(70), 5, 80); row(7420, up(200), 2, 50); row(7520, up(70), 3, 80);
  row(8420, up(70), 5, 80); row(8520, up(396), 5, 80); row(8900, up(70), 4, 70);                                         // млин: двір і цоколь
  // прикраси: на гребені повітки, над першою крижиною (стрибни з неї), над мостом, над колесом (дочекайся верхньої дошки),
  // на балконі млина
  const ORNAMENTS = [[1121, up(470), 2], [3350, up(330), 0], [4764, up(470), 1], [8090, up(680), 2], [8720, up(700), 0]];
  // троє злодюжок — у кожного подарунок (річка — рівень подарунків); поруч з водою не ставимо: подарунок не втопиться
  const THIEVES = [{ x: 2500, a: 2120, b: 2880, gift: 0 }, { x: 6200, a: 5800, b: 6470, gift: 1 }, { x: 8850, a: 8560, b: 9100, gift: 2 }];
  const BULLIES = [{ x: 4180, y: up(97) }];                       // кидайло на валуні між протоками
  const AMMO = [[1700, 0], [3900, 1], [6050, 0], [7650, 1], [8480, 0]];

  // ---------------- правила рівня ----------------
  const SN_BOX = [70, 230];
  const SIMr = () => root.SIM, ACTr = () => root.ACT;
  // Розставити рухомі платформи на момент t (їхні лінії в SIM.SURF) і запам'ятати положення в стані — для малювання.
  function place(S, t) { const SURF = SIMr().SURF;
    FLOES.forEach((f, i) => { const [x, y] = floeAt(f, t), s = SURF.find((q) => q.id === 'f' + i); S.mv[i] = [x, y];
      if (s) s.pts = [[x - f.w / 2 + 10, y], [x + f.w / 2 - 10, y]]; });
    for (let k = 0; k < WHEEL.n; k++) { const [x, y] = plankAt(k, t), s = SURF.find((q) => q.id === 'w' + k); S.mv[FLOES.length + k] = [x, y];
      if (s) s.pts = [[x - WHEEL.pw / 2, y - 14], [x + WHEEL.pw / 2, y - 14]]; } }

  function onInit(S) {
    S.mv = []; place(S, 0);
    S.safe = [LV().START, GY]; S.wet = -9; S.snT = LAMPS.map(() => -9);   // snT — коли ліхтар погасили (для згасання світла й димка)
    S.sn = SNUFFERS.map((d) => ({ x: d.x, y: GY, vx: 0, face: -1, st: 'walk', stT: 0, hp: 2, hitT: -9, dist: 0, dir: -1, tg: -1 }));
  }
  const LV = () => SIMr().LV;

  // Удар по гасильнику: шишка — 1, хлопавка — 2. На нулі злітає сірий шарф, гасильник тікає (і більше не гасить).
  function hitSn(S, t, i, n, fromX) { const e = S.sn[i]; if (e.st === 'gone' || t - e.hitT < 0.25) return;
    e.hp -= n; e.hitT = t; e.face = Math.sign(fromX - e.x) || e.face; S.ev.push({ k: 'snufferhit', t, x: e.x, y: e.y - 150, i });
    if (e.hp > 0) { e.st = 'hit'; e.stT = t; return; }
    e.st = 'gone'; e.stT = t; e.vx = (Math.sign(e.x - fromX) || 1) * 380; S.ev.push({ k: 'snufferout', t, x: e.x, y: e.y - SN_BOX[1], i }); }

  function onStep(S, t) {
    const SIM = SIMr(), L3 = LV();
    // ---- рухомі платформи: зсуваємо, а героя, що стоїть на одній із них, веземо разом з нею ----
    const ride = S.ground ? MOVERS.findIndex((m) => m.id === S.ground) : -1, was = ride >= 0 ? S.mv[ride].slice() : null;
    place(S, t);
    if (ride >= 0) { S.x += S.mv[ride][0] - was[0]; S.y += S.mv[ride][1] - was[1]; }
    // ---- безпечне місце: остання тверда точка (не крижина і не колесо), трохи далі від краю — сюди повертаємо з води ----
    if (S.ground && ride < 0 && S.faint < 0) { const s = SIM.byId(S.ground), p = s && s.pts;
      if (p && p[p.length - 1][0] - p[0][0] > 200) S.safe = [Math.max(p[0][0] + 90, Math.min(p[p.length - 1][0] - 90, S.x)), SIM.yOn(s, Math.max(p[0][0] + 90, Math.min(p[p.length - 1][0] - 90, S.x)))]; }
    // ---- вода: провалився нижче берега → бризки, мінус рукавичка; ще є рукавички — назад на безпечне місце ----
    if (S.faint < 0 && !S.climb && S.y > GY + 60) {
      S.wet = t; S.ev.push({ k: 'splash', t, x: S.x, y: GY + 10 });
      S.hearts--; S.hurtT = t; S.inv = 1.4;
      if (S.hearts <= 0) { S.faint = t; S.ev.push({ k: 'faint', t, x: S.x, y: GY }); S.vx = 0; S.vy = 0; S.y = GY + 60; }
      else { Object.assign(S, { x: S.safe[0], y: S.safe[1], vx: 0, vy: 0, ground: null }); S.ev.push({ k: 'revive', t, x: S.x, y: S.y }); } }
    if (S.faint >= 0 && S.y > GY + 60) { S.y = GY + 60; S.vy = 0; }                   // непритомний — не тоне нескінченно
    const evNow = S.ev.filter((e) => e.t === t);                                       // події цього кроку (влучання, вибухи)
    // ---- гасильники: обходять свою ділянку; побачили запалений ліхтар — підходять і гасять ----
    S.sn.forEach((e, i) => { const d = SNUFFERS[i], dx = S.x - e.x;
      if (e.st === 'gone') { e.x += e.vx * DT; e.dist += Math.abs(e.vx) * DT; return; }
      if (e.st === 'hit') { e.vx = 0; if (t - e.stT > 0.5) { e.st = 'walk'; e.stT = t; } return; }
      if (e.st === 'snuff') { e.vx = 0; const li = e.tg;
        if (t - e.stT > 0.9) { if (S.lit[li] >= 0) { S.lit[li] = -3; S.snT[li] = t; S.ev.push({ k: 'snuff', t, x: L3.LAMPS[li], y: GY - L3.LAMP_H + 60, i: li }); }
          e.st = 'walk'; e.stT = t; e.tg = -1; e.dir = -e.dir; } }
      else { const li = L3.LAMPS.findIndex((lx, j) => S.lit[j] >= 0 && t - S.lit[j] > 1.5 && lx > d.a - 100 && lx < d.b + 100);
        if (li >= 0) { const lx = L3.LAMPS[li], side = Math.sign(e.x - lx) || 1, gx = lx + side * 150;  // стає за 150 px від ліхтаря
          e.tg = li; e.vx = Math.sign(gx - e.x) * 150; if (Math.abs(gx - e.x) < 6) { e.vx = 0; e.face = -side; e.st = 'snuff'; e.stT = t;
            S.ev.push({ k: 'raise', t, x: e.x, y: e.y - 200, i }); } }
        else { e.tg = -1; if (e.x < d.a) e.dir = 1; if (e.x > d.b) e.dir = -1; e.vx = e.dir * 70; } }
      e.x += e.vx * DT; e.dist += Math.abs(e.vx) * DT; if (Math.abs(e.vx) > 5) e.face = Math.sign(e.vx);
      if (Math.abs(dx) < 60 && S.y > e.y - 180 && S.y < e.y + 30) ACTr().hurt(S, t, e.x); });   // впритул — штовхає палицею
    // шишки, що влучили в гасильника (решту снарядів уже порахував actors.js)
    for (let k = S.shots.length - 1; k >= 0; k--) { const p = S.shots[k]; if (p.k !== 'cone') continue;
      const i = S.sn.findIndex((e) => e.st !== 'gone' && Math.abs(p.x - e.x) < SN_BOX[0] / 2 + 14 && p.y > e.y - SN_BOX[1] - 14 && p.y < e.y + 14);
      if (i >= 0) { hitSn(S, t, i, 1, p.x - p.vx * 0.02); S.ev.push({ k: 'bonk', t, x: p.x, y: p.y }); S.shots.splice(k, 1); } }
    for (const e of evNow) if (e.k === 'boom') S.sn.forEach((q, i) => { if (Math.hypot(q.x - e.x, q.y - 100 - e.y) < 280) hitSn(S, t, i, 2, e.x); });
    // ---- знову запалити погашений ліхтар: торкнутись, влучити шишкою («дзинь») або хлопавкою поруч ----
    L3.LAMPS.forEach((lx, i) => { if (S.lit[i] !== -3) return;
      const touch = Math.abs(S.x - lx) < 50 && S.y > GY - 200, ding = evNow.some((e) => e.k === 'ding' && e.i === i),
        boom = evNow.some((e) => e.k === 'boom' && Math.abs(e.x - lx) < 320);
      if (touch || ding || boom) { S.lit[i] = t; if (lx > S.cp) { S.cp = lx; S.cpY = GY; } S.ev.push({ k: 'lamp', t, x: lx, y: GY - L3.LAMP_H + 60, i }); } });
  }

  root.LEVELS.river = {
    name: 'river', RIVER: true, GY, HK, LAMP_H: LV0.LAMP_H, TEX: LV0.TEX, LEN, START: 220, END: 9250, CAMY: 820, CAMMIN: -60,
    TITLE: 'Річку врятовано!', BGMID: 'bg_river', BGW: 1700, BGY: 40, GIFTS: ['gift_red', 'gift_green', 'gift_red'],
    HINT: 'На льоду ковзко — гальмуй завчасно! Гасильник погасив ліхтар? Влуч у ліхтар шишкою — і він засвітить знову',
    LEDGES, HOUSES, PROPS, LAMPS, SWEETS, ORNAMENTS, THIEVES, BULLIES, AMMO, SNUFFERS, SN_BOX,
    WATER, ICE, GROUND: SPLIT, FLOES, WHEEL, MOVERS, onInit, onStep,
  };
  if (typeof module !== 'undefined') module.exports = root.LEVELS.river;
})(typeof window !== 'undefined' ? window : globalThis);
