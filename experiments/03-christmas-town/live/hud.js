// live/hud.js — інтерфейс: лічильники в грі (рукавички-життя, солодощі, шишки, хлопавки, подарунки, прикраси)
// і всі екрани-меню: головне меню, «Керування», пауза, «Вулицю врятовано!», фінал на площі. Стан меню — window.UI;
// index.html передає сюди клавіші й кліки, а назад отримує дію: 'start', 'resume', 'restart', 'again', 'tohub', 'tomenu'.
// На площі (хабі) свій HUD: торба з добром, що вже висить на ялинці, написи на табличках брам, підказка біля брами.
(function () {
  const L = LIB, SS = L.SS, W = SIM.VIEW.W, H = SIM.VIEW.H, LV = SIM.LV;
  // music — гучність музики (0..1); за замовчуванням 10 % (2026-11-11, побажання користувача; було 70 %)
  const UI = (window.UI = { mode: 'menu', sel: 0, t0: 0, now: 0, sound: true, music: 0.1, hits: [], hover: -1, fade: 0 });
  const CREAM = '#fbecc8', INK = '#2a0f12', GOLD = '#ffd66b';
  const ITEMS = {
    menu: () => [['play', 'Грати'], ['controls', 'Керування'], ['sound', 'Звук: ' + (UI.sound ? 'увімкнено' : 'вимкнено')], ['music', 'Музика: ' + Math.round(UI.music * 100) + '%'],
      ...(PROG.any() ? [['reset', 'Зняти прикраси (нова гра)']] : [])],
    // пауза на площі коротша; на вулиці можна повернутись на площу (крадене тоді лишається у злодюжок)
    pause: () => LV.HUB ? [['resume', 'Продовжити'], ['sound', 'Звук: ' + (UI.sound ? 'увімкнено' : 'вимкнено')], ['menu', 'Головне меню']]
      : [['resume', 'Продовжити'], ['restart', 'Почати рівень знову'], ['tohub', 'Повернутись на площу'], ['sound', 'Звук: ' + (UI.sound ? 'увімкнено' : 'вимкнено')], ['menu', 'Головне меню']],
    controls: () => [['back', 'Назад']],
    done: () => [['tohub', 'На площу з добром'], ['again', 'Пройти ще раз'], ['menu', 'Головне меню']],
    final: () => [['walk', 'Гуляти площею'], ['menu', 'Головне меню']],
  };
  UI.open = (mode) => { UI.mode = mode; UI.sel = 0; UI.t0 = UI.now; if (window.AUDIO) AUDIO.ui('open'); };
  // дія пункту меню → що робити грі (index.html)
  const activate = (id) => { if (window.AUDIO) AUDIO.ui('ok');
    if (id === 'play') return 'start';
    if (id === 'again') return 'again';
    if (id === 'tohub') return 'tohub';
    if (id === 'resume' || id === 'walk') return 'resume';
    if (id === 'reset') { PROG.reset(); UI.sel = 0; return null; }
    if (id === 'restart') return 'restart';
    if (id === 'menu') return 'tomenu';
    if (id === 'controls') { UI.open('controls'); return null; }
    if (id === 'back') { UI.open('menu'); UI.sel = 1; return null; }
    if (id === 'sound') { UI.sound = !UI.sound; if (window.AUDIO) AUDIO.apply(); return null; }
    if (id === 'music') { UI.music = UI.music >= 1 ? 0 : Math.round((UI.music + 0.1) * 10) / 10; if (window.AUDIO) AUDIO.apply(); return null; }
    return null; };
  UI.key = (c) => { const it = ITEMS[UI.mode] ? ITEMS[UI.mode]() : [];
    if (c === 'ArrowUp' || c === 'KeyW') { UI.sel = (UI.sel + it.length - 1) % it.length; if (window.AUDIO) AUDIO.ui('move'); return null; }
    if (c === 'ArrowDown' || c === 'KeyS') { UI.sel = (UI.sel + 1) % it.length; if (window.AUDIO) AUDIO.ui('move'); return null; }
    if ((c === 'ArrowLeft' || c === 'ArrowRight') && it[UI.sel] && it[UI.sel][0] === 'music') {
      UI.music = Math.max(0, Math.min(1, Math.round((UI.music + (c === 'ArrowLeft' ? -0.1 : 0.1)) * 10) / 10)); if (window.AUDIO) AUDIO.apply(); return null; }
    if (c === 'Escape') { if (UI.mode === 'pause' || UI.mode === 'final') return activate('resume'); if (UI.mode === 'controls') return activate('back'); return null; }
    if (c === 'Enter' || c === 'Space' || c === 'KeyX' || c === 'KeyJ') return it[UI.sel] ? activate(it[UI.sel][0]) : null;
    return null; };
  const hitAt = (x, y) => UI.hits.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  UI.move = (x, y) => { const i = hitAt(x, y); if (i >= 0 && i !== UI.sel) { UI.sel = i; if (window.AUDIO) AUDIO.ui('move'); } };
  UI.click = (x, y) => { const i = hitAt(x, y); if (i < 0) return null; UI.sel = i; return activate(UI.hits[i].id); };

  // ---------------- малювання ----------------
  const H_ = (window.HUD = {});
  const icon = (n, cx, cy, h, a = 1) => L.sprite(n, cx - L.hsz(n, h) / 2, cy - h / 2, { h, u: { alpha: a } });
  // панель під лічильником — розмір від вмісту (щоб довге число не вилізло за край)
  const counter = (slot, n, value, x, y, bump) => { const s = 40 * (1 + 0.25 * bump), tw = L.labelW(slot, value, { size: 40 }), w = 70 + tw + 26;
    L.rrect(x, y, w, 64, 20, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.72); L.uiBox(slot, x, y, w, 64, 4);
    icon(n, x + 38, y + 32, 46 * (1 + 0.2 * bump)); L.label(slot, value, x + 68, y + 33, { size: 40, col: CREAM, out: INK }); return w; };
  const bumpOf = (ST, GT, kinds) => { let b = 0; for (const e of ST.ev) if (kinds.includes(e.k)) { const a = GT - e.t; if (a >= 0 && a < 0.3) b = Math.max(b, 1 - a / 0.3); } return b; };

  // режим рендеру кадрів (?render=1, перевірки й відео): меню не малюємо; стан гри є — показуємо ігровий HUD
  const RENDER = new URLSearchParams(location.search).has('render');
  H_.draw = (ST, GT, t) => {
    UI.now = t; UI.hits = [];
    if (RENDER) UI.mode = SCENE.state ? 'play' : 'none';
    if ((UI.mode === 'play' || UI.mode === 'pause' || UI.mode === 'done' || UI.mode === 'final') && ST) (LV.HUB ? hudHub : hudPlay)(ST, GT, t);
    if (UI.mode === 'menu') menu(t);
    else if (UI.mode === 'controls') controls(t);
    else if (UI.mode === 'pause') { overlay('Пауза', ITEMS.pause(), t, 0.55); if (ST) pauseTips(ST, t); }
    else if (UI.mode === 'done') done(ST, GT, t);
    else if (UI.mode === 'final') final(ST, GT, t);
    if (UI.fade > 0.003) L.solid(0, 0, W, H, [0.01, 0.02, 0.05], 0, 0, 0, UI.fade);   // затемнення між площею і вулицею
  };

  // ---------------- HUD площі ----------------
  const ORN_N = ['orn_red', 'orn_gold', 'orn_blue'];
  function hudHub(ST, GT, t) {
    const sx = (x) => x - ST.cam, sy = (y) => y - ST.camY;
    // написи на табличках брам (дошку й стовп малює plaza.js у грі)
    LV.GATES.forEach((g, i) => { const b = PLAZA.signBox(g, i);
      L.label('gate' + i, g.name, sx(g.x), sy(b.y + b.h / 2), Object.assign({ al: 0.5, a: g.to ? 1 : 0.6 }, PLAZA.LBL)); });
    // біля брами — підказка над героєм
    const g = UI.mode === 'play' && !ST.exit && LV.GATES.find((q) => Math.abs(ST.x - q.x) < 110);
    if (g) { const s = g.to ? '↑  вирушити' : 'Зачинено — скоро!', o = { size: 30, col: g.to ? GOLD : CREAM, out: INK }, w = L.labelW('gp', s, o) + 40;
      const x = sx(ST.x), y = sy(ST.y) - 196 + 3 * Math.sin(t * 4);                      // над головою, під табличкою
      L.rrect(x - w / 2, y - 27, w, 54, 18, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.8); L.uiBox('gpbox', x - w / 2, y - 27, w, 54, 4);
      L.label('gp', s, x, y, Object.assign({ al: 0.5 }, o)); }
    // торба: скільки добра ще не на ялинці
    if (ST.bagQ.length) counter('bag', 'sack', '×' + ST.bagQ.length, 30, 28, bumpOf(ST, GT, ['hang']));
    // справа — що вже на ялинці: подарунки, зірка, прикраси (порожні слоти тьмяні — видно, чого бракує)
    const T = ST.tree, on = (v) => v !== -1 && GT >= v;
    // подарунки всіх рівнів + зірка; прикраси — рядок на кожен рівень (вулиця, дахи)
    const gs = [...T.gift.map((v, i) => [i % 2 ? 'gift_green' : 'gift_red', v]), ['star', T.star]], gw = gs.length * 62;
    const gx = W - 40 - gw; L.rrect(gx - 16, 24, gw + 26, 76, 22, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.72); L.uiBox('gifts', gx - 16, 24, gw + 26, 76, 0);
    gs.forEach(([n, v], i) => icon(n, gx + 28 + i * 62, 62, 48, on(v) ? 1 : 0.22));
    for (let r = 0; r * 5 < T.orn.length; r++) { const ox = W - 40 - 5 * 46, oy = 108 + r * 62;
      L.rrect(ox - 14, oy, 5 * 46 + 22, 56, 18, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.6); L.uiBox('orns' + r, ox - 14, oy, 5 * 46 + 22, 56, 0);
      for (let i = r * 5; i < Math.min(T.orn.length, r * 5 + 5); i++) icon(ORN_N[LV.TREE.ornKind(i)], ox + 18 + (i - r * 5) * 46, oy + 28, 40, on(T.orn[i]) ? 1 : 0.22); }
    const ht = ST.t; if (ht < 7 && UI.mode === 'play') { const a = SS(0, 0.5, ht) * (1 - SS(6, 7, ht)), s = LV.HINT, w = L.labelW('hint', s, { size: 28 }) + 40;
      L.rrect(W / 2 - w / 2, H - 92, w, 54, 18, [0.05, 0.06, 0.12], [0.02, 0.03, 0.07], 0.75 * a); L.uiBox('hint', W / 2 - w / 2, H - 92, w, 54, 4);
      L.label('hint', s, W / 2, H - 65, { size: 28, col: CREAM, out: INK, al: 0.5, a }); }
  }

  function hudPlay(ST, GT, t) {
    // рукавички-життя: втрачена — тьмяна й «падає»
    for (let i = 0; i < 3; i++) { const lost = i >= ST.hearts, hb = bumpOf(ST, GT, ['hurt']) * (i === ST.hearts ? 1 : 0);
      icon('mitten', 60 + i * 62, 60 + 10 * hb, 54 * (1 + 0.3 * hb), lost ? 0.25 : 1); }
    L.uiBox('hearts', 26, 26, 190, 70, 0);
    let x = 240; x += counter('sw', 'it_candy', String(ST.sw), x, 28, bumpOf(ST, GT, ['collect'])) + 14;
    x += counter('cn', 'cone', String(ST.cones), x, 28, bumpOf(ST, GT, ['shoot', 'ammo'])) + 14;
    counter('cr', 'cracker', String(ST.crackers), x, 28, bumpOf(ST, GT, ['toss', 'ammo']));
    // справа: 3 подарунки і 5 прикрас — порожні слоти видно (чого ще бракує)
    const GF = LV.GIFTS || ['gift_red', 'gift_green', 'star'], ng = GF.length;                     // скільки подарунків на рівні
    const gx = W - 40 - ng * 74; L.rrect(gx - 16, 24, ng * 74 + 26, 76, 22, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.72); L.uiBox('gifts', gx - 16, 24, ng * 74 + 26, 76, 0);
    GF.forEach((n, i) => { const g = ST.gifts[i], a = g >= 0 ? SS(0.5, 0.8, GT - g) : 0;
      icon(n, gx + 32 + i * 74, 62, 54 * (1 + 0.3 * Math.max(0, 1 - Math.abs(GT - g - 0.8) / 0.2) * (g >= 0 ? 1 : 0)), 0.22 + 0.78 * a); });
    const ox = W - 40 - 5 * 46; if (LV.ORNAMENTS.length) { L.rrect(ox - 14, 108, 5 * 46 + 22, 56, 18, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.6); L.uiBox('orns', ox - 14, 108, 5 * 46 + 22, 56, 0); }   // у вежі прикрас нема
    LV.ORNAMENTS.forEach(([, , k], i) => icon(['orn_red', 'orn_gold', 'orn_blue'][k], ox + 18 + i * 46, 136, 40, ST.orn[i] >= 0 ? 1 : 0.22));
    // підібраний подарунок/прикраса летить у свій слот (дуга від місця підбору)
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || a > 0.8 || (e.k !== 'gift' && e.k !== 'ornament')) continue;
      const q = SS(0, 1, a / 0.8), x0 = e.x - ST.cam, y0 = e.y - ST.camY, tx = e.k === 'gift' ? gx + 32 + e.i * 74 : ox + 18 + e.i * 46, ty = e.k === 'gift' ? 62 : 136;
      const cx = (x0 + tx) / 2, cy = Math.min(y0, ty) - 200, px = (1 - q) ** 2 * x0 + 2 * (1 - q) * q * cx + q * q * tx, py = (1 - q) ** 2 * y0 + 2 * (1 - q) * q * cy + q * q * ty;
      const n = e.k === 'gift' ? GF[e.i] : ['orn_red', 'orn_gold', 'orn_blue'][LV.ORNAMENTS[e.i][2]];
      L.glow(px, py, 60, [1, 0.8, 0.4], 0.6, 3); icon(n, px, py, 60 - 10 * q); }
    if (ST.boss && ST.boss.ph > 0) bossBar(ST, GT);
    // підказка на старті (зникає сама): спершу керування, далі (якщо є) — підказка самого рівня
    const ht0 = ST.t, lvh = LV.HINT && ht0 >= 6, ht = lvh ? ht0 - 6 : ht0;
    if (ht < 6 && UI.mode === 'play') { const a = SS(0, 0.5, ht) * (1 - SS(5, 6, ht)), s = lvh ? LV.HINT : SIM.HINT, w = L.labelW('hint', s, { size: 28 }) + 40;
      L.rrect(W / 2 - w / 2, H - 92, w, 54, 18, [0.05, 0.06, 0.12], [0.02, 0.03, 0.07], 0.75 * a); L.uiBox('hint', W / 2 - w / 2, H - 92, w, 54, 4);
      L.label('hint', s, W / 2, H - 65, { size: 28, col: CREAM, out: INK, al: 0.5, a }); }
  }

  function buttons(items, cx, y0, t, gap = 92) {
    const k = SS(0, 0.35, t - UI.t0);
    items.forEach(([id, label], i) => { const sel = i === UI.sel, sz = sel ? 46 : 40, tw = L.labelW('btn' + i, label, { size: sz, col: sel ? GOLD : CREAM, out: INK });
      const w = Math.max(420, tw + 120), h = 74, x = cx - w / 2, y = y0 + i * gap + (1 - k) * 40 * (i + 1), wob = sel ? 3 * Math.sin(t * 5) : 0;
      L.rrect(x, y, w, h, 26, sel ? [0.55, 0.12, 0.14] : [0.1, 0.12, 0.22], sel ? [0.32, 0.05, 0.08] : [0.05, 0.06, 0.12], (sel ? 0.95 : 0.75) * k);
      L.uiBox('btnbox' + i, x, y, w, h, 4); UI.hits.push({ id, x, y, w, h });
      if (sel) { icon('star', x + 42, y + h / 2 + wob, 40, k); icon('star', x + w - 42, y + h / 2 - wob, 40, k); }
      L.label('btn' + i, label, cx, y + h / 2, { size: sz, col: sel ? GOLD : CREAM, out: INK, al: 0.5, a: k }); });
  }

  // фінал: зірка на ялинці — підсумок і що далі
  function final(ST, GT, t) {
    const k = SS(0, 0.5, t - UI.t0); L.solid(0, 0, W, H, [0.01, 0.02, 0.05], 0, 0, 0, 0.35 * k);
    const w = 1100, h = 500, x = W / 2 - w / 2, y = 120; panel(x, y, w, h, k); L.uiBox('fin', x, y, w, h, 8);
    L.label('ft', 'Ялинка засяяла!', W / 2, y + 74, { size: 80, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k });
    L.label('fs', 'Зірка на місці — у містечку буде Різдво.', W / 2, y + 150, { size: 34, col: '#cfd8ff', out: '#0b1230', al: 0.5, a: k });
    const T = ST.tree, n = (a) => a.filter((v) => v !== -1).length;
    const rows = [['orn_gold', 'Прикраси', n(T.orn) + ' / ' + T.orn.length], ['gift_red', 'Подарунки', n(T.gift) + ' / ' + T.gift.length], ['it_cane', 'Цукерки на гілках', n(T.candy) + ' / ' + T.candy.length]];
    rows.forEach(([ic, a, b], i) => { const yy = y + 236 + i * 70; icon(ic, x + 170, yy, 54, k);
      L.label('fr' + i, a, x + 230, yy, { size: 40, col: CREAM, out: INK, a: k }); L.label('fv' + i, b, x + w - 140, yy, { size: 44, col: GOLD, out: INK, al: 1, a: k }); });
    // 2026-11-11: банда прийшла до ялинки (фінал з бандою) — замість старого «далі буде»
    L.label('fn', 'Сірі Шарфи вперше прийшли на свято — і шарфи в них тепер кольорові', W / 2, y + h - 40, { size: 28, col: '#9fb0d8', out: '#0b1230', al: 0.5, a: k });
    buttons(ITEMS.final(), W / 2, y + h + 40, t);
  }

  function menu(t) {
    // затемнення зверху, щоб назва читалась на тлі живої сцени (позаду грає демо)
    for (let i = 0; i < 8; i++) L.solid(0, i * 50, W, 50, [0.01, 0.02, 0.06], 0, 0, 0, 0.5 * (1 - i / 8));
    const k = SS(0, 0.8, t - UI.t0), bob = 6 * Math.sin(t * 1.6);
    L.glow(W / 2, 190, 520, [1, 0.6, 0.3], 0.18 * k, 2);
    L.label('title', 'Ялинка до світанку', W / 2, 180 + bob - (1 - k) * 60, { size: 118, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k });
    L.label('sub', 'Різдвяна пригода в містечку фахверкових будиночків', W / 2, 282, { size: 34, col: '#cfd8ff', out: '#0b1230', al: 0.5, a: SS(0.4, 1.2, t - UI.t0) });
    L.uiBox('titlebox', 0, 60, W, 260, 8);
    icon('star', W / 2 - 560, 175 + bob, 70, k); icon('star', W / 2 + 560, 175 - bob, 70, k);
    const mi = ITEMS.menu(); buttons(mi, W / 2, mi.length > 4 ? 420 : 470, t, mi.length > 4 ? 86 : 92);
    L.label('foot', 'стрілки — вибір, Enter — так, миша теж працює', W / 2, H - 50, { size: 26, col: '#9fb0d8', out: '#0b1230', al: 0.5, a: 0.8 });
    L.uiBox('footbox', 0, H - 90, W, 80, 4);
  }

  function panel(x, y, w, h, a) { L.rrect(x, y, w, h, 30, [0.08, 0.1, 0.2], [0.04, 0.05, 0.11], 0.9 * a); }
  function overlay(title, items, t, dim) {
    const k = SS(0, 0.25, t - UI.t0); L.solid(0, 0, W, H, [0.01, 0.02, 0.05], 0, 0, 0, dim * k);
    L.label('ovt', title, W / 2, 260, { size: 92, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k }); L.uiBox('ovtbox', 0, 180, W, 160, 8);
    buttons(items, W / 2, 400, t);
  }
  // 2026-11-11 (відгук: «підказка зникає, прочитав чи ні»): у паузі внизу — що зараз робити і керування, щоб перечитати
  function pauseTips(ST, t) { const k = SS(0, 0.25, t - UI.t0), B = ST.boss;
    const goal = B && B.ph > 0 ? BOSS_TIP[B.ph] : (LV.HINT || '');                     // у бою — підказка фази, інакше — рівня
    [[goal, H - 170, GOLD], [SIM.HINT, H - 110, CREAM]].forEach(([s, y, col], i) => { if (!s) return;
      const w = L.labelW('ptip' + i, s, { size: 28, col, out: INK }) + 48;
      L.rrect(W / 2 - w / 2, y - 27, w, 54, 18, [0.05, 0.06, 0.12], [0.02, 0.03, 0.07], 0.85 * k);
      L.label('ptip' + i, s, W / 2, y, { size: 28, col, out: INK, al: 0.5, a: k }); }); }
  function controls(t) {
    const k = SS(0, 0.25, t - UI.t0); L.solid(0, 0, W, H, [0.01, 0.02, 0.05], 0, 0, 0, 0.6 * k);
    const rows = [['← → або A D', 'біг'], ['Пробіл / ↑', 'стрибок (довше тримаєш — вище)'], ['X або клік мишею', 'рогатка з шишками (миша — приціл)'],
      ['↑ + X', 'постріл угору'], ['C', 'хлопавка: оглушує всіх поруч'], ['Esc або P', 'пауза']];
    const w = 1180, h = 140 + rows.length * 70, x = W / 2 - w / 2, y = 150; panel(x, y, w, h, k); L.uiBox('ctl', x, y, w, h, 8);
    L.label('ctlt', 'Керування', W / 2, y + 60, { size: 60, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k });
    rows.forEach(([a, b], i) => { L.label('ck' + i, a, x + 90, y + 150 + i * 70, { size: 34, col: GOLD, out: INK, a: k });
      L.label('cv' + i, b, x + 520, y + 150 + i * 70, { size: 34, col: CREAM, out: INK, a: k }); });
    buttons(ITEMS.controls(), W / 2, y + h + 40, t);
  }
  // смужка боса вгорі посередині: ім'я, три фази (пройдені — золоті), «здоров'я» поточної фази; на початку фази — підказка
  const BOSS_TIP = ['', 'Збий вугілля шишкою — і воно полетить назад у Бурчака!', 'Кинь хлопавку до дзвона, коли Бурчак під ним!', 'Наздожени Бурчака на даху й влуч шишкою!'];
  function bossBar(ST, GT) { const B = ST.boss, w = 560, x = W / 2 - w / 2, y = 26, max = B.ph === 2 ? 2 : 3, bump = Math.max(0, 1 - (GT - B.hitT) / 0.3);
    L.rrect(x, y, w, 78, 22, [0.12, 0.05, 0.1], [0.05, 0.02, 0.05], 0.8); L.uiBox('boss', x, y, w, 78, 0);
    L.label('bossn', 'Пан Бурчак', x + 26, y + 30, { size: 30, col: '#ffe7b0', out: INK });
    for (let p = 1; p <= 3; p++) L.rrect(x + w - 200 + (p - 1) * 62, y + 16, 50, 16, 8, p < B.ph ? [0.95, 0.75, 0.3] : p === B.ph ? [0.85, 0.3, 0.3] : [0.25, 0.2, 0.25], p < B.ph ? [0.7, 0.5, 0.15] : [0.4, 0.1, 0.12], 1);
    const hp = B.ph === 3 && B.hp <= 0 ? 0 : B.hp; L.rrect(x + 26, y + 52, (w - 52) * Math.max(0, hp) / max, 14, 7, [1, 0.35 + 0.5 * bump, 0.3], [0.6, 0.12, 0.12], 1);
    const a = GT - ST.bmsg; if (a >= 0 && a < 6) { const k = SS(0, 0.4, a) * (1 - SS(5, 6, a)), s = BOSS_TIP[B.ph], tw = L.labelW('btip', s, { size: 30 }) + 40;
      L.rrect(W / 2 - tw / 2, y + 96, tw, 52, 18, [0.05, 0.06, 0.12], [0.02, 0.03, 0.07], 0.8 * k); L.uiBox('btipb', W / 2 - tw / 2, y + 96, tw, 52, 4);
      L.label('btip', s, W / 2, y + 122, { size: 30, col: CREAM, out: INK, al: 0.5, a: k }); }
    // 2026-11-11: після великого показу підказка фази НЕ зникає — лишається дрібнішим рядком під смужкою боса
    else if (a >= 6 && B.hp > 0) { const s = BOSS_TIP[B.ph], k = SS(6, 6.5, a), tw = L.labelW('btip2', s, { size: 24, col: CREAM, out: INK }) + 32;
      L.rrect(W / 2 - tw / 2, y + 90, tw, 40, 14, [0.05, 0.06, 0.12], [0.02, 0.03, 0.07], 0.6 * k);
      L.label('btip2', s, W / 2, y + 110, { size: 24, col: CREAM, out: INK, al: 0.5, a: 0.85 * k }); } }
  function done(ST, GT, t) {
    const k = SS(0, 0.4, t - UI.t0); L.solid(0, 0, W, H, [0.01, 0.02, 0.05], 0, 0, 0, 0.55 * k);
    const w = 980, h = 470, x = W / 2 - w / 2, y = 140; panel(x, y, w, h, k); L.uiBox('done', x, y, w, h, 8);
    L.label('dt', LV.TITLE || 'Вулицю врятовано!', W / 2, y + 74, { size: 76, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k });
    const tot = LV.SWEETS.length, c = (v, d) => Math.round(v * SS(d, d + 0.8, t - UI.t0));     // числа «набігають»
    // рівень з босом: замість прикрас і подарунків — повернута зірка
    const rows = LV.BOSS ? [['it_candy', 'Солодощі', c(ST.got.filter((g) => g >= 0).length, 0.4) + ' / ' + tot], ['star', 'Зірка', c(ST.gifts[0] >= 0 ? 1 : 0, 1.0) + ' / 1']]
      : [['it_candy', 'Солодощі', c(ST.got.filter((g) => g >= 0).length, 0.4) + ' / ' + tot], ['orn_gold', 'Прикраси', c(ST.orn.filter((g) => g >= 0).length, 1.0) + ' / ' + LV.ORNAMENTS.length],
      ['gift_red', 'Подарунки', c(ST.gifts.filter((g) => g >= 0).length, 1.6) + ' / ' + (LV.GIFTS || LV.THIEVES).length]];
    rows.forEach(([n, a, b], i) => { const yy = y + 190 + i * 88; icon(n, x + 150, yy, 62, k);
      L.label('dr' + i, a, x + 220, yy, { size: 44, col: CREAM, out: INK, a: k }); L.label('dv' + i, b, x + w - 120, yy, { size: 48, col: GOLD, out: INK, al: 1, a: k }); });
    buttons(ITEMS.done(), W / 2, y + h + 40, t);
  }
})();
