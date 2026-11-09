// live/actors.js — «живе» в симуляції: вороги (злодюжки, хулігани), снаряди (шишки, хлопавки, вугілля),
// предмети (солодощі, прикраси, подарунки, запаси) і удари по героєві. Лише правила й числа — без малювання.
// Усе детерміноване (без Math.random): та сама гра → той самий результат, тож демо можна перевіряти автоматично.
(function (root) {
  const LV = root.LEVEL || require('./level.js');
  const GY = LV.GY;
  const G_PROJ = 1500, G_COAL = 2400;           // гравітація для шишки й вугілля (px/с²)
  const BOX = { thief: [70, 175], bully: [110, 190] };   // «тіло» ворога для влучань: ширина, висота
  const h1 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  // Початковий стан усіх акторів рівня (кладеться в S при create()).
  const init = () => ({
    th: LV.THIEVES.map((d) => ({ x: d.x, vx: 0, face: -1, st: 'idle', hp: 2, stT: 0, hitT: -9, dist: 0 })),
    bu: LV.BULLIES.map((d) => ({ x: d.x, face: -1, st: 'idle', hp: 3, stT: 0, hitT: -9, nextT: 1.5 })),
    shots: [],                                    // снаряди в польоті
    drops: [],                                    // подарунки, які випали зі злодюжок і падають/лежать
    loose: [],                                    // солодощі, що висипались при ударі (їх можна встигнути підібрати)
    got: LV.SWEETS.map(() => -1), orn: LV.ORNAMENTS.map(() => -1), am: LV.AMMO.map(() => -1), gifts: LV.THIEVES.map(() => -1),
  });

  // Удар по героєві: мінус рукавичка, відкидання, коротка невразливість, висипаються солодощі.
  function hurt(S, t, fromX) {
    if (S.inv > 0 || S.faint >= 0 || S.done >= 0) return;
    S.hearts--; S.inv = 1.4; S.hurtT = t; const d = Math.sign(S.x - fromX) || -S.face;
    S.vx = d * 520; S.vy = -650; S.ground = null;
    const n = Math.min(3, S.sw); S.sw -= n;
    for (let j = 0; j < n; j++) S.loose.push({ x: S.x, y: S.y - 90, vx: (j - 1) * 260 + d * 120, vy: -700 - 120 * j, t0: t, on: 0 });
    S.ev.push({ k: 'hurt', t, x: S.x, y: S.y - 90, n });
    if (S.hearts <= 0) { S.faint = t; S.ev.push({ k: 'faint', t, x: S.x, y: S.y }); }
  }

  // Постріл з рогатки: шишка летить у бік прицілу. Початок — з руки героя (SIM.hand), не з ніг.
  function fire(S, t, aim, sh, len) {
    let dx = aim[0] - sh[0], dy = aim[1] - sh[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const hx = sh[0] + dx * len, hy = sh[1] + dy * len;            // кисть = плече + рука, витягнута до прицілу
    S.shots.push({ k: 'cone', x: hx, y: hy, vx: dx * 1550, vy: dy * 1550, t0: t, a: 0 });
    S.cones--; S.ev.push({ k: 'shoot', t, x: hx, y: hy, ax: dx, ay: dy });
  }
  function toss(S, t, hand) {                     // хлопавка: кидок дугою, вибух через ~0.9 с або від удару об ворога
    S.shots.push({ k: 'cracker', x: hand[0], y: hand[1], vx: S.face * 640 + S.vx * 0.4, vy: -760, t0: t, a: 0, b: 0 });
    S.crackers--; S.ev.push({ k: 'toss', t, x: hand[0], y: hand[1] });
  }

  // Пошкодження ворога (шишка = 1, хлопавка = 2). Злодюжка на нулі впускає подарунок; хуліган — тікає.
  function damage(S, t, kind, i, n, fromX) {
    const e = kind === 'thief' ? S.th[i] : S.bu[i];
    if (e.st === 'gone' || t - e.hitT < 0.25) return;
    e.hp -= n; e.hitT = t; e.face = Math.sign(fromX - e.x) || e.face;
    S.ev.push({ k: kind + 'hit', t, x: e.x, y: GY - BOX[kind][1] * 0.6, i });
    if (e.hp > 0) { e.st = 'hit'; e.stT = t; return; }
    e.st = 'gone'; e.stT = t; e.vx = (Math.sign(e.x - fromX) || 1) * (kind === 'thief' ? 620 : 420);
    S.ev.push({ k: kind + 'out', t, x: e.x, y: GY - BOX[kind][1], i });            // злітає сірий шарф, ворог тікає
    if (kind === 'thief') S.drops.push({ i: LV.THIEVES[i].gift, x: e.x, y: GY - 120, vx: -e.vx * 0.25, vy: -900, on: 0, t0: t });
  }

  function hitEnemy(S, x, y, r) {                 // хто з ворогів у колі (x, y, r)? → [kind, i]
    for (const [kind, arr] of [['thief', S.th], ['bully', S.bu]]) for (let i = 0; i < arr.length; i++) { const e = arr[i];
      if (e.st === 'gone') continue; const [w, h] = BOX[kind];
      if (x > e.x - w / 2 - r && x < e.x + w / 2 + r && y > GY - h - r && y < GY + r) return [kind, i]; }
    return null;
  }

  function step(S, t, dt, W) {
    // ---- злодюжки: крадуться → помітили героя → тікають → загнані в кут → прориваються повз ----
    S.th.forEach((e, i) => { const d = LV.THIEVES[i], dx = S.x - e.x, near = Math.abs(dx) < 650 && S.faint < 0;
      if (e.st === 'gone') { e.x += e.vx * dt; e.dist += Math.abs(e.vx) * dt; return; }
      if (e.st === 'hit') { e.vx *= 0.9; e.x += e.vx * dt; if (t - e.stT > 0.4) { e.st = 'flee'; e.stT = t; } return; }
      if (e.st === 'idle') { const tg = d.x + 140 * Math.sin(t * 0.7 + i); e.vx = Math.max(-110, Math.min(110, (tg - e.x) * 2));
        if (near) { e.st = 'flee'; e.stT = t; S.ev.push({ k: 'spot', t, x: e.x, y: GY - 190, i }); } }
      else if (e.st === 'flee') { const run = -Math.sign(dx) || 1; e.vx = run * 330;
        if ((run < 0 && e.x < d.a) || (run > 0 && e.x > d.b)) { e.st = 'cower'; e.stT = t; }
        else if (!near && Math.abs(dx) > 1100) { e.st = 'idle'; } }
      else if (e.st === 'cower') { e.vx = 0; if (t - e.stT > 1.1) { e.st = 'dash'; e.stT = t; e.vx = Math.sign(dx || 1) * 520; S.ev.push({ k: 'dash', t, x: e.x, y: GY, i }); } }
      else if (e.st === 'dash') { if (t - e.stT > 1.3) { e.st = 'flee'; e.stT = t; } }
      e.x = Math.max(d.a - 60, Math.min(d.b + 60, e.x + e.vx * dt)); if (Math.abs(e.vx) > 5) e.face = Math.sign(e.vx); e.dist += Math.abs(e.vx) * dt;
      // злодюжка, що пробігає крізь героя, «цупить» дві цукерки (без втрати рукавички)
      if (Math.abs(S.x - e.x) < 50 && S.y > GY - 40 && S.inv <= 0 && S.sw > 0 && S.faint < 0) { const n = Math.min(2, S.sw); S.sw -= n; S.inv = 0.8;
        S.ev.push({ k: 'steal', t, x: S.x, y: S.y - 120, n }); }
    });
    // ---- хулігани: стоять, повертаються до героя, кидають вугілля дугою прямо в нього ----
    S.bu.forEach((e, i) => { const dx = S.x - e.x;
      if (e.st === 'gone') { e.x += e.vx * dt; return; }
      e.face = Math.sign(dx) || e.face;
      if (e.st === 'hit') { if (t - e.stT > 0.5) { e.st = 'idle'; e.nextT = t + 1.2; } return; }
      if (e.st === 'idle' && Math.abs(dx) < 1000 && S.faint < 0 && S.done < 0 && t > e.nextT) { e.st = 'throw'; e.stT = t; }
      if (e.st === 'throw' && t - e.stT > 0.45) {                        // кидок на кінці замаху, з руки над головою
        const hx = e.x + e.face * 11, hy = GY - 192,     /* кисть маріонетки в момент кидка (draw.js) */ T = 0.8 + Math.abs(dx) / 2200, ty = S.y - 70;
        S.shots.push({ k: 'coal', x: hx, y: hy, vx: (S.x - hx) / T, vy: (ty - hy - 0.5 * G_COAL * T * T) / T, t0: t, a: 0 });
        S.ev.push({ k: 'throw', t, x: hx, y: hy, i }); e.st = 'idle'; e.nextT = t + 2.1 + 0.8 * h1(i + t); }
      if (Math.abs(dx) < 70 && S.y > GY - 160) hurt(S, t, e.x);         // впритул до хулігана — боляче
    });
    // ---- снаряди ----
    for (let k = S.shots.length - 1; k >= 0; k--) { const p = S.shots[k], age = t - p.t0;
      p.vy += (p.k === 'coal' ? G_COAL : G_PROJ) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += (p.k === 'cracker' ? 9 : 14) * dt * Math.sign(p.vx || 1);
      let dead = false;
      if (p.k === 'cone') { const h = hitEnemy(S, p.x, p.y, 14);
        if (h) { damage(S, t, h[0], h[1], 1, p.x - p.vx * 0.02); S.ev.push({ k: 'bonk', t, x: p.x, y: p.y }); dead = true; }
        else { const li = W.lampAt(p.x, p.y); if (li >= 0) { S.la[li][1] += p.vx * 0.004; S.ev.push({ k: 'ding', t, x: p.x, y: p.y, i: li }); dead = true; } } }
      if (p.k === 'coal' && Math.abs(p.x - S.x) < 40 && p.y > S.y - 150 && p.y < S.y) { hurt(S, t, p.x - p.vx); S.ev.push({ k: 'smash', t, x: p.x, y: p.y }); dead = true; }
      if (p.k === 'cracker') { const h = hitEnemy(S, p.x, p.y, 10); if (h || age > 0.95) { boom(S, t, p.x, p.y, W); dead = true; } }
      const gy = W.groundBelow(p.x, p.y - p.vy * dt - 2);
      if (!dead && gy !== null && p.y >= gy && p.vy > 0) {
        if (p.k === 'cracker' && !p.b) { p.y = gy; p.vy *= -0.35; p.vx *= 0.6; p.b = 1; }
        else if (p.k !== 'cracker') { S.ev.push({ k: p.k === 'coal' ? 'smash' : 'plop', t, x: p.x, y: gy }); dead = true; } }
      if (dead || age > 2.5) S.shots.splice(k, 1); }
    // ---- подарунки, що випали: летять дугою і лягають на землю ----
    for (const g of S.drops) if (!g.on) { g.vy += 2200 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
      const gy = W.groundBelow(g.x, g.y - 20); if (gy !== null && g.y >= gy && g.vy > 0) { if (g.vy > 500) { g.vy *= -0.3; S.ev.push({ k: 'thud', t, x: g.x, y: gy }); } else { g.y = gy; g.on = 1; } } }
    for (const s of S.loose) if (!s.on) { s.vy += 2200 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const gy = W.groundBelow(s.x, s.y - 20); if (gy !== null && s.y >= gy && s.vy > 0) { if (s.vy > 450) { s.vy *= -0.4; s.vx *= 0.7; } else { s.y = gy - 26; s.on = 1; } } }
    // ---- підбір (тільки поки герой «у грі») ----
    if (S.faint >= 0) return;
    const near = (x, y, r) => Math.hypot(x - S.x, y - (S.y - 80)) < r;
    S.got.forEach((g, i) => { if (g === -1 && near(LV.SWEETS[i][0], LV.SWEETS[i][1], 70)) { S.got[i] = t; S.sw++; S.combo = t - S.comboT < 0.6 ? S.combo + 1 : 0; S.comboT = t;
      S.ev.push({ k: 'collect', t, x: LV.SWEETS[i][0], y: LV.SWEETS[i][1], i, c: S.combo }); } });
    S.orn.forEach((g, i) => { if (g === -1 && near(LV.ORNAMENTS[i][0], LV.ORNAMENTS[i][1], 80)) { S.orn[i] = t; S.ev.push({ k: 'ornament', t, x: LV.ORNAMENTS[i][0], y: LV.ORNAMENTS[i][1], i }); } });
    S.am.forEach((g, i) => { const [ax, kind] = LV.AMMO[i]; if (g === -1 && near(ax, GY - 60, 90)) { S.am[i] = t;
      if (kind) S.crackers = Math.min(9, S.crackers + 3); else S.cones = Math.min(40, S.cones + 12); S.ev.push({ k: 'ammo', t, x: ax, y: GY - 60, i, kind }); } });
    for (const g of S.drops) if (S.gifts[g.i] < 0 && t - g.t0 > 0.5 && near(g.x, g.y - 40, 90)) { S.gifts[g.i] = t; S.ev.push({ k: 'gift', t, x: g.x, y: g.y - 40, i: g.i }); }
    for (let k = S.loose.length - 1; k >= 0; k--) { const s = S.loose[k];
      if (t - s.t0 > 0.5 && near(s.x, s.y, 75)) { S.sw++; S.ev.push({ k: 'collect', t, x: s.x, y: s.y, i: -1, c: 0 }); S.loose.splice(k, 1); }
      else if (t - s.t0 > 7) S.loose.splice(k, 1); }
  }

  // Вибух хлопавки: конфеті, оглушує всіх ворогів поруч (2 удари), гойдає ліхтарі. Герою не шкодить — гра добра.
  function boom(S, t, x, y, W) {
    S.ev.push({ k: 'boom', t, x, y });
    S.th.forEach((e, i) => { if (Math.hypot(e.x - x, GY - 90 - y) < 280) damage(S, t, 'thief', i, 2, x); });
    S.bu.forEach((e, i) => { if (Math.hypot(e.x - x, GY - 100 - y) < 280) damage(S, t, 'bully', i, 2, x); });
    LV.LAMPS.forEach((lx, i) => { if (Math.abs(lx - x) < 300) S.la[i][1] += Math.sign(lx - x || 1) * 3; });
  }

  root.ACT = { init, step, fire, toss, hurt, BOX };
  if (typeof module !== 'undefined') module.exports = root.ACT;
})(typeof window !== 'undefined' ? window : globalThis);
