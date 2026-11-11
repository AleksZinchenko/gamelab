// live/draw.js — малювання акторів і предметів: герой-маріонетка (cut-out rig — фігура з окремих частин на «шарнірах»),
// вороги, солодощі, прикраси, подарунки, снаряди. Позиції бере зі стану симуляції, сам нічого не «запам'ятовує».
(function () {
  const L = LIB, M = L.M, LV = SIM.LV, GY = LV.GY;
  const D = (window.DRAW = {});
  const INK = [0.05, 0.04, 0.06];                 // колір контуру — майже чорний синій, як у референсі

  // ---------------- герой ----------------
  // Масштаб частин: зріст ~160 px екрана (80 «пікселів» гри). Частини з одного листа, тож масштаб у всіх однаковий.
  const HK = 0.2;
  // Точки кріплення в частках текстури: корінь (плече/стегно), суглоб (лікоть/коліно), де різати на два сегменти.
  const ARM = { split: 0.5, root: [0.5, 0.08], joint: [0.5, 0.5], r: 0 };
  const LEG = { split: 0.47, root: [0.45, 0.06], joint: [0.45, 0.47], r: 0 };
  // Пози: [дальнє стегно, дальнє коліно, ближнє стегно, ближнє коліно, дальня рука, дальній лікоть, ближня рука, ближній лікоть,
  //        нахил тіла, присідання]. Кути в градусах: 0 — кінцівка вниз, «−» — вперед (куди дивиться герой).
  const PO = {
    idle: [-4, 6, 6, 4, -8, -10, 10, -8, 1, 1.0],
    squat: [-38, 56, -14, 46, -30, -20, 26, -20, 6, 0.88],
    rise: [-8, 14, 12, 18, -60, -40, 50, -30, -3, 1.06],
    tuck: [-64, 92, -26, 72, -80, -40, 40, -60, 0, 1.0],
    fall: [-14, 26, 12, 24, -110, -10, 100, -10, 2, 1.02],
    hurt: [20, 30, -10, 20, 70, -20, -60, -30, -14, 0.96],
    faint: [-70, 90, -60, 80, 30, -40, 40, -50, 70, 0.9],
  };
  // біг: ноги навпереміну, руки — протифазою до ніг (як у людей)
  const runPose = (p) => { const s = Math.sin(p), c = Math.cos(p);
    return [-34 * s - 2, 8 + 78 * Math.max(0, c) ** 1.4, 34 * s - 2, 8 + 78 * Math.max(0, -c) ** 1.4, -26 + 34 * s, -26 - 26 * Math.max(0, -s), 6 - 38 * s, -34 - 30 * Math.max(0, s), 7, 1 + 0.03 * Math.cos(2 * p)]; };

  // лазіння по драбині: руки перехоплюють щаблі по черзі (одна витягнута вгору, друга зігнута біля обличчя),
  // ноги ступають навпереміну — коли ліва рука вгорі, піднята права нога (так лазять люди: хрест-навхрест).
  // p — фаза циклу; u/v — плавні «ваги» 0…1 для двох половин циклу.
  const climbPose = (p) => { const s = Math.sin(p), u = (1 + s) / 2, v = 1 - u;
    return [-18 - 52 * v, 22 + 78 * v,          // дальня нога: піднята (зігнута) у своїй половині циклу
            -18 - 52 * u, 22 + 78 * u,          // ближня нога — у протифазі
            -72 - 78 * u, -58 + 48 * u,         // дальня рука: u=1 — тягнеться вперед-угору майже пряма, u=0 — зігнута перед грудьми
            -62 - 50 * v, -50 + 30 * v,         // ближня рука — у протифазі; вона росте з плеча за обличчям, тож тягнеться
                                                // вперед, а не вгору, — інакше кисть проходить по лицю
            3, 1]; };                           // тіло трохи нахилене до драбини

  // Плече ближньої руки (з неї стріляємо) — та сама формула, що й SIM.shoulder: постріл вилітає саме з кисті.
  D.heroPose = (ST, GT, t) => {
    let Q;
    if (ST.faint >= 0) return L.lerpP(PO.idle, PO.faint, L.SS(0, 0.4, GT - ST.faint));
    // на драбині фаза береться з висоти: повний цикл — 120 px (чотири щаблі), стоїш — поза завмирає
    if (ST.climb) { Q = climbPose(ST.y / 120 * 2 * Math.PI); const sh = GT - ST.hurtT;
      return sh >= 0 && sh < 0.5 ? L.lerpP(Q, PO.hurt, Math.exp(-sh / 0.18) * 0.5) : Q; }
    if (ST.ground) { const idle = PO.idle.slice(); idle[9] = 1 + 0.018 * Math.sin(t * 2 * Math.PI / 1.9);   // дихання
      idle[6] += 3 * Math.sin(t * 2 * Math.PI / 1.9); Q = L.lerpP(idle, runPose(ST.dist / 150 * 2 * Math.PI), Math.min(1, Math.abs(ST.vx) / 260)); }
    else Q = ST.vy < 0 ? L.lerpP(PO.rise, PO.tuck, L.SS(-700, -80, ST.vy)) : L.lerpP(PO.tuck, PO.fall, L.SS(80, 700, ST.vy));
    const sl = GT - ST.landT; if (sl >= 0 && sl < 0.3) Q = L.lerpP(Q, PO.squat, Math.exp(-sl / 0.07) * Math.max(0.35, Math.min(1, ST.landV / 1400)));
    const sh = GT - ST.hurtT; if (sh >= 0 && sh < 0.5) Q = L.lerpP(Q, PO.hurt, Math.exp(-sh / 0.18));
    return Q;
  };

  // Кут ближньої руки під час пострілу/кидка: рука тягнеться до прицілу, потім плавно повертається.
  const aimArm = (ST, GT) => { const e = ST.ev.findLast && ST.ev.findLast((q) => q.k === 'shoot' || q.k === 'toss');
    if (!e) return null; const a = GT - e.t; if (a < 0 || a > 0.45) return null;
    const w = a < 0.3 ? 1 : 1 - L.SS(0.3, 0.45, a);
    if (e.k === 'toss') return { w, ang: -150 + 120 * L.SS(0, 0.18, a), elbow: 0 };          // кидок: замах над головою вперед
    // кут від вертикалі «вниз» до напрямку пострілу; у системі рук «−» — вперед
    const ang = Math.atan2(e.ax * ST.face, e.ay) / L.D2R; return { w, ang: -ang, elbow: 0, recoil: a };
  };

  D.hero = (ST, GT, t, X, Y) => {
    const Q = D.heroPose(ST, GT, t), [fl1, fl2, nl1, nl2, fa1, fa2, na1, na2, rot, sq] = Q, face = ST.face;
    const [bw, bh] = L.sz('hero_body', HK), lh = G.tex('hero_leg_n').h * HK, ah = G.tex('hero_arm_n').h * HK;
    const Lt = (LEG.joint[1] - LEG.root[1]) * lh, Ls = (0.97 - LEG.joint[1]) * lh;
    const reachOf = (a1, a2) => Lt * Math.cos(a1 * L.D2R) + Ls * Math.cos((a1 + a2) * L.D2R);
    // висота стегон = довша з ніг (ступня на землі); на бігу половину перепаду гасимо — інакше голова «скаче» (перевірка: ≤ 6 % зросту)
    const full = Lt + Ls, rr = Math.max(reachOf(fl1, fl2), reachOf(nl1, nl2)), runK = ST.ground ? Math.min(1, Math.abs(ST.vx) / 260) : 0;
    const reach = ST.faint >= 0 ? 20 + 30 * (1 - L.SS(0, 0.4, GT - ST.faint)) : rr + (full - rr) * 0.6 * runK - 3;
    // на драбині фігуру зсуваємо трохи назад, щоб кисті (вони попереду тіла) лягали на щаблі, а не в повітря
    const hx = Math.round(ST.x + X(1) - (ST.climb ? ST.face * 22 : 0)), hy = Math.round(ST.y + Y(1)), sy = sq, sx = 1 / Math.sqrt(sy);
    // контактна тінь: менша, коли герой високо над землею
    if (!L.sp) { const gy = SIM.groundBelow(ST.x, ST.y); if (gy !== null) { const f = Math.max(0.2, 1 - (gy - ST.y) / 360); L.shadow(hx, gy + 3 + Y(1), 30 * f, 6 * f, 0.55 * f); } }
    const blink = ST.inv > 0 && ST.faint < 0 && Math.floor(GT * 14) % 2 === 0 ? 0.35 : 1;   // невразливість — блимання
    const Mb = M.of(M.t(hx, hy), M.s(face, 1), M.t(0, -reach), M.r(rot * L.D2R), M.s(sx, sy));
    const at = (nx, ny) => M.ap(Mb, [(nx - 0.5) * bw, (ny - 0.92) * bh]);
    const u = { alpha: blink }, uf = { alpha: blink, tint: [0.72, 0.74, 0.86, 1] };            // дальні частини — темніші (вони в тіні)
    // кінцівка + звіт суглобів для перевірок: корінь (плече/стегно), суглоб (лікоть/коліно), кінець (кисть/щиколотка)
    const limb = (tex, p, a1, a2, c, far, side) => { const h = G.tex(tex).h * HK;
      const kp = L.twoBone({ tex, p, a1, a2, face, rot, w: G.tex(tex).w * HK, h, split: c.split, root: c.root, joint: c.joint, r: 0, u: far ? uf : u });
      const end = M.ap(M.of(M.t(kp[0], kp[1]), M.s(face, 1), M.r((rot + a1 + a2) * L.D2R)), [0, (0.97 - c.joint[1]) * h]);
      if (side) { const leg = c === LEG; L.joint('hero', (leg ? 'hip' : 'sh') + side, p); L.joint('hero', (leg ? 'knee' : 'elbow') + side, kp);
        L.joint('hero', (leg ? 'ankle' : 'hand') + side, end); }
      return kp; };
    const aim = aimArm(ST, GT);
    // шарф: кінець висить зі спини і відстає від руху (пружина в симуляції)
    { const p = at(0.2, 0.6), sw = G.tex('hero_scarf').w * HK * 0.9, shh = G.tex('hero_scarf').h * HK * 0.62;
      L.sprite('hero_scarf', 0, 0, { m: M.of(M.t(p[0], p[1]), M.s(face, 1), M.r((ST.scarfTh + 12 + 6 * Math.sin(t * 3.1)) * L.D2R)), w: sw, h: shh, pivot: [sw * 0.5, 2], u }); }
    limb('hero_arm_f', at(0.8, 0.61), fa1 + (aim ? -30 * aim.w : 0), fa2, ARM, true, 'R');       // дальня рука — за тулубом
    limb('hero_leg_f', at(0.62, 0.9), fl1, fl2, LEG, true, 'R');
    L.sprite('hero_body', 0, 0, { m: Mb, w: bw, h: bh, pivot: [bw * 0.5, bh * 0.92], u });
    limb('hero_leg_n', at(0.36, 0.9), nl1, nl2, LEG, false, 'L');
    const sh = at(0.2, 0.62);
    const na = aim ? na1 + (aim.ang - rot - na1) * aim.w : na1, ne = aim ? na2 * (1 - aim.w) : na2;
    const kp = limb('hero_arm_n', sh, na, ne, ARM, false, 'L');
    // рогатка в кисті: дерев'яна «рогачка» з гумкою (маленька, малюється кодом у кольорах референсу)
    const handP = M.ap(M.of(M.t(sh[0], sh[1]), M.s(face, 1), M.r((rot + na + ne) * L.D2R)), [0, ah * 0.84]);
    if (aim && !L.sp && aim.recoil !== undefined) slingshot(handP, (rot + na) * face, face, aim.recoil);
    L.joint('hero', 'head', at(0.5, 0.2)); L.joint('hero', 'hip', at(0.5, 0.9)); L.joint('hero', 'ground', [hx, hy]);
    return { hand: handP, shoulder: sh };
  };
  function slingshot(p, angDeg, face, a) {
    const r = angDeg * L.D2R, c = Math.cos(r), s = Math.sin(r), f = (dx, dy) => [p[0] + dx * c - dy * s, p[1] + dx * s + dy * c];
    const wood = [0.42, 0.24, 0.12];
    const tip = f(0, 16), l = f(-7 * face, 26), rr = f(7 * face, 26);
    L.solid(p[0] - 2, p[1] - 2, 4, 18, wood, r, 2, 0);
    for (const q of [l, rr]) L.solid(tip[0] - 2, tip[1], 4, 12, wood, Math.atan2(q[1] - tip[1], q[0] - tip[0]) - Math.PI / 2, 2, 0);
    const pull = Math.max(0, 1 - a / 0.12) * 12;                                    // гумка тягнеться назад і клацає
    const back = f(0, 26 - pull - 6);
    for (const q of [l, rr]) L.solid(q[0] - 1, q[1], 2, Math.hypot(back[0] - q[0], back[1] - q[1]), [0.75, 0.35, 0.3], Math.atan2(back[1] - q[1], back[0] - q[0]) - Math.PI / 2, 1, 0);
  }

  // ---------------- вороги: маріонетки з листів частин ----------------
  // Спільна «лялька»: тулуб, дві руки й дві ноги, кожна кінцівка — два сегменти зі згином (лікоть/коліно).
  // k — масштаб частин; sh/hip — плечі й стегна в частках текстури тулуба: [ближнє], [дальнє].
  const RIG = {
    thief: { k: 0.197, sh: [[0.16, 0.47], [0.78, 0.46]], hip: [[0.33, 0.93], [0.62, 0.93]], pv: 0.95,
      ARM: { split: 0.47, root: [0.55, 0.07], joint: [0.55, 0.47] }, LEG: { split: 0.47, root: [0.45, 0.04], joint: [0.45, 0.47] }, stride: 230 },
    bully: { k: 0.312, sh: [[0.11, 0.56], [0.85, 0.52]], hip: [[0.33, 0.93], [0.66, 0.93]], pv: 0.95,
      ARM: { split: 0.48, root: [0.55, 0.08], joint: [0.55, 0.48] }, LEG: { split: 0.45, root: [0.4, 0.05], joint: [0.4, 0.45] }, stride: 170 },
    // гасильник (річка): довгий плащ, циліндр; плечі й стегна виміряно сіткою frames/g_snuf.png
    snuffer: { k: 0.23, sh: [[0.14, 0.47], [0.78, 0.45]], hip: [[0.35, 0.93], [0.62, 0.93]], pv: 0.95,
      ARM: { split: 0.47, root: [0.5, 0.06], joint: [0.5, 0.47] }, LEG: { split: 0.47, root: [0.45, 0.04], joint: [0.45, 0.47] }, stride: 200 },
    // бос пан Бурчак (вежа): у півтора раза вищий за злодюжку
    burchak: { k: 0.3, sh: [[0.1, 0.4], [0.8, 0.38]], hip: [[0.38, 0.93], [0.62, 0.93]], pv: 0.95,
      ARM: { split: 0.47, root: [0.5, 0.06], joint: [0.5, 0.47] }, LEG: { split: 0.47, root: [0.45, 0.04], joint: [0.45, 0.47] }, stride: 260 },
  };
  // пози: [дальнє стегно, коліно, ближнє стегно, коліно, дальня рука, лікоть, ближня рука, лікоть, нахил тіла°, присідання]
  const EPO = {
    thief: { idle: [-4, 8, 8, 6, -10, -14, 8, -12, 4, 1], sneak: [0, 0, 0, 0, -40, -60, -30, -70, 12, 0.97],
      cower: [-50, 80, -40, 70, -150, -60, -160, -50, 14, 0.82], hit: [20, 30, -10, 20, 60, -30, 50, -40, -16, 0.95], sack: [0, 0, 0, 0, 165, -70, 0, 0, 0, 1] },
    bully: { idle: [-10, 6, 12, 6, 14, -10, -12, -10, 0, 1], hit: [16, 24, -8, 18, 50, -30, 40, -30, -12, 0.96],
      wind: [-10, 6, 12, 6, 30, -20, 150, -50, -8, 0.98], fling: [-14, 10, 16, 10, 20, -20, -140, -10, 10, 1.0] },
    // гасильник: ближня рука несе палицю; snuff — рука вгору-вперед, палиця дзвоником накриває ліхтар
    snuffer: { idle: [-4, 6, 6, 4, 6, -8, -40, -60, 2, 1], snuff: [-6, 8, 10, 6, 10, -10, -150, -14, -6, 1.02],
      hit: [16, 24, -8, 18, 50, -30, 30, -40, -12, 0.96] },
    // Бурчак: кидок як у кидайла; dizzy — руки обвисли, хитається; down — сів на дах
    burchak: { idle: [-6, 6, 8, 6, 12, -10, -14, -12, 2, 1], hit: [16, 24, -8, 18, 50, -30, 40, -30, -14, 0.96],
      wind: [-10, 6, 12, 6, 30, -20, 160, -50, -8, 0.98], fling: [-14, 10, 16, 10, 20, -20, -140, -10, 10, 1.0],
      dizzy: [-8, 14, 10, 12, 30, -6, 24, -6, 0, 0.97], down: [-80, 90, -70, 85, 40, -30, 50, -30, -6, 0.85], carry: [0, 0, 0, 0, 165, -70, 0, 0, 0, 1] },
  };
  // крок: ноги навпереміну, руки протифазою; amp — розмах ніг (крадькома — дрібно, втеча — широко), arms — розмах рук
  const gait = (p, amp, arms) => { const s = Math.sin(p), c = Math.cos(p);
    return [-34 * amp * s, 6 + 70 * amp * Math.max(0, c) ** 1.4, 34 * amp * s, 6 + 70 * amp * Math.max(0, -c) ** 1.4,
      -20 * arms + 40 * arms * s, -30 * arms, 10 * arms - 44 * arms * s, -34 * arms, 9 * amp, 1 + 0.03 * Math.cos(2 * p)]; };

  // Складає ляльку з частин за позою Q. Порядок шарів: дальня рука → (мішок) → дальня нога → тулуб → ближня нога → ближня рука.
  function puppet(kind, Q, x, y, face, u, extra) {
    const R = RIG[kind], k = R.k, [fl1, fl2, nl1, nl2, fa1, fa2, na1, na2, rot, sq] = Q;
    const bw = G.tex(kind + '_body').w * k, bh = G.tex(kind + '_body').h * k, lh = G.tex(kind + '_leg_n').h * k;
    const Lt = (R.LEG.joint[1] - R.LEG.root[1]) * lh, Ls = (0.97 - R.LEG.joint[1]) * lh;
    const reachOf = (a1, a2) => Lt * Math.cos(a1 * L.D2R) + Ls * Math.cos((a1 + a2) * L.D2R);
    const reach = Math.max(reachOf(fl1, fl2), reachOf(nl1, nl2)) - 4, sx = 1 / Math.sqrt(sq);   // стегна на висоті довшої ноги — ступні на землі
    const Mb = M.of(M.t(x, y), M.s(face, 1), M.t(0, -reach), M.r(rot * L.D2R), M.s(sx, sq));
    const at = (p) => M.ap(Mb, [(p[0] - 0.5) * bw, (p[1] - R.pv) * bh]);
    const uf = Object.assign({}, u, { tint: u.tint && u.tint[3] > 0 ? u.tint : [0.72, 0.74, 0.86, 1] });   // дальні частини — в тіні
    const limb = (part, p, a1, a2, c, far) => L.twoBone({ tex: kind + '_' + part, p, a1, a2, face, rot, w: G.tex(kind + '_' + part).w * k,
      h: G.tex(kind + '_' + part).h * k, split: c.split, root: c.root, joint: c.joint, r: 0, u: far ? uf : u });
    const shF = at(R.sh[1]);
    limb('arm_f', shF, fa1, fa2, R.ARM, true);
    if (extra && extra.behind) extra.behind(shF);                                     // мішок за спиною, у дальній руці
    limb('leg_f', at(R.hip[1]), fl1, fl2, R.LEG, true);
    if (extra && extra.body) { const aw = bh * G.tex(extra.body).w / G.tex(extra.body).h;          // запасний тулуб (інший вираз обличчя) — тієї ж висоти
      L.sprite(extra.body, 0, 0, { m: Mb, w: aw, h: bh, pivot: [aw * 0.5, bh * R.pv], u }); }
    else L.sprite(kind + '_body', 0, 0, { m: Mb, w: bw, h: bh, pivot: [bw * 0.5, bh * R.pv], u });
    limb('leg_n', at(R.hip[0]), nl1, nl2, R.LEG, false);
    const el = limb('arm_n', at(R.sh[0]), na1, na2, R.ARM, false);
    const ah = G.tex(kind + '_arm_n').h * k;
    const hand = M.ap(M.of(M.t(el[0], el[1]), M.s(face, 1), M.r((rot + na1 + na2) * L.D2R)), [0, (0.9 - R.ARM.joint[1]) * ah]);
    return { hand, head: at([0.5, 0.05]), reach };
  }

  D.enemy = (kind, e, i, ST, GT, t, X, Y) => {
    const gone = e.st === 'gone', a = GT - e.stT; if (gone && a > 2.5) return;
    const face = e.face || 1, R = RIG[kind], P = EPO[kind], hit = GT - e.hitT < 0.3;
    const sp = Math.abs(e.vx || 0), ph = (e.dist || 0) / R.stride * 2 * Math.PI;
    let Q;
    if (kind === 'thief') {
      const run = L.SS(150, 330, sp), walk = Math.min(1, sp / 60);
      Q = L.lerpP(P.idle, L.lerpP(L.lerpP(P.sneak, gait(ph, 0.55, 0.3), 0.6), gait(ph, 1.15, 1), run), walk);   // крадькома → біг
      if (e.st === 'idle') Q[8] += 4;                                                  // згорблений, крадеться
      if (e.st === 'cower') Q = L.lerpP(Q, P.cower, L.SS(0, 0.2, a));
      if (!gone && e.st !== 'cower' && !e.guest) { Q = Q.slice(); Q[4] = P.sack[4] + 6 * Math.sin(ph); Q[5] = P.sack[5]; }   // дальня рука тримає мішок на плечі
      if (gone) Q = gait(ph, 1.3, 1.2);
    } else if (kind === 'burchak') {
      const walk = Math.min(1, sp / 120); Q = L.lerpP(P.idle, gait(ph, 1.2, 1), walk).slice();
      if (e.carry) { Q[4] = P.carry[4] + 6 * Math.sin(ph); Q[5] = P.carry[5]; }        // дальня рука тримає мішок із зіркою
      if (e.st === 'throw') Q = a < 0.35 ? L.lerpP(Q, P.wind, L.SS(0, 0.3, a)) : L.lerpP(P.wind, P.fling, L.SS(0.35, 0.45, a));
      if (e.st === 'dizzy') { Q = P.dizzy.slice(); Q[8] = 8 * Math.sin(GT * 5); }
      if (e.st === 'down') Q = L.lerpP(P.dizzy, P.down, L.SS(0, 0.4, a));
      if (e.st === 'leap') Q = P.fling;
    } else if (kind === 'snuffer') {
      // повільна похмура хода; ближня рука тримає палицю (лише дальня махає); snuff — підняти палицю до ліхтаря
      const walk = Math.min(1, sp / 70); Q = L.lerpP(P.idle, gait(ph, gone ? 1.2 : 0.7, gone ? 1 : 0.5), walk).slice();
      if (!gone) { Q[6] = P.idle[6] + 4 * Math.sin(ph); Q[7] = P.idle[7]; }
      if (e.st === 'snuff') Q = L.lerpP(Q, P.snuff, L.SS(0, 0.35, a));
    } else {
      const walk = Math.min(1, sp / 120); Q = L.lerpP(P.idle, gait(ph, 1.1, 1), walk).slice();
      Q[9] *= 1 + 0.02 * Math.sin(t * 2.4 + i); Q[6] += 4 * Math.sin(t * 2.4 + i);     // важке дихання
      // кидок: замах над головою (0…0.35 с) → різкий викид уперед (0.35…0.45 с), кидок — на кінці дуги
      if (e.st === 'throw') Q = a < 0.35 ? L.lerpP(Q, P.wind, L.SS(0, 0.3, a)) : L.lerpP(P.wind, P.fling, L.SS(0.35, 0.45, a));
    }
    if (hit && !gone) Q = L.lerpP(Q, P.hit, Math.exp(-(GT - e.hitT) / 0.12));
    // [фінал] Шарф тримає подарунок перед собою обома руками (передпліччя вперед, на рівні грудей)
    if (e.gift) { Q = Q.slice(); Q[4] = -50; Q[5] = -55; Q[6] = -60; Q[7] = -50; }
    const x = Math.round(e.x + X(1) + (e.st === 'cower' ? 2 * Math.sin(GT * 70) : 0)), y = Math.round((e.y || GY) + Y(1));   // своя висота (дахи)
    const fade = (gone ? 1 - L.SS(1.6, 2.5, a) : 1) * (e.alpha === undefined ? 1 : e.alpha), u = { alpha: fade, tint: hit ? [1, 0.5, 0.45, 0.55] : [1, 1, 1, 0] };
    if (!L.sp) L.shadow(x, (e.y || GY) + Y(1) + 3, kind === 'bully' ? 46 : 34, 7, 0.5 * fade);
    const pole = kind === 'snuffer' && !gone && !e.gift;                             // з подарунком у руках палицю відклав
    // Бурчак: обличчя міняється (лютий — у бою, очі-спіралі — оглушений), мішок із зіркою — за спиною
    const bx = kind === 'burchak' ? { body: e.st === 'dizzy' || e.st === 'down' ? 'burchak_dizzy' : e.ph >= 1 && GT - e.hitT > 0.3 ? 'burchak_angry' : null,
      behind: e.carry ? (sh) => { const s = 130; L.sprite('starsack', 0, 0, { m: M.of(M.t(sh[0] - face * 10, sh[1] + 10), M.r(-0.3 * face + 0.1 * Math.sin(ph))), w: s * 426 / 620, h: s, pivot: [s * 0.34, s * 0.2], flip: face < 0, u }); } : null } : null;
    const extra = kind === 'thief' && !gone ? { behind: (sh) => { const s = 92;
      L.sprite('sack', 0, 0, { m: M.of(M.t(sh[0] - face * 8, sh[1] + 6), M.r(-0.3 * face + 0.1 * Math.sin(ph))), w: s, h: s, pivot: [s / 2, s * 0.25], flip: face < 0, u }); } } : null;
    // [фінал] гість на площі: без мішка; щасливий — усміхнений тулуб і кольоровий кінчик шарфа, що майорить за спиною
    let ex = bx || extra;
    if (e.guest) { const bh = G.tex(kind + '_body').h * R.k, sc = kind + '_scarf2';
      ex = { body: e.happy ? kind + '_happy' : null, behind: e.happy ? (sh) => { const h = bh * 0.5, w = L.hsz(sc, h);
        L.sprite(sc, 0, 0, { m: M.of(M.t(sh[0] + face * 6, sh[1] - bh * 0.04), M.r(face * (0.5 + 0.12 * Math.sin(t * 2.6 + i)))), w, h, pivot: [w / 2, 4], u }); } : null }; }
    const J = puppet(kind, Q, x, y, face, u, ex);
    if (e.gift) { const gn = e.box || 'gift_red', gh = 64, gw = L.hsz(gn, gh); L.sprite(gn, Math.round(J.hand[0] - gw / 2), Math.round(J.hand[1] - gh * 0.7), { w: gw, h: gh, u }); }   // подарунок у руках
    L.joint(kind + i, 'hand', J.hand);
    // палиця-гасильник у ближній кисті: зазвичай нахилена назад через плече; під час гасіння дзвоник тягнеться до скла ліхтаря
    if (pole) { const ph2 = 300, pw2 = L.hsz('snuffer_pole', ph2), hold = 0.55;
      // r — поворот за годинниковою від вертикалі «вгору»: верх палиці дивиться в (sin r, −cos r)
      let r = -face * 0.35;                                                               // несе: верх нахилений назад
      if (e.st === 'snuff' && e.tg >= 0) { const lx = LV.LAMPS[e.tg] + X(1), ly = GY - LV.LAMP_H + 60 + Y(1);
        r += (Math.atan2(lx - J.hand[0], -(ly - J.hand[1])) - r) * L.SS(0.1, 0.5, a); }  // повертає дзвоник до скла ліхтаря
      L.sprite('snuffer_pole', 0, 0, { m: M.of(M.t(J.hand[0], J.hand[1]), M.r(r)), w: pw2, h: ph2, pivot: [pw2 / 2, ph2 * hold], u }); }
    // вугілля в кисті під час замаху; у момент кидка далі летить снаряд із симуляції — з тієї ж точки
    if (kind === 'bully' && e.st === 'throw' && a < 0.45 && !L.sp) L.sprite('coal', J.hand[0] - 15, J.hand[1] - 15, { w: 30 });
    if (kind === 'bully' && e.st === 'throw' && a > 0.43 && a < 0.45) L.anchor('coal' + i, [e.x + face * 11 + X(1), (e.y || GY) - 192 + Y(1)], J.hand, 16);
    if (e.st === 'cower' || e.st === 'dizzy' || (hit && e.hp > 0)) for (let j = 0; j < 3; j++) { const an = GT * 5 + j * 2.1;
      L.star(J.head[0] + Math.cos(an) * 30, J.head[1] - 14 + Math.sin(an) * 8, 8, [1, 0.9, 0.5], 0.9); }
  };

  // ---------------- предмети ----------------
  const SWT = ['it_cane', 'it_ginger', 'it_candy', 'it_lolly'], ORN = ['orn_red', 'orn_gold', 'orn_blue'], GIFT = ['gift_red', 'gift_green', 'star'];
  D.items = (ST, GT, t, X, Y, onScreen) => {
    const glowCol = [1.0, 0.75, 0.35];
    LV.SWEETS.forEach(([x, y], i) => { if (ST.got[i] !== -1 || !onScreen(x)) return;
      const yy = y + 5 * Math.sin(t * 2.6 + i * 0.7) + Y(1), xx = x + X(1), n = SWT[i % 4], s = 44;
      L.glow(xx, yy, 34, glowCol, 0.18, 3); L.sprite(n, 0, 0, { m: M.of(M.t(xx, yy), M.r(0.12 * Math.sin(t * 1.7 + i))), h: s, pivot: [L.hsz(n, s) / 2, s / 2] }); });
    LV.ORNAMENTS.forEach(([x, y, k], i) => { if (ST.orn[i] !== -1 || !onScreen(x)) return;
      const yy = y + 7 * Math.sin(t * 1.9 + i) + Y(1), xx = x + X(1), sw = Math.sin(t * 2.2 + i) * 0.18;
      L.glow(xx, yy, 70, [1, 0.85, 0.5], 0.3, 3); L.sprite(ORN[k], 0, 0, { m: M.of(M.t(xx, yy - 26), M.r(sw)), h: 60, pivot: [L.hsz(ORN[k], 60) / 2, 2] });
      if ((t * 0.9 + i * 0.37) % 1 < 0.15) L.star(xx + 12, yy - 8, 14, [1, 1, 0.9], 1 - ((t * 0.9 + i * 0.37) % 1) / 0.15); });
    LV.AMMO.forEach(([x, kind, ay], i) => { if (ST.am[i] !== -1 || !onScreen(x)) return; const n = kind ? 'cracker' : 'branch', h = kind ? 56 : 62, gy = ay || GY;
      L.glow(x + X(1), gy - 50 + Y(1), 60, [0.8, 1, 0.7], 0.15, 3); L.sprite(n, x + X(1) - L.hsz(n, h) / 2, gy - h - 6 + Y(1) + 3 * Math.sin(t * 2 + i), { h }); });
    for (const g of ST.drops) { if (ST.gifts[g.i] >= 0) continue; const n = (LV.GIFTS || GIFT)[g.i], h = 64, xx = g.x + X(1), yy = g.y + Y(1);
      L.glow(xx, yy - 30, 90, [1, 0.8, 0.45], 0.35 + 0.1 * Math.sin(t * 4), 3); L.sprite(n, xx - L.hsz(n, h) / 2, yy - h + (g.on ? 2 * Math.sin(t * 3) : 0), { h }); }
    for (const s of ST.loose) { const age = GT - s.t0, a = age > 5.5 ? (Math.floor(age * 10) % 2 ? 0.3 : 1) : 1;   // скоро зникне — блимає
      L.sprite(SWT[Math.floor(s.t0 * 10) % 4], s.x + X(1) - 18, s.y + Y(1) - 18, { h: 38, u: { alpha: a } }); }
    for (const p of ST.shots) { const xx = p.x + X(1), yy = p.y + Y(1);
      const n = p.k === 'cone' ? 'cone' : p.k.startsWith('coal') ? 'coal' : 'cracker', h = p.k === 'cracker' ? 44 : 30;
      if (p.k === 'coalback') L.glow(xx, yy, 46, [1, 0.55, 0.2], 0.5, 3);                          // відбите вугілля жевріє — летить назад до боса
      L.sprite(n, 0, 0, { m: M.of(M.t(xx, yy), M.r(p.a)), h, pivot: [L.hsz(n, h) / 2, h / 2] });
      if (p.k === 'cracker') { const sp = M.ap(M.of(M.t(xx, yy), M.r(p.a)), [L.hsz(n, h) * 0.3, -h * 0.5]);       // іскра на ґноті
        L.star(sp[0], sp[1], 12 + 4 * Math.sin(GT * 40), [1, 0.85, 0.4], 1); L.glow(sp[0], sp[1], 40, [1, 0.6, 0.2], 0.4, 3); } }
  };
})();
