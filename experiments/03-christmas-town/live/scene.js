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

  // ---------------- читабельність платформ ----------------
  // Одна «мова» для гравця: де лежить сніжна смуга з бурульками — туди можна стати. Малюється кодом по лініях SIM.SURF,
  // тож кожна платформа (дах, навіс, вазон, ящики, карниз) позначена однаково, а все інше — ні.
  const CAP = [0.93, 0.93, 0.99], CAP_SH = [0.55, 0.61, 0.86], ICE = [0.74, 0.86, 1.0];
  const seedOf = (id) => { let h = 0; for (const c of id) h = h * 31 + c.charCodeAt(0); return h % 997; };
  function caps(X, Y, onScreen) {
    for (const s of SIM.SURF) { if (s.id === 'ground') continue; const p = s.pts, sd = seedOf(s.id);
      for (let i = 0; i < p.length - 1; i++) { const [x0, y0] = p[i], [x1, y1] = p[i + 1]; if (!onScreen((x0 + x1) / 2, Math.abs(x1 - x0) + 100)) continue;
        const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), sx = Math.round(x0 + X(1)), sy = Math.round(y0 + Y(1));
        // смуга: синя тінь знизу, біла шапка зверху (верх — рівно під ногами героя); краї трохи звисають
        L.solid(sx - 6, sy + 2, len + 12, 8, CAP_SH, a, 6, -2);
        L.solid(sx - 8, sy - 3, len + 16, 8, CAP, a, 8, 3);
        if (s.roof || Math.abs(y1 - y0) > 0.2 * Math.abs(x1 - x0)) continue;         // на дахах (і скісних) бурульок нема
        // горбики снігу й бурульки — однакові щокадру (rnd від номера платформи), різної довжини
        for (let k = 6; k < len - 4; k += 22) { const r = rnd(sd, k), x = sx + Math.round(k / 2) * 2, y = sy + (y1 - y0) * k / len;
          L.solid(x - 4, Math.round(y) - 5, 10, 4, CAP);
          if (r > 0.3) { const h = 6 + Math.round(r * 14 / 2) * 2; L.solid(x, Math.round(y) + 8, 4, h, ICE); L.solid(x + 1, Math.round(y) + 8 + h, 2, 4, ICE); } } } }
  }
  // Іскри на краях, до яких герой дістане стрибком прямо зараз (стоїть на опорі; край вище, але не вище ~360 px, поруч).
  const REACH = 370;
  function glints(ST, t, X, Y, onScreen) {
    if (!ST.ground || ST.faint >= 0 || ST.exit) return;
    for (const s of SIM.SURF) { if (s.id === 'ground' || s.id === ST.ground) continue; const p = s.pts, sd = seedOf(s.id);
      for (let i = 0; i < p.length - 1; i++) { const [x0, y0] = p[i], [x1, y1] = p[i + 1]; if (!onScreen((x0 + x1) / 2, Math.abs(x1 - x0))) continue;
        const cx = Math.max(x0, Math.min(x1, ST.x)), cy = y0 + (y1 - y0) * (cx - x0) / (x1 - x0 || 1), dy = ST.y - cy, dx = Math.abs(cx - ST.x);
        const k = SS(30, 70, dy) * (1 - SS(REACH - 40, REACH, dy)) * (1 - SS(260, 430, dx)); if (k <= 0.01) continue;
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / 55));
        // постійний легкий блиск + час від часу спалах (кожна іскра у своєму ритмі)
        for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.6 + j * 2.3 + sd)) ** 3;
          const x = x0 + (x1 - x0) * u + X(1), y = y0 + (y1 - y0) * u + Y(1) - 2;
          // золотий хрестик звичайним шаром: «світле» додавання на білому снігу не видно, а жовте — видно
          const s = Math.round(4 + 6 * tw) * 2, xx = Math.round(x / 2) * 2, yy = Math.round((y - 6) / 2) * 2, a = Math.min(1, 1.2 * k * tw);
          L.solid(xx - s / 2, yy - 1, s, 2, [1, 0.78, 0.25], 0, 0, 0, a); L.solid(xx - 1, yy - s / 2, 2, s, [1, 0.78, 0.25], 0, 0, 0, a);
          L.solid(xx - 2, yy - 2, 4, 4, [1, 1, 0.9], 0, 0, 0, a); L.glow(x, y - 6, 34, [1, 0.85, 0.5], 0.2 * k, 3); } } }
  }

  // Вікна будинків (центри в частках текстури) — для теплого світла, що мерехтить. Виміряно з сітки.
  const WIN = {
    house_bakery: [[0.27, 0.42], [0.59, 0.42], [0.36, 0.84], [0.17, 0.78], [0.3, 0.78]],
    house_tall: [[0.5, 0.27], [0.5, 0.47], [0.5, 0.67], [0.78, 0.9]],
    house_wide: [[0.2, 0.58], [0.48, 0.58], [0.75, 0.58], [0.6, 0.36]],
    townhall: [[0.125, 0.66], [0.305, 0.66], [0.494, 0.66], [0.69, 0.66], [0.853, 0.66]],
    roof_gable: [[0.5, 0.42], [0.5, 0.8]], roof_flat: [[0.3, 0.37], [0.71, 0.37], [0.3, 0.76], [0.71, 0.76]],
    roof_slope: [[0.53, 0.82], [0.62, 0.42]], roof_tower: [[0.5, 0.45]],
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
    const BM = LV.BGMID ? { n: LV.BGMID, w: 1600, y: -110 } : { n: 'bg_mid', w: 1440, y: 260 };          // дахи: «море дахів» унизу
    for (let k = -1; k < 5; k++) L.sprite(BM.n, k * BM.w + ((X(0.4) % BM.w) + BM.w) % BM.w - BM.w, BM.y + Y(0.4), { w: BM.w,
      u: { grade: [0.7, 0.62, 0.32, 0.8], haze: [0.10, 0.14, 0.30], lod: 0.6 } });
    L.fog(700, 260, [0.003, 0.03, 0.45, 0.4], [0.22, 0.28, 0.45], 2, t, 0.2);
    if (LV.HUB) PLAZA.sky(ST, GT, X, Y);                                     // феєрверк над площею (фінал)

    // ===================== ігровий план → T.comp =====================
    L.beginComp();
    // будинки
    for (const h of LV.HOUSES) { const [tw, th] = LV.TEX[h.tex], w = tw * (h.k || LV.HK), hh = th * (h.k || LV.HK); if (!onScreen(h.x + w / 2, w)) continue;
      if (h.base) ROOFDRAW.walls(h, Math.round(h.x + X(1)), w, hh, Y);
      L.sprite(h.tex, Math.round(h.x + X(1)), Math.round((h.base || GY + 8) - hh + Y(1)), { w, h: hh, flip: !!h.flip, u: h.haze ? HAZE : undefined }); }
    if (LV.HUB) { PLAZA.clock(ST, GT, X, Y); PLAZA.signs(ST, X, Y); }
    // ліхтарі: хитаються від влучань; запалений — тепле світло і пляма на снігу
    LV.LAMPS.forEach((lx, i) => { if (!onScreen(lx)) return; const h = LV.LAMP_H, w = L.hsz('lamp', h), x = lx + X(1), y = GY + 6 + Y(1);
      L.sprite('lamp', 0, 0, { m: M.of(M.t(Math.round(x), Math.round(y)), M.r(ST.la[i][0] * 0.06)), w, h, pivot: [w / 2, h] }); });
    // реквізит
    for (const p of LV.PROPS) { if (!onScreen(p.x)) continue; const w = L.hsz(p.tex, p.h);
      L.sprite(p.tex, Math.round(p.x - w / 2 + X(1)), Math.round((p.y || GY) - p.h + 6 + Y(1)), { h: p.h }); }
    ROOFDRAW.front(ST, GT, t, X, Y, onScreen);                               // драбини, місточки, пласти, дим (дахи)
    caps(X, Y, onScreen);                                                    // сніжні краї платформ — поверх будинків і реквізиту
    // земля: смуга бруківки під снігом, повторюється
    { const g = A('ground'), k = 0.8, gw = g.w * k, walk = (g.walk || 14) * k, x0 = Math.floor(camX / gw) * gw - gw;
      for (let x = x0; x < camX + W + gw; x += gw - 1) L.sprite('ground', Math.round(x + X(1)), Math.round(GY - walk + Y(1)), { w: gw, h: g.h * k });
      L.solid(0, GY - walk + g.h * k - 4 + Y(1), W, 400, [0.05, 0.06, 0.1]); }
    if (LV.HUB) PLAZA.tree(ST, GT, t, X, Y);                                 // ялинка посеред площі — перед ратушею, за героєм

    // предмети, вороги, герой
    DRAW.items(ST, GT, t, X, Y, onScreen);
    ST.th.forEach((e, i) => onScreen(e.x) && DRAW.enemy('thief', e, i, ST, GT, t, X, Y));
    ST.bu.forEach((e, i) => onScreen(e.x) && DRAW.enemy('bully', e, i, ST, GT, t, X, Y));
    ROOFDRAW.pigeons(ST, GT, t, X, Y, onScreen);
    L.inked(() => DRAW.hero(ST, GT, t, X, Y), { r: 2, n: 6, col: [0.04, 0.04, 0.07], dy: 0 });
    FX.events(ST, GT, t, X, Y);

    // ===================== світло: вікна, ліхтарі (додається поверх — «світить») =====================
    const fest = LV.HUB ? PLAZA.lit(ST, GT) : 0;                             // фінал: у всіх вікнах світліше, темні — загоряються
    for (const h of LV.HOUSES) { const k = h.k || LV.HK, [tw, th] = LV.TEX[h.tex], w = tw * k, hh = th * k, r = h.k ? 0.7 : 1; if (!onScreen(h.x + w / 2, w)) continue;
      const win = (u, v, j, amt) => { const fl = 0.85 + 0.1 * Math.sin(t * 7.3 + j * 3 + h.x) + 0.05 * Math.sin(t * 13.1 + j);
        const wx = h.x + (h.flip ? 1 - u : u) * w + X(1), wy = (h.base || GY + 8) - hh + v * hh + Y(1);
        L.glow(wx, wy, 120 * r, WARM, 0.22 * fl * amt, 2.6); L.glow(wx, wy, 40 * r, [1, 0.85, 0.55], 0.25 * fl * amt, 3.5); };
      (WIN[h.tex] || []).forEach(([u, v], j) => win(u, v, j, 1 + 0.6 * fest));
      (WIN_DARK[h.tex] || []).forEach(([u, v], j) => { const on = fest * SS(0, 0.3, GT - ST.fin - 1.2 - j * 0.25); if (on > 0) win(u, v, j + 9, 1.3 * on); }); }
    LV.LAMPS.forEach((lx, i) => { if (!onScreen(lx)) return; const lit = ST.lit[i] >= 0 ? SS(0, 0.35, GT - ST.lit[i]) : 0;
      const a = ST.la[i][0] * 0.06, lpx = lx + X(1) + Math.sin(a) * (LV.LAMP_H - 60), lpy = GY - LV.LAMP_H + 66 + Y(1);
      const fl = 0.92 + 0.08 * Math.sin(t * 9.1 + i * 2) * Math.sin(t * 5.3 + i);
      if (lit > 0) { L.glow(lpx, lpy, 330, WARM, 0.35 * lit * fl, 2.2); L.glow(lpx, lpy, 50, [1, 0.92, 0.7], 0.8 * lit * fl, 3);
        L.glow(lx + X(1), GY + Y(1) + 10, 220, WARM, 0.18 * lit, 2.4); }
      else L.glow(lpx, lpy, 30, [0.5, 0.6, 0.9], 0.15, 3); });
    if (LV.HUB) PLAZA.light(ST, GT, t, X, Y);
    ROOFDRAW.light(ST, GT, t, X, Y, onScreen);                               // жар у запалених димарях
    glints(ST, t, X, Y, onScreen);                                           // іскри на краях, до яких зараз дістанеш

    // ===================== сніг: два шари пластівців, вітер з симуляції =====================
    if (!L.NOFX) for (let i = 0; i < 150; i++) { const near = i % 3 === 0, sp = near ? 120 + 40 * rnd(i, 1) : 55 + 30 * rnd(i, 1);
      const par = near ? 1.15 : 0.6, wx = SIM.windAt(t, i * 37) * (near ? 90 : 50);
      const x = ((rnd(i, 2) * (W + 200) + X(par) + t * wx + 24 * Math.sin(t * (0.6 + rnd(i, 3)) + i)) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = ((rnd(i, 4) * (H + 100) + t * sp + Y(par)) % (H + 100) + H + 100) % (H + 100) - 50, s = near ? 4 : 2;
      L.solid(Math.round(x / 2) * 2, Math.round(y / 2) * 2, s, s, SNOW, 0, 0, 0, near ? 0.9 : 0.55); }
    ROOFDRAW.wind(ST, t, X, Y);                                              // смуги вітру в проміжках між дахами
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
