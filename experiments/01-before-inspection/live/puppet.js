// live/puppet.js — «маріонетка» (cut-out rig): персонаж зібраний з окремих намальованих частин (тіло, стегно, гомілка,
// ступня, плече, передпліччя), кожна обертається навколо свого суглоба. Так рухаються герої в Amanita-іграх:
// не 30 перемальованих кадрів, а одні й ті самі частини, які поворотами складаються в будь-яку позу.
// Дані частин і суглобів — live/rigs.js (його пише partrig.py з аркуша частин).
(function () {
  const L = LIB, M = L.M;
  const P = (window.PUPPET = {});
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const len = (v) => Math.hypot(v[0], v[1]), ang = (v) => Math.atan2(v[1], v[0]);
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

  // Хода: фаза кроку p ∈ [0,1) для кожної ноги (друга нога — зі зсувом півкроку).
  // Опора (60% циклу): ступня стоїть на підлозі й «їде» назад рівно зі швидкістю тіла — тому не ковзає.
  // Перенос (40%): ступня піднімається дугою і переноситься вперед, носок трохи задирається.
  const STANCE = 0.6;
  function footPath(p, S, lift) {
    if (p < STANCE) return { dx: S / 2 - (p / STANCE) * S, dy: 0, pitch: 0, fwd: 1 - 2 * p / STANCE };
    const q = (p - STANCE) / (1 - STANCE), e = q * q * (3 - 2 * q);
    return { dx: -S / 2 + S * e, dy: -lift * Math.sin(Math.PI * q), pitch: -0.28 * Math.sin(Math.PI * q), fwd: -1 + 2 * e };
  }
  // Двокісткова інверсна кінематика (IK): знаючи стегно (H) і куди треба поставити щиколотку (A),
  // знаходимо коліно (K) за теоремою косинусів. Коліно завжди дивиться вперед (у бік руху).
  function ik(H, A, t, s) {
    const d0 = sub(A, H), d = Math.min(len(d0), (t + s) * 0.999), base = ang(d0);
    const c = Math.max(-1, Math.min(1, (t * t + d * d - s * s) / (2 * t * d)));
    return add(H, rot([t, 0], base - Math.acos(c)));          // «мінус» = коліно вперед (+x) для героя, що дивиться вправо
  }

  // Намалювати ходока. o: { x, y — точка між ступнями на екрані; face: 1 вправо / -1 вліво; dist — пройдена відстань;
  // wk — 0 стоїть … 1 іде; cycle — довжина циклу (два кроки) у px; id — ім'я для QA-трасування; lift; t — час;
  // arms: { R: [мах, згин ліктя], L: [мах] } — поза рук замість маху ходи (замах ключем, ковток з пробірки);
  // armBlend: 0…1 — наскільки ближню руку показує повна рука з аркуша частин замість руки з якоря (на час жесту) }
  // Повертає точки для реквізиту: hand — кисть ближньої руки (екран), ang — кут передпліччя, top(p) — px текстури верху → екран.
  P.walker = (name, o) => {
    const R = RIGS[name], T = (part) => name + '__' + part;
    const cycle = o.cycle || 180, S = STANCE * cycle * o.wk, lift = (o.lift || 26) * o.wk;   // крок і висота підйому ступні
    const ph = (o.dist / cycle) % 1, legs = { L: (ph + 0.5) % 1, R: ph };
    const cx = (R.footL[0] + R.footR[0]) / 2;                                 // точка опори = між ступнями
    const Mroot = M.of(M.t(o.x, o.y), M.s(o.face, 1), M.t(-cx, -R.h));
    const at = (pt) => M.ap(Mroot, pt);
    // куди ставимо щиколотки + наскільки опустити таз, щоб опорна нога не «розтягувалась» (таз їде на опорній нозі)
    // Ноги ближче до центру тіла: на картинці герой стоїть ширше, ніж ходять. Без цього зсув між ногами лишається й у ході —
    // одна нога весь час «попереду», виходить приставний крок. Стоячи зводимо на 35%, у ході — на 85% (сліди майже на одній
    // лінії, ноги перехрещуються, як у справжній ході в профіль). neutral — точно як намальовано (еталон для QA).
    const hc = (R.hipL[0] + R.hipR[0]) / 2, nar = o.neutral ? 0 : 0.35 + 0.5 * o.wk;
    const sx = { L: -(R.hipL[0] - hc) * nar, R: -(R.hipR[0] - hc) * nar };
    const pose = {}; let drop = 0;
    for (const s of ['L', 'R']) {
      // стоячи ступні трохи ширше за (зведені) стегна — природна стійка, не «струнко»
      const spread = o.neutral ? 0 : (s === 'L' ? -9 : 9) * (1 - o.wk);
      const f = footPath(legs[s], S, lift), A = [R['ankle' + s][0] + f.dx + sx[s] + spread, R['ankle' + s][1] + f.dy];
      // reach < довжини ноги: таз трохи нижче, коліна в опорі ледь зігнуті (пряма «ходуля» виглядає дерев'яно)
      const H = add(R['hip' + s], [sx[s], 0]), tl = len(sub(R['knee' + s], R['hip' + s])), sl = len(sub(R['ankle' + s], R['knee' + s])), reach = (tl + sl) * (0.985 - 0.04 * o.wk);
      const dx = A[0] - H[0], need = (A[1] - H[1]) - Math.sqrt(Math.max(0, reach * reach - dx * dx));
      drop = Math.max(drop, need); pose[s] = { f, A, tl, sl };
    }
    const dY = [0, drop - (o.hop || 0)];
    const draw = (part, J, pivot, th, far) => {
      const tx = G.tex(T(part));
      L.sprite(T(part), 0, 0, { m: M.mul(Mroot, M.of(M.t(J[0], J[1]), M.r(th))), w: tx.w, h: tx.h, pivot,
        u: far ? { tint: [0.78, 0.74, 0.72, 1] } : {} }); };
    const legPose = (s) => { const H = add(add(R['hip' + s], [sx[s], 0]), dY), p = pose[s], K = ik(H, p.A, p.tl, p.sl);
      return { H, K, A: p.A, th1: ang(sub(K, H)) - ang(sub(R['knee' + s], R['hip' + s])),
        th2: ang(sub(p.A, K)) - ang(sub(R['ankle' + s], R['knee' + s])), pitch: p.f.pitch, fwd: p.f.fwd }; };
    const leg = (s, far) => { const q = legPose(s);
      draw('thigh' + s, q.H, R['hip' + s], q.th1, far); draw('shin' + s, q.K, R['knee' + s], q.th2, far);
      draw('foot' + s, q.A, R['ankle' + s], q.pitch, far); return q; };
    // руки махають у протифазі до своєї ноги; лікоть трохи згинається, коли рука йде вперед
    const armPose = (s, q) => { let sw = (s === 'R' ? 0.2 : 0.14) * o.wk * q.fwd + 0.03 * Math.sin((o.t || 0) * 1.7 + (s === 'L' ? 1 : 0)) * (1 - o.wk);
      let bend = -0.1 - 0.22 * o.wk * Math.max(0, -q.fwd);
      const ov = o.arms && o.arms[s]; if (ov) { sw = ov[0]; if (ov[1] !== undefined) bend = ov[1]; }   // задана поза рук (жест)
      const Sh = add(R['sh' + s], dY), E = add(Sh, rot(sub(R['elbow' + s], R['sh' + s]), sw));
      return { Sh, E, sw, bend, Hd: add(E, rot(sub(R['hand' + s], R['elbow' + s]), sw + bend)) }; };
    const arm = (s, a, far) => { draw('uarm' + s, a.Sh, R['sh' + s], a.sw, far); draw('farm' + s, a.E, R['elbow' + s], a.sw + a.bend, far); };

    // порядок (глибина): дальня рука → плече ближньої → обидві ноги (під халатом) → тіло → передпліччя ближньої
    const qL = legPose('L'), qR = legPose('R'), aL = armPose('L', qL), aR = armPose('R', qR);
    let tr = null, topPt = null, sheetHand = null;
    if (o.top) {
      // ВЕРХ — цілий намальований малюнок (руки природно намальовані разом із тілом), руки згинаються «м'якими кістками»
      // у шейдері: кожен піксель руки повертається навколо плеча на кут × вагу (ваги — softbones.py), без шва й «наліпки».
      // Ноги — окремі частини під халатом (малюємо раніше, халат їх накриває).
      const tp = o.top, tx = G.tex(tp.tex), k = R.h / tx.h, uv = (p) => [p[0] / tx.w, p[1] / tx.h];
      const Mt = M.mul(Mroot, M.of(M.t(tp.ox + dY[0], dY[1]), M.s(k, k)));
      if (tp.back) L.sprite(tp.tex + '__back', 0, 0, { m: Mt, w: tx.w, h: tx.h });   // підкладка спинки халата — позаду ніг
      leg('L', true); leg('R', false);
      L.sprite(tp.tex, 0, 0, { m: Mt, w: tx.w, h: tx.h });                             // тіло (під руками — домальований халат)
      L.sprite(tp.tex + '_arms', 0, 0, { m: Mt, w: tx.w, h: tx.h, pad: tp.pad || 0.06,  // руки окремим шаром, гнуться кістками (pad — запас квадрата під піднятою рукою)
        u: { wtex: G.tex(tp.tex + '_arms_w'), wsz: [tx.w, tx.h], bone0: [...uv(tp.near), aR.sw, 1], bone1: [...uv(tp.far), aL.sw, 1], bone2: [...uv(tp.elbow), aR.bend + 0.1, 1] } });
      if (tp.rigid) {
        // ближня рука — два жорсткі шматки (tools/make_top.py): плече крутиться навколо плечового суглоба, передпліччя —
        // навколо ліктя, який їде разом із плечем. Матриці в px текстури: T(суглоб) · R(кут) · T(−суглоб)
        const turn = (c, a) => M.of(M.t(c[0], c[1]), M.r(a), M.t(-c[0], -c[1]));
        const Mu = M.mul(Mt, turn(tp.near, aR.sw)), Mf = M.mul(Mu, turn(tp.elbow, aR.bend + 0.1)), bl = o.armBlend || 0;
        if (bl < 1) { L.sprite(tp.tex + '__armU', 0, 0, { m: Mu, w: tx.w, h: tx.h, u: { alpha: 1 - bl } });
          L.sprite(tp.tex + '__armF', 0, 0, { m: Mf, w: tx.w, h: tx.h, u: { alpha: 1 - bl } }); }
        if (bl > 0) {
          // На час жесту (замах, ковток) плавно підміняємо руку з якоря ПОВНОЮ рукою з аркуша частин: у ракурсі 3/4 з якоря
          // видно лише вузьку смужку рукава (решта за тілом), і відведена від тіла вона виглядає «сухою».
          // Рука з аркуша: плече — у плечовому суглобі якоря, масштаб — під довжину руки якоря, кути — від того самого
          // спокою (δu, δf — різниця напрямків рукава на аркуші й на якорі), тож жест той самий.
          const Cj = (p) => [tp.ox + p[0] * k, p[1] * k + dY[1]], J = Cj(tp.near);
          const sc = (len(sub(tp.handR, tp.elbow)) + len(sub(tp.elbow, tp.near))) * k / (len(sub(R.handR, R.elbowR)) + len(sub(R.elbowR, R.shR)));
          const du = ang(sub(tp.elbow, tp.near)) - ang(sub(R.elbowR, R.shR)), df = ang(sub(tp.handR, tp.elbow)) - ang(sub(R.handR, R.elbowR));
          const a1 = aR.sw + du, a2 = aR.sw + aR.bend + 0.1 + df, E = add(J, rot(sub(R.elbowR, R.shR), a1).map((v) => v * sc));
          const part = (n, P, piv, a) => { const t2 = G.tex(T(n));
            L.sprite(T(n), 0, 0, { m: M.mul(Mroot, M.of(M.t(P[0], P[1]), M.s(sc, sc), M.r(a))), w: t2.w, h: t2.h, pivot: piv, u: { alpha: bl } }); };
          part('uarmR', J, R.shR, a1); part('farmR', E, R.elbowR, a2);
          sheetHand = add(E, rot(sub(R.handR, R.elbowR), a2).map((v) => v * sc));
        }
      }
      // суглоби рук для QA: пряме відображення кісток (плече нерухоме, лікоть і кисть повертаються)
      const C = (p) => [tp.ox + p[0] * k, p[1] * k + dY[1]]; topPt = (p) => at(C(p)); const R2 = (p, c, a) => add(c, rot(sub(p, c), a));
      const eR = R2(tp.elbow, tp.near, aR.sw), hR = R2(R2(tp.handR, tp.elbow, aR.bend + 0.1), tp.near, aR.sw);
      tr = { shR: C(tp.near), elbowR: C(eR), handR: C(hR), shL: C(tp.far), elbowL: C(R2(tp.elbowL, tp.far, aL.sw)), handL: C(R2(tp.handL, tp.far, aL.sw)) };
    } else {
      // ближня рука: плече — ЗА тулубом (виходить з-під плеча халата), передпліччя — попереду
      arm('L', aL, true); draw('uarmR', aR.Sh, R.shR, aR.sw, false); leg('L', true); leg('R', false);
      const tb = G.tex(T('body')); L.sprite(T('body'), 0, 0, { m: M.mul(Mroot, M.t(dY[0], dY[1])), w: tb.w, h: tb.h });
      draw('farmR', aR.E, R.elbowR, aR.sw + aR.bend, false);
    }

    // QA: суглоби в екранних координатах (qa.mjs міряє ковзання ступнів, кульгання, коліна, махи рук)
    if (L.TRACE && o.id) { const j = (n, p) => L.joint(o.id, n, at(p));
      j('ground', [cx, R.h]); j('head', add(R.head, dY)); j('hip', [cx, R.hipL[1] + dY[1]]);
      for (const [s, q, a] of [['L', qL, aL], ['R', qR, aR]]) {
        j('hip' + s, q.H); j('knee' + s, q.K); j('ankle' + s, q.A);
        j('heel' + s, add(q.A, rot(sub(R['heel' + s], R['ankle' + s]), q.pitch))); j('toe' + s, add(q.A, rot(sub(R['toe' + s], R['ankle' + s]), q.pitch)));
        if (tr) { j('sh' + s, tr['sh' + s]); j('elbow' + s, tr['elbow' + s]); j('hand' + s, tr['hand' + s]); }
        else { j('sh' + s, a.Sh); j('elbow' + s, a.E); j('hand' + s, a.Hd); } } }
    // точки для реквізиту (ключ у руці Двічі, пробірка Мирона, світіння бороди й очей)
    // кисть: з руки аркуша, коли жест показує її (armBlend > 0.5), інакше з якоря
    const hand = sheetHand && o.armBlend > 0.5 ? sheetHand : tr ? tr.handR : aR.Hd;
    return { hand: at(hand), ang: o.face * (aR.sw + aR.bend + (tr ? 0.1 : 0)), top: topPt };
  };

  // Лише ноги, що стирчать з-під машини НА ГЛЯДАЧА (герой лежить на спині під машиною). Ті самі частини, що й у ходи:
  // нога «звисає» вниз по екрану, але вкорочена по вертикалі (ракурс — вона лежить на підлозі до нас), черевик носком
  // догори. o: { x, y — де ноги виходять з-під машини (екран); gap — відстань між ногами; wig: 0…1 — ступні ворушаться;
  // tap — фаза, щоб ступні ворушились не в такт }
  P.lying = (name, o) => {
    const R = RIGS[name], T = (part) => name + '__' + part, F = o.fore || 0.55;   // F — вкорочення ніг у ракурсі
    for (const [s, dx, far] of [['L', -(o.gap || 46) / 2, true], ['R', (o.gap || 46) / 2, false]]) {
      const H = R['hip' + s], K = R['knee' + s], A = R['ankle' + s];
      const Ml = M.of(M.t(o.x + dx, o.y), M.s(1, F), M.t(-H[0], -H[1]));          // нога у своїх px, вкорочена по y
      const u = far ? { tint: [0.78, 0.74, 0.72, 1] } : {};
      for (const part of ['thigh', 'shin']) { const tx = G.tex(T(part + s));
        L.sprite(T(part + s), 0, 0, { m: Ml, w: tx.w, h: tx.h, u }); }
      // черевик — без вкорочення, носком угору; ворушиться навколо щиколотки (лікті «крутять» щось там, під машиною)
      const ank = M.ap(Ml, A), tx = G.tex(T('foot' + s));
      const sway = (o.wig || 0) * 0.35 * Math.sin((o.tap || 0) + (far ? 2.1 : 0));
      L.sprite(T('foot' + s), 0, 0, { m: M.of(M.t(ank[0], ank[1]), M.r(-Math.PI / 2 + sway), M.t(-A[0], -A[1])), w: tx.w, h: tx.h, u });
    }
  };
})();
