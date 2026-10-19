// live/scene.js — МАЛЮВАННЯ зрізу (greybox: прямокутники замість картинок). Чиста функція від часу й стану гри:
// той самий стан → той самий кадр. Порядок: кімната → герої → темрява зі світлом → ефекти → інтерфейс.
// Коли прийде справжня графіка, прямокутники тут замінимо на спрайти — логіка (sim.js) не зміниться.
(function () {
  const S = (window.SCENE = {}), L = LIB, W = SIM.VIEW.W, H = SIM.VIEW.H;
  const { HOT, PRO, ITEMS, RW } = SIM.STORY;
  const C = {                                   // палітра greybox — з біблії стилю (тепла ніч)
    wall: [0.20, 0.25, 0.25], wall2: [0.15, 0.19, 0.20], floor: [0.30, 0.24, 0.15], floor2: [0.22, 0.17, 0.10],
    wood: [0.36, 0.25, 0.14], metal: [0.36, 0.38, 0.36], night: [0.07, 0.11, 0.22], paper: [0.93, 0.88, 0.76],
    coat: [0.88, 0.85, 0.78], ink: [0.12, 0.09, 0.06], copper: [0.62, 0.38, 0.18], glass: [0.45, 0.62, 0.70],
  };
  // Темрява: повноекранний шар, у якому «вирізані» плями світла (до 10 джерел). Пишемо свій шейдер — рушій це дозволяє
  const DARK = `
uniform vec4 u_L[10]; uniform float u_n, u_dark;
void main(){ float lit = 0.0;
  for (int i = 0; i < 10; i++){ if (float(i) >= u_n) break; vec4 l = u_L[i];
    float d = length(v_px - l.xy) / l.z; lit += l.w * (1.0 - smoothstep(0.1, 1.0, d)); }
  lit += (vnoise(v_px * 0.015 + u_t * 0.25) - 0.5) * 0.08;               // ледь «живий» морок, щоб не був пласким
  float a = u_dark * (1.0 - clamp(lit, 0.0, 0.93)); o = vec4(vec3(0.01, 0.015, 0.035) * a, a); }`;

  S.programs = () => { L.init(W, H, { dark: DARK }); L.glyphs(); };
  S.JPG = ['bg_room_a', 'bg_room_b'];            // ці текстури вантажимо з JPEG (див. index.html, tools/jpg.py)

  // ---------- маленькі помічники малювання ----------
  let cam = 0; const X = (wx) => wx - cam;                       // координати кімнати → екран
  const box = (x, y, w, h, col, r = 8, a = 1, col2) => L.rrect(X(x), y, w, h, r, col, col2 || col.map((v) => v * 0.8), a);
  // sign: напис, що належить кімнаті (табличка, підпис greybox). Малюємо текстуру напряму, без L.label —
  // інакше перевірка інтерфейсу (qa.mjs) вважала б таблички на стінах «текстом HUD, що вилазить за екран»
  const sign = (slot, s, sx, y, o) => { const tw = L.labelW(slot, s, o), tx = G.tex('lbl_' + slot), pad = Math.ceil((o.size || 30) * 0.3);
    L.sprite('lbl_' + slot, Math.round(sx - tw * (o.al === undefined ? 0.5 : o.al)) - pad, Math.round(y - tx.h / 2), { w: tx.w, h: tx.h, u: { alpha: o.a === undefined ? 1 : o.a } }); };
  const tag = (slot, s, wx, y, size = 22, a = 0.9) => sign(slot, s, X(wx), y, { size, a, col: '#efe2c4', out: '#1a120b' });
  const plate = (slot, s, wx, y, size) => sign(slot, s, X(wx), y, { size, col: '#2a1d12', out: '' });   // табличка на папері
  const age = (ST, k) => { let a = -1; for (const e of ST.ev) if (e.k === k) a = ST.t - e.t; return a; };   // скільки с від події
  // ---------- бульбашки-думки (як у Machinarium): намальована рамка + олівцеві піктограми ----------
  // Рядки бульбашок у sim/story пишемо «мовою емодзі» — тут кожен знак замінюємо на намальовану піктограму.
  // Знаки без піктограми (🌙, 9:00, ×2…) лишаються текстом — так нічого не губиться.
  const ICON = { '🔧': 'p_wrench', '📏': 'p_ruler', '☕': 'p_cup', '🥪': 'p_sandwich', '💡': 'p_bulb', 'π': 'p_pi', '?': 'p_q',
    '✖': 'p_x', '✔': 'p_ok', '🧪': 'p_tube', '🪑': 'p_chair', '⚡': 'p_bolt', '🕘': 'p_clock', '🏛': 'p_building', '🐀': 'p_rat',
    '🦎': 'p_axel', '😆': 'p_axel', '🦵': 'p_legs', '🎒': 'p_bag', '👁': 'p_eye', '🧔': 'p_beard', '📞': 'p_phone', '→': 'p_arrow',
    '←': 'p_arrow', '📓': 'hud_note' };
  const PEN = { col: '#3a3026', out: '', font: '"Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive', weight: 'bold' };   // «олівцевий» текст
  const toks = (str) => { const out = []; let txt = '';
    for (const ch of Array.from(str)) { if (ch === '️' || ch === '‍') continue;
      const ic = ICON[ch]; if (ic || ch === ' ') { if (txt) { out.push({ t: txt }); txt = ''; } if (ic) out.push({ i: ic, flip: ch === '←' }); } else txt += ch; }
    if (txt) out.push({ t: txt }); return out; };
  // ряд піктограм заввишки S: міряє (draw=false) або малює, x — лівий край, y — центр. Повертає ширину.
  const row = (slot, str, x, y, S, a = 1, draw = true) => { let cx = x; const gap = S * 0.16;
    toks(str).forEach((tk, k) => { if (k) cx += gap;
      if (tk.i) { const tx = G.tex(tk.i), w = Math.max(S * 0.55, S * tx.w / tx.h);
        if (draw) L.sprite(tk.i, cx, y - S / 2, { w, h: S, flip: tk.flip, u: { alpha: a } }); cx += w; }
      else { const o = Object.assign({ size: Math.round(S * 0.62) }, PEN), w = L.labelW(slot + k, tk.t, o);
        if (draw) L.label(slot + k, tk.t, cx, y, Object.assign({ a }, o)); cx += w; } });
    return cx - x; };
  // бульбашка над героєм: (x, y) — куди веде хвостик (над головою). age — для «вистрибування» з пружинкою
  const bubble = (slot, str, x, y, a = 1, S = 104, age = 1) => {
    const cw = row(slot, str, 0, 0, S, a, false), round = cw < S * 1.3;
    const bw = round ? Math.max(cw, S) + 120 : cw + 190, bh = round ? bw : S + 130;
    const k = Math.min(1, 0.6 + age * 4) * (1 + 0.12 * Math.exp(-7 * age) * Math.sin(16 * age));   // пружинка при появі
    const by = y - 150, cx = Math.max(bw / 2 + 20, Math.min(W - bw / 2 - 20, x));               // не вилазить за край екрана
    // хвостик: три кружечки від голови до бульбашки
    [['bub_t3', 0.0, 34], ['bub_t2', 0.45, 50], ['bub_t1', 0.85, 66]].forEach(([n, q, d]) => {
      const tx = x + (cx - x) * q, ty = y - 20 - 120 * q; L.sprite(n, tx - d / 2, ty - d / 2, { w: d, h: d, u: { alpha: a } }); });
    L.sprite(round ? 'bub_round' : 'bub_oval', cx - bw * k / 2, by - bh * k, { w: bw * k, h: bh * k, u: { alpha: a } });
    L.uiBox(slot, cx - bw / 2, by - bh, bw, bh, 0);
    row(slot, str, cx - cw / 2, by - bh / 2, S * k, a); };

  // ---------- кімната ----------
  // Фон — намальована панорама з двох текстур (tools/stitch.py зшив їх по трубі). Поверх фону малюємо лише те,
  // що змінюється (рубильник, папір із факсу, Аксель, ключ, тост) або має читатися як текст (таблички).
  function room(ST, t) {
    const aw = SIZES.bg_room_a[0];
    L.sprite('bg_room_a', X(0), 0, { w: aw, h: H }); L.sprite('bg_room_b', X(aw), 0, { w: SIZES.bg_room_b[0], h: H });
    const lit = ST.light;
    // табличка на шафі МНП: свій папірець поверх намальованого (той замалий, щоб напис читався)
    L.solid(X(890), 418, 180, 104, C.paper, -0.03, 90, 52);
    plate('mnp1', 'МАТЕРІАЛИ', 980, 446, 18); plate('mnp2', 'НЕВІДОМОГО', 980, 471, 18); plate('mnp3', 'ПОХОДЖЕННЯ', 980, 496, 18);
    L.rrect(X(1300), 424, 150, 34, 3, [0.78, 0.66, 0.42], [0.62, 0.5, 0.3]); plate('door', 'ЛАБОРАТОРІЯ №3', 1375, 441, 16);
    // рубильник щитка: внизу — вимкнено, вгорі — увімкнено
    L.solid(X(1646), lit ? 392 : 452, 10, 58, C.ink); L.rrect(X(1640), lit ? 384 : 500, 22, 18, 6, [0.6, 0.15, 0.1], [0.45, 0.1, 0.08]);
    // факс друкує перший рядок чекліста, коли світло повернулось
    const fa = lit ? Math.min(1, (ST.t - ST.lightT - 1.5) / 3) : 0;
    if (fa > 0) { L.rrect(X(1120), 548 - 130 * fa, 84, 130 * fa, 2, C.paper, C.paper);
      if (fa > 0.5) plate('faxl', 'УСТАНОВКА', 1162, 548 - 130 * fa + 22, 13); }
    // кристал у машині дихає світлом
    L.glow(X(2123), 480, 150, [0.4, 0.7, 1], 0.22 + 0.08 * Math.sin(t * 2.3)); L.star(X(2123), 480, 50 + 6 * Math.sin(t * 2.3), [0.6, 0.85, 1], 0.6);
    axel(ST, t);
    if (ST.key === 'floor') L.star(X(2895), 578, 24 + 6 * Math.sin(t * 5), [1, 0.85, 0.5], 0.9);          // ключ блищить на дні
    if (ST.mi.st !== 'follow') chair(2460, 770);                                                          // крісло на коліщатках (поки greybox)
    const toast = age(ST, 'toast'); if (toast >= 0 && toast < 1.4) {                                       // тост вистрілює в стелю
      const q = toast / 1.4, yy = 630 - 900 * q + 700 * q * q; box(2950, yy, 46, 38, [0.8, 0.6, 0.3], 8); }
  }

  // крісло на коліщатках (поки greybox): sy — верх сидіння; спинка — з боку спини того, хто сидить (face — куди дивиться)
  function chair(wx, sy, face = -1) { const wood = [0.45, 0.25, 0.18], wood2 = [0.35, 0.2, 0.14];
    L.rrect(X(wx - face * 38 - 9), sy - 120, 18, 126, 8, wood, wood2);                                 // спинка
    L.rrect(X(wx - 50), sy, 100, 20, 8, wood, wood2);                                                  // сидіння
    L.solid(X(wx - 4), sy + 20, 8, 862 - sy, C.ink); L.solid(X(wx - 46), 880, 92, 7, C.ink);          // ніжка й хрестовина
    L.rrect(X(wx - 50), 886, 14, 14, 7, C.ink, C.ink); L.rrect(X(wx + 36), 886, 14, 14, 7, C.ink, C.ink); }   // коліщата

  function axel(ST, t) {                                         // Аксель: плаває на одній позначці (підказка до пульта), хвіст хвилею
    const [w, h] = SIZES.axel_anchor, ax = 2895 + 50 * Math.sin(t * 0.7), ay = 545 + 5 * Math.sin(t * 1.9), back = Math.cos(t * 0.7) < 0;
    L.sprite('axel_anchor', X(ax) - w / 2, ay - h / 2, { w, h, pad: 0.1, flip: back, u: { sway: [0.08, 7, t * 4.2, 3] } });
    if (ST.key === 'aqua') { const kx = ax + (back ? -1 : 1) * w * 0.42;   // ключ — іграшка Акселя, блищить біля мордочки
      L.sprite('it_wrench', X(kx) - 9, ay - 2, { w: 18, h: 52, rot: back ? 0.9 : -0.9, pivot: [9, 26] }); L.star(X(kx), ay + 6, 16, [1, 0.9, 0.6], 0.5 + 0.3 * Math.sin(t * 4)); }
  }

  // Верх Ліни з якоря (px текстури lina_top): плечі — корені кісток рук, лікоть, кисті; ox — зсув, щоб ступні якоря
  // збіглися з ногами маріонетки (виміряно: середина ступнів якоря 80.3 px, ніг маріонетки 64.5 px)
  const LINA_TOP = { tex: 'lina_top', ox: -15.8, near: [398, 367], far: [138, 367], elbow: [425, 622], handR: [443, 822], elbowL: [138, 640], handL: [138, 827] };
  // Двічі й Мирон — так само (tools/make_top.py + art/softbones.json); ox — щоб ноги маріонетки стали під ступні якоря.
  // rigid — ближня рука жорсткими шматками (великі жести: замах ключем, пробірка до рота), дальня — м'якими кістками
  const DVICHI_TOP = { tex: 'dvichi_top', ox: -34.7, near: [578, 330], far: [112, 333], elbow: [650, 520], handR: [700, 790], elbowL: [87, 563], handL: [67, 823], rigid: 1 };
  const MIRON_TOP = { tex: 'miron_top', ox: -24.6, near: [440, 330], far: [106, 314], elbow: [495, 505], handR: [555, 770], elbowL: [91, 534], handL: [91, 774], rigid: 1 };
  const MI_PX = { eyeN: [304, 101], eyeF: [347, 96], beard: [351, 214] };   // точки на текстурі верху Мирона: очі, борода
  // ключові кадри → значення (лінійно з плавним входом-виходом), K = [[час, значення], ...]
  const kf = (K, x) => { if (x <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (x <= K[i][0]) {
    const q = (x - K[i - 1][0]) / (K[i][0] - K[i - 1][0]), e = q * q * (3 - 2 * q); return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * e; }
    return K[K.length - 1][1]; };
  // замах ключем (кут плеча; мінус = рука вперед-угору): два удари — у 0.4 і 0.9 с, як події 'hit' у sim.js
  const HIT = [[0, 0], [0.25, -2.7], [0.4, -1.75], [0.65, -2.7], [0.9, -1.75], [1.3, -0.3], [1.6, 0]];
  // ковток: рука з пробіркою до рота (0.3 с), сьорбає (0.5 с), опускає (0.4 с); s = 0 рука внизу … 1 пробірка біля рота
  const SIP = [[0, 0], [0.3, 1], [0.8, 1], [1.2, 0]];
  let miPts = null;                                              // де зараз очі й борода Мирона (для світіння в темряві)

  // ---------- герої (greybox: капсули з підписами; силуети різні, як у characters.md) ----------
  function people(ST, t) {
    // Академік — високий і тонкий, спить головою на столі
    { const [w, h] = SIZES.akademik_anchor, br = Math.sin(t * 1.3);      // повільне дихання сплячого
      L.sprite('akademik_anchor', X(380), 520, { w, h, pad: 0.04, u: { bulge: [0.62, 0.42, 0.32, 0.035 * (0.5 + 0.5 * br)] } }); }
    if (!ST.light || ST.phase === 'pro') { const z = (t * 0.5) % 1, zs = 34 + 40 * z;   // олівцеві «z-z-Z» спливають над головою
      L.sprite('p_zzz', X(400 + 40 * z), 500 - 90 * z - zs, { w: zs * 1.2, h: zs, u: { alpha: 0.85 * Math.sin(Math.PI * z) } }); }

    // Двічі — маріонетка: лежить під машиною (видно лише ноги) → вилазить → іде до щитка → б'є ключем двічі
    const d = ST.dv, da = ST.t - d.t0;
    if (d.st === 'legs' || (d.st === 'out' && da < 0.6)) {
      const q = d.st === 'out' ? da / 0.6 : 0, wig = d.st === 'legs' ? Math.max(0, Math.sin(t * 6)) ** 3 : 0;   // коліна смикаються — щось крутить
      PUPPET.lying('dvichi', { x: X(2215 - 80 * q), y: 914, face: -1, wig });
      L.shadow(X(2240 - 80 * q), 906, 64, 30, 0.9);                                                     // темна щілина під машиною ховає таз
      tag('n_dv', 'Двічі', 2140, 985, 20, 0.6); }
    else {
      const up = d.st === 'out' ? da - 0.6 : 9;                                                         // щойно підвівся: пил з-під ніг
      if (up < 0.5) for (let j = 0; j < 4; j++) L.ring(X(d.x - 60 + j * 40), 900 - 30 * up, 14 + 50 * up, 8 + 20 * up, [0.8, 0.7, 0.55], 0.5 * (1 - up / 0.5));
      const arms = d.st === 'hit' ? { R: [kf(HIT, da), -0.25] } : null;
      L.shadow(X(d.x), 896, 80, 16, 0.35);
      const P = PUPPET.walker('dvichi', { x: X(d.x), y: d.st === 'out' ? 900 : d.y, face: -1, dist: Math.abs(2150 - d.x), wk: d.st === 'walk' ? 1 : 0,
        cycle: 150, lift: 20, t, arms, top: DVICHI_TOP });
      L.sprite('it_wrench', P.hand[0] - 14, P.hand[1] - 12, { w: 28, h: 80, rot: P.ang, pivot: [14, 12] });   // ключ у руці: росте з кулака вздовж передпліччя
      tag('n_dv', 'Двічі', d.x, d.y + 30, 20, 0.6); }

    // Мирон — маріонетка з пробіркою в руці: сьорбає (після кожного ковтка Ліни й зрідка сам), іде до крісла й їде на ньому
    const m = ST.mi, rid = m.st === 'follow', sa = age(ST, 'sip'), mface = rid ? (ST.lx < m.x ? -1 : 1) : -1;
    const own = (t % 7.3) / 1.2;                                                                        // «для себе» — раз на ~7 с
    const sp = sa >= 0 && sa < 1.2 ? kf(SIP, sa) : m.st === 'stand' && own < 1 ? kf(SIP, own * 1.2) * 0.8 : 0;
    if (rid) chair(m.x - 14 * mface, 760, mface);                                                       // їде, стоячи на хрестовині крісла, як на самокаті
    L.shadow(X(m.x), 896, 70, 15, 0.35);
    // ковток: плече вперед-угору (лікоть піднятий), передпліччя через груди — кисть із пробіркою біля рота (кути пораховані
    // за двома довжинами руки, як IK); sp плавно веде від опущеної руки до рота
    const MP = PUPPET.walker('miron', { x: X(m.x), y: rid ? 876 + Math.sin(t * 3) * 2 : 900, face: mface, dist: Math.abs(3185 - m.x),
      wk: m.st === 'tochair' && ST.t - m.t0 > 1.2 ? 1 : 0, cycle: 210, t, arms: { R: [-1.7 * sp, -0.1 - 2.44 * sp] }, top: MIRON_TOP });
    L.sprite('it_tube', MP.hand[0] - 9, MP.hand[1] - 40, { w: 18, h: 80, rot: MP.ang, pivot: [9, 40] });   // пробірка в пальцях
    miPts = { eyeN: MP.top(MI_PX.eyeN), eyeF: MP.top(MI_PX.eyeF), beard: MP.top(MI_PX.beard) };
    if (m.lit) { const b = miPts.beard; L.glow(b[0], b[1], 150, [0.65, 0.35, 1], 0.45 + 0.1 * Math.sin(t * 3)); }   // борода світиться фіолетовим
    tag('n_mi', 'Мирон', m.x, 925, 20, 0.6);
    // Ліна — маріонетка з намальованих частин (live/puppet.js): хода з кроками, що не ковзають, і махом рук
    const hop = ST.phase === 'pro' ? Math.max(0, Math.sin(Math.min(1, Math.max(0, (ST.pt - PRO.JUMP) / 0.5)) * Math.PI)) * 90 : 0;
    L.shadow(X(ST.lx), ST.ly - 4, 70, 14, 0.35 * (1 - hop / 180));                                   // м'яка тінь під ногами
    PUPPET.walker('lina', { x: X(ST.lx), y: ST.ly, face: ST.face, dist: ST.dist, wk: ST.wk, cycle: 180, hop, t, id: 'lina', neutral: ST.neutral, top: LINA_TOP });
  }

  // ---------- темрява й кольорові плями світла ----------
  function darkness(ST, t) {
    let dk = 0;
    if (ST.phase === 'pro') dk = ST.pt >= PRO.BITE ? 1 : 0;
    else if (!ST.light) dk = 1;
    else { const a = ST.t - ST.lightT; dk = a < 0.5 ? (Math.sin(a * 60) > 0 ? 0.8 : 0.2) * (1 - a / 0.5) : 0; }   // світло «моргає» при вмиканні
    if (dk <= 0) return;
    const Ls = SIM.lights(ST).map(([x, y, r, w]) => [X(x), y, r, w]);
    Ls.push([X(ST.lx), ST.ly - 140, 230, 0.45]);                 // очі звикають: саму Ліну трохи видно
    const u = []; Ls.slice(0, 10).forEach((l) => u.push(...l)); while (u.length < 40) u.push(0, 0, 1, 0);
    G.full(L.P.dark, { u_L: u, u_n: Math.min(10, Ls.length), u_dark: dk, u_t: t });
    L.glow(X(2123), 480, 420, [0.25, 0.45, 0.9], 0.35 * dk); L.glow(X(2895), 535, 200, [0.3, 0.6, 0.7], 0.25 * dk);
    if (ST.mi.lit) L.glow(miPts.beard[0], miPts.beard[1], 380, [0.6, 0.3, 0.95], 0.45 * dk);
    else { const bl = Math.sin(t * 0.9) > 0.97 ? 0 : 1;           // очі Мирона світяться в темряві (і зрідка кліпають)
      L.glow(miPts.eyeN[0], miPts.eyeN[1], 12, [1, 0.9, 0.6], 0.9 * dk * bl); L.glow(miPts.eyeF[0], miPts.eyeF[1], 10, [1, 0.9, 0.6], 0.8 * dk * bl); }
  }

  // ---------- ефекти з подій (S.ev): кожна подія має свій «сік» (juice) ----------
  function fx(ST) {
    for (const e of ST.ev) { const a = ST.t - e.t; if (a < 0) continue;
      if (e.k === 'tap' && a < 0.35) L.ring(X(e.x), e.y, 16 + 40 * a / 0.35, 16 + 40 * a / 0.35, [1, 1, 1], 0.5 * (1 - a / 0.35));
      if ((e.k === 'hit' || e.k === 'spark' || e.k === 'switch') && a < 0.5) for (let j = 0; j < 7; j++) {
        const an = j * 0.9 + e.t * 7, d = 20 + 120 * a; L.star(X(e.x) + Math.cos(an) * d, e.y + Math.sin(an) * d + 200 * a * a, 16, [1, 0.85, 0.4], 1 - a / 0.5); }
      if ((e.k === 'tickle' || e.k === 'sip') && a < 1.2) for (let j = 0; j < 5; j++) L.ring(X(e.x + (j - 2) * 22), e.y - 90 * a - j * 14, 8 + j * 2, 8 + j * 2, [0.85, 0.95, 1], 0.6 * (1 - a / 1.2));
      if (e.k === 'beard' && a < 1) L.ring(X(e.x), e.y, 60 + 260 * a, 60 + 260 * a, [0.7, 0.4, 1], 1 - a);
      if (e.k === 'light' && a < 0.8) L.glow(W / 2, H / 2, 1400, [1, 0.9, 0.7], 0.5 * (1 - a / 0.8));
      if (e.k === 'bonk' && a < 1.2) { L.solid(X(1600), 300, 14, 80 - 30 * Math.abs(Math.sin(a * 9)), C.metal); L.star(X(e.x), e.y + 10, 30, [1, 1, 0.6], 1 - a / 1.2); }
    }
  }

  // ---------- інтерфейс: пролог (картки), рюкзак і нотатник, фінальна картка ----------
  function card(c, a, slot, dx = 0, dy = 0, rot = 0) {
    const sN = { size: 46, col: '#2a1d12', out: '' }, sR = { size: 32, col: '#5a4630', out: '' }, sI = { size: 52, col: '#2a1d12', out: '' };   // ті самі стилі для виміру й малювання
    const tw = Math.max(L.labelW(slot + 'n', c.name, sN), L.labelW(slot + 'r', c.role, sR), row(slot + 'i', c.ico, 0, 0, 70, 1, false));
    const w = 210 + tw + 50, h = 270;                                 // розмір — під текст (ширину не вгадуємо)
    const x = Math.max(20, Math.min(W - w - 20, X(c.x) + 120)) + dx, y = Math.max(20, Math.min(H - h - 20, c.y - 300)) + dy;
    L.solid(x, y, w, h, C.paper, rot, w / 2, h / 2, a);
    L.rrect(x + 30, y + 34, 156, 200, 8, c.empty ? [0.75, 0.72, 0.66] : [0.55, 0.5, 0.45], undefined, a);   // «фото» на перепустці
    if (c.empty) L.sprite('p_tube', x + 78, y + 84, { w: 60, h: 100, u: { alpha: a } });   // на фото Мирона — лише пробірка в повітрі
    else L.label(slot + 'p', c.name[0], x + 108, y + 134, { size: 88, al: 0.5, a, col: '#efe2c4', out: '#2a1d12' });
    L.uiBox(slot, x, y, w, h, 0);
    L.label(slot + 'n', c.name, x + 212, y + 68, Object.assign({ a }, sN));
    L.label(slot + 'r', c.role, x + 212, y + 128, Object.assign({ a }, sR));
    row(slot + 'i', c.ico, x + 212, y + 200, 70, a);
  }
  function hudPrologue(ST, t) {
    const p = ST.pt;
    if (p < PRO.EXT + 0.6) { const a = p < PRO.EXT ? 1 : 1 - (p - PRO.EXT) / 0.6;                                     // заставка: будівля НДІ вночі
      L.rrect(0, 0, W, H, 0, C.night, [0.03, 0.05, 0.1], a); L.rrect(W / 2 - 360, 260, 720, 420, 8, [0.22, 0.24, 0.3], undefined, a);
      L.rrect(W / 2 + 120, 380, 70, 90, 4, [1, 0.8, 0.45], undefined, a);                          // одне світле вікно
      L.label('ndi', 'НДІ ПРИКЛАДНОЇ НЕВИЗНАЧЕНОСТІ', W / 2, 190, { size: 62, al: 0.5, a });
      L.rrect(W / 2 - 400 + 300 * Math.min(1, p / PRO.EXT), 640, 26, 40, 10, [0.3, 0.2, 0.15], undefined, a); }   // фігурка з рюкзаком біжить
    PRO.CARDS.forEach((c, i) => { if (p < c.t0 || p > c.t1) return; const a = Math.min(1, (p - c.t0) / 0.15, (c.t1 - p) / 0.2);
      const again = c.twice && p > c.t0 + 0.5;                                                        // картка Двічі вискакує двічі
      card(c, again ? Math.min(a, (p - c.t0 - 0.5) / 0.1) : a, 'c' + i, again ? 30 : 0, again ? 24 : 0,
        again ? -0.06 : c.crooked ? (p - c.t0 < 1.2 ? 0.09 : 0.09 * Math.max(0, 1 - (p - c.t0 - 1.2) / 0.25)) : 0); });
    if (p > PRO.CUP[0] && p < PRO.CUP[1]) bubble('cup', '☕ ✖', X(ST.lx), ST.ly - 430, 1, 104, p - PRO.CUP[0]);                           // чашка не влазить на блюдце
    if (p > PRO.RING[0] && p < PRO.RING[1]) { bubble('boss', '🏛 9:00 ⚡ ⚡', X(1195), 430, 1, 120, p - PRO.RING[0]);
      card({ x: 1250, y: 760, name: 'ШЕФ', role: '(ніхто ніколи не бачив)', ico: '📞' }, 1, 'cboss'); }
    if (p > PRO.CAL[0] && p < PRO.CAL[1]) card({ x: cam - 90, y: 260, name: 'ІНСПЕКЦІЯ', role: 'завтра', ico: '09:00' }, 1, 'ccal');
    if (p > PRO.RAT[0] && p < PRO.RAT[1]) { const q = (p - PRO.RAT[0]) / (PRO.RAT[1] - PRO.RAT[0]), rx = 500 + 1200 * Math.min(1, q * 1.15);
      { const [w, h] = SIZES.rat_anchor, gal = Math.abs(Math.sin(p * 26)) * 5;              // щуриця з Дозволом у зубах біжить кабелем
        L.sprite('rat_anchor', X(rx) - w / 2, 126 - h - gal, { w, h, pad: 0.12, u: { sway: [0.12, 9, p * 30, 3] } }); }
      if (p < PRO.JUMP + 1.4) card({ x: rx, y: 420, name: 'РОЗШУКУЄТЬСЯ', role: "ОБ'ЄКТ R", ico: '🐀 📄' }, 1, 'crat');
      if (p > PRO.JUMP) bubble('scare', '🐀 ✖', X(ST.lx), ST.ly - 520, 1, 104, p - PRO.JUMP); }
    if (p > PRO.TITLE[0]) L.label('title', 'ПЕРЕД ІНСПЕКЦІЄЮ', W / 2, H / 2, { size: 80, al: 0.5, a: Math.min(1, (p - PRO.TITLE[0]) / 0.6) });
    if (p > 0.6) L.label('skip', 'тап — пропустити', W - 30, H - 46, { size: 34, al: 1, a: 0.7 });
  }
  // мерехтіння: по черзі на кожній речі, яку можна чіпати (і яку зараз видно), — «тут щось є»
  function shimmer(ST, t) {
    HOT.forEach((h, i) => { const r = SIM.rectOf(ST, h); if (!r) return; const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
      if (!SIM.seen(ST, cx, cy) || X(cx) < 0 || X(cx) > W) return;
      const ph = (t + i * 0.83) % 4.6; if (ph > 0.7) return; const k = Math.sin(Math.PI * ph / 0.7);
      L.star(X(cx + (L.rnd(i, 1) - 0.5) * r[2] * 0.5), cy - r[3] * 0.25, 26 * k + 6, [1, 0.95, 0.8], 0.55 * k); });
  }
  // палець-підказка: пульсує й «тапає» в точку (екранні px)
  function finger(x, y, t, a = 1) { const q = (t * 1.3) % 1, press = q > 0.55 && q < 0.75;
    L.ring(x, y, 30 + 50 * q, 30 + 50 * q, [1, 1, 1], 0.7 * (1 - q) * a, 0.12); L.glow(x, y, 60, [1, 0.95, 0.8], 0.35 * a);
    L.label('finger', '👆', x + 18, y + (press ? 50 : 66), { size: 84, al: 0.5, a, out: '' }); }
  // стрілка до цілі підказки: на ціль, якщо вона на екрані, або з краю екрана в її бік
  function pointTo(ST, id, t, a) { const h = HOT.find((q) => q.id === id), r = h && SIM.rectOf(ST, h); if (!r) return;
    const sx = X(r[0] + r[2] / 2), sy = r[1] + r[3] / 2;
    if (sx > 60 && sx < W - 60) { finger(sx, sy, t, a); return; }
    const right = sx >= W - 60, ex = right ? W - 70 : 70, bob = Math.sin(t * 8) * 14 * (right ? 1 : -1);
    L.glow(ex, 560, 90, [1, 0.9, 0.6], 0.5 * a); L.label('edge', right ? '▶' : '◀', ex + bob, 560, { size: 110, al: 0.5, a, col: '#ffe9b0' }); }

  function hudPlay(ST, t) {
    // рюкзак: шкіряна панель з іконкою 🎒 і речами
    const [bx, by, bw, bh] = SIM.HUD.bag, n = ST.inv.length, pw = bw + 18 + n * 162;
    L.rrect(bx - 8, by - 8, pw, bh + 16, 26, [0.36, 0.25, 0.15], [0.24, 0.16, 0.09], 0.9); L.uiBox('bag', bx - 8, by - 8, pw, bh + 16, 0);
    const bagPop = age(ST, 'bag'), bp = bagPop >= 0 && bagPop < 0.4 ? Math.sin(bagPop / 0.4 * Math.PI) * 10 : 0;
    L.rrect(bx + 6, by + 6, bw - 12, bh - 12, (bw - 12) / 2, [0.62, 0.48, 0.3], [0.5, 0.37, 0.22], 0.9);   // світліша «підкладка», щоб коричневий рюкзак не зливався з панеллю
    L.sprite('hud_bag', bx + 18, by + 8 - bp, { h: bh - 16 });
    ST.inv.forEach((it, i) => { const [x, y, w, h] = SIM.HUD.slot(i), dragging = ST.drag && ST.drag.item === it && ST.drag.moved > 24;
      L.rrect(x, y, w, h, 20, [0.93, 0.86, 0.7], [0.82, 0.74, 0.58], 0.95); L.uiBox('s' + i, x, y, w, h, 0);
      const tx = G.tex(ITEMS[it].spr), k = Math.min((w - 24) / tx.w, (h - 24) / tx.h);
      L.sprite(ITEMS[it].spr, x + (w - tx.w * k) / 2, y + (h - tx.h * k) / 2, { w: tx.w * k, h: tx.h * k, u: { alpha: dragging ? 0.3 : 1 } }); });
    const [nx, ny, nw, nh] = SIM.HUD.note;                                         // нотатник = підказки
    L.rrect(nx, ny, nw, nh, 26, [0.36, 0.25, 0.15], [0.24, 0.16, 0.09], 0.9); L.uiBox('note', nx, ny, nw, nh, 0);
    L.sprite('hud_note', nx + 26, ny + 10, { h: nh - 20 });
    if (ST.drag && ST.drag.moved > 24) { const n = ITEMS[ST.drag.item].spr, tx = G.tex(n), k = 170 / Math.max(tx.w, tx.h);
      L.sprite(n, ST.drag.x - tx.w * k / 2, ST.drag.y - tx.h * k - 10, { w: tx.w * k, h: tx.h * k }); }
    const who = { lina: [ST.lx, ST.ly - 430], aka: [470, 500], dv: ST.dv.st === 'legs' ? [2140, 820] : [ST.dv.x, ST.dv.y - 360], mi: [ST.mi.x, 330], ax: [2895, 450] };
    for (const b of ST.bub) { const a = ST.t - b.t0; if (a > b.dur) continue; const [x, y] = who[b.who];
      bubble('bub_' + b.who, b.s, X(x), Math.max(330, y), Math.min(1, a / 0.12, (b.dur - a) / 0.3), 104, a); }
    // навчання без слів: 0 — тапни підлогу; 1 — тапни річ; 2 — перетягни з рюкзака (рука «несе» річ)
    if (ST.phase === 'dark' && !ST.tx) {
      if (ST.tut === 0) finger(Math.min(W - 200, X(ST.lx) + 380), 930, t);
      else if (ST.tut === 1) { let best = null, bd = 1e9;
        for (const h of HOT) { const r = SIM.rectOf(ST, h); if (!r || h.id === 'machine') continue; const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
          const d = Math.abs(cx - ST.lx); if (SIM.seen(ST, cx, cy) && X(cx) > 120 && X(cx) < W - 120 && d < bd) { bd = d; best = [X(cx), cy]; } }
        if (best) finger(best[0], best[1], t); }
      else if (ST.tut === 2 && ST.t - ST.tutT > 2.5) { const q = ((ST.t - ST.tutT - 2.5) % 3) / 2.2; if (q <= 1) {
        const [sx, sy] = SIM.HUD.slot(0), e = q * q * (3 - 2 * q), x = sx + 75 + (W / 2 - sx - 75) * e, y = sy + 75 + (620 - sy - 75) * e;
        const n = ITEMS[ST.inv[0]].spr, tx = G.tex(n), k = 150 / Math.max(tx.w, tx.h); L.sprite(n, x - tx.w * k / 2, y - tx.h * k - 10, { w: tx.w * k, h: tx.h * k, u: { alpha: 0.85 } }); L.label('tuth', '👆', x + 20, y + 40, { size: 84, al: 0.5, out: '' }); } }
    }
    const ha = ST.t - ST.hintT; if (ST.hintId && ha < 3.5) pointTo(ST, ST.hintId, t, Math.min(1, (3.5 - ha) / 0.5));
  }
  function hudEnd(ST) {
    L.rrect(0, 0, W, H, 0, [0, 0, 0], undefined, 0.45);
    L.rrect(W / 2 - 380, 300, 760, 440, 10, C.paper); L.uiBox('end', W / 2 - 380, 300, 760, 440, 0);
    L.label('e1', '✔ УСТАНОВКА', W / 2, 400, { size: 52, al: 0.5, col: '#2a1d12', out: '' });
    L.label('e2', 'Кінець вертикального зрізу', W / 2, 500, { size: 34, al: 0.5, col: '#5a4630', out: '' });
    L.label('e3', 'тап — грати знову', W / 2, 620, { size: 30, al: 0.5, col: '#5a4630', out: '' });
  }

  S.render = (t) => {
    const ST = S.state || SIM.at(t);
    cam = ST.camX;
    L.beginBG([0.1, 0.1, 0.1, 1]); L.beginComp();
    room(ST, t); people(ST, t); darkness(ST, t); fx(ST); if (ST.phase === 'dark' || ST.phase === 'lit') shimmer(ST, t);
    L.finish(t, { bloom: [0.12, 0.1], vignette: 0.9 });
    if (ST.phase === 'pro') hudPrologue(ST, t); else if (ST.phase === 'end') hudEnd(ST); else hudPlay(ST, t);
  };

  // QA-стани для qa.mjs: кожен екран інтерфейсу з найдовшими рядками (картки, бульбашки, фінал)
  S.QA = () => {
    const adv = (s, secs, inp = {}) => { while (s.t < secs) SIM.step(s, inp); return s; };
    const play = (o) => { const s = SIM.create(); s.pt = PRO.END - 0.01; adv(s, 0.2); return Object.assign(s, o); };
    const states = [['pro_card', adv(SIM.create(), 9.3)], ['pro_twice', adv(SIM.create(), 13)], ['pro_lina', adv(SIM.create(), 23.5)],
      ['pro_boss', adv(SIM.create(), 26.6)], ['pro_rat', adv(SIM.create(), 28.8)], ['dark', play()],
      ['bubble_long', play({ bub: [{ who: 'dv', s: '🔧→👧  🔧←  🔧→👧', t0: 0.1, dur: 9 }], dv: { st: 'idle', x: 1740, y: 900, t0: 0 } })]];
    // цикл ходи Ліни: 8 кадрів через рівні відрізки шляху (один цикл = 180 px = два кроки), камера їде слідом
    const walkAt = (d) => play({ light: 1, lightT: -99, phase: 'lit', lx: 1200 + d, ly: 905, dist: d, wk: 1, tx: 3000, ty: 905, face: 1, camX: 1200 - W / 2, hintId: null, tut: 3 });   // камера стоїть — героїня справді йде кадром
    const LINA = ['body', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'uarmL', 'uarmR', 'farmL', 'farmR'].map((n) => 'lina__' + n);
    return { states, cycles: { lina_walk: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => walkAt(i * 22.5)) }, cycleT: { lina_walk: 0.5 },
      subject: { lina_walk: 'lina' }, actors: ['lina'], sprites: { lina_walk: LINA },
      rest: { lina_walk: Object.assign(walkAt(0), { wk: 0, tx: null, neutral: true }) }, box: () => [0, 0, W, H] };
  };
})();
