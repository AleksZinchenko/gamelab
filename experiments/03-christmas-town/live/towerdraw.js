// live/towerdraw.js — малювання рівня «Ратушна вежа»: нутро вежі (фон повторюється вгору), балки й полички шматками,
// шестерні, що крутяться, маятники, дзвін на кроквах, ліхтарики-чекпоінти, дах ратуші під містком (фаза погоні).
// Чиста функція стану й часу, як і решта малювання.
(function () {
  const L = LIB, M = L.M, SS = L.SS, LV = SIM.LV, W = SIM.VIEW.W, H = SIM.VIEW.H;
  const R = (window.TOWERDRAW = {});

  // ---------------- фон: цегла, балки, віконця — нижче за підлогу дзвіниці; вище — небо й місто внизу ----------------
  R.bg = (ST, GT, t, X, Y) => {
    const tw = W, th = tw * 1536 / 1024, top = Math.round(LV.YB + 40 + Y(1)), x0 = Math.round(LV.WR + 60 + X(1));   // правий край вежі
    if (top < H && x0 > 0) { const off = ((Y(0.85) % th) + th) % th;
      for (let y = off - th; y < H; y += th - 1) { if (y + th < top) continue; const v0 = Math.max(0, (top - y) / th);
        L.sprite('bg_tower', Math.round(X(1)), Math.round(y + v0 * th), { w: Math.min(tw, x0 - X(1)), h: th * (1 - v0), src: [0, v0, Math.min(1, (x0 - X(1)) / tw), 1] }); }
      L.solid(0, top, x0, H - top, [0.02, 0.02, 0.05], 0, 0, 0, 0.3); }
  };

  // ---------------- ігровий план ----------------
  const piece = (p, X, Y) => { const th = LV.TEX[p.tex][1], tw = LV.TEX[p.tex][0], h = LV.PH[p.tex], pw = h * tw / th, y = p.y - LV.TOPF[p.tex] * h;
    const n = Math.max(1, Math.round((p.x1 - p.x0) / (pw - 4))), w = (p.x1 - p.x0) / n;          // шматки рівної ширини, без розтягування
    for (let j = 0; j < n; j++) L.sprite(p.tex, Math.round(p.x0 + j * w + X(1)), Math.round(y + Y(1)), { w: w + 4, h }); };
  R.front = (ST, GT, t, X, Y, onScreen) => {
    const vis = (y, m = 500) => y + Y(1) > -m && y + Y(1) < H + m;
    // дах ратуші під містком: темна черепиця, що йде вниз (між шматками — прогалини-прірви)
    for (const p of LV.PIECES) if (p.x0 >= LV.WR && onScreen((p.x0 + p.x1) / 2, p.x1 - p.x0) && vis(p.y)) {
      L.solid(Math.round(p.x0 + 20 + X(1)), Math.round(p.y + 30 + Y(1)), p.x1 - p.x0 - 40, 700, [0.1, 0.12, 0.2]);
      for (let k = 0; k < 6; k++) L.solid(Math.round(p.x0 + 20 + X(1)), Math.round(p.y + 70 + k * 60 + Y(1)), p.x1 - p.x0 - 40, 4, [0.16, 0.19, 0.3]); }
    // зовнішня стіна вежі (видно, коли камера їде дахом)
    if (onScreen(LV.WR + 40)) L.solid(Math.round(LV.WR + 20 + X(1)), Math.round(LV.YB + 20 + Y(1)), 60, 2000, [0.24, 0.12, 0.09]);
    // шестерні: крутяться так, що верх рухається туди ж, куди несе героя
    LV.GEARS.forEach((g) => { if (!vis(g.y)) return; const d = g.r * 2.05;
      L.sprite(g.tex, 0, 0, { m: M.of(M.t(Math.round(g.x + X(1)), Math.round(g.y + Y(1))), M.r(GT * g.v / g.r)), w: d, h: d * LV.TEX[g.tex][1] / LV.TEX[g.tex][0], pivot: [d / 2, d * LV.TEX[g.tex][1] / LV.TEX[g.tex][0] / 2] }); });
    for (const p of LV.PIECES) if (onScreen((p.x0 + p.x1) / 2, p.x1 - p.x0) && vis(p.y)) piece(p, X, Y);
    // маятники: стрижень від підвісу, тягарець — платформа
    LV.PENDS.forEach((p) => { if (!vis(p.y + p.L)) return; const a = LV.pendAt(p, GT)[2], h = p.L / 0.79, w = h * 168 / 703;
      L.sprite('pendulum', 0, 0, { m: M.of(M.t(Math.round(p.x + X(1)), Math.round(p.y + Y(1))), M.r(-a)), w, h, pivot: [w / 2, h * 0.03] }); });
    // дзвін на кроквах; після «БАМ!» розгойдується й затихає
    const B = LV.BELL; if (vis(B.y)) { const a = GT - ST.bellT, sw = a >= 0 && a < 4 ? 0.32 * Math.exp(-a / 1.1) * Math.sin(a * 7) : 0.015 * Math.sin(t * 1.3);
      const tw = 520, th = tw * 416 / 427; L.sprite('truss', Math.round(B.x - tw / 2 + X(1)), Math.round(LV.YB - th - 230 + Y(1)), { w: tw, h: th });
      const bw = 300, bh = bw * 404 / 359; L.sprite('bell', 0, 0, { m: M.of(M.t(Math.round(B.x + X(1)), Math.round(B.y - bh * 0.42 + Y(1))), M.r(sw)), w: bw, h: bh, pivot: [bw / 2, bh * 0.06] }); }
    // ліхтарики-чекпоінти на кронштейнах: темні, поки не пробіг повз
    (LV.CHIMNEYS || []).forEach((c, i) => { if (!vis(c.y) || !onScreen(c.x)) return; const x = Math.round(c.x + X(1)), y = Math.round(c.y - 190 + Y(1)), on = ST.ch[i] >= 0;
      L.solid(x - 2, y - 40, 4, 40, [0.15, 0.13, 0.12]); L.solid(x - 16, y, 32, 8, [0.55, 0.42, 0.2]);
      L.solid(x - 12, y + 8, 24, 30, on ? [1, 0.8, 0.45] : [0.25, 0.3, 0.42]); L.solid(x - 16, y + 38, 32, 6, [0.55, 0.42, 0.2]); });
  };
  R.light = (ST, GT, t, X, Y) => (LV.CHIMNEYS || []).forEach((c, i) => { if (!(ST.ch[i] >= 0)) return; const k = SS(0, 0.4, GT - ST.ch[i]);
    L.glow(c.x + X(1), c.y - 168 + Y(1), 260, [1, 0.7, 0.4], 0.4 * k * (0.9 + 0.1 * Math.sin(t * 8 + i)), 2.2); });
})();
