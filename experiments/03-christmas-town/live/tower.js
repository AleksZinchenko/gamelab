// live/tower.js — рівень 4 «Ратушна вежа»: ДАНІ рівня + правила (onInit / onStep), зокрема бій із босом паном Бурчаком.
// Рівень ВЕРТИКАЛЬНИЙ: лізеш угору всередині вежі (y зменшується), камера по x стоїть, по y — їде за героєм.
// Нове: шестерні — «конвеєри» (стоїш на верху шестерні — вона несе тебе вбік), маятники — рухомі платформи,
// нагорі — дзвіниця-арена. Бій — три фази (boss phases — кожна зі своїм прийомом, щоб бій не набрид):
//   1) Бурчак кидає вугілля з полиці; збий грудку шишкою — і вона полетить назад у нього (deflect — відбивання);
//   2) він ходить дзвіницею; підірви хлопавку біля дзвона, коли Бурчак під ним, — дзвін бамкне й оглушить його;
//   3) він хапає мішок із зіркою і тікає дахом ратуші; наздожени й влуч шишкою тричі — зірка випаде.
// Як і sim.js: без Math.random і Date — усе залежить лише від вводу й часу рівня.
(function (root) {
  const LV0 = root.LEVEL || require('./level.js');
  const GY = LV0.GY, DT = 1 / 120;
  const YB = -3850;                                   // підлога дзвіниці (y верху)
  const WL = 60, WR = 1860;                           // стіни шахти вежі (x)

  Object.assign(LV0.TEX, { beam: [557, 109], shelf: [280, 167], belfloor: [950, 158], gear_big: [500, 506], gear_md: [331, 345],
    gear_sm: [234, 243], pendulum: [168, 703], bell: [359, 404], truss: [427, 416], spire: [454, 611], coalcrate: [205, 209], rope: [319, 203] });

  // ---------------- статичні платформи: балки, полички, підлога дзвіниці, місток на даху ----------------
  // [текстура, x0, x1, y верху]. Малюються шматками текстури, не розтягуючи (як місточки на дахах).
  const PIECES = [
    ['beam', 1450, 1860, 600], ['beam', 1000, 1400, 350], ['shelf', 60, 284, -120], ['beam', 360, 806, -380],
    ['beam', 1500, 1860, -700], ['shelf', 1636, 1860, -1050], ['shelf', 60, 284, -1700], ['beam', 400, 846, -1760],
    ['beam', 900, 1346, -2050], ['shelf', 1636, 1860, -2650], ['beam', 1100, 1860, -3050], ['beam', 100, 546, -3560],
    ['belfloor', WL, WR, YB], ['shelf', 1636, 1860, YB - 300],
    // дах ратуші: дерев'яний місток уздовж гребеня з трьома прогалинами (під ними — прірва до вулиці)
    ['belfloor', WR, 2500, YB], ['belfloor', 2700, 3400, YB], ['belfloor', 3640, 4300, YB], ['belfloor', 4520, 6000, YB],
  ].map(([tex, x0, x1, y]) => ({ tex, x0, x1, y }));
  const TOPF = { beam: 0.05, shelf: 0.03, belfloor: 0.12 };          // де верх (по чому ходять) — частка висоти текстури
  const PH = { beam: 70, shelf: 90, belfloor: 120 };                  // висота шматка на екрані
  const ROOFGAPS = [[2500, 2700], [3400, 3640], [4300, 4520]];
  // шестерні: центр, радіус зубців, швидкість верху (px/с, «+» — несе праворуч)
  // 2026-11-11 (відгук: «надто складно») — швидкості вдвічі менші: на швидкому конвеєрі не встигаєш прицілитись до стрибка
  const GEARS = [
    { tex: 'gear_big', x: 650, y: 310, r: 190, v: -75 }, { tex: 'gear_md', x: 1380, y: -1125, r: 125, v: -60 },
    { tex: 'gear_sm', x: 1000, y: -1420, r: 90, v: 100 }, { tex: 'gear_big', x: 850, y: -3110, r: 190, v: -85 },
  ];
  const GEARTOP = 0.52;                               // півширина «верху» шестерні, на якому можна стояти (частка радіуса)
  // маятники: точка підвісу, довжина до центру тягарця, розмах (рад), період (с)
  // 2026-11-11: повільніше (більший період) і менший розмах — тягарець летить ~2× повільніше, легше заскочити
  const PENDS = [{ x: 1150, y: -900, L: 560, A: 0.47, P: 4.6 }, { x: 1420, y: -2850, L: 650, A: 0.5, P: 5.0 }];
  // маятник 2 подовжено на 50 (і полицю 4 опущено на 50): тягарець пролітає нижче над балкою — легше заскочити
  const PENDW = 78;                                   // півширина верху тягарця (тягарець намальований ~170 px завширшки)
  const MOVERS = [...GEARS.map((_, i) => ({ id: 'g' + i })), ...PENDS.map((_, i) => ({ id: 'pd' + i }))];
  const pendAt = (p, t) => { const a = p.A * Math.sin(2 * Math.PI * t / p.P); return [p.x + p.L * Math.sin(a), p.y + p.L * Math.cos(a), a]; };
  const LADDERS = [{ x: 1700, top: 600, bot: GY }, { x: 1780, top: -1050, bot: -700 }, { x: 1780, top: -3050, bot: -2650 }];
  // чекпоінти — ліхтарики на стіні (у симуляції працюють як димарі дахів: x, y платформи)
  const CHECKS = [{ x: 620, y: -1760 }, { x: 1750, y: -2650 }, { x: 200, y: YB }];   // останній — щойно піднявся на дзвіницю
  const BELL = { x: 960, y: YB - 330 };                // центр дзвона (сюди має долетіти вибух хлопавки)
  const LEDGE = { x: 1748, y: YB - 300 };              // полиця, з якої Бурчак кидає вугілля у фазі 1

  const SWEETS = [];
  const row = (x0, y, n, dx = 70) => { for (let i = 0; i < n; i++) SWEETS.push([x0 + i * dx, y]); };
  row(300, GY - 70, 4, 90); SWEETS.push([1700, 800], [1700, 690]);                                  // уздовж першої драбини
  row(1500, 530, 4); row(1050, 280, 4, 90); row(600, 50, 3); row(400, -450, 5, 90); row(1560, -770, 4);
  [-800, -900, -1000].forEach((y) => SWEETS.push([1780, y])); row(470, -1830, 5, 90); row(950, -2120, 5, 90);
  row(1680, -2720, 3); row(1200, -3120, 8, 80); row(150, -3630, 5, 90); row(300, YB - 70, 6, 120);
  row(1900, YB - 70, 6, 90); row(2750, YB - 70, 7, 90); row(3700, YB - 70, 6, 90); row(4600, YB - 70, 8, 90);
  const AMMO = [[1200, 0, GY], [620, 0, -1760], [1750, 1, -2650], [300, 1, -3560], [600, 0, YB]];
  const BULLIES = [{ x: 170, y: -1700 }, { x: 1450, y: -3050 }];
  const PIGEONS = [{ x: 583, y: -380 }, { x: 1180, y: -2050 }, { x: 330, y: -3560 }];
  const END = 5600, LEN = 6000;

  // ---------------- правила ----------------
  const SIMr = () => root.SIM, ACTr = () => root.ACT;
  const BOX = [110, 300];                               // «тіло» Бурчака для влучань
  const G_PROJ = 1500;
  function place(S, t) { const SURF = SIMr().SURF;
    GEARS.forEach((g, i) => { const s = SURF.find((q) => q.id === 'g' + i); if (s) s.pts = [[g.x - g.r * GEARTOP, g.y - g.r + 8], [g.x + g.r * GEARTOP, g.y - g.r + 8]]; });
    PENDS.forEach((p, i) => { const [x, y] = pendAt(p, t), s = SURF.find((q) => q.id === 'pd' + i); S.mv[GEARS.length + i] = [x, y];
      if (s) s.pts = [[x - PENDW, y - 58], [x + PENDW, y - 58]]; });
    GEARS.forEach((g, i) => { S.mv[i] = [g.x, g.y - g.r + 8]; }); }
  // y даху під Бурчаком: на прогалині — стрибок дугою
  const roofY = (x) => { for (const [a, b] of ROOFGAPS) if (x > a - 30 && x < b + 30) { const u = (x - a + 30) / (b - a + 60); return YB - 4 * 130 * u * (1 - u); } return YB; };
  const solidAt = (x) => !ROOFGAPS.some(([a, b]) => x > a - 30 && x < b + 30);

  function onInit(S) {
    // gifts[0] — зірка (її несе бос); xmax — права стіна вежі (відчиниться у фазі 3)
    S.mv = []; place(S, 0); S.gifts = [-1]; S.safe = [WL + 200, GY]; S.xmax = WR - 40; S.bellT = -9; S.bmsg = -9;
    S.boss = { ph: 0, x: LEDGE.x, y: LEDGE.y, vx: 0, face: -1, st: 'idle', stT: 0, hp: 3, hitT: -9, dist: 0, nextT: 0, carry: false, refT: 0, dir: -1 };
  }
  function setPhase(S, t, ph) { const B = S.boss; B.ph = ph; B.stT = t; B.hitT = -9; S.bmsg = t;
    S.ev.push({ k: 'bossphase', t, x: B.x, y: B.y - 320, ph });
    if (ph === 2) { B.hp = 2; B.st = 'leap'; B.l0 = [B.x, B.y]; B.l1 = [1500, YB]; S.crackers = Math.max(S.crackers, 3); }
    if (ph === 3) { B.hp = 3; B.st = 'grab'; B.carry = true; S.xmax = END - 60; } }
  // Бурчак кидає вугілля дугою точно в героя (як кидайло, лише сильніше)
  function throwCoal(S, t, B) { const hx = B.x + B.face * 20, hy = B.y - 290, T = 0.85 + Math.abs(S.x - hx) / 2600, ty = S.y - 70;
    S.shots.push({ k: 'coal', x: hx, y: hy, vx: (S.x - hx) / T, vy: (ty - hy - 0.5 * 2400 * T * T) / T, t0: t, a: 0 });
    S.ev.push({ k: 'throw', t, x: hx, y: hy, i: 0 }); }
  function hitBoss(S, t, x, y) { const B = S.boss; B.hp--; B.hitT = t; S.ev.push({ k: 'bosshit', t, x, y, ph: B.ph });
    if (B.ph === 1 && B.hp <= 0) setPhase(S, t, 2);
    else if (B.ph === 2 && B.hp <= 0) setPhase(S, t, 3);
    else if (B.ph === 3) { B.st = B.hp <= 0 ? 'down' : 'stumble'; B.stT = t;
      if (B.hp <= 0) { B.carry = false; S.drops.push({ i: 0, x: B.x, y: B.y - 150, vx: -180, vy: -900, on: 0, t0: t }); S.ev.push({ k: 'starfall', t, x: B.x, y: B.y - 200 }); } } }

  function onStep(S, t) {
    const SIM = SIMr(), B = S.boss;
    // ---- рухомі платформи: маятники везуть героя; шестерня — конвеєр (несе вбік, поки стоїш на ній) ----
    const ri = S.ground ? MOVERS.findIndex((m) => m.id === S.ground) : -1, was = ri >= 0 ? S.mv[ri].slice() : null;
    place(S, t);
    if (ri >= GEARS.length) { S.x += S.mv[ri][0] - was[0]; S.y += S.mv[ri][1] - was[1]; }
    else if (ri >= 0) S.x += GEARS[ri].v * DT;
    // ---- дах (фаза 3): упав у прогалину — мінус рукавичка, назад на останнє тверде місце ----
    if (S.ground && ri < 0 && S.y < YB + 5 && S.x > WR) S.safe = [Math.max(WR + 40, Math.min(S.x, LEN)), YB];
    if (S.faint < 0 && S.x > WR + 10 && S.y > YB + 420) { S.ev.push({ k: 'fallout', t, x: S.x, y: YB + 300 });
      S.hearts--; S.hurtT = t; S.inv = 1.4;
      if (S.hearts <= 0) { S.faint = t; S.ev.push({ k: 'faint', t, x: S.x, y: S.y }); }
      Object.assign(S, { x: S.safe[0], y: S.safe[1], vx: 0, vy: 0, ground: null }); }
    if (S.faint >= 0) return;
    // ---- бій ----
    if (B.ph === 0) { if (S.y < YB + 10 && S.x < WR) setPhase(S, t, 1); return; }   // герой піднявся на дзвіницю — бій почався
    const dx = S.x - B.x;
    if (B.st !== 'down' && B.st !== 'dizzy') B.face = Math.sign(dx) || B.face;
    if (B.ph === 1) { B.x = LEDGE.x; B.y = LEDGE.y;
      if (t > B.nextT && t - B.stT > 1.2) { B.st = 'throw'; B.stT = t; B.nextT = t + 2.0; }
      if (B.st === 'throw' && t - B.stT > 0.45) { throwCoal(S, t, B); B.st = 'idle'; } }
    else if (B.ph === 2) {
      if (B.st === 'leap') { const u = Math.min(1, (t - B.stT) / 0.8); B.x = B.l0[0] + (B.l1[0] - B.l0[0]) * u; B.y = B.l0[1] + (B.l1[1] - B.l0[1]) * u - 260 * 4 * u * (1 - u);
        if (u >= 1) { B.st = 'walk'; B.stT = t; B.nextT = t + 1.5; S.ev.push({ k: 'land', t, x: B.x, y: B.y, v: 1500 }); } }
      else if (B.st === 'dizzy') { B.vx = 0; if (t - B.stT > 2.4) { B.st = 'walk'; B.stT = t; B.nextT = t + 1.2; } }
      else if (B.st === 'throw') { B.vx = 0; if (t - B.stT > 0.45) { throwCoal(S, t, B); B.st = 'walk'; B.nextT = t + 2.4; } }
      else { if (B.x < 280) B.dir = 1; if (B.x > 1640) B.dir = -1; B.vx = B.dir * 170; B.x += B.vx * DT; B.dist += Math.abs(B.vx) * DT;
        if (t > B.nextT) { B.st = 'throw'; B.stT = t; } }
      // 2026-11-11: хлопавка, що пролетіла впритул до дзвона, вибухає об нього одразу (t0 у минуле → actors.js підриває її
      // наступним кроком). Раніше вона летіла далі й вибухала за ~600 px від героя — людина не могла влучити в дзвін.
      for (const p of S.shots) if (p.k === 'cracker' && Math.hypot(p.x - BELL.x, p.y - BELL.y) < 150) p.t0 = t - 2;
      // хлопавка вибухнула біля дзвона або на підлозі під ним (±330 px) → «БАМ!»; Бурчак під дзвоном — оглушений, це удар
      for (const e of S.ev) if (e.k === 'boom' && e.t === t && Math.abs(e.x - BELL.x) < 330 && e.y > BELL.y - 220) { S.bellT = t; S.ev.push({ k: 'dong', t, x: BELL.x, y: BELL.y });
        if (Math.abs(B.x - BELL.x) < 320 && B.st !== 'dizzy' && B.st !== 'leap') { B.st = 'dizzy'; B.stT = t; hitBoss(S, t, B.x, B.y - 300); }
        else S.ev.push({ k: 'bosslaugh', t, x: B.x, y: B.y - 320 }); }
      if (S.crackers === 0 && t - B.refT > 4) { B.refT = t; S.crackers = 2; S.ev.push({ k: 'ammo', t, x: S.x, y: S.y - 120, i: -1, kind: 1 }); }   // хлопавки не скінчаться
    }
    else if (B.ph === 3) {
      if (B.st === 'grab') { B.vx = 0; if (t - B.stT > 0.8) { B.st = 'run'; B.stT = t; B.nextT = t + 2.5; S.ev.push({ k: 'dash', t, x: B.x, y: B.y, i: 0 }); } }
      else if (B.st === 'stumble') { B.vx = 0; if (t - B.stT > 0.55) { B.st = 'run'; B.stT = t; } }
      else if (B.st === 'throw') { B.vx = 0; if (t - B.stT > 0.45) { throwCoal(S, t, B); B.st = 'run'; B.nextT = t + (B.x > END - 260 ? 1.4 : 2.8); } }
      else if (B.st === 'run') { const end = B.x > END - 220; B.vx = end ? 0 : 340; B.x += B.vx * DT; B.dist += B.vx * DT; B.y = roofY(B.x); if (!end) B.face = 1;
        if (t > B.nextT && solidAt(B.x)) { B.st = 'throw'; B.stT = t; B.face = Math.sign(dx) || -1; } }
    }
    // ---- шишки: у фазах 1–2 Бурчак відмахується («Ха!»), у фазі 3 — влучання; вугілля, збите шишкою, летить назад ----
    for (let k = S.shots.length - 1; k >= 0; k--) { const p = S.shots[k]; if (p.k !== 'cone') continue;
      // 2026-11-11: допомога прицілу (aim assist) у фазі 1 — щойно випущена шишка, що летить у бік грудки (кут < ~78°, тобто будь-що попереду),
      // перенаправляється в точку зустрічі з нею: грудка падає дугою, шишка летить майже прямо — вручну їх не звести.
      if (B.ph === 1 && !p.aa) { p.aa = 1; const sp = Math.hypot(p.vx, p.vy);
        let best = null, bd = 1e9; for (const q of S.shots) if (q.k === 'coal') { const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < 1100 && d < bd && ((q.x - p.x) * p.vx + (q.y - p.y) * p.vy) / (d * sp) > 0.2) { bd = d; best = q; } }
        // час зустрічі tau уточнюємо ітераціями: де буде грудка через tau (з її падінням) мінус те, наскільки за tau
        // впаде сама шишка, — стільки шишці треба пролетіти; ділимо на її швидкість → новий tau
        if (best) { let tau = bd / sp, dx = 0, dy = 0;
          for (let it = 0; it < 6; it++) { dx = best.x + best.vx * tau - p.x; dy = best.y + best.vy * tau + 0.5 * 2400 * tau * tau - p.y - 0.5 * G_PROJ * tau * tau;
            tau = Math.hypot(dx, dy) / sp; }
          p.vx = dx / tau; p.vy = dy / tau; } }                                                             // швидкість, що приведе шишку в точку зустрічі
      // 2026-11-11: радіус збивання грудки 40 → 90 px — без точного прицілу мишею в грудку раніше майже не влучиш
      const ci = S.shots.findIndex((q) => q.k === 'coal' && Math.hypot(q.x - p.x, q.y - p.y) < 90);
      if (ci >= 0 && B.ph === 1) { const c = S.shots[ci], tx = B.x, ty = B.y - 170, T = 0.65;          // грудка летить назад у Бурчака
        Object.assign(c, { k: 'coalback', vx: (tx - c.x) / T, vy: (ty - c.y - 0.5 * G_PROJ * T * T) / T, t0: t });
        S.ev.push({ k: 'deflect', t, x: c.x, y: c.y }); S.shots.splice(k, 1); continue; }
      if (Math.abs(p.x - B.x) < BOX[0] / 2 + 14 && p.y > B.y - BOX[1] && p.y < B.y + 10 && B.st !== 'down' && B.st !== 'leap') {
        S.shots.splice(k, 1);
        if (B.ph === 3 && solidAt(B.x) && B.st !== 'stumble') hitBoss(S, t, p.x, p.y); else S.ev.push({ k: 'bosslaugh', t, x: B.x, y: B.y - 320 }); } }
    for (let k = S.shots.length - 1; k >= 0; k--) { const p = S.shots[k];
      if (p.k === 'coalback' && Math.abs(p.x - B.x) < BOX[0] / 2 + 20 && p.y > B.y - BOX[1] && p.y < B.y + 10) { S.shots.splice(k, 1); hitBoss(S, t, p.x, p.y); } }
    // впритул до Бурчака — боляче (крім коли він оглушений чи впав)
    if (B.st !== 'dizzy' && B.st !== 'down' && Math.abs(dx) < 70 && S.y > B.y - 280 && S.y < B.y + 30) ACTr().hurt(S, t, B.x);
    // зірку підібрано → дорогу відкрито, далі — до кінця даху (фініш)
    if (S.gifts[0] >= 0) S.xmax = LEN + 300;
  }
  // камера по x стоїть, поки ти у вежі; на даху (фаза 3) — їде за героєм
  const camX = (S, ctg) => (S.boss && S.boss.ph === 3 && S.x > WR - 600 ? ctg : 0);

  root.LEVELS.tower = {
    name: 'tower', TOWER: true, BOSS: true, GY, HK: LV0.HK, LAMP_H: LV0.LAMP_H, TEX: LV0.TEX, LEN, START: 300, END, CAMY: 680,
    TITLE: 'Зірку повернуто!', BGMID: 'bg_towertop', BGW: 1700, BGY: Math.round(-40 + 0.4 * (YB - 680)), GIFTS: ['star'],
    HINT: 'Лізь угору! Стоїш на шестерні — вона везе вбік. На маятник стрибай, коли підлітає',
    LEDGES: LV0.LEDGES, HOUSES: [], PROPS: [{ tex: 'coalcrate', x: 420, h: 90, top: 0.2 }, { tex: 'coalcrate', x: 1250, h: 80, top: 0.2 }],
    LAMPS: [], SWEETS, ORNAMENTS: [], THIEVES: [], BULLIES, PIGEONS, AMMO, LADDERS, CHIMNEYS: CHECKS, CPLAMP: true,
    SURFX: PIECES.map((p) => [p.x0, p.y, p.x1, p.y]), PIECES, TOPF, PH, GEARS, PENDS, MOVERS, BELL, LEDGE, YB, WL, WR, ROOFGAPS, BOX,
    pendAt, onInit, onStep, camX,
  };
  if (typeof module !== 'undefined') module.exports = root.LEVELS.tower;
})(typeof window !== 'undefined' ? window : globalThis);
