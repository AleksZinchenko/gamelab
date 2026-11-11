// live/plaza.js — малювання площі (хаба): ялинка з прикрасами, гірлянда, зірка, стрілки годинника на ратуші, таблички
// брам, речі, що летять з торби на гілки, і фінал (вогні хвилею, сяйво зірки, феєрверк, конфеті).
// Як і решта малювання — чиста функція стану й часу: нічого не запам'ятовує між кадрами.
(function () {
  const L = LIB, M = L.M, SS = L.SS, rnd = L.rnd, LV = SIM.LV, GY = LV.GY;
  const P = (window.PLAZA = {});
  const ORN = ['orn_red', 'orn_gold', 'orn_blue'], GIFT = ['gift_red', 'gift_green'];
  const BULB = [[1, 0.3, 0.3], [1, 0.82, 0.3], [0.35, 0.95, 0.45], [0.4, 0.65, 1], [1, 0.95, 0.85]];   // кольори лампочок
  const WOOD = [0.36, 0.2, 0.11], WOOD_D = [0.2, 0.1, 0.06];
  const px = (x, y, s, col, a) => L.solid(Math.round(x / 2) * 2, Math.round(y / 2) * 2, s, s, col, 0, 0, 0, a);

  // наскільки площа «засяяла»: 0 — до фіналу, 1 — усе горить (fin = -100 — засяяла ще в минулий візит)
  P.lit = (ST, GT) => (ST.fin === -1 || ST.fin === undefined ? 0 : SS(ST.fin, ST.fin + 2.2, GT));
  // гірлянда: точки на ярусі (провисає дугою між краями крони). Повертає [x, y, номер лампочки] у світі.
  const garland = () => { const T = LV.TREE, out = []; let n = 0;
    T.tiers.forEach((v, ti) => { const hw = T.half(v) - 0.04, cnt = Math.max(4, Math.round(hw * 2 * T.w / 30));
      for (let j = 0; j <= cnt; j++) { const s = j / cnt, u = 0.5 - hw + 2 * hw * s, vv = v + 0.022 * Math.sin(Math.PI * s);
        const [x, y] = T.pt(u, vv); out.push([x, y, n++, ti, s]); } });
    return out; };
  let GAR = null;
  // момент, коли лампочка загоряється у фіналі: хвиля від зірки вниз, ярус за ярусом
  // (fin = -1 — фіналу ще не було: лампочка не горить ніколи; -100 — горить давно)
  const bulbOn = (ST, b) => ST.fin === -1 ? Infinity : ST.fin === -100 ? -100 : ST.fin + 0.35 + b[3] * 0.28 + b[4] * 0.2;

  // ---------------- годинник ратуші: 21:00 → ближче до півночі з кожною повернутою річчю; у фіналі — 12:00 ----------------
  P.clock = (ST, GT, X, Y) => {
    const TH = LV.TH, [cu, cv, cr] = TH.clock, cx = TH.x + cu * TH.w + X(1), cy = GY - TH.h + 8 + cv * TH.h + Y(1), R = cr * TH.w;
    const T = ST.tree, all = [...T.orn, ...T.gift, ...T.candy, T.star], done = all.filter((v) => v !== -1 && v <= GT).length / all.length;
    let hours = 21 + 2.5 * done;                                       // 21:00 … 23:30
    if (ST.fin !== -1) hours += (24 - hours) * SS(ST.fin - 0.2, ST.fin + 1.0, GT);   // фінал: стрілки біжать до півночі
    const hand = (ang, len, w, col) => L.solid(cx - w / 2, cy, w, len, col, ang + Math.PI, w / 2, 0);
    hand((hours % 12) / 12 * 2 * Math.PI, R * 0.55, 6, [0.13, 0.08, 0.06]);
    hand((hours % 1) * 2 * Math.PI, R * 0.82, 4, [0.13, 0.08, 0.06]);
    L.solid(cx - 4, cy - 4, 8, 8, [0.5, 0.36, 0.16]);
  };

  // ---------------- таблички брам (стовп і дошка — тут; напис — у hud.js, чіткий, повної роздільності) ----------------
  P.LBL = { size: 30, col: '#fbecc8', out: '#2a0f12' };   // ті самі опції і для заміру, і для напису (інакше текстура перемальовується щокадру)
  P.signBox = (g, i) => { const w = L.labelW('gate' + i, g.name, P.LBL) + 44, y = g.post === false ? GY - 262 : GY - 290; return { w, h: 52, x: g.x - w / 2, y }; };
  P.signs = (ST, X, Y) => LV.GATES.forEach((g, i) => { const b = P.signBox(g, i), x = b.x + X(1), y = b.y + Y(1), lock = !g.to;
    if (g.post !== false) { L.solid(Math.round(g.x - 6 + X(1)), Math.round(y + b.h - 4 + 0), 12, GY + 8 - b.y - b.h + 4, WOOD_D);
      L.solid(Math.round(g.x - 4 + X(1)), Math.round(y + b.h), 4, GY - b.y - b.h, WOOD); }
    else for (const dx of [-b.w * 0.3, b.w * 0.3]) L.solid(Math.round(g.x + dx - 1 + X(1)), Math.round(y - 22), 2, 24, [0.25, 0.25, 0.28]);   // ланцюжки
    L.rrect(Math.round(x), Math.round(y), b.w, b.h, 10, lock ? [0.3, 0.26, 0.26] : [0.52, 0.3, 0.15], lock ? [0.16, 0.13, 0.14] : WOOD_D);
    if (g.dir) { const ax = g.dir > 0 ? x + b.w : x, s = g.dir;                                              // стрілка-вістря дошки
      for (let k = 0; k < 13; k++) L.solid(Math.round(ax + s * k * 2 - (s < 0 ? 2 : 0)), Math.round(y + 6 + k * 2), 2, b.h - 12 - k * 4, lock ? [0.3, 0.26, 0.26] : [0.52, 0.3, 0.15]); } });

  // ---------------- ялинка з усім, що на ній висить ----------------
  P.tree = (ST, GT, t, X, Y) => {
    const T = LV.TREE, lit = P.lit(ST, GT), tr = ST.tree; GAR = GAR || garland();
    L.sprite('tree_square', Math.round(T.x0 + X(1)), Math.round(T.y0 + Y(1)), { w: T.w, h: T.h });
    // гірлянда: дріт і лампочки (до фіналу — темні скельця)
    for (const b of GAR) { const x = b[0] + X(1), y = b[1] + Y(1), on = SS(0, 0.15, GT - bulbOn(ST, b));
      const c = BULB[b[2] % 5], dim = [0.07 + c[0] * 0.1, 0.08 + c[1] * 0.1, 0.1 + c[2] * 0.1];   // незапалена — темне скельце
      px(x, y + 4, 2, [0.1, 0.14, 0.08], 1);
      L.solid(Math.round(x / 2) * 2 - 2, Math.round(y / 2) * 2, 6, 6, on > 0 ? [dim[0] + (c[0] - dim[0]) * on, dim[1] + (c[1] - dim[1]) * on, dim[2] + (c[2] - dim[2]) * on] : dim); }
    // місця для прикрас: порожні — «дірки» (тьмяний гачок-кільце), щоб було видно, чого бракує
    const hung = (v) => v !== -1 && GT >= v;
    LV.TREE.orn.forEach(([u, v], i) => { const [x, y] = T.pt(u, v), xx = x + X(1), yy = y + Y(1), k = T.ornKind(i);
      if (!hung(tr.orn[i])) { L.ring(xx, yy + 24, 20, 20, [0.7, 0.8, 1], 0.28 + 0.1 * Math.sin(t * 2 + i), 0.12); return; }
      const sw = 0.12 * Math.sin(t * 1.8 + i) + 0.5 * Math.exp(-(GT - tr.orn[i]) * 3) * Math.sin((GT - tr.orn[i]) * 14);   // сіла — погойдалась
      L.sprite(ORN[k], 0, 0, { m: M.of(M.t(xx, yy), M.r(sw)), h: 52, pivot: [L.hsz(ORN[k], 52) / 2, 2] }); });
    LV.TREE.candy.forEach(([u, v], i) => { if (!hung(tr.candy[i])) return; const [x, y] = T.pt(u, v), sw = 0.1 * Math.sin(t * 1.6 + i * 1.7);
      L.sprite('it_cane', 0, 0, { m: M.of(M.t(x + X(1), y + Y(1)), M.r(sw)), h: 40, pivot: [L.hsz('it_cane', 40) / 2, 2] }); });
    T.gifts.forEach((dx, i) => { const x = T.x + dx + X(1), y = GY + 6 + Y(1), n = GIFT[i % 2], h = i < 2 ? 74 : 62;
      if (!hung(tr.gift[i])) { L.ring(x, y - 30, 34, 14, [0.7, 0.8, 1], 0.22, 0.1); return; }
      const sq = 1 + 0.25 * Math.exp(-(GT - tr.gift[i]) * 6) * Math.cos((GT - tr.gift[i]) * 20);           // приземлився — «пружинить»
      L.sprite(n, Math.round(x - L.hsz(n, h) / 2), Math.round(y - h * sq), { h: h * sq, w: L.hsz(n, h) / Math.sqrt(sq) }); });
    // зірка на верхівці (або її тьмяний контур, поки не повернули)
    const [sx, sy] = T.pt(...T.top), ssx = sx + X(1), ssy = sy + Y(1);
    if (hung(tr.star)) { const pop = 1 + 0.6 * Math.exp(-(GT - tr.star) * 4); L.sprite('star', 0, 0, { m: M.of(M.t(ssx, ssy), M.r(0.06 * Math.sin(t * 1.3))), h: 76 * pop, pivot: [L.hsz('star', 76 * pop) / 2, 76 * pop / 2] }); }
    else L.ring(ssx, ssy, 30, 30, [1, 0.9, 0.5], 0.25 + 0.12 * Math.sin(t * 2.4), 0.1);
    flying(ST, GT, t, X, Y);
    if (lit > 0) confetti(ST, GT, X, Y);
  };

  // речі в польоті з торби на ялинку: дуга над головою, іскри слідом
  function flying(ST, GT, t, X, Y) {
    for (const e of ST.ev) { if (e.k !== 'hang') continue; const a = GT - e.t; if (a < 0 || a >= e.fly) continue;
      const q = SS(0, 1, a / e.fly), x0 = e.x + X(1), y0 = e.y + Y(1), x1 = e.tx + X(1), y1 = e.ty + Y(1) + (e.kind === 'gift' ? -30 : 0);
      const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - (e.kind === 'star' ? 260 : 160);
      const x = (1 - q) ** 2 * x0 + 2 * (1 - q) * q * cx + q * q * x1, y = (1 - q) ** 2 * y0 + 2 * (1 - q) * q * cy + q * q * y1;
      const n = e.kind === 'orn' ? ORN[LV.TREE.ornKind(e.i)] : e.kind === 'gift' ? GIFT[e.i % 2] : e.kind === 'candy' ? 'it_cane' : 'star';
      const h = e.kind === 'gift' ? 64 : e.kind === 'star' ? 70 + 30 * Math.sin(q * Math.PI) : 48;
      for (let j = 1; j < 6; j++) { const qq = Math.max(0, q - j * 0.04);
        const tx = (1 - qq) ** 2 * x0 + 2 * (1 - qq) * qq * cx + qq * qq * x1, ty = (1 - qq) ** 2 * y0 + 2 * (1 - qq) * qq * cy + qq * qq * y1;
        L.star(tx, ty, 12 - j * 1.5, [1, 0.9, 0.6], 0.7 - j * 0.1); }
      L.sprite(n, 0, 0, { m: M.of(M.t(x, y), M.r(e.kind === 'star' ? q * 6.283 : 0.3 * Math.sin(q * 9))), h, pivot: [L.hsz(n, h) / 2, h / 2] }); }
  }

  // ---------------- містяни (2026-11-11): сумні до фіналу, у фіналі підстрибують від радості ----------------
  // Кожен — один малюнок у двох станах (folk_<хто>_sad / _happy), оживлений кодом: дихання, зітхання, підскоки.
  // x — де стоїть, face — куди дивиться (1 — праворуч), foot — де між ступнями (частка ширини: [сумний, радісний]),
  // hk — поправка масштабу радісного малюнка (аркуш A радісних намальований на ~15 % більшим).
  const FOLK = [
    { n: 'baker', x: 470, face: 1, foot: [0.534, 0.556], hk: 0.87 }, { n: 'grandpa', x: 1000, face: 1, foot: [0.498, 0.587], hk: 0.87 },
    { n: 'mother', x: 2380, face: -1, foot: [0.503, 0.569], hk: 0.87 }, { n: 'kids', x: 2560, face: -1, foot: [0.435, 0.42], hk: 0.97 },
    { n: 'lamplighter', x: 2700, face: -1, foot: [0.539, 0.479], hk: 0.97 }, { n: 'postman', x: 3260, face: -1, foot: [0.491, 0.438], hk: 0.97 },
  ];
  // місця вибрано поза світлом вітрини пекарні (x ≈ 620–930): адитивне світло робить фігуру там напівпрозорою
  const FOLK_K = 0.34;                                         // піксель аркуша → піксель екрана (дорослий ≈ 205 px, герой — 160)
  P.folk = (ST, GT, t, X, Y, onScreen) => FOLK.forEach((f, i) => { if (!onScreen(f.x)) return;
    // коли стрибнув від радості: на вже засяяній площі — давно; до фіналу — ніколи; у фіналі — по черзі з 1-ї секунди
    const joy = ST.fin === -100 ? -100 : ST.fin === -1 ? Infinity : ST.fin + 1.0 + i * 0.35, a = GT - joy;
    const happy = a > 0.22;                                    // підміна малюнка — у верхній точці стрибка (0.22 с з 0.45)
    let hop = 0, sx = 1, sy = 1, rot = 0;
    if (!happy) { const sigh = Math.max(0, Math.sin((t + i * 1.7) * 0.9)) ** 12;                    // зрідка — глибоке зітхання
      sy = 1 + 0.012 * Math.sin(t * 1.6 + i) - 0.03 * sigh; sx = 1 / Math.sqrt(sy); rot = 0.015 * Math.sin(t * 0.7 + i); }
    else { const c = (a - 0.45) % 2.6, jump = a < 0.45 ? a : c < 0.4 ? c : -1;                         // перший стрибок, далі — підскок раз на 2.6 с
      if (jump >= 0) { const d = jump < 0.45 && a < 0.45 ? 0.45 : 0.4, u = jump / d; hop = (a < 0.45 ? 46 : 22) * 4 * u * (1 - u); }
      rot = 0.05 * Math.sin(t * 2.4 + i * 1.3); sy = 1 + 0.02 * Math.sin(t * 4.8 + i); sx = 1 / Math.sqrt(sy); }
    if (a >= 0 && a < 0.06) sy *= 0.9;                                                                   // присів перед стрибком
    const n = 'folk_' + f.n + (happy ? '_happy' : '_sad'), tex = G.tex(n), k = FOLK_K * (happy ? f.hk : 1);
    const w = tex.w * k * sx, h = tex.h * k * sy, ft = f.foot[happy ? 1 : 0], px0 = (f.face > 0 ? ft : 1 - ft) * w;
    L.sprite(n, 0, 0, { m: M.of(M.t(Math.round(f.x + X(1)), Math.round(GY + 6 - hop + Y(1))), M.r(rot)), w, h, pivot: [px0, h], flip: f.face < 0 });
    if (a >= 0.2 && a < 1.0) for (let j = 0; j < 6; j++) { const an = j / 6 * 6.283 + i, d = 30 + 60 * (a - 0.2);   // іскорки радості
      L.star(f.x + X(1) + Math.cos(an) * d, GY - h * 0.7 + Y(1) + Math.sin(an) * d * 0.6, 9, CONF[j % 5], 0.9 * (1 - (a - 0.2) / 0.8)); } });

  // ---------------- фінал з бандою: гості біля ялинки, подарунок у польоті, «пуф!» перетворення ----------------
  P.gang = (ST, GT, t, X, Y, onScreen) => {
    (ST.gang || []).forEach((e, i) => { if (e.on && onScreen(e.x)) DRAW.enemy(e.kind, e, 10 + i, ST, GT, t, X, Y); });
    for (const e of ST.ev) { const a = GT - e.t;
      // подарунок летить дугою від Тимка до рук Шарфа, крутиться, за ним — іскри
      if (e.k === 'giftfly' && a >= 0 && a < e.fly) { const q = SS(0, 1, a / e.fly), x0 = e.x + X(1), y0 = e.y + Y(1), x1 = e.tx + X(1), y1 = e.ty + Y(1);
        const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 220, bz = (u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1];
        for (let j = 1; j < 6; j++) { const [tx, ty] = bz(Math.max(0, q - j * 0.04)); L.star(tx, ty, 12 - j * 1.5, [1, 0.9, 0.6], 0.7 - j * 0.1); }
        const [x, y] = bz(q), h = 64, n = e.box || 'gift_red'; L.sprite(n, 0, 0, { m: M.of(M.t(x, y), M.r(q * 6.283)), h, pivot: [L.hsz(n, h) / 2, h / 2] }); }
      // «пуф!»: спалах і кільце іскор, що розлітаються, — ховає миттєву підміну малюнка (сердитий → усміхнений)
      if (e.k === 'puff' && a >= 0 && a < 1.2) { const x = e.x + X(1), y = e.y + Y(1), k = 1 - SS(0.5, 1.2, a);
        if (a < 0.3) L.glow(x, y, 240, [1, 0.9, 0.6], 0.8 * (1 - a / 0.3), 2);
        for (let j = 0; j < 14; j++) { const an = j / 14 * 6.283 + e.t, d = 40 + 170 * (1 - Math.exp(-a * 4));
          L.star(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.8 - 40 * a, 10 + 6 * rnd(j, 5), CONF[j % 5], 0.9 * k); } } }
  };

  // конфеті у фіналі: падає зверху кілька секунд, кружляючи
  const CONF = [[0.95, 0.25, 0.3], [1, 0.85, 0.3], [0.35, 0.8, 0.45], [0.4, 0.6, 1], [1, 1, 1]];
  function confetti(ST, GT, X, Y) { const a = GT - ST.fin; if (ST.fin === -100 || a < 0.4 || a > 7) return;
    for (let j = 0; j < 90; j++) { const s = rnd(j, 3), d = a - 0.4 - s * 1.5; if (d < 0) continue;
      const x = ((rnd(j, 1) * 2200 - 140 + 40 * Math.sin(d * 2 + j)) % 2200), y = -20 + d * (150 + 90 * rnd(j, 2)) + 0 * Y(1);
      if (y > 1100) continue; const fl = Math.abs(Math.cos(d * 7 + j)) > 0.3 ? 6 : 2;
      L.solid(Math.round(x / 2) * 2, Math.round(y / 2) * 2, fl, 6, CONF[j % 5], 0, 0, 0, 1 - SS(5.5, 7, a)); } }

  // ---------------- світло (додається поверх): лампочки, зірка, вікна ратуші у фіналі ----------------
  P.light = (ST, GT, t, X, Y) => {
    const T = LV.TREE, lit = P.lit(ST, GT); GAR = GAR || garland();
    for (const b of GAR) { const on = SS(0, 0.15, GT - bulbOn(ST, b)); if (on <= 0) continue;
      const tw = 0.65 + 0.35 * Math.sin(t * 3.2 - b[2] * 0.55);                          // «біжучі вогні»: яскравість хвилею вздовж гірлянди
      L.glow(b[0] + X(1), b[1] + 3 + Y(1), 26, BULB[b[2] % 5], 0.5 * on * tw, 3); }
    const [sx, sy] = T.pt(...T.top), ssx = sx + X(1), ssy = sy + Y(1);
    if (ST.tree.star !== -1 && GT >= ST.tree.star) { const p = 0.8 + 0.2 * Math.sin(t * 2.1);
      L.glow(ssx, ssy, 200 + 120 * lit, [1, 0.85, 0.45], (0.35 + 0.3 * lit) * p, 2.2); L.star(ssx, ssy, 70 + 40 * lit * p, [1, 0.95, 0.75], 0.6 + 0.3 * lit);
      if (ST.fin >= 0 && GT - ST.fin < 0.6) L.glow(ssx, ssy, 900 * SS(0, 0.6, GT - ST.fin), [1, 0.9, 0.6], 0.6 * (1 - (GT - ST.fin) / 0.6), 2); }   // спалах
    if (lit > 0) L.glow(T.x + X(1), T.y0 + T.h * 0.55 + Y(1), 520, [1, 0.7, 0.35], 0.16 * lit, 2.2);          // ялинка гріє площу
  };

  // ---------------- феєрверк (у небі, за будинками): у фіналі часто, потім — зрідка ----------------
  P.sky = (ST, GT, X, Y) => { if (ST.fin === -1) return; const a0 = ST.fin === -100 ? GT : GT - ST.fin; if (a0 < 0.8) return;
    const start = (k) => (k < 10 ? 0.8 + k * 0.7 : 0.8 + 7 + (k - 10) * 2.6);
    let k = a0 < 7.8 ? Math.floor((a0 - 0.8) / 0.7) : 10 + Math.floor((a0 - 7.8) / 2.6);
    for (let kk = Math.max(0, k - 2); kk <= k; kk++) { const a = a0 - start(kk); if (a < 0 || a > 1.8) continue;
      const bx = 200 + rnd(kk, 1) * 1500, by = 140 + rnd(kk, 2) * 260, col = CONF[kk % 4], r = 160 + 80 * rnd(kk, 3);
      if (a < 0.1) L.glow(bx, by, 120, col, 0.6, 2);
      for (let j = 0; j < 30; j++) { const an = j / 30 * 6.283 + kk, d = r * (1 - Math.exp(-a * 3.2));
        const x = bx + Math.cos(an) * d, y = by + Math.sin(an) * d + 60 * a * a, al = 1 - SS(0.9, 1.8, a);
        px(x, y, 4, col, al); px(x - Math.cos(an) * 10, y - Math.sin(an) * 10 - 4 * a, 2, col, al * 0.5); } } };
})();
