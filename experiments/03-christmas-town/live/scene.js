// live/scene.js — що і в якому порядку малюється: небо → далеке місто → туман → ряд будинків → вулиця (будинки, ліхтарі,
// реквізит, земля) → предмети й актори → ефекти подій → сніг → світіння (bloom) → інтерфейс (hud.js).
// render(t) — чиста функція часу і стану гри: однаковий t дає однаковий кадр (так працюють демо, перевірки й відео).
(function () {
  const S = (window.SCENE = {}), L = LIB, M = L.M, W = SIM.VIEW.W, H = SIM.VIEW.H, LV = SIM.LV, GY = LV.GY;
  S.REPEAT = [];
  // pixel: 2 — гра рендериться в 960×540 і збільшується «квадратиками» ×2: усі асети на одній піксельній сітці
  S.programs = () => { L.init(W, H, {}, { pixel: 2 }); L.glyphs(); L.SUN = [470, 200]; };
  const SNOW = [0.86, 0.9, 1.0], WARM = [1.0, 0.68, 0.32];
  const rnd = L.rnd, SS = L.SS;

  // Вікна будинків (центри в частках текстури) — для теплого світла, що мерехтить. Виміряно з сітки.
  const WIN = {
    house_bakery: [[0.27, 0.42], [0.59, 0.42], [0.36, 0.84], [0.17, 0.78], [0.3, 0.78]],
    house_tall: [[0.5, 0.27], [0.5, 0.47], [0.5, 0.67], [0.78, 0.9]],
    house_wide: [[0.2, 0.58], [0.48, 0.58], [0.75, 0.58], [0.6, 0.36]],
    townhall: [[0.125, 0.66], [0.305, 0.66], [0.494, 0.66], [0.69, 0.66], [0.853, 0.66]],
  };
  // темні вікна, що спалахують у фіналі (мансарди ратуші, вікна аркади)
  const WIN_DARK = { townhall: [[0.153, 0.49], [0.296, 0.49], [0.69, 0.49], [0.845, 0.49], [0.22, 0.89], [0.78, 0.89]] };
  const HAZE = { grade: [0.9, 0.86, 0.1, 0.95], haze: [0.12, 0.17, 0.32] };   // ратуша «в глибині площі» — трохи в серпанку

  S.render = (t) => {
    const ST = S.state || SIM.at(t), GT = ST.t;
    // ---- тряска камери від подій (вибух, удар, важке приземлення); затухає квадратично ----
    let tr = 0; for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      const A0 = e.k === 'boom' ? 10 : e.k === 'hurt' ? 7 : e.k === 'land' && (e.v || 0) > 1400 ? 4 : e.k.endsWith('out') ? 5 : 0;
      if (A0 && a < 0.35) tr = Math.max(tr, A0 * (1 - a / 0.35) ** 2); }
    const camX = ST.cam + tr * Math.sin(GT * 91), camY = ST.camY + tr * Math.sin(GT * 117 + 1.3);
    const X = (f) => -camX * f, Y = (f) => -camY * f;               // зсув шару з глибиною f (паралакс)
    const onScreen = (x, m = 300) => x + X(1) > -m && x + X(1) < W + m;

    // ===================== фон → T.bg =====================
    L.beginBG([0.02, 0.05, 0.11, 1]);
    L.sprite('bg_sky', -60 + X(0.03), -140 + Y(0.05), { w: 2340 });
    // зорі мерехтять (кожна зі своїм періодом), місяць має м'яке сяйво — у картинці його нема, це код
    for (let i = 0; i < 46; i++) { const sx = ((rnd(i, 1) * 2600 + X(0.03)) % 2600 + 2600) % 2600 - 300, sy = 20 + rnd(i, 2) * 380 + Y(0.05);
      const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + 2 * rnd(i, 3)) + i); L.star(sx, sy, 5 + 6 * rnd(i, 4), [0.85, 0.9, 1], 0.25 + 0.6 * tw * tw); }
    const moon = [-60 + 0.22 * 2340 + X(0.03), -140 + 0.23 * 1316 + Y(0.05)];
    L.glow(moon[0], moon[1], 260, [0.55, 0.65, 0.95], 0.22, 2.5); L.glow(moon[0], moon[1], 70, [0.85, 0.9, 1], 0.35, 4);
    // далеке місто (паралакс 0.15), серпанок синій
    for (let k = -1; k < 3; k++) L.sprite('bg_far', k * 2400 + ((X(0.15) % 2400) + 2400) % 2400 - 2400, -130 + Y(0.15), { w: 2400,
      u: { grade: [0.75, 0.9, 0.3, 0.85], haze: [0.12, 0.17, 0.32], lod: 0.5 } });
    // вогники в далеких вікнах подеколи гаснуть і загоряються
    for (let i = 0; i < 14; i++) { const fx = ((rnd(i, 7) * 2400 + X(0.15)) % 2400 + 2400) % 2400 - 200, fy = 520 + rnd(i, 8) * 120 + Y(0.15);
      if (Math.sin(t * 0.21 + i * 4.1) > -0.3) L.glow(fx, fy, 22, WARM, 0.35, 3); }
    L.fog(470, 260, [0.0018, 0.010, 0.52, 0.30], [0.25, 0.32, 0.52], 1, t, 0.2);
    // ряд будинків за площею (паралакс 0.4)
    // менший масштаб і більше серпанку, ніж на ігровому плані, — тоді око читає «це далі, за площею»
    for (let k = -1; k < 5; k++) L.sprite('bg_mid', k * 1440 + ((X(0.4) % 1440) + 1440) % 1440 - 1440, 260 + Y(0.4), { w: 1440,
      u: { grade: [0.7, 0.62, 0.32, 0.8], haze: [0.10, 0.14, 0.30], lod: 0.6 } });
    L.fog(700, 260, [0.003, 0.03, 0.45, 0.4], [0.22, 0.28, 0.45], 2, t, 0.2);
    if (LV.HUB) PLAZA.sky(ST, GT, X, Y);                                     // феєрверк над площею (фінал)

    // ===================== ігровий план → T.comp =====================
    L.beginComp();
    // будинки
    for (const h of LV.HOUSES) { const [tw, th] = LV.TEX[h.tex], w = tw * (h.k || LV.HK), hh = th * (h.k || LV.HK); if (!onScreen(h.x + w / 2, w)) continue;
      L.sprite(h.tex, Math.round(h.x + X(1)), Math.round(GY - hh + 8 + Y(1)), { w, h: hh, flip: !!h.flip, u: h.haze ? HAZE : undefined }); }
    if (LV.HUB) { PLAZA.clock(ST, GT, X, Y); PLAZA.signs(ST, X, Y); }
    // ліхтарі: хитаються від влучань; запалений — тепле світло і пляма на снігу
    LV.LAMPS.forEach((lx, i) => { if (!onScreen(lx)) return; const h = LV.LAMP_H, w = L.hsz('lamp', h), x = lx + X(1), y = GY + 6 + Y(1);
      L.sprite('lamp', 0, 0, { m: M.of(M.t(Math.round(x), Math.round(y)), M.r(ST.la[i][0] * 0.06)), w, h, pivot: [w / 2, h] }); });
    // реквізит
    for (const p of LV.PROPS) { if (!onScreen(p.x)) continue; const w = L.hsz(p.tex, p.h);
      L.sprite(p.tex, Math.round(p.x - w / 2 + X(1)), Math.round(GY - p.h + 6 + Y(1)), { h: p.h }); }
    // земля: смуга бруківки під снігом, повторюється
    { const g = A('ground'), k = 0.8, gw = g.w * k, walk = (g.walk || 14) * k, x0 = Math.floor(camX / gw) * gw - gw;
      for (let x = x0; x < camX + W + gw; x += gw - 1) L.sprite('ground', Math.round(x + X(1)), Math.round(GY - walk + Y(1)), { w: gw, h: g.h * k });
      L.solid(0, GY - walk + g.h * k - 4 + Y(1), W, 400, [0.05, 0.06, 0.1]); }
    if (LV.HUB) PLAZA.tree(ST, GT, t, X, Y);                                 // ялинка посеред площі — перед ратушею, за героєм

    // предмети, вороги, герой
    DRAW.items(ST, GT, t, X, Y, onScreen);
    ST.th.forEach((e, i) => onScreen(e.x) && DRAW.enemy('thief', e, i, ST, GT, t, X, Y));
    ST.bu.forEach((e, i) => onScreen(e.x) && DRAW.enemy('bully', e, i, ST, GT, t, X, Y));
    L.inked(() => DRAW.hero(ST, GT, t, X, Y), { r: 2, n: 6, col: [0.04, 0.04, 0.07], dy: 0 });
    FX.events(ST, GT, t, X, Y);

    // ===================== світло: вікна, ліхтарі (додається поверх — «світить») =====================
    const fest = LV.HUB ? PLAZA.lit(ST, GT) : 0;                             // фінал: у всіх вікнах світліше, темні — загоряються
    for (const h of LV.HOUSES) { const k = h.k || LV.HK, [tw, th] = LV.TEX[h.tex], w = tw * k, hh = th * k, r = h.k ? 0.7 : 1; if (!onScreen(h.x + w / 2, w)) continue;
      const win = (u, v, j, amt) => { const fl = 0.85 + 0.1 * Math.sin(t * 7.3 + j * 3 + h.x) + 0.05 * Math.sin(t * 13.1 + j);
        const wx = h.x + (h.flip ? 1 - u : u) * w + X(1), wy = GY - hh + 8 + v * hh + Y(1);
        L.glow(wx, wy, 120 * r, WARM, 0.22 * fl * amt, 2.6); L.glow(wx, wy, 40 * r, [1, 0.85, 0.55], 0.25 * fl * amt, 3.5); };
      WIN[h.tex].forEach(([u, v], j) => win(u, v, j, 1 + 0.6 * fest));
      (WIN_DARK[h.tex] || []).forEach(([u, v], j) => { const on = fest * SS(0, 0.3, GT - ST.fin - 1.2 - j * 0.25); if (on > 0) win(u, v, j + 9, 1.3 * on); }); }
    LV.LAMPS.forEach((lx, i) => { if (!onScreen(lx)) return; const lit = ST.lit[i] >= 0 ? SS(0, 0.35, GT - ST.lit[i]) : 0;
      const a = ST.la[i][0] * 0.06, lpx = lx + X(1) + Math.sin(a) * (LV.LAMP_H - 60), lpy = GY - LV.LAMP_H + 66 + Y(1);
      const fl = 0.92 + 0.08 * Math.sin(t * 9.1 + i * 2) * Math.sin(t * 5.3 + i);
      if (lit > 0) { L.glow(lpx, lpy, 330, WARM, 0.35 * lit * fl, 2.2); L.glow(lpx, lpy, 50, [1, 0.92, 0.7], 0.8 * lit * fl, 3);
        L.glow(lx + X(1), GY + Y(1) + 10, 220, WARM, 0.18 * lit, 2.4); }
      else L.glow(lpx, lpy, 30, [0.5, 0.6, 0.9], 0.15, 3); });
    if (LV.HUB) PLAZA.light(ST, GT, t, X, Y);

    // ===================== сніг: два шари пластівців, вітер з симуляції =====================
    if (!L.NOFX) for (let i = 0; i < 150; i++) { const near = i % 3 === 0, sp = near ? 120 + 40 * rnd(i, 1) : 55 + 30 * rnd(i, 1);
      const par = near ? 1.15 : 0.6, wx = SIM.windAt(t, i * 37) * (near ? 90 : 50);
      const x = ((rnd(i, 2) * (W + 200) + X(par) + t * wx + 24 * Math.sin(t * (0.6 + rnd(i, 3)) + i)) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = ((rnd(i, 4) * (H + 100) + t * sp + Y(par)) % (H + 100) + H + 100) % (H + 100) - 50, s = near ? 4 : 2;
      L.solid(Math.round(x / 2) * 2, Math.round(y / 2) * 2, s, s, SNOW, 0, 0, 0, near ? 0.9 : 0.55); }
    L.finish(t, { bloom: [0.32, 0.26], vignette: 0.86, warm: 0.4, roll: 1, dither: 0 });

    HUD.draw(ST, GT, t);
  };
  const A = (n) => window.ASSETS[n];

  // QA (scripts/qa.mjs): стани з найдовшими значеннями в інтерфейсі; цикл бігу героя
  S.QA = () => {
    const base = (o = {}) => { const s = SIM.spawn(0); for (let i = 0; i < 120; i++) SIM.step(s, {}); return Object.assign(s, o); };
    // місце без цукерок поруч (інакше їхнє гойдання плутає перевірку), камера зафіксована: герой на екрані в x = 600
    const run = (d) => base({ x: 2300 + d, cam: 1700 + d, camV: 0, camY: 0, vx: 430, dist: d, ground: 'ground' });   // справді біжить, камера слідом
    return { states: [['start', base()], ['full', base({ sw: 999, cones: 40, crackers: 9, hearts: 3 })], ['low', base({ hearts: 1, cones: 0, crackers: 0 })]],
      cycles: { hero_run: [0, 19, 38, 56, 75, 94, 112, 131].map(run) }, subject: { hero_run: 'hero' }, cycleT: { hero_run: 150 / 430 },
      sprites: { hero_run: ['hero_body', 'hero_arm_n', 'hero_arm_f', 'hero_leg_n', 'hero_leg_f', 'hero_scarf', 'rig'] },
      box: () => [500, 650, 220, 280] };
  };
})();
