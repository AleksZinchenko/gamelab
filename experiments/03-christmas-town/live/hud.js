// live/hud.js — інтерфейс: лічильники в грі (рукавички-життя, солодощі, шишки, хлопавки, подарунки, прикраси)
// і всі екрани-меню: головне меню, «Керування», пауза, «Вулицю врятовано!». Стан меню — window.UI;
// index.html передає сюди клавіші й кліки, а назад отримує дію: 'start', 'resume', 'restart', 'tomenu'.
(function () {
  const L = LIB, SS = L.SS, W = SIM.VIEW.W, H = SIM.VIEW.H, LV = SIM.LV;
  const UI = (window.UI = { mode: 'menu', sel: 0, t0: 0, now: 0, sound: true, music: 0.7, hits: [], hover: -1 });
  const CREAM = '#fbecc8', INK = '#2a0f12', GOLD = '#ffd66b';
  const ITEMS = {
    menu: () => [['play', 'Грати'], ['controls', 'Керування'], ['sound', 'Звук: ' + (UI.sound ? 'увімкнено' : 'вимкнено')], ['music', 'Музика: ' + Math.round(UI.music * 100) + '%']],
    pause: () => [['resume', 'Продовжити'], ['restart', 'Почати вулицю знову'], ['sound', 'Звук: ' + (UI.sound ? 'увімкнено' : 'вимкнено')], ['menu', 'Головне меню']],
    controls: () => [['back', 'Назад']],
    done: () => [['again', 'Пройти ще раз'], ['menu', 'Головне меню']],
  };
  UI.open = (mode) => { UI.mode = mode; UI.sel = 0; UI.t0 = UI.now; if (window.AUDIO) AUDIO.ui('open'); };
  // дія пункту меню → що робити грі (index.html)
  const activate = (id) => { if (window.AUDIO) AUDIO.ui('ok');
    if (id === 'play' || id === 'again') return 'start';
    if (id === 'resume') return 'resume';
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
    if (c === 'Escape') { if (UI.mode === 'pause') return activate('resume'); if (UI.mode === 'controls') return activate('back'); return null; }
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
    if (UI.mode === 'play' || UI.mode === 'pause' || UI.mode === 'done') hudPlay(ST, GT, t);
    if (UI.mode === 'menu') menu(t);
    else if (UI.mode === 'controls') controls(t);
    else if (UI.mode === 'pause') overlay('Пауза', ITEMS.pause(), t, 0.55);
    else if (UI.mode === 'done') done(ST, GT, t);
  };

  function hudPlay(ST, GT, t) {
    // рукавички-життя: втрачена — тьмяна й «падає»
    for (let i = 0; i < 3; i++) { const lost = i >= ST.hearts, hb = bumpOf(ST, GT, ['hurt']) * (i === ST.hearts ? 1 : 0);
      icon('mitten', 60 + i * 62, 60 + 10 * hb, 54 * (1 + 0.3 * hb), lost ? 0.25 : 1); }
    L.uiBox('hearts', 26, 26, 190, 70, 0);
    let x = 240; x += counter('sw', 'it_candy', String(ST.sw), x, 28, bumpOf(ST, GT, ['collect'])) + 14;
    x += counter('cn', 'cone', String(ST.cones), x, 28, bumpOf(ST, GT, ['shoot', 'ammo'])) + 14;
    counter('cr', 'cracker', String(ST.crackers), x, 28, bumpOf(ST, GT, ['toss', 'ammo']));
    // справа: 3 подарунки і 5 прикрас — порожні слоти видно (чого ще бракує)
    const gx = W - 40 - 3 * 74; L.rrect(gx - 16, 24, 3 * 74 + 26, 76, 22, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.72); L.uiBox('gifts', gx - 16, 24, 3 * 74 + 26, 76, 0);
    ['gift_red', 'gift_green', 'star'].forEach((n, i) => { const g = ST.gifts[i], a = g >= 0 ? SS(0.5, 0.8, GT - g) : 0;
      icon(n, gx + 32 + i * 74, 62, 54 * (1 + 0.3 * Math.max(0, 1 - Math.abs(GT - g - 0.8) / 0.2) * (g >= 0 ? 1 : 0)), 0.22 + 0.78 * a); });
    const ox = W - 40 - 5 * 46; L.rrect(ox - 14, 108, 5 * 46 + 22, 56, 18, [0.06, 0.08, 0.16], [0.03, 0.04, 0.09], 0.6); L.uiBox('orns', ox - 14, 108, 5 * 46 + 22, 56, 0);
    LV.ORNAMENTS.forEach(([, , k], i) => icon(['orn_red', 'orn_gold', 'orn_blue'][k], ox + 18 + i * 46, 136, 40, ST.orn[i] >= 0 ? 1 : 0.22));
    // підібраний подарунок/прикраса летить у свій слот (дуга від місця підбору)
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || a > 0.8 || (e.k !== 'gift' && e.k !== 'ornament')) continue;
      const q = SS(0, 1, a / 0.8), x0 = e.x - ST.cam, y0 = e.y - ST.camY, tx = e.k === 'gift' ? gx + 32 + e.i * 74 : ox + 18 + e.i * 46, ty = e.k === 'gift' ? 62 : 136;
      const cx = (x0 + tx) / 2, cy = Math.min(y0, ty) - 200, px = (1 - q) ** 2 * x0 + 2 * (1 - q) * q * cx + q * q * tx, py = (1 - q) ** 2 * y0 + 2 * (1 - q) * q * cy + q * q * ty;
      const n = e.k === 'gift' ? ['gift_red', 'gift_green', 'star'][e.i] : ['orn_red', 'orn_gold', 'orn_blue'][LV.ORNAMENTS[e.i][2]];
      L.glow(px, py, 60, [1, 0.8, 0.4], 0.6, 3); icon(n, px, py, 60 - 10 * q); }
    // підказка на старті (зникає сама)
    const ht = ST.t; if (ht < 6 && UI.mode === 'play') { const a = SS(0, 0.5, ht) * (1 - SS(5, 6, ht)), s = SIM.HINT, w = L.labelW('hint', s, { size: 28 }) + 40;
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

  function menu(t) {
    // затемнення зверху, щоб назва читалась на тлі живої сцени (позаду грає демо)
    for (let i = 0; i < 8; i++) L.solid(0, i * 50, W, 50, [0.01, 0.02, 0.06], 0, 0, 0, 0.5 * (1 - i / 8));
    const k = SS(0, 0.8, t - UI.t0), bob = 6 * Math.sin(t * 1.6);
    L.glow(W / 2, 190, 520, [1, 0.6, 0.3], 0.18 * k, 2);
    L.label('title', 'Ялинка до світанку', W / 2, 180 + bob - (1 - k) * 60, { size: 118, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k });
    L.label('sub', 'Різдвяна пригода в містечку фахверкових будиночків', W / 2, 282, { size: 34, col: '#cfd8ff', out: '#0b1230', al: 0.5, a: SS(0.4, 1.2, t - UI.t0) });
    L.uiBox('titlebox', 0, 60, W, 260, 8);
    icon('star', W / 2 - 560, 175 + bob, 70, k); icon('star', W / 2 + 560, 175 - bob, 70, k);
    buttons(ITEMS.menu(), W / 2, 470, t);
    L.label('foot', 'стрілки — вибір, Enter — так, миша теж працює', W / 2, H - 50, { size: 26, col: '#9fb0d8', out: '#0b1230', al: 0.5, a: 0.8 });
    L.uiBox('footbox', 0, H - 90, W, 80, 4);
  }

  function panel(x, y, w, h, a) { L.rrect(x, y, w, h, 30, [0.08, 0.1, 0.2], [0.04, 0.05, 0.11], 0.9 * a); }
  function overlay(title, items, t, dim) {
    const k = SS(0, 0.25, t - UI.t0); L.solid(0, 0, W, H, [0.01, 0.02, 0.05], 0, 0, 0, dim * k);
    L.label('ovt', title, W / 2, 260, { size: 92, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k }); L.uiBox('ovtbox', 0, 180, W, 160, 8);
    buttons(items, W / 2, 400, t);
  }
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
  function done(ST, GT, t) {
    const k = SS(0, 0.4, t - UI.t0); L.solid(0, 0, W, H, [0.01, 0.02, 0.05], 0, 0, 0, 0.55 * k);
    const w = 980, h = 470, x = W / 2 - w / 2, y = 140; panel(x, y, w, h, k); L.uiBox('done', x, y, w, h, 8);
    L.label('dt', 'Вулицю врятовано!', W / 2, y + 74, { size: 76, col: '#ffe7b0', out: '#5a1018', al: 0.5, a: k });
    const tot = LV.SWEETS.length, c = (v, d) => Math.round(v * SS(d, d + 0.8, t - UI.t0));     // числа «набігають»
    const rows = [['it_candy', 'Солодощі', c(ST.got.filter((g) => g >= 0).length, 0.4) + ' / ' + tot], ['orn_gold', 'Прикраси', c(ST.orn.filter((g) => g >= 0).length, 1.0) + ' / 5'],
      ['gift_red', 'Подарунки', c(ST.gifts.filter((g) => g >= 0).length, 1.6) + ' / 3']];
    rows.forEach(([n, a, b], i) => { const yy = y + 190 + i * 88; icon(n, x + 150, yy, 62, k);
      L.label('dr' + i, a, x + 220, yy, { size: 44, col: CREAM, out: INK, a: k }); L.label('dv' + i, b, x + w - 120, yy, { size: 48, col: GOLD, out: INK, al: 1, a: k }); });
    buttons(ITEMS.done(), W / 2, y + h + 40, t);
  }
})();
