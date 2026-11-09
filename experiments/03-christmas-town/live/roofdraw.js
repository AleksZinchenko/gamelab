// live/roofdraw.js — малювання рівня «Дахи й димарі»: стіни під дахами (повтор нижнього поверху спрайта до землі),
// драбини, місточки з дощок, сніжні пласти, дим із запалених димарів, смуги вітру в проміжках і голуби-маріонетки.
// Чиста функція стану й часу, як і решта малювання.
(function () {
  const L = LIB, M = L.M, SS = L.SS, rnd = L.rnd, LV = SIM.LV, GY = LV.GY;
  const R = (window.ROOFDRAW = {});

  // Стіна під дахом: нижній поверх спрайта повторюється донизу до землі; що нижче (глибше в провулку) — то темніше.
  R.walls = (h, x, w, hh, Y) => { const v0 = LV.WALL && LV.WALL[h.tex]; if (v0 === undefined || !h.base) return; const sh = (1 - v0) * hh;
    for (let y0 = h.base, n = 0; y0 < GY + 10; y0 += sh - 2, n++) { const f = Math.min(1, (GY + 10 - y0) / sh);
      L.sprite(h.tex, x, Math.round(y0 + Y(1)), { w, h: sh * f, src: [0, v0, 1, v0 + (1 - v0) * f], flip: !!h.flip,
        u: { grade: [0.95, Math.max(0.4, 0.8 - 0.13 * n), 0, 1] } }); } };

  // Драбини, місточки, сніжні пласти, дим — на ігровому плані, перед стінами
  R.front = (ST, GT, t, X, Y, onScreen) => {
    for (const l of LV.LADDERS || []) { if (!onScreen(l.x)) continue; const seg = 120, w = L.hsz('ladder', seg);
      for (let y = l.top - 40; y < l.bot; y += seg - 2) { const f = Math.min(1, (l.bot + 4 - y) / seg);       // драбина трохи стирчить над дахом
        L.sprite('ladder', Math.round(l.x - w / 2 + X(1)), Math.round(y + Y(1)), { w, h: seg * f, src: [0, 0, 1, f] }); } }
    for (const [x0, x1, y] of LV.PLANKS || []) { if (!onScreen((x0 + x1) / 2, x1 - x0)) continue;
      const ph = 46, pw = L.hsz('plank', ph), n = Math.ceil((x1 - x0 + 28) / (pw - 6));                         // дошки — шматками, не розтягуючи
      for (let j = 0; j < n; j++) L.sprite('plank', Math.round(x0 - 14 + j * (pw - 6) + X(1)), Math.round(y - 12 + Y(1)) + (j % 2), { w: pw, h: ph }); }
    (ST.sl || []).forEach((s, i) => { if (s.st === 'gone' || !onScreen(s.x)) return; const d = LV.SLABS[i];
      const m = SIM.slopeAt(SIM.byId(d.surf), s.x), a = s.st === 'fall' ? s.a + Math.atan(m) : Math.atan(m), w = 120, h = w * 150 / 320;
      const sh = s.st === 'rest' && Math.abs(ST.x - s.x) < 260 && Math.abs(ST.y - s.y) < 160 ? 1.5 * Math.sin(GT * 40) : 0;   // герой поруч — пласт тремтить
      L.sprite('slab', 0, 0, { m: M.of(M.t(s.x + sh + X(1), s.y + Y(1) + 8), M.r(a)), w, h, pivot: [w / 2, h * 0.85] }); });
    // дим із запалених димарів (чекпоінтів): клуби піднімаються, вітер їх зносить
    (LV.CHIMNEYS || []).forEach((c, i) => { if (!(ST.ch && ST.ch[i] >= 0) || !onScreen(c.x)) return; const k = SS(0, 0.8, GT - ST.ch[i]);
      for (let j = 0; j < 7; j++) { const ph = (t * 0.32 + j / 7) % 1, x = c.x + X(1) + Math.sin(t * 0.8 + j * 1.7) * 14 * ph + SIM.windAt(t, c.x) * 70 * ph;
        L.puff(x, c.y - 150 + Y(1) - ph * 190, 12 + 30 * ph, [0.72, 0.75, 0.84], 0.5 * (1 - ph) * k, j + i * 7); } });
  };

  // ---------------- голуби: тіло + крила на «шарнірі» плеча ----------------
  const PK = 0.16;                                         // масштаб: тіло ~70 px заввишки
  R.pigeons = (ST, GT, t, X, Y, onScreen) => (ST.pg || []).forEach((p, i) => { if (!onScreen(p.x)) return;
    const a = GT - p.stT; if (p.st === 'gone' && a > 2.2) return;
    const fly = p.st !== 'sit', face = p.face || 1, bw = G.tex('pigeon_body').w * PK, bh = G.tex('pigeon_body').h * PK;
    const peck = !fly && Math.sin(t * 2.3 + i * 2) > 0.9 ? 0.25 : 0;                                   // сидить — інколи «клює» головою
    const tilt = fly ? (p.st === 'dive' ? 0.45 : -0.15) : peck, al = p.st === 'gone' ? 1 - SS(1.4, 2.2, a) : 1;
    const Mb = M.of(M.t(p.x + X(1), p.y + Y(1) + (fly ? 3 * Math.sin(t * 18) : 0)), M.s(face, 1), M.r(tilt));
    const at = (nx, ny) => M.ap(Mb, [(nx - 0.5) * bw, (ny - 0.97) * bh]);
    const fl = Math.sin(t * (p.st === 'gone' ? 28 : p.st === 'dive' ? 10 : 20) + i);   // мах крил: пікірування — крила майже складені
    const wing = (dark) => { const ww = G.tex('pigeon_wing_n').w * PK, wh = G.tex('pigeon_wing_n').h * PK, sh = at(0.6, 0.55);
      const ang = (p.st === 'dive' ? -0.9 : -0.15) + (p.st === 'dive' ? 0.15 : 0.75) * fl + (dark ? 0.25 : 0);
      L.sprite('pigeon_wing_n', 0, 0, { m: M.of(M.t(sh[0], sh[1]), M.s(face, 1), M.r(ang)), w: ww, h: wh, pivot: [ww * 0.85, wh * 0.92],
        u: { alpha: al, tint: dark ? [0.66, 0.7, 0.86, 1] : [1, 1, 1, 0] } }); };
    if (!L.sp) L.shadow(p.x + X(1), (SIM.groundBelow(p.x, p.y) || p.y) + Y(1) + 3, 22, 5, fly ? 0.15 : 0.45);
    if (fly) wing(true);                                                                                  // дальнє крило — за тілом, темніше
    L.sprite('pigeon_body', 0, 0, { m: Mb, w: bw, h: bh, pivot: [bw * 0.5, bh * 0.97], u: { alpha: al } });
    if (fly) wing(false);
    else { const fw = G.tex('pigeon_wing_fold').w * PK, fh = G.tex('pigeon_wing_fold').h * PK, sh = at(0.66, 0.55);
      L.sprite('pigeon_wing_fold', 0, 0, { m: M.of(M.t(sh[0], sh[1]), M.s(face, 1), M.r(peck * 0.5)), w: fw, h: fh, pivot: [fw * 0.85, fh * 0.2], u: { alpha: al } }); }
    L.joint('pigeon' + i, 'body', at(0.5, 0.5));
  });

  // ---------------- світло: жар у запалених димарях ----------------
  R.light = (ST, GT, t, X, Y, onScreen) => (LV.CHIMNEYS || []).forEach((c, i) => { if (!(ST.ch && ST.ch[i] >= 0) || !onScreen(c.x)) return;
    const k = SS(0, 0.5, GT - ST.ch[i]); L.glow(c.x + X(1), c.y - 150 + Y(1), 130, [1, 0.6, 0.3], 0.32 * k * (0.85 + 0.15 * Math.sin(t * 7 + i)), 2.4); });

  // ---------------- вітер: білі смуги летять у бік вітру — видно, де зносить ----------------
  R.wind = (ST, t, X, Y) => (LV.WIND || []).forEach((w, wi) => { const span = w.x1 - w.x0 + 240;
    for (let j = 0; j < 24; j++) { const sp = Math.sign(w.f) * (520 + 320 * rnd(j, wi + 3));
      const x = w.x0 - 120 + (((rnd(j, wi) * span + t * sp) % span) + span) % span + X(1), y = GY - 280 - rnd(j, wi + 1) * 760 + Y(1);
      if (x < -60 || x > L.W + 60) continue;
      L.solid(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 16 + 24 * rnd(j, 7), 2, [0.85, 0.9, 1], 0, 0, 0, 0.45 + 0.2 * Math.sin(t * 3 + j)); } });
})();
