// live/sim.js — симуляція гри (фіксований крок 1/120 с): рух героя, платформи, камера, ліхтарі-чекпоінти, кінець рівня.
// Вороги, снаряди й предмети — в actors.js. Тут нема малювання, Math.random і Date: стан залежить лише від вводу й часу.
// SIM.at(t) — атракт-демо (програє записаний сценарій натискань), SIM.spawn + SIM.step — справжня гра в браузері.
(function (root) {
  const LV = root.LEVEL || require('./level.js'), ACT = root.ACT || require('./actors.js');
  if (!root.LEVELS.hub && typeof require !== 'undefined') require('./hub.js');   // у node площу підтягуємо самі (у браузері — index.html)
  const DT = 1 / 120, L = 16.0;                  // крок симуляції і довжина циклу демо (с)
  const VIEW = { W: 1920, H: 1080 }, GY = LV.GY;
  // «Відчуття» руху (px, с). JUMP дає стрибок ~360 px (2.2 зросту героя) — щоб діставати навіси й підвіконня.
  // COYOTE — «час койота»: ще 0.1 с після краю можна стрибнути; BUFFER — натиснув трохи раніше приземлення — спрацює.
  const K = { G: 2700, GF: 3300, MAXF: 1600, RUN: 430, ACC_G: 3200, ACC_A: 2100, JUMP: 1390, COYOTE: 0.10, BUFFER: 0.12, CUT: 480, APEX: 170 };
  const HERO_H = 160;                            // зріст героя на екрані (px)
  const HINT = 'стрілки / WASD — біг, Пробіл — стрибок, X або клік — рогатка, C — хлопавка, Esc — пауза';

  // ---------------- платформи з даних рівня ----------------
  // Кожна платформа — ламана [x, y ніг]; односторонні: на них стають згори, знизу пролітаєш крізь (як у більшості платформерів).
  // SURF будується з даних АКТИВНОГО рівня; SIM.use(...) перебудовує його (масив той самий — посилання в інших модулях живі).
  const SURF = [];
  function buildSurf() { SURF.length = 0; SURF.push({ id: 'ground', pts: [[-600, GY], [LV.LEN + 600, GY]] });
  LV.HOUSES.forEach((h, hi) => { const [tw, th] = LV.TEX[h.tex], k = h.k || LV.HK;          // k — свій масштаб будинку (ратуша менша)
    const X = (lx) => h.x + (h.flip ? tw - lx : lx) * k, Y = (ly) => GY - (th - ly) * k;
    LV.LEDGES[h.tex].forEach(([x0, y0, x1, y1], li) => { const a = [X(x0), Y(y0)], b = [X(x1), Y(y1)];
      SURF.push({ id: 'h' + hi + '_' + li, pts: a[0] < b[0] ? [a, b] : [b, a] }); }); });
  LV.PROPS.forEach((p, pi) => { if (p.top === undefined) return; const [tw, th] = LV.TEX[p.tex], w = p.h * tw / th, y = GY - p.h * (1 - p.top);
    SURF.push({ id: 'p' + pi, pts: [[p.x - w * 0.42, y], [p.x + w * 0.42, y]] }); });
  (LV.SURFX || []).forEach(([x0, y0, x1, y1], i) => SURF.push({ id: 'x' + i, pts: [[x0, y0], [x1, y1]] }));   // додаткові платформи рівня
  }
  buildSurf();
  // Перейти на інший рівень: вміст LEVEL замінюється даними з полиці LEVELS, платформи перебудовуються.
  function use(name) { if (LV.name === name || !root.LEVELS[name]) return; for (const k of Object.keys(LV)) delete LV[k];
    Object.assign(LV, root.LEVELS[name]); buildSurf(); cache = null; }
  const yOn = (s, x) => { const p = s.pts; for (let i = 0; i < p.length - 1; i++) if (x >= p[i][0] && x <= p[i + 1][0]) {
    const u = (x - p[i][0]) / (p[i + 1][0] - p[i][0] || 1); return p[i][1] + (p[i + 1][1] - p[i][1]) * u; } return null; };
  const surfAt = (x, y, tol) => { let best = null;
    for (const s of SURF) { const sy = yOn(s, x); if (sy !== null && Math.abs(sy - y) <= tol && (!best || sy < best.y)) best = { s, y: sy }; }
    return best; };
  const groundBelow = (x, y) => { let best = null; for (const s of SURF) { const sy = yOn(s, x); if (sy !== null && sy >= y - 4 && (best === null || sy < best)) best = sy; } return best; };
  // ліхтар, у який влучила шишка (скло ліхтаря — коло біля верхівки)
  const lampAt = (x, y) => LV.LAMPS.findIndex((lx) => Math.hypot(x - lx, y - (GY - LV.LAMP_H + 60)) < 40);
  const W = { groundBelow, lampAt };

  // Рука з рогаткою — ЄДИНЕ джерело пострілу: і симуляція, і малюнок героя беруть цю точку (тоді шишка вилітає з руки).
  // Плече ближньої руки (draw.js малює руку саме звідси) і довжина руки до кисті — постріл вилітає з кисті.
  const ARM_LEN = 52;
  const shoulder = (S) => [S.x - S.face * 18, S.y - 87];
  const hand = (S) => { const sh = shoulder(S); return [sh[0] + S.face * ARM_LEN, sh[1]]; };

  // ---------------- вітер (для снігу, гірлянд, диму) ----------------
  const windAt = (t, x) => 0.35 * Math.sin(0.5 * t + 0.0011 * x) + 0.15 * Math.sin(1.3 * t + 0.0031 * x + 1.3);

  // ---------------- демо-сценарій (атракт): [час, клавіша, натиснута] ----------------
  const SCRIPT = [[0, 'right', 1], [1.05, 'jump', 1], [1.45, 'jump', 0], [2.2, 'jump', 1], [2.6, 'jump', 0],
    [3.9, 'right', 0], [4.0, 'act', 1], [4.1, 'act', 0], [4.2, 'right', 1], [5.2, 'jump', 1], [5.5, 'jump', 0],
    [7.4, 'act', 1], [7.5, 'act', 0], [7.8, 'act', 1], [7.9, 'act', 0], [8.5, 'jump', 1], [8.8, 'jump', 0],
    [10.6, 'alt', 1], [10.7, 'alt', 0], [12.2, 'jump', 1], [12.6, 'jump', 0]];

  function create(o) {
    const S = Object.assign({ t: 0, steps: 0, wt0: 0, vj: false,
      x: LV.START, y: GY, vx: 0, vy: 0, ground: 'ground', face: 1, dist: 0, coyote: 0, buf: 0, prevJump: 0, prevAct: 0, prevAlt: 0, cut: false,
      landT: -9, landV: 0, jumpT: -9, hurtT: -9, shootT: -9, tossT: -9, inv: 0, hearts: 3, faint: -1, done: -1, sw: 0, combo: 0, comboT: -9,
      cones: 20, crackers: 3, cp: LV.START, scarfTh: 0, scarfOm: 0, cam: 0, camV: 0, camY: 0, camYV: 0, ev: [],
      lit: LV.LAMPS.map(() => (LV.HUB ? -100 : -1)), la: LV.LAMPS.map(() => [0, 0]), aim: null, prevUp: 0, exit: null }, ACT.init());   // на площі ліхтарі вже горять
    if (o && o.x !== undefined) Object.assign(S, { x: o.x, cp: o.x, face: o.face || 1 });                    // звідки заходимо (напр. з брами вулиці)
    if (LV.onInit) LV.onInit(S, o);
    return S;
  }
  const spawn = (worldT, o) => Object.assign(create(o), { vj: true, wt0: worldT });
  const outOfPlay = () => false;                 // ям нема: «програш» — лише втрата рукавичок (див. faint)
  const respawn = (S) => S;

  function step(S, inp) {
    const t = S.t + DT;
    // ---- ліхтарі: пружинний маятник (шишка або вибух розгойдує) ----
    for (const l of S.la) { l[1] += (-60 * l[0] - 2.2 * l[1]) * DT; l[0] += l[1] * DT; }
    // ---- непритомність після втрати всіх рукавичок → відродження біля останнього запаленого ліхтаря ----
    if (S.faint >= 0) { if (t - S.faint > 1.6) { Object.assign(S, { x: S.cp, y: GY, vx: 0, vy: 0, ground: 'ground', hearts: 3, faint: -1, inv: 1.5 });
        S.ev.push({ k: 'revive', t, x: S.x, y: GY }); } inp = {}; }
    if (S.done >= 0) inp = { right: S.x < LV.END + 260 ? 1 : 0 };         // фініш: герой сам добігає до ліхтаря
    if (S.exit) inp = {};                                                  // увійшов у браму — чекаємо переходу
    S.inv = Math.max(0, S.inv - DT);

    // ---- ввід ----
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) S.face = dir;
    const jumpHeld = !!(inp.jump || inp.up), jumpEdge = jumpHeld && !S.prevJump; S.prevJump = jumpHeld;
    S.buf = jumpEdge ? K.BUFFER : Math.max(0, S.buf - DT);
    // ---- брами (площа): ↑ біля брами — вирушити; зачинена — лише «стук». Тоді ↑ не стрибок ----
    const upEdge = !!inp.up && !S.prevUp; S.prevUp = !!inp.up;
    if (LV.GATES && upEdge && S.ground && S.faint < 0) { const g = LV.GATES.find((q) => Math.abs(S.x - q.x) < 110);
      if (g) { S.buf = 0; if (g.to) { S.exit = g.to; S.vx = 0; S.ev.push({ k: 'gate', t, x: S.x, y: S.y, to: g.to }); }
        else S.ev.push({ k: 'locked', t, x: g.x, y: S.y - 200 }); } }
    // ---- по горизонталі: розгін/гальмування (у повітрі керування слабше) ----
    const acc = S.ground ? K.ACC_G : K.ACC_A, target = dir * K.RUN;
    S.vx = S.vx < target ? Math.min(target, S.vx + acc * DT) : Math.max(target, S.vx - acc * DT);
    const py = S.y;
    if (S.ground) {
      S.x += S.vx * DT;
      const g = surfAt(S.x, S.y, 24);
      if (g) { S.y = g.y; S.ground = g.s.id; S.coyote = K.COYOTE; } else S.ground = null;          // зійшов з краю — падає
      if (S.ground && Math.abs(S.vx) > 20) { const b = Math.floor(S.dist / 70); S.dist += Math.abs(S.vx) * DT;
        if (Math.floor(S.dist / 70) !== b) S.ev.push({ k: 'step', t, x: S.x, y: S.y }); }
    } else {
      S.coyote = Math.max(0, S.coyote - DT);
      if (S.vj && S.cut && !jumpHeld && S.vy < -K.CUT) { S.vy = -K.CUT; S.cut = false; }        // відпустив рано — низький стрибок
      const apex = S.vj && jumpHeld && Math.abs(S.vy) < K.APEX ? 0.5 : 1;                       // на вершині трохи «зависає»
      S.vy = Math.min(K.MAXF, S.vy + (S.vy > 0 ? K.GF : K.G) * apex * DT);
      S.x += S.vx * DT; S.y += S.vy * DT;
      if (S.vy > 0) { let best = null; for (const s of SURF) { const sy = yOn(s, S.x);                // приземлення на найвищу платформу під нами
        if (sy !== null && py <= sy + 1 && S.y >= sy && (!best || sy < best.y)) best = { s, y: sy }; }
        if (best) { S.landV = S.vy; S.y = best.y; S.vy = 0; S.ground = best.s.id; S.landT = t; S.ev.push({ k: 'land', t, x: S.x, y: best.y, v: S.landV }); } }
    }
    S.x = Math.max(LV.HUB ? 80 : 40, Math.min(LV.XMAX || LV.LEN + 300, S.x));
    // ---- стрибок (з буфером і «часом койота») ----
    if (S.buf > 0 && (S.ground || S.coyote > 0) && S.faint < 0) { S.vy = -K.JUMP; S.ground = null; S.coyote = 0; S.buf = 0; S.jumpT = t; S.cut = true;
      S.ev.push({ k: 'jump', t, x: S.x, y: S.y }); }
    // ---- рогатка: X / клік мишею; приціл — курсор (якщо мишу рухали) або вперед, «вгору» — вище ----
    const actEdge = (inp.act || inp.click) && !S.prevAct; S.prevAct = !!(inp.act || inp.press);
    if (inp.px !== undefined && inp.px !== null) S.aim = [inp.px + S.cam, inp.py + S.camY];
    if (actEdge && S.cones > 0 && t - S.shootT > 0.22) {
      const hd = shoulder(S), useMouse = inp.click && S.aim;
      const aim = useMouse ? S.aim : [hd[0] + S.face * 1000, hd[1] - (inp.up ? 900 : 150)];
      if (useMouse) S.face = Math.sign(aim[0] - S.x) || S.face;
      S.shootT = t; ACT.fire(S, t, aim, shoulder(S), ARM_LEN); }
    const altEdge = inp.alt && !S.prevAlt; S.prevAlt = !!inp.alt;
    if (altEdge && S.crackers > 0 && t - S.tossT > 0.5) { S.tossT = t; ACT.toss(S, t, hand(S)); }
    // ---- вороги, снаряди, предмети ----
    ACT.step(S, t, DT, W);
    if (LV.onStep) LV.onStep(S, t);                                      // правила рівня (площа: ялинка, фінал)
    // ---- ліхтарі-чекпоінти: пробіг повз — запалився ----
    LV.LAMPS.forEach((lx, i) => { if (S.lit[i] === -1 && S.x > lx - 30) { S.lit[i] = t; S.cp = lx; S.ev.push({ k: 'lamp', t, x: lx, y: GY - LV.LAMP_H + 60, i }); } });
    if (S.done < 0 && S.x > LV.END) { S.done = t; S.ev.push({ k: 'done', t, x: S.x, y: S.y }); }
    // ---- шарф: пружина, що відстає від руху (follow-through — «наздоганяючий» рух) ----
    const ct = Math.max(-40, Math.min(40, S.vy * 0.03)) + (S.ground ? Math.max(-30, Math.min(30, -S.vx * 0.06)) : -S.vx * 0.03);
    S.scarfOm += (150 * (ct - S.scarfTh) - 12 * S.scarfOm) * DT; S.scarfTh += S.scarfOm * DT;
    // ---- камера: по x — з випередженням у бік погляду; по y — «прилипає» до платформи, на якій стоїш ----
    const ctg = Math.max(0, Math.min(LV.LEN - VIEW.W + 400, S.x + S.face * 220 - VIEW.W / 2));
    S.camV += (30 * (ctg - S.cam) - 11 * S.camV) * DT; S.cam += S.camV * DT;
    let cy = S.camY; if (S.ground || S.y - S.camY > 1000 || S.y - S.camY < 330) cy = Math.min(0, S.y - 820);
    S.camYV += (22 * (cy - S.camY) - 9.4 * S.camYV) * DT; S.camY += S.camYV * DT;
    if (S.ev.length > 64) S.ev.splice(0, S.ev.length - 64);
    S.t = t; S.steps++;
    return S;
  }

  const scriptInput = (t) => { const inp = { right: 0, left: 0, jump: 0, act: 0, alt: 0 }; for (const [ts, k, d] of SCRIPT) if (ts <= t + 1e-9) inp[k] = d; return inp; };
  let cache = null;
  function at(t) {                               // стан демо в момент t (кешується покроково)
    const loop = Math.floor(t / L), q = t - loop * L, n = Math.round(q / DT);
    if (!cache || cache.loop !== loop || cache.S.steps > n) cache = { loop, S: Object.assign(create(), { wt0: loop * L }) };
    const S = cache.S; while (S.steps < n) step(S, scriptInput(S.t));
    return Object.assign({}, S, { loop, q });
  }
  const demoCheck = (S) => S.got.filter((g) => g >= 0).length >= 6;
  const selfCheck = () => { const out = [];
    LV.SWEETS.forEach(([x, y], i) => { if (groundBelow(x, y) === null) out.push('sweet ' + i + ' has nothing below'); });
    return out; };

  root.SIM = { DT, L, K, VIEW, HINT, HERO_H, SURF, LV, use, yOn, groundBelow, windAt, hand, shoulder, ARM_LEN, create, spawn, respawn, outOfPlay, step, at, scriptInput, demoCheck, selfCheck };
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
