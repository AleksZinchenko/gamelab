// live/fx.js — ефекти подій («juice» — дрібниці, через які гра відчувається соковитою): сніжний пил від кроків і
// приземлень, зірочки від влучань, конфеті хлопавки, іскри від підбору, шарф, що злітає зі злодюжки, тощо.
// Кожен ефект — чиста функція (подія, вік події a): його можна намалювати в будь-який момент, без накопиченого стану.
(function () {
  const L = LIB, rnd = L.rnd, SS = L.SS, FX = (window.FX = {});
  const SNOW = [0.85, 0.89, 0.98], CONF = [[0.95, 0.25, 0.3], [1, 0.85, 0.3], [0.35, 0.8, 0.45], [0.4, 0.6, 1], [1, 1, 1]];
  // маленькі «піксельні» частинки — квадратики, кратні сітці (гра у «пікселях» ×2)
  const px = (x, y, s, col, a) => L.solid(Math.round(x / 2) * 2, Math.round(y / 2) * 2, s, s, col, 0, 0, 0, a);

  FX.events = (ST, GT, t, X, Y) => {
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || a > 3) continue; const ex = e.x + X(1), ey = e.y + Y(1);
      if (e.k === 'step' && a < 0.35) for (let j = 0; j < 3; j++) { const q = a / 0.35, s = rnd(e.t, j);
        px(ex - ST.face * (6 + 40 * q * (0.5 + s)), ey - 4 - 30 * q * (1 - q) * (1 + s) * 2, 4, SNOW, 0.9 * (1 - q)); }
      if ((e.k === 'land' || e.k === 'jump') && a < 0.5) { const n = e.k === 'land' ? 12 : 6, pw = e.k === 'land' ? Math.min(1.4, Math.max(0.6, (e.v || 900) / 1100)) : 0.7;
        for (let j = 0; j < n; j++) { const q = a / 0.5, side = j % 2 ? 1 : -1, s = rnd(e.t, j);
          px(ex + side * (10 + 90 * pw * (1 - (1 - q) ** 2) * (0.4 + s)), ey - 2 - 60 * pw * s * q * (1 - q) * 2, 4, SNOW, 0.95 * (1 - q)); }
        if (e.k === 'land') L.puff(ex, ey - 6, 30 * pw * (0.6 + a), SNOW, 0.35 * (1 - a / 0.5), e.t); }
      if (e.k === 'shoot' && a < 0.15) L.star(ex + e.ax * 10, ey + e.ay * 10, 16 * (1 - a / 0.15), [1, 0.95, 0.8], 0.8);
      if (e.k === 'bonk' && a < 0.5) { const q = a / 0.5;                                   // шишка влучила: «тук!» + зірочки + лусочки
        for (let j = 0; j < 6; j++) { const an = j * 1.05 + e.t * 3, d = 10 + 50 * (1 - (1 - q) ** 2); L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, 10, [1, 0.9, 0.5], 1 - q); }
        for (let j = 0; j < 5; j++) { const s = rnd(e.t, j); px(ex + (s - 0.5) * 120 * q, ey - 80 * q + 300 * q * q, 4, [0.45, 0.28, 0.14], 1 - q); }
        L.ring(ex, ey, 10 + 40 * q, 10 + 40 * q, [1, 0.95, 0.8], 0.8 * (1 - q), 0.15); }
      if ((e.k === 'plop' || e.k === 'smash') && a < 0.45) { const q = a / 0.45, col = e.k === 'smash' ? [0.15, 0.14, 0.16] : SNOW;
        for (let j = 0; j < 7; j++) { const s = rnd(e.t, j + 2); px(ex + (j - 3) * 14 * q * (1 + s), ey - 70 * s * q + 260 * q * q, 4, col, 1 - q); } }
      if (e.k === 'boom' && a < 1.6) {                                                    // хлопавка: спалах → кільце → конфеті, що кружляє й падає
        if (a < 0.12) { L.glow(ex, ey, 240, [1, 0.8, 0.5], 1 - a / 0.12, 2); L.star(ex, ey, 90, [1, 1, 0.9], 1 - a / 0.12); }
        if (a < 0.4) L.ring(ex, ey, 30 + 300 * SS(0, 0.4, a), 30 + 240 * SS(0, 0.4, a), [1, 0.9, 0.7], 1 - a / 0.4, 0.06);
        for (let j = 0; j < 46; j++) { const s = rnd(e.t, j), an = s * 6.283, v = 300 + 500 * rnd(e.t, j + 50), q = Math.min(a, 1.6);
          const x = ex + Math.cos(an) * v * (1 - Math.exp(-q * 3)) / 3 + 20 * Math.sin(q * 6 + j), y = ey + Math.sin(an) * v * (1 - Math.exp(-q * 3)) / 3 + 90 * q * q;
          const fl = Math.abs(Math.cos(q * 9 + j)) > 0.3 ? 6 : 2;                       // конфетті «перевертається» — то ширше, то вузьке
          L.solid(Math.round(x / 2) * 2, Math.round(y / 2) * 2, fl, 6, CONF[j % 5], 0, 0, 0, 1 - SS(1.1, 1.6, a)); } }
      if (e.k === 'collect' && a < 0.5) { const q = a / 0.5;
        for (let j = 0; j < 6; j++) { const an = j * Math.PI / 3 + e.t, d = 12 + 44 * (1 - (1 - q) ** 2); L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, 9, [1, 0.92, 0.6], 1 - q); } }
      if ((e.k === 'ornament' || e.k === 'gift' || e.k === 'ammo') && a < 0.9) { const q = a / 0.9;
        L.ring(ex, ey, 20 + 90 * q, 20 + 90 * q, [1, 0.9, 0.6], 1 - q, 0.12); L.glow(ex, ey, 160 * (1 - q * 0.5), [1, 0.8, 0.4], 0.5 * (1 - q), 2.5);
        for (let j = 0; j < 12; j++) { const an = j * 0.524, d = 30 + 120 * q; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d - 40 * q, 12, [1, 0.95, 0.7], 1 - q); } }
      if (e.k === 'hurt' && a < 0.4) { L.glow(ex, ey, 140, [1, 0.3, 0.25], 0.5 * (1 - a / 0.4), 2.5);
        for (let j = 0; j < 5; j++) { const an = -1.2 - j * 0.2; L.star(ex + Math.cos(an) * 60 * a / 0.4, ey + Math.sin(an) * 60 * a / 0.4, 10, [1, 0.8, 0.6], 1 - a / 0.4); } }
      if (e.k === 'steal' && a < 0.7) L.ring(ex, ey, 20 + 50 * a, 20 + 50 * a, [0.6, 0.6, 0.7], 1 - a / 0.7, 0.1);
      if (e.k === 'spot' && a < 0.9) {                                                    // злодюжка помітив героя: «!» над головою
        const h = 46 * (1 + 0.3 * Math.max(0, 1 - a / 0.15)), al = 1 - SS(0.6, 0.9, a);
        L.solid(ex - 6, ey - h, 12, h * 0.68, [1, 0.85, 0.3], 0, 0, 0, al); L.solid(ex - 6, ey - h * 0.22, 12, 12, [1, 0.85, 0.3], 0, 0, 0, al); }
      if ((e.k === 'thiefout' || e.k === 'bullyout' || e.k === 'snufferout') && a < 2.2) {                       // сірий шарф злітає і, кружляючи, падає
        const x = ex + 140 * a + 30 * Math.sin(a * 5), y = ey - 220 * a + 160 * a * a, r = a * 5;
        // намальований шарф злодюжки (той самий шматок з листа частин), крутиться в повітрі й тьмяніє
        const sh = 66, sw = L.hsz('thief_scarf', sh);
        L.sprite('thief_scarf', 0, 0, { m: LIB.M.of(LIB.M.t(x, y), LIB.M.r(r)), w: sw, h: sh, pivot: [sw / 2, sh / 2], u: { alpha: 1 - SS(1.6, 2.2, a) } }); }
      if ((e.k === 'lamp' || e.k === 'chimney') && a < 1) { L.glow(ex, ey, 260 * SS(0, 0.25, a), [1, 0.75, 0.4], 0.8 * (1 - a), 2.2);
        for (let j = 0; j < 10; j++) { const an = j * 0.628 + 0.3, d = 20 + 120 * a; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, 10, [1, 0.9, 0.6], 1 - a); } }
      // голуб отримав шишку: пір'я розлітається й повільно падає, сірий шарфик злітає
      if (e.k === 'pigeonout' && a < 2) { for (let j = 0; j < 9; j++) { const s = rnd(e.t, j);
          px(ex + (s - 0.5) * 160 * Math.min(1, a * 3) + 12 * Math.sin(a * 5 + j), ey - 50 * Math.min(1, a * 3) + 70 * a * a * 0.3 + 40 * a, 4, [0.55, 0.6, 0.72], 1 - SS(1.4, 2, a)); }
        const sh = 36, sw = L.hsz('thief_scarf', sh);
        L.sprite('thief_scarf', 0, 0, { m: LIB.M.of(LIB.M.t(ex + 90 * a, ey - 120 * a + 90 * a * a), LIB.M.r(a * 6)), w: sw, h: sh, pivot: [sw / 2, sh / 2], u: { alpha: 1 - SS(1.4, 2, a) } }); }
      // сніжний пласт розбився: великий сніжний вибух
      if (e.k === 'slabsmash' && a < 0.8) { const q = a / 0.8;
        for (let j = 0; j < 22; j++) { const s = rnd(e.t, j), side = j % 2 ? 1 : -1; px(ex + side * (10 + 170 * (1 - (1 - q) ** 2) * (0.3 + s)), ey - 4 - 150 * s * q * (1 - q) * 2, 6, SNOW, 1 - q); }
        L.puff(ex, ey - 20, 60 + 60 * q, SNOW, 0.5 * (1 - q), e.t); }
      // ковзання по скату: сніг бризкає з-під ніг
      if (e.k === 'slide' && a < 0.3) for (let j = 0; j < 2; j++) { const q = a / 0.3, s = rnd(e.t, j);
        px(ex - e.d * (10 + 50 * q) , ey - 6 - 40 * q * (1 - q) * (1 + s) * 2, 4, SNOW, 0.9 * (1 - q)); }
      // річка: бризки води (впав у протоку) — краплі летять угору віялом і падають, на воді — кола
      if (e.k === 'splash' && a < 1) { const q = Math.min(1, a / 0.7);
        for (let j = 0; j < 16; j++) { const s = rnd(e.t, j), vx = (s - 0.5) * 520, vy = -500 - 400 * rnd(e.t, j + 40);
          px(ex + vx * a, ey + vy * a + 1300 * a * a, 4, [0.55, 0.72, 0.95], 1 - q); }
        L.ring(ex, ey + 6, 30 + 160 * a, 8 + 30 * a, [0.6, 0.78, 1], 1 - a, 0.15); }
      // ліхтар погасили: клубок сірого диму з-під дзвоника
      if (e.k === 'snuff' && a < 1.2) for (let j = 0; j < 5; j++) { const q = a / 1.2;
        L.puff(ex + (j - 2) * 10 + 20 * q * Math.sin(j), ey - 10 - 80 * q * (0.6 + 0.4 * rnd(e.t, j)), 14 + 26 * q, [0.55, 0.57, 0.65], 0.5 * (1 - q), j + e.t); }
      // вежа: відбите вугілля — помаранчеві іскри; «БАМ!» дзвона — кола звуку; удар по босу — зірочки; зірка випала — сяйво
      if (e.k === 'deflect' && a < 0.4) for (let j = 0; j < 8; j++) { const an = j * 0.785 + e.t, d = 10 + 70 * a; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, 10, [1, 0.7, 0.3], 1 - a / 0.4); }
      if (e.k === 'dong' && a < 1.4) for (let j = 0; j < 3; j++) { const q = a - j * 0.18; if (q > 0) L.ring(ex, ey, 60 + 420 * q, 40 + 260 * q, [1, 0.9, 0.6], 0.8 * (1 - q / 1.4), 0.08); }
      if (e.k === 'bosshit' && a < 0.6) { L.glow(ex, ey, 160, [1, 0.5, 0.3], 0.6 * (1 - a / 0.6), 2.5);
        for (let j = 0; j < 7; j++) { const an = j * 0.9 + 0.3, d = 20 + 120 * a; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, 14, [1, 0.9, 0.5], 1 - a / 0.6); } }
      if (e.k === 'starfall' && a < 1.5) L.glow(ex, ey, 300 * SS(0, 0.3, a), [1, 0.85, 0.45], 0.9 * (1 - a / 1.5), 2);
      if (e.k === 'ding' && a < 0.3) L.star(ex, ey, 30 * (1 - a / 0.3), [1, 1, 0.9], 1);
      if (e.k === 'faint' && a < 1.6) for (let j = 0; j < 4; j++) { const an = GT * 4 + j * 1.57; L.star(ex + Math.cos(an) * 40, ey - 70 + Math.sin(an) * 10, 10, [1, 0.95, 0.6], 1); }
      if (e.k === 'revive' && a < 0.8) L.ring(ex, ey - 80, 40 + 120 * a, 40 + 120 * a, [1, 0.9, 0.6], 1 - a / 0.8, 0.1);
    }
  };
})();
