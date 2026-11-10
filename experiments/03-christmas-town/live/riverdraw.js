// live/riverdraw.js — малювання рівня «Замерзла річка й старий млин»: берег, лід і вода в протоках (кодом),
// крижини, колесо млина з дошками, а ще темрява — «карта світла» (light map): окрема картинка, де темно всюди,
// крім кіл світла навколо ліхтарів, вікон, героя й речей; кадр множиться на неї — освітлене видно, решта тоне в ночі.
// Чиста функція стану й часу, як і решта малювання.
(function () {
  const L = LIB, M = L.M, SS = L.SS, rnd = L.rnd, LV = SIM.LV, GY = LV.GY, W = SIM.VIEW.W, H = SIM.VIEW.H;
  const R = (window.RIVERDRAW = {});
  const px2 = (v) => Math.round(v / 2) * 2;                     // піксельна сітка гри — 2 px екрана
  const ICE_TOP = [0.86, 0.94, 1.0], ICE = [0.6, 0.76, 0.92], ICE_DK = [0.33, 0.47, 0.7], DEEP = [0.05, 0.07, 0.13];
  const WATER = [0.09, 0.2, 0.36], WATER_HI = [0.55, 0.74, 0.98];
  const WL = GY + 14;                                           // рівень води в протоках (трохи нижче за берег)

  // ---------------- земля: берег (плитки землі, обрізані по краях проток), лід, вода ----------------
  R.ground = (ST, GT, t, X, Y, camX) => {
    const g = window.ASSETS.ground, k = 0.8, gw = g.w * k, walk = (g.walk || 14) * k, x0 = Math.floor(camX / gw) * gw - gw, vis = [camX - 100, camX + W + 100];
    for (const s of SIM.SURF) { if (!s.gnd) continue; const a = Math.max(s.pts[0][0], vis[0]), b = Math.min(s.pts[1][0], vis[1]); if (a >= b) continue;
      if (!s.ice) {                                               // берег: плитка землі, лише в межах цього шматка
        for (let x = x0; x < camX + W + gw; x += gw - 1) { const u0 = Math.max(0, (a - x) / gw), u1 = Math.min(1, (b - x) / gw); if (u1 <= u0) continue;
          L.sprite('ground', Math.round(x + u0 * gw + X(1)), Math.round(GY - walk + Y(1)), { w: (u1 - u0) * gw, h: g.h * k, src: [u0, 0, u1, 1] }); }
        L.solid(Math.round(a + X(1)), Math.round(GY - walk + g.h * k - 4 + Y(1)), b - a, 400, DEEP); continue; }
      // лід: блакитна товща, світла кромка зверху, латки снігу й тріщини — однакові щокадру (rnd від світового x)
      const sx = Math.round(a + X(1)), sy = Math.round(GY + Y(1)), w = b - a;
      L.solid(sx, sy - 4, w, 70, ICE); L.solid(sx, sy + 40, w, 30, ICE_DK); L.solid(sx, sy + 70, w, 400, DEEP);
      L.solid(sx, sy - 6, w, 4, ICE_TOP);
      for (let x = Math.floor(a / 64) * 64; x < b; x += 64) { const r = rnd(x, 3), xx = px2(x + X(1));
        if (r > 0.45) L.solid(xx, sy - 8, px2(18 + 40 * rnd(x, 4)), 6, [0.95, 0.95, 1]);                  // латка снігу на льоду
        if (r < 0.35) { const len = 20 + 30 * rnd(x, 5); L.solid(xx + 10, sy + 6 + 20 * rnd(x, 6), len, 2, ICE_DK, (rnd(x, 7) - 0.5) * 1.2); }   // тріщина
        if (r > 0.8) L.solid(xx + 30, sy + 4, 6, 2, [1, 1, 1], 0, 0, 0, 0.5 + 0.5 * Math.sin(t * 3 + x)); } }        // відблиск
    // протоки: темна вода з брижами й місячною доріжкою; на краях — уламки льоду
    for (const [a, b] of LV.WATER) { if (b < vis[0] || a > vis[1]) continue; const sx = Math.round(a + X(1)), w = b - a, sy = Math.round(WL + Y(1));
      L.solid(sx, sy, w, 600, WATER); L.solid(sx, sy, w, 4, [0.14, 0.24, 0.42]);
      for (let i = 0; i < w / 40; i++) { const r = rnd(a + i, 9), ph = (t * (0.25 + 0.2 * r) + r) % 1, x = a + ((i * 40 + t * (14 + 10 * r)) % w);
        L.solid(px2(x + X(1)), px2(sy + 10 + 60 * rnd(a + i, 10)), px2(14 + 30 * r), 2, WATER_HI, 0, 0, 0, 0.8 * Math.sin(Math.PI * ph)); }
      for (const e of [a, b]) { const d = e === a ? 1 : -1, ex = Math.round(e + X(1));               // крижаний уступ на краю протоки
        L.solid(ex - (d > 0 ? 6 : 0), sy - 18, 6, 44, ICE); L.solid(ex - (d > 0 ? 6 : 0), sy - 20, 6, 4, ICE_TOP);
        L.solid(ex + d * 6 - (d > 0 ? 0 : 14), sy + 2, 14, 8, ICE_DK); } }
  };

  // ---------------- крижини й колесо млина ----------------
  const FT = 0.1;                                               // верх снігу на крижині — частка висоти текстури
  R.movers = (ST, GT, t, X, Y, onScreen) => {
    LV.FLOES.forEach((f, i) => { const [x, y] = ST.mv[i]; if (!onScreen(x, f.w)) return;
      const on = ST.ground === 'f' + i ? 1 : 0, dip = on * 4;                  // герой стоїть — крижина трохи осідає
      L.sprite(f.tex, Math.round(x - f.w / 2 + X(1)), Math.round(y - f.h * FT + dip + Y(1)), { w: f.w, h: f.h });
      // підводна частина — під напівпрозорою водою, на межі — світла смужка брижів
      L.solid(Math.round(x - f.w / 2 - 6 + X(1)), Math.round(WL + 6 + Y(1)), f.w + 12, f.h, WATER, 0, 0, 0, 0.6);
      L.solid(px2(x - f.w / 2 - 10 + X(1)), px2(WL + 4 + Y(1)), px2(f.w + 20), 2, WATER_HI, 0, 0, 0, 0.5 + 0.3 * Math.sin(t * 2 + i)); });
    const Wh = LV.WHEEL; if (!onScreen(Wh.x, 700)) return;
    const a = 2 * Math.PI * GT / Wh.P, D = Wh.R / 0.43, Dh = D * 446 / 431, cx = Wh.x + X(1), cy = Wh.y + Y(1);
    // вісь колеса — колода до стіни млина
    const mill = LV.HOUSES.find((h) => h.tex === 'mill'), wx = mill.x + 0.15 * LV.TEX.mill[0] * LV.HK + X(1);
    L.solid(Math.round(cx), Math.round(cy - 12), Math.round(wx - cx), 24, [0.22, 0.12, 0.07]); L.solid(Math.round(cx), Math.round(cy - 12), Math.round(wx - cx), 4, [0.45, 0.28, 0.16]);
    L.sprite('millwheel', 0, 0, { m: M.of(M.t(Math.round(cx), Math.round(cy)), M.r(a)), w: D, h: Dh, pivot: [D * 0.505, Dh * 0.48] });
    // дошки-сходинки на кінцях лопатей — завжди горизонтальні (як кабінки оглядового колеса), на них і стають
    for (let k = 0; k < Wh.n; k++) { const [x, y] = ST.mv[LV.FLOES.length + k], pw = Wh.pw + 16, ph = pw * 138 / 296;
      L.sprite('plank', Math.round(x - pw / 2 + X(1)), Math.round(y - 22 + Y(1)), { w: pw, h: ph }); }
    // з лопатей, що виходять з води (ліва половина піднімається), капає вода
    for (let j = 0; j < 10; j++) { const s = rnd(j, 21), ph = (t * 1.3 + s) % 1, an = a + j * Math.PI / 4;
      const bx = Wh.x + Wh.R * 1.08 * Math.cos(an), by = Wh.y + Wh.R * 1.08 * Math.sin(an); if (Math.sin(an) < 0.2) continue;
      L.solid(px2(bx + X(1)), px2(by + ph * 120 + Y(1)), 2, 4, WATER_HI, 0, 0, 0, 0.8 * (1 - ph)); }
  };

  // ---------------- темрява: карта світла ----------------
  let TD = null;
  const AMB = [0.17, 0.2, 0.34];                                // місячна ніч: усе синє й темне, але обриси видно
  R.dark = (ST, GT, t, X, Y, onScreen) => {
    if (L.NOFX) return;
    if (!TD) TD = G.target(Math.round(W / 4), Math.round(H / 4), true, { view: [W, H] });   // низька роздільність — м'які краї світла
    G.bind(TD, [AMB[0], AMB[1], AMB[2], 1]);
    // запалені ліхтарі — великі теплі кола; щойно погашений — світло згасає за пів секунди
    LV.LAMPS.forEach((lx, i) => { if (!onScreen(lx, 800)) return; const l = ST.lit[i];
      const k = l >= 0 ? SS(0, 0.35, GT - l) : l === -3 ? 1 - SS(0, 0.5, GT - ST.snT[i]) : 0; if (k <= 0) return;
      const fl = 0.95 + 0.05 * Math.sin(t * 9.1 + i * 2), x = lx + X(1), y = GY - LV.LAMP_H + 66 + Y(1);
      L.glow(x, y + 120, 620, [1.0, 0.82, 0.55], 1.1 * k * fl, 1.7); L.glow(x, y, 220, [1, 0.9, 0.7], 0.6 * k, 2); });
    // герой: невелике коло — щоб завжди бачити, куди ступаєш
    L.glow(ST.x + X(1), ST.y - 80 + Y(1), 440, [0.78, 0.84, 1.0], 0.75, 1.8);
    // вікна млина й повітки (там світло горить у будь-якому разі)
    for (const h of LV.HOUSES) { if (h.tex !== 'mill') continue; const k = LV.HK, [tw, th] = LV.TEX.mill, w = tw * k, hh = th * k;
      for (const [u, v] of [[0.55, 0.23], [0.55, 0.4], [0.55, 0.6], [0.73, 0.82]]) L.glow(h.x + u * w + X(1), h.base - hh + v * hh + Y(1), 260, [1, 0.78, 0.45], 0.8, 1.8); }
    // речі, які треба знайти, ледь світяться в темряві
    LV.ORNAMENTS.forEach(([x, y], i) => { if (ST.orn[i] === -1 && onScreen(x)) L.glow(x + X(1), y + Y(1), 160, [1, 0.9, 0.6], 0.6, 2); });
    LV.SWEETS.forEach(([x, y], i) => { if (ST.got[i] === -1 && onScreen(x)) L.glow(x + X(1), y + Y(1), 70, [1, 0.85, 0.6], 0.35, 2); });
    for (const g of ST.drops) if (ST.gifts[g.i] < 0) L.glow(g.x + X(1), g.y - 30 + Y(1), 200, [1, 0.85, 0.5], 0.8, 2);
    for (const p of ST.shots) if (p.k === 'cracker') L.glow(p.x + X(1), p.y + Y(1), 160, [1, 0.7, 0.4], 0.6, 2);
    // спалахи: вибух хлопавки освітлює все довкола, запалений ліхтар — коротко яскравіше
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'boom' && a < 1.2) L.glow(e.x + X(1), e.y + Y(1), 900, [1, 0.85, 0.6], 1.4 * (1 - a / 1.2) ** 2, 1.5);
      if (e.k === 'lamp' && a < 0.8) L.glow(e.x + X(1), e.y + Y(1), 700, [1, 0.85, 0.6], 0.8 * (1 - a / 0.8), 1.6); }
    G.bind(L.T.comp); G.blend('mult'); G.full(L.P.copy, { u_src: TD }); G.blend();
  };

  // погашений ліхтар: над склом в'ється тоненький димок від ґнота (ще 3 с)
  R.smoke = (ST, GT, t, X, Y, onScreen) => {
    LV.LAMPS.forEach((lx, i) => { if (ST.lit[i] !== -3 || !onScreen(lx)) return; const a = GT - ST.snT[i]; if (a > 3) return;
      for (let j = 0; j < 4; j++) { const ph = (t * 0.6 + j / 4) % 1;
        L.puff(lx + X(1) + 8 * Math.sin(t * 2 + j), GY - LV.LAMP_H + 30 + Y(1) - ph * 90, 6 + 10 * ph, [0.6, 0.63, 0.72], 0.35 * (1 - ph) * (1 - a / 3), j); } });
  };
})();
