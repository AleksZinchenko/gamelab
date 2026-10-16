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
  // wk — 0 стоїть … 1 іде; cycle — довжина циклу (два кроки) у px; id — ім'я для QA-трасування; lift; t — час }
  P.walker = (name, o) => {
    const R = RIGS[name], T = (part) => name + '__' + part;
    const cycle = o.cycle || 180, S = STANCE * cycle * o.wk, lift = (o.lift || 26) * o.wk;   // крок і висота підйому ступні
    const ph = (o.dist / cycle) % 1, legs = { L: (ph + 0.5) % 1, R: ph };
    const cx = (R.footL[0] + R.footR[0]) / 2;                                 // точка опори = між ступнями
    const Mroot = M.of(M.t(o.x, o.y), M.s(o.face, 1), M.t(-cx, -R.h));
    const at = (pt) => M.ap(Mroot, pt);
    // куди ставимо щиколотки + наскільки опустити таз, щоб опорна нога не «розтягувалась» (таз їде на опорній нозі)
    const pose = {}; let drop = 0;
    for (const s of ['L', 'R']) {
      // стоячи ноги трохи ширше за стегна (природна стійка, не «струнко»); neutral — точно як намальовано (еталон для QA)
      const spread = o.neutral ? 0 : (s === 'L' ? -9 : 9) * (1 - o.wk);
      const f = footPath(legs[s], S, lift), A = [R['ankle' + s][0] + f.dx + spread, R['ankle' + s][1] + f.dy];
      const H = R['hip' + s], tl = len(sub(R['knee' + s], H)), sl = len(sub(R['ankle' + s], R['knee' + s])), reach = (tl + sl) * 0.985;
      const dx = A[0] - H[0], need = (A[1] - H[1]) - Math.sqrt(Math.max(0, reach * reach - dx * dx));
      drop = Math.max(drop, need); pose[s] = { f, A, tl, sl };
    }
    const dY = [0, drop - (o.hop || 0)];
    const draw = (part, J, pivot, th, far) => {
      const tx = G.tex(T(part));
      L.sprite(T(part), 0, 0, { m: M.mul(Mroot, M.of(M.t(J[0], J[1]), M.r(th))), w: tx.w, h: tx.h, pivot,
        u: far ? { tint: [0.78, 0.74, 0.72, 1] } : {} }); };
    const legPose = (s) => { const H = add(R['hip' + s], dY), p = pose[s], K = ik(H, p.A, p.tl, p.sl);
      return { H, K, A: p.A, th1: ang(sub(K, H)) - ang(sub(R['knee' + s], R['hip' + s])),
        th2: ang(sub(p.A, K)) - ang(sub(R['ankle' + s], R['knee' + s])), pitch: p.f.pitch, fwd: p.f.fwd }; };
    const leg = (s, far) => { const q = legPose(s);
      draw('thigh' + s, q.H, R['hip' + s], q.th1, far); draw('shin' + s, q.K, R['knee' + s], q.th2, far);
      draw('foot' + s, q.A, R['ankle' + s], q.pitch, far); return q; };
    // руки махають у протифазі до своєї ноги; лікоть трохи згинається, коли рука йде вперед
    const armPose = (s, q) => { const sw = (s === 'R' ? 0.2 : 0.14) * o.wk * q.fwd + 0.03 * Math.sin((o.t || 0) * 1.7 + (s === 'L' ? 1 : 0)) * (1 - o.wk);
      const Sh = add(R['sh' + s], dY), E = add(Sh, rot(sub(R['elbow' + s], R['sh' + s]), sw)), bend = -0.1 - 0.22 * o.wk * Math.max(0, -q.fwd);
      return { Sh, E, sw, bend, Hd: add(E, rot(sub(R['hand' + s], R['elbow' + s]), sw + bend)) }; };
    const arm = (s, a, far) => { draw('uarm' + s, a.Sh, R['sh' + s], a.sw, far); draw('farm' + s, a.E, R['elbow' + s], a.sw + a.bend, far); };

    // порядок (глибина): дальня рука → плече ближньої → обидві ноги (під халатом) → тіло → передпліччя ближньої
    const qL = legPose('L'), qR = legPose('R'), aL = armPose('L', qL), aR = armPose('R', qR);
    let tr = null;
    if (o.top) {
      // ВЕРХ — цілий намальований малюнок (руки природно намальовані разом із тілом), руки згинаються «м'якими кістками»
      // у шейдері: кожен піксель руки повертається навколо плеча на кут × вагу (ваги — softbones.py), без шва й «наліпки».
      // Ноги — окремі частини під халатом (малюємо раніше, халат їх накриває).
      const tp = o.top, tx = G.tex(tp.tex), k = R.h / tx.h, uv = (p) => [p[0] / tx.w, p[1] / tx.h];
      leg('L', true); leg('R', false);
      const Mt = M.mul(Mroot, M.of(M.t(tp.ox + dY[0], dY[1]), M.s(k, k)));
      L.sprite(tp.tex, 0, 0, { m: Mt, w: tx.w, h: tx.h });                             // тіло (під руками — домальований халат)
      L.sprite(tp.tex + '_arms', 0, 0, { m: Mt, w: tx.w, h: tx.h, pad: 0.06,            // руки окремим шаром, гнуться кістками
        u: { wtex: G.tex(tp.tex + '_arms_w'), wsz: [tx.w, tx.h], bone0: [...uv(tp.near), aR.sw, 1], bone1: [...uv(tp.far), aL.sw, 1], bone2: [...uv(tp.elbow), aR.bend + 0.1, 1] } });
      // суглоби рук для QA: пряме відображення кісток (плече нерухоме, лікоть і кисть повертаються)
      const C = (p) => [tp.ox + p[0] * k, p[1] * k + dY[1]], R2 = (p, c, a) => add(c, rot(sub(p, c), a));
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
  };
})();
