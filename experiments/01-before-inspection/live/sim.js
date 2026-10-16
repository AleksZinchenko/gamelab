// live/sim.js — ЛОГІКА зрізу «Пролог + Акт I» (greybox). Усе, що «відбувається»: ходьба Ліни, рюкзак,
// перетягування речей, пролог зі стоп-кадрами, темрява, обидва шляхи до світла, демо-режим, що грає сам.
// Контракт рушія ref2game: детерміновані кроки по 1/120 с (однаковий вхід → однаковий результат),
// create/step/at/spawn/scriptInput, події для ефектів у S.ev. Дані сцени — у story.js.
(function (root) {
  const STORY = root.STORY || require('./story.js');
  const { RW, FLOOR, HOT, ITEMS, LIGHTS, PRO, LOOK, WRONG, HINTS } = STORY;
  const DT = 1 / 120, VIEW = { W: 1920, H: 1080 };
  const L = 57;                          // довжина демо-циклу (с): пролог + проходження + кілька секунд фінальної картки
  const WALK = 360;                      // швидкість ходьби Ліни, px/с
  const LINA_Y = 905;                    // типовий y, куди Ліна стає біля предметів
  // Кнопки інтерфейсу (екранні px з 1920×1080). Великі — під палець на телефоні: 150 px ≈ 55 px на екрані телефона.
  // Ліворуч — рюкзак 🎒 і речі в ньому, праворуч — нотатник 📓 (підказки).
  const HUD = { bag: [36, 30, 150, 150], note: [1734, 30, 150, 150], slot: (i) => [204 + i * 162, 30, 150, 150] };   // відступ від країв: на телефоні краї ховає виріз/рамка
  const HINT = 'Тап — грати. Тап по підлозі — йти, по предмету — роздивитись. Перетягни річ з рюкзака на предмет.';

  // ---------- стан гри (звичайний JSON-об'єкт: його можна зберегти й відновити) ----------
  const create = () => ({
    t: 0, steps: 0, wt0: 0, ev: [], phase: 'pro', pt: 0,          // phase: pro (пролог) → dark (темрява) → lit (світло) → end
    camX: PRO.CAM[0][1], camV: 0,                                  // камера: x лівого краю екрана + швидкість (пружина)
    lx: 1375, ly: 900, face: -1, tx: null, ty: null, pend: null,   // Ліна: позиція, куди дивиться, ціль ходьби, відкладена дія
    dist: 0, wk: 0,                                                // пройдена відстань (фаза кроку) і «наскільки йде» 0…1 (для маріонетки)
    inv: ['ruler', 'cup'], drag: null, px: 960, py: 540, press: 0, // рюкзак і вказівник (палець/миша)
    key: 'aqua',                                                    // де ключ: aqua (в Акселя) → floor (на дні) → inv (у Ліни)
    dv: { st: 'legs', x: 2150, y: 930, t0: 0 },                    // Двічі: legs → out → walk → hit → idle
    mi: { st: 'stand', sips: 0, x: 3185, y: 900, lit: 0, t0: 0 },  // Мирон: stand → tochair → follow (світить бородою)
    light: 0, lightT: -1, bub: [], busy: 0, botI: 0, botT: 0, hintI: 0,
    tut: 0, tutT: 0, idle: 0, hintId: null, hintT: -9,            // навчання без слів (0 йти → 1 тапнути річ → 2 перетягнути → 3 вміє) і підказки
  });
  const spawn = (worldT) => Object.assign(create(), { wt0: worldT });

  // ---------- дрібні помічники ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, q) => a + (b - a) * q;
  const ev = (S, k, x, y, o) => { S.ev.push(Object.assign({ k, t: S.t, x, y }, o)); if (S.ev.length > 64) S.ev.splice(0, S.ev.length - 64); };
  // бульбашка-думка над героєм (who: lina / aka / dv / mi / ax); замість слів — піктограми
  const say = (S, who, s, dur = 2.2) => { S.bub = S.bub.filter((b) => b.who !== who && S.t - b.t0 < b.dur); S.bub.push({ who, s, t0: S.t, dur }); };
  // ключові кадри [[час, значення…]] → значення в момент t (плавно, smoothstep між кадрами)
  const keys = (K, t, i = 1) => { if (t <= K[0][0]) return K[0][i]; for (let k = 1; k < K.length; k++) if (t < K[k][0]) {
    const q = (t - K[k - 1][0]) / (K[k][0] - K[k - 1][0]), e = q * q * (3 - 2 * q); return lerp(K[k - 1][i], K[k][i], e); } return K[K.length - 1][i]; };

  // гаряча точка: її прямокутник зараз (деякі рухаються або зникають)
  const rectOf = (S, h) => {
    if (h.id === 'legs' && S.dv.st !== 'legs') return null;          // Двічі вже виліз
    if (h.id === 'keyfloor' && S.key !== 'floor') return null;       // ключа на дні ще/вже нема
    if (h.id === 'miron') return [S.mi.x - 75, 400, 150, 480];        // Мирон ходить і їздить на кріслі
    if (h.id === 'chair' && S.mi.st === 'follow') return null;       // крісло зайняте Мироном
    return h.r;
  };
  // що під точкою кімнати (wx, wy): найменший прямокутник, що її містить (дрібне «перемагає» велике)
  const hotAt = (S, wx, wy) => { let best = null, area = 1e12;
    for (const h of HOT) { const r = rectOf(S, h); if (!r) continue;
      if (wx >= r[0] && wx <= r[0] + r[2] && wy >= r[1] && wy <= r[1] + r[3] && r[2] * r[3] < area) { best = h; area = r[2] * r[3]; } }
    return best; };
  const hot = (id) => HOT.find((h) => h.id === id);
  const inBox = (b, x, y) => x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];

  // Джерела світла зараз (у темряві): постійні + борода Мирона, якщо він її «увімкнув»
  const lights = (S) => { const a = Object.values(LIGHTS); if (S.mi.lit) a.push([S.mi.x, 560, 560, 1]); return a; };
  // чи видно точку: при світлі — завжди; у темряві — лише в плямі світла
  const seen = (S, x, y) => S.light || lights(S).some(([lx, ly, r]) => Math.hypot(x - lx, y - ly) < r * 0.8);

  // ---------- команди гравця: «роздивитись/використати» (use) і «річ на предмет» (give) ----------
  function command(S, c) {
    if (S.busy > S.t) return;                                       // поки йде сценка (Двічі б'є щиток) — чекаємо
    if (c.v === 'walk') { S.tx = clamp(c.x, 60, RW - 60); S.ty = clamp(c.y, FLOOR[0], FLOOR[1]); S.pend = null; if (S.tut === 0) S.tut = 1; return; }
    const h = hot(c.id); if (!h) return;
    const r = rectOf(S, h); if (!r) return;
    ev(S, 'tap', r[0] + r[2] / 2, r[1] + r[3] / 2);
    // підійти до предмета; для Мирона на кріслі — до місця поруч із ним
    S.tx = h.id === 'miron' ? clamp(S.mi.x - 110, 60, RW - 60) : h.sx; S.ty = LINA_Y; S.pend = c;
  }

  // Дія, коли Ліна дійшла до предмета
  function perform(S, c) {
    const h = hot(c.id), r = rectOf(S, h); if (!r) return;
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
    if (S.tut < 2 && c.v === 'use') { S.tut = 2; S.tutT = S.t; }     // навчився тапати по речах → покажемо перетягування
    if (c.v === 'give') S.tut = 3;                                   // уже перетягує сам — навчання завершене
    S.face = cx < S.lx ? -1 : 1;
    // у темряві більшість речей не видно: Ліна мацає наосліп. Чути можна Академіка й телефон, Мирона видно по очах
    const blindOk = ['aka', 'phone', 'miron', 'door', 'keyfloor'].includes(c.id);
    if (!seen(S, cx, cy) && !blindOk) { say(S, 'lina', '👁 ?'); ev(S, 'grope', S.lx, S.ly); return; }

    if (c.v === 'give') {
      const it = c.item;
      if (it === 'ruler' && c.id === 'aqua' && S.key === 'aqua') {           // I-A крок 1: полоскотати Акселя лінійкою
        say(S, 'ax', '😆'); S.key = 'floor'; ev(S, 'tickle', cx, cy); S.busy = S.t + 1.2; return; }
      if (it === 'key' && c.id === 'legs') {                                  // I-A крок 2: ключ — Двічі
        say(S, 'dv', '🔧 ✔'); S.dv.st = 'out'; S.dv.t0 = S.t; S.busy = S.t + 7; ev(S, 'give', cx, cy); return; }
      if (it === 'key' && c.id === 'fuse' && !S.light) {                      // Ліна б'є щиток сама — щиток б'є її
        say(S, 'lina', WRONG['key:fuse'], 2.6); ev(S, 'bonk', S.lx, S.ly - 230); return; }
      say(S, 'lina', WRONG[it + ':' + c.id] || WRONG[it + ':*'] || '?'); ev(S, 'nope', S.lx, S.ly); return;
    }

    switch (c.id) {
      case 'keyfloor': S.key = 'inv'; S.inv.push('key'); say(S, 'lina', '🔧 ✔'); ev(S, 'pick', cx, cy); return;
      case 'aqua':                                                          // ключ у Акселя: рука не дістає (вода вища за край) → «а лінійкою?»
        if (S.key === 'aqua') { say(S, 'ax', '😆 🔧'); say(S, 'lina', '✋ ✖ → 📏 ?', 3); ev(S, 'reach', cx, cy); }
        else say(S, 'ax', '😆');
        ev(S, 'mimic', cx, cy); return;
      case 'legs': say(S, 'dv', '🔧 🔧 ?'); return;
      case 'aka': say(S, 'aka', LOOK.aka); ev(S, 'snore', 510, 600); return;
      case 'miron': {                                                         // I-B: три ковтки → борода світиться
        const m = S.mi;
        if (m.lit) { say(S, 'mi', '🧪 ✔'); return; }
        m.sips++; ev(S, 'sip', m.x, 560); say(S, 'mi', Array(m.sips).fill('🧪').join(' '), 1.4);
        if (m.sips >= 3) { m.lit = 1; m.st = 'tochair'; m.t0 = S.t; ev(S, 'beard', m.x, 560); say(S, 'mi', '💡 → 🪑', 2.4); }
        return; }
      case 'fuse':
        if (S.light) { say(S, 'lina', '⚡ ✔'); return; }
        // сюди доходимо лише якщо щиток видно — тобто Мирон-ліхтар поруч: піднімаємо рубильник
        ev(S, 'switch', cx, cy); setLight(S); say(S, 'lina', '💡 ✔'); return;
      case 'fax': say(S, 'lina', S.light ? '📠 ✔' : LOOK.fax); return;
      case 'toaster': ev(S, 'toast', cx, r[1]); say(S, 'lina', LOOK.toaster); return;
      case 'chair': ev(S, 'spin', cx, cy); say(S, 'lina', LOOK.chair); return;
      default: say(S, 'lina', LOOK[c.id] || '…');
    }
  }

  // Наступна корисна ціль (для підказок): що саме зараз просуне гру вперед
  function goal(S) {
    if (S.light || S.dv.st !== 'legs') return null;                  // світло є або Двічі вже йде до щитка
    if (S.key === 'inv') return 'legs';
    if (S.key === 'floor') return 'keyfloor';
    if (S.mi.st === 'follow') return 'fuse';
    if (S.mi.sips > 0) return 'miron';                                // уже почали поїти Мирона — допиваємо
    return ['legs', 'aqua', 'miron'][S.hintI % 3];                    // по черзі: що просить Двічі → ключ в акваріумі → Мирон
  }
  function hint(S, quiet) {
    const g = goal(S); if (!g) return;
    S.hintId = g; S.hintT = S.t; if (!quiet) { say(S, 'lina', '📓 ' + HINTS[g], 3); S.hintI++; }
  }

  function setLight(S) { if (S.light) return; S.light = 1; S.lightT = S.t; S.phase = 'lit'; ev(S, 'light', S.lx, S.ly); }

  // ---------- інтерфейс: тапи по екрану (нотатник, рюкзак, кімната) ----------
  function pointer(S, inp) {
    const wx = S.px + S.camX, wy = S.py;
    if (S.drag) {                                                   // тягнемо річ з рюкзака
      S.drag.x = S.px; S.drag.y = S.py; S.drag.moved = Math.max(S.drag.moved, Math.hypot(S.px - S.drag.sx, S.py - S.drag.sy));
      if (!S.press) {                                               // відпустили
        const it = S.drag.item, moved = S.drag.moved > 24; S.drag = null;
        if (!moved) { say(S, 'lina', ITEMS[it].ico + ' ?'); return; }      // просто тап по речі — Ліна її роздивляється
        const h = hotAt(S, wx, wy);
        if (h) command(S, { v: 'give', id: h.id, item: it }); else ev(S, 'drop', S.px, S.py);
      }
      return;
    }
    if (!inp.click) return;
    if (inBox(HUD.note, S.px, S.py)) { hint(S); return; }           // нотатник = підказка + стрілка, куди йти
    if (inBox(HUD.bag, S.px, S.py)) { say(S, 'lina', '🎒 → ' + S.inv.map((i) => ITEMS[i].ico).join(' '), 2); ev(S, 'bag', 93, 93); return; }
    for (let i = 0; i < S.inv.length; i++) if (inBox(HUD.slot(i), S.px, S.py)) {
      S.drag = { item: S.inv[i], sx: S.px, sy: S.py, x: S.px, y: S.py, moved: 0 }; return; }
    const h = hotAt(S, wx, wy);
    if (h) command(S, { v: 'use', id: h.id }); else { command(S, { v: 'walk', x: wx, y: wy }); ev(S, 'tap', wx, clamp(wy, FLOOR[0], FLOOR[1])); }
  }

  // ---------- один крок симуляції (1/120 с) ----------
  function step(S, inp) {
    const t = S.t + DT;
    if (inp.px !== undefined) { S.px = inp.px; S.py = inp.py; }
    S.press = inp.press ? 1 : 0;
    S.t = t; S.steps++;

    if (S.phase === 'pro') { prologue(S, inp); return S; }
    if (S.phase === 'end') { if (inp.click) Object.assign(S, create(), { wt0: S.wt0 + S.t }); return S; }

    if (inp.cmd && inp.cmdI === S.botI) { S.botI++; S.botT = S.t; command(S, inp.cmd); }   // демо-«гравець»
    else pointer(S, inp);
    S.idle = inp.click || S.drag || inp.cmd ? 0 : S.idle + DT;
    if (S.idle > 14 && !S.light) { hint(S, true); S.idle = 0; }        // гравець задумався — нотатник сам підказує

    // ходьба: рівномірно до цілі, на місці — виконати відкладену дію
    if (S.tx !== null) {
      const dx = S.tx - S.lx, dy = S.ty - S.ly, d = Math.hypot(dx, dy), s = WALK * DT;
      if (Math.abs(dx) > 2) S.face = dx < 0 ? -1 : 1;
      if (d <= s) { S.lx = S.tx; S.ly = S.ty; S.tx = null; const p = S.pend; S.pend = null; if (p) perform(S, p); }
      else { S.lx += dx / d * s; S.ly += dy / d * s; }
      S.dist += Math.min(d, s);
    }
    S.wk += ((S.tx !== null ? 1 : 0) - S.wk) * Math.min(1, DT * 12);   // плавно між «стоїть» і «йде» (без ривка в позі)
    actors(S);
    if (S.introT && S.t - S.introT >= 2.6 && S.t - DT - S.introT < 2.6) say(S, 'dv', '🔧 🔧 ?', 3);   // а Двічі з-під машини кличе ключ
    // камера тримає Ліну ближче до центру; пружина з критичним загасанням — без ривків і без «гойдання»
    const goal = clamp(S.lx - VIEW.W / 2, 0, RW - VIEW.W), k = 18;
    S.camV += (k * k * (goal - S.camX) - 2 * k * S.camV) * DT; S.camX += S.camV * DT;
    if (S.light && S.t - S.lightT > 8) S.phase = 'end';               // факс надрукував «УСТАНОВКА» → фінальна картка зрізу
    return S;
  }

  // Двічі й Мирон — маленькі «автомати станів» (FSM): кожен стан знає, що робити і коли перейти в наступний
  function actors(S) {
    const d = S.dv, m = S.mi, a = S.t - d.t0;
    if (d.st === 'out') { d.y = lerp(930, 900, clamp(a / 1, 0, 1)); if (a > 1.1) { d.st = 'walk'; d.t0 = S.t; } }
    else if (d.st === 'walk') { d.x -= 300 * DT; if (d.x <= 1690) { d.x = 1690; d.st = 'hit'; d.t0 = S.t; } }
    else if (d.st === 'hit') {                                       // б'є двічі (бо Двічі) — і світло вмикається
      if (a >= 0.4 && a - DT < 0.4) ev(S, 'hit', 1600, 450);
      if (a >= 0.9 && a - DT < 0.9) { ev(S, 'hit', 1600, 450); setLight(S); }
      if (a >= 1.6 && a - DT < 1.6) say(S, 'dv', '🔧 → 🎒 ← 🔧 → 🎒', 3);   // віддає ключ… забирає… віддає (двічі!)
      if (a > 1.6) d.st = 'idle'; }
    const ma = S.t - m.t0;
    if (m.st === 'tochair' && ma > 1.2) { m.x += Math.sign(2460 - m.x) * 260 * DT; if (Math.abs(m.x - 2460) < 4) { m.x = 2460; m.st = 'follow'; } }
    else if (m.st === 'follow' && !S.light) {                        // їде на кріслі слідом за Ліною, світячи бородою
      const goal = S.lx + (S.lx < m.x ? 170 : -170); m.x += clamp(goal - m.x, -420 * DT, 420 * DT); }
  }

  // Пролог: усе за таймлайном PRO (story.js); тап після 0.6 с — пропустити
  function prologue(S, inp) {
    S.pt += DT;
    if (inp.click && S.pt > 0.6) S.pt = PRO.END;
    S.camX = keys(PRO.CAM, S.pt);
    const ox = S.lx; S.lx = keys(PRO.LINA, S.pt, 1); S.ly = keys(PRO.LINA, S.pt, 2);
    const mv = Math.abs(S.lx - ox); S.dist += mv; if (mv > 0.01) S.face = S.lx < ox ? -1 : 1;
    S.wk += ((mv > 0.5 ? 1 : 0) - S.wk) * Math.min(1, DT * 12);
    if (S.pt >= PRO.BITE && S.pt - DT < PRO.BITE) ev(S, 'spark', 1700, 110);
    if (S.pt >= PRO.END) { S.phase = 'dark'; S.lx = 1150; S.ly = 900; S.face = -1; S.camV = 0; ev(S, 'dark', 1700, 110);
      S.introT = S.t; say(S, 'lina', '💡 ?', 2.4); }                  // мета з першої секунди: «треба світло»
  }

  // ---------- демо (attract): «бот» проходить шлях I-A з парою помилок для сміху ----------
  const ROUTE_A = [{ v: 'use', id: 'fuse' }, { v: 'use', id: 'aka' }, { v: 'give', id: 'aqua', item: 'ruler' },
    { v: 'use', id: 'keyfloor' }, { v: 'give', id: 'legs', item: 'key' }];
  const ROUTE_B = [{ v: 'use', id: 'miron' }, { v: 'use', id: 'miron' }, { v: 'use', id: 'miron' }, { v: 'use', id: 'fuse' }];
  const idle = (S) => S.phase !== 'pro' && S.tx === null && S.busy <= S.t && S.t - S.botT > 1.6;
  const botInput = (route) => (t, S) => (S && idle(S) && S.botI < route.length ? { cmd: route[S.botI], cmdI: S.botI } : {});
  const scriptInput = botInput(ROUTE_A);

  let cache = null;
  function at(t) {
    const loop = Math.floor(t / L), q = t - loop * L, n = Math.round(q / DT);
    if (!cache || cache.loop !== loop || cache.S.steps > n) cache = { loop, S: Object.assign(create(), { wt0: loop * L }) };
    const S = cache.S; while (S.steps < n) step(S, scriptInput(S.t, S));
    return Object.assign({}, S, { loop, q });
  }

  // Самоперевірка (node live/tune.cjs): обидва шляхи мають вмикати світло — тобто тупиків нема
  const run = (route, secs = 70) => { const S = create(); const inp = botInput(route); while (S.t < secs) step(S, inp(S.t, S)); return S; };
  const demoCheck = (S) => S.light === 1;
  const selfCheck = () => { const f = [];
    if (!run(ROUTE_A).light) f.push('шлях I-A (ключ з акваріума → Двічі) не вмикає світло');
    if (!run(ROUTE_B).light) f.push('шлях I-B (Мирон-ліхтар → щиток) не вмикає світло');
    return f; };

  root.SIM = { DT, L, VIEW, HINT, STORY, HUD, create, spawn, step, at, scriptInput, demoCheck, selfCheck, lights, rectOf, keys, seen, goal };
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
