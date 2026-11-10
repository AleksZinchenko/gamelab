// live/audio.js — звук гри на WebAudio (вбудований у браузер «мікшерний пульт»).
// Звідки звуки: семпли Kenney (CC0) у live/sfx/, музика з OpenGameArt (CC0) — див. sfx/CREDITS.txt.
// Частина звуків синтезується кодом: дзвіночки за солодощі (серія підбирань звучить усе вище — як у класичних
// платформерах), тріск хлопавки, свист стрибка, вітер. Кожна подія гри (S.ev) → свій звук, з панорамою за x на екрані.
// Браузер дозволяє звук лише після першого натискання/кліку — тому контекст «будимо» на першу дію користувача.
(function () {
  const A = (window.AUDIO = {});
  const STATIC = !!window.__STATIC__, RENDER = new URLSearchParams(location.search).has('render');
  let ctx = null, master, sfxBus, musicBus, ambBus, noiseBuf;
  const buf = {};                      // назва → AudioBuffer (завантажені семпли)
  const NAMES = ['step0', 'step1', 'step2', 'step3', 'step4', 'land', 'twang0', 'twang1', 'wood', 'punch0', 'punch1', 'punchh', 'coal', 'bell', 'ding',
    'glass', 'gift', 'ammo', 'oops', 'steal', 'spot', 'whoosh', 'revive', 'done', 'ui_move', 'ui_ok', 'ui_open', 'plate', 'music_menu', 'music_game', 'music_done'];

  function init() {
    if (ctx || RENDER) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    // легкий компресор на загальній шині: гучні вибухи не «ріжуть» вуха
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(comp); musicBus = ctx.createGain(); musicBus.connect(comp); ambBus = ctx.createGain(); ambBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let s = 1; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    NAMES.forEach((n) => fetch('sfx/' + n + '.ogg').then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((ab) => { buf[n] = ab; if (n.startsWith('music')) music(); }).catch(() => {}));
    wind(); A.apply();
  }
  const wake = () => { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);

  // ---------------- примітиви ----------------
  // семпл: гучність, висота (rate), панорама −1..1, затримка (с)
  function play(n, vol = 1, rate = 1, pan = 0, delay = 0) { if (!ctx || !buf[n]) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(); s.buffer = buf[n]; s.playbackRate.value = rate;
    g.gain.value = vol; p.pan.value = Math.max(-1, Math.min(1, pan)); s.connect(g); g.connect(p); p.connect(sfxBus); s.start(ctx.currentTime + delay); }
  // дзвіночок: синус + обертон, швидка атака і довге згасання (як скляна кулька на ялинці)
  function chime(freq, vol = 0.18, delay = 0, pan = 0, len = 0.6) { if (!ctx) return; const t0 = ctx.currentTime + delay, p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(sfxBus);
    [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([m, a]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq * m; o.type = 'sine';
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol * a, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len / m ** 0.3);
      o.connect(g); g.connect(p); o.start(t0); o.stop(t0 + len + 0.1); }); }
  // шум через фільтр: свист (стрибок, кидок), тріск хлопавки
  function noise(len, f0, f1, vol, type = 'bandpass', delay = 0, pan = 0, q = 1.2) { if (!ctx) return; const t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + len);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len); p.pan.value = pan;
    s.connect(f); f.connect(g); g.connect(p); p.connect(sfxBus); s.start(t0, Math.random() * 1.5); s.stop(t0 + len + 0.05); }
  // пентатоніка: будь-які ноти з неї звучать гармонійно — серія цукерок «грає мелодію»
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const note = (i, base = 784) => base * Math.pow(2, PENTA[Math.min(PENTA.length - 1, i)] / 12);

  // ---------------- вітер і далекі дзвони (атмосфера) ----------------
  function wind() { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.7; g.gain.value = 0.035;
    lfo.frequency.value = 0.09; lg.gain.value = 0.022; lfo.connect(lg); lg.connect(g.gain);          // вітер то посилюється, то стихає
    s.connect(f); f.connect(g); g.connect(ambBus); s.start(); lfo.start(); }

  // ---------------- музика: меню ↔ гра, плавний перехід ----------------
  let cur = null, curName = '';
  function music() { if (!ctx) return; const want = UIwant(); if (want === curName || !buf[want]) return;
    const t0 = ctx.currentTime; if (cur) { cur.g.gain.setTargetAtTime(0, t0, 0.4); cur.s.stop(t0 + 2); }
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf[want]; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(want === 'music_game' ? 0.42 : 0.55, t0, 0.6);
    s.connect(g); g.connect(musicBus); s.start(); cur = { s, g }; curName = want; }
  // меню — спокійна, вулиця — жвава, «Вулицю врятовано!» — урочиста
  // на площі — спокійна (як у меню), а коли ялинка засяяла — святкова
  const lit = () => { const S = window.SCENE && SCENE.state; return !!(S && SIM.LV.HUB && S.fin !== undefined && S.fin !== -1 && (S.fin === -100 || S.t >= S.fin)); };
  const UIwant = () => { const m = window.UI ? UI.mode : 'menu';
    if (m === 'final' || m === 'done') return 'music_done';
    if (m === 'play' || m === 'pause') return SIM.LV.HUB ? (lit() ? 'music_done' : 'music_menu') : 'music_game';
    return 'music_menu'; };
  A.refresh = () => { music(); A.apply(); };
  A.apply = () => { if (!ctx) return; const U = window.UI || { sound: true, music: 0.7 }; const t0 = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(U.sound ? 0.9 : 0, t0, 0.05); ambBus.gain.setTargetAtTime(U.sound ? 1 : 0, t0, 0.2);
    musicBus.gain.setTargetAtTime(U.music * (U.mode === 'pause' ? 0.45 : 1), t0, 0.15); };

  // ---------------- меню ----------------
  A.ui = (k) => { wake(); if (k === 'move') play('ui_move', 0.35, 1.1); else if (k === 'ok') { play('ui_ok', 0.5); chime(1175, 0.08); } else if (k === 'open') play('ui_open', 0.3); };

  // ---------------- події гри → звуки ----------------
  let lastS = null, lastT = 0, mode = '';
  A.events = (S) => {
    if (!ctx) return;
    if (window.UI && UI.mode !== mode) { mode = UI.mode; music(); A.apply(); }
    if (!S || UI.mode !== 'play') { lastS = S; if (S) lastT = S.t; return; }
    if (S !== lastS || S.t < lastT) { lastS = S; lastT = S.t; return; }              // нова гра / відновлення — старі події не програємо
    const W = 1920, pan = (e) => ((e.x - S.cam) / W - 0.5) * 1.4;
    for (const e of S.ev) { if (e.t <= lastT || e.t > S.t) continue; const p = pan(e);
      switch (e.k) {
        case 'step': play('step' + (Math.floor(e.t * 37) % 5), 0.32, 0.95 + 0.1 * ((e.t * 13) % 1), p); break;
        case 'jump': noise(0.22, 600, 2400, 0.12, 'bandpass', 0, p); play('step2', 0.25, 1.2, p); break;
        case 'land': play('land', Math.min(0.7, 0.2 + (e.v || 800) / 3000), 1.1, p); play('step' + (Math.floor(e.t * 11) % 5), 0.4, 0.85, p); break;
        case 'shoot': play('twang' + (Math.floor(e.t * 7) % 2), 0.55, 0.9 + 0.15 * ((e.t * 17) % 1), p); noise(0.12, 2500, 900, 0.06, 'bandpass', 0, p); break;
        case 'toss': noise(0.3, 400, 1600, 0.1, 'bandpass', 0, p); break;
        case 'bonk': play('wood', 0.7, 1.1, p); chime(1568, 0.05, 0.02, p, 0.25); break;
        case 'plop': play('step' + (Math.floor(e.t * 5) % 5), 0.3, 1.4, p); break;
        case 'smash': play('coal', 0.55, 1.1, p); break;
        case 'ding': play('ding', 0.6, 1.0, p); chime(2093, 0.06, 0, p, 0.8); break;
        case 'boom': {                                                            // хлопавка: удар + тріск + дзвін конфеті
          noise(0.5, 1800, 120, 0.7, 'lowpass', 0, p, 0.7); play('punchh', 0.6, 0.7, p);
          for (let j = 0; j < 9; j++) noise(0.05, 3000 + 400 * j, 1500, 0.25, 'bandpass', 0.05 + j * 0.035 + 0.02 * (j % 3), p + (j % 2 ? 0.2 : -0.2), 2);
          for (let j = 0; j < 4; j++) chime(note(4 + j * 2, 1046), 0.05, 0.15 + j * 0.07, p, 0.5); break; }
        case 'collect': { const c = e.c || 0; chime(note(Math.min(10, c)), 0.16, 0, p, 0.5); chime(note(Math.min(10, c)) * 2, 0.05, 0.03, p, 0.3); break; }
        case 'ornament': play('glass', 0.6, 1, p); [0, 2, 4, 7].forEach((n, j) => chime(note(n + 3, 1046), 0.11, j * 0.08, p, 0.9)); break;
        case 'gift': play('gift', 0.7, 1, p); [0, 4, 7, 12].forEach((n, j) => chime(523 * Math.pow(2, n / 12), 0.14, j * 0.1, p, 1.0)); play('bell', 0.25, 1.5, p, 0.35); break;
        case 'ammo': play('ammo', 0.6, 1, p); chime(988, 0.07, 0.05, p); break;
        case 'hurt': play('punch0', 0.6, 1.2, p); play('oops', 0.45, 1, p); break;
        case 'steal': play('steal', 0.6, 1.2, p); play('whoosh', 0.3, 1.4, p); break;
        case 'spot': play('spot', 0.55, 0.9, p); break;
        case 'dash': play('whoosh', 0.35, 1.1, p); break;
        case 'throw': noise(0.25, 300, 900, 0.12, 'bandpass', 0, p); break;
        case 'thiefhit': case 'bullyhit': play('punch' + (Math.floor(e.t * 3) % 2), 0.6, e.k === 'bullyhit' ? 0.8 : 1.1, p); break;
        case 'thiefout': case 'bullyout': play('whoosh', 0.6, 0.9, p); play('punchh', 0.5, 0.9, p); [7, 4, 0].forEach((n, j) => chime(note(n, 1046), 0.08, 0.25 + j * 0.09, p)); break;
        case 'thud': play('plate', 0.35, 0.8, p); break;
        case 'lamp': play('bell', 0.35, 1.25, p); chime(1318, 0.09, 0.05, p, 1.2); chime(1975, 0.06, 0.15, p, 1.2); break;
        case 'faint': play('oops', 0.5, 0.7, p); break;
        case 'revive': play('revive', 0.55, 1, p); break;
        // ---- дахи ----
        case 'grab': play('wood', 0.35, 1.3, p); break;
        case 'rung': play('wood', 0.22, 1.5 + 0.2 * ((e.t * 7) % 1), p); break;                       // щабель драбини
        case 'slide': noise(0.1, 1200, 2500, 0.05, 'bandpass', 0, p); break;                        // шурхіт снігу під ногами
        case 'chimney': play('whoosh', 0.35, 0.6, p); chime(1046, 0.08, 0.05, p, 1); chime(1568, 0.06, 0.15, p, 1); break;
        case 'coo': play('spot', 0.35, 1.6, p); break;                                              // голуб помітив
        case 'dive': noise(0.4, 500, 1800, 0.12, 'bandpass', 0, p); break;
        case 'pigeonout': play('punch1', 0.5, 1.4, p); for (let j = 0; j < 6; j++) noise(0.05, 1500, 900, 0.08, 'bandpass', j * 0.06, p, 2); break;
        case 'creak': play('wood', 0.5, 0.5, p); noise(0.5, 300, 900, 0.08, 'bandpass', 0, p); break;   // пласт зрушив з місця
        case 'whoosh2': play('whoosh', 0.45, 0.8, p); break;
        case 'slabsmash': play('land', 0.8, 0.7, p); noise(0.6, 1500, 200, 0.35, 'lowpass', 0, p, 0.7); break;
        // ---- річка ----
        case 'splash': noise(0.6, 900, 300, 0.45, 'lowpass', 0, p, 0.8); play('oops', 0.45, 1, p, 0.1); for (let j = 0; j < 5; j++) noise(0.08, 2200, 1200, 0.12, 'bandpass', 0.1 + j * 0.07, p, 2); break;
        case 'raise': play('wood', 0.3, 0.8, p); break;                                             // гасильник підняв палицю
        case 'snuff': play('plate', 0.3, 1.6, p); noise(0.5, 1200, 300, 0.12, 'lowpass', 0.05, p); break;   // «пух» — ліхтар погас
        case 'snufferhit': play('punch' + (Math.floor(e.t * 3) % 2), 0.6, 0.95, p); break;
        case 'snufferout': play('whoosh', 0.6, 0.8, p); play('punchh', 0.5, 0.85, p); [7, 4, 0].forEach((n, j) => chime(note(n, 1046), 0.08, 0.25 + j * 0.09, p)); break;
        // ---- площа ----
        case 'gate': play('ui_open', 0.5, 0.9, p); play('whoosh', 0.45, 0.8, p); break;
        case 'locked': play('wood', 0.6, 0.6, p); play('wood', 0.5, 0.55, p, 0.16); break;          // «тук-тук» у зачинену браму
        case 'hang': { const d = e.fly;                                                             // річ злітає з торби і сідає на ялинку
          noise(0.35, 500, 2200, 0.08, 'bandpass', 0, p);
          if (e.kind === 'orn') { play('glass', 0.45, 1.05 + 0.05 * e.i, p, d); chime(note(3 + e.i, 1046), 0.1, d, p, 0.9); }
          else if (e.kind === 'gift') { play('plate', 0.35, 0.9, p, d); play('gift', 0.5, 1, p, d); }
          else if (e.kind === 'candy') chime(note(5 + e.i), 0.11, d, p, 0.5);
          else { for (let j = 0; j < 8; j++) chime(note(j + 2, 784), 0.07, j * 0.15, p, 0.6); play('bell', 0.5, 1.2, p, d); }
          break; }
        case 'fin': {                                                                               // опівнічні дзвони, акорд, феєрверк
          music();
          for (let j = 0; j < 12; j++) play('bell', 0.42, 0.62, (j % 2 ? 0.25 : -0.25), 0.3 + j * 0.62);
          [0, 4, 7, 12, 16, 19, 24].forEach((n, j) => chime(523 * Math.pow(2, n / 12), 0.12, j * 0.09, 0, 1.6));
          for (let k = 0; k < 10; k++) { const dl = 0.8 + k * 0.7, pp = ((k * 0.37) % 1) * 1.2 - 0.6;
            noise(0.6, 900, 80, 0.32, 'lowpass', dl, pp, 0.7);
            for (let j = 0; j < 6; j++) noise(0.04, 3000 + 300 * j, 1600, 0.12, 'bandpass', dl + 0.1 + j * 0.05, pp, 2); }
          break; }
        case 'done': play('done', 0.7, 1); [0, 4, 7, 12, 16, 19, 24].forEach((n, j) => chime(523 * Math.pow(2, n / 12), 0.12, j * 0.12, 0, 1.4)); play('bell', 0.4, 1, 0, 0.9); break;
      } }
    lastT = S.t;
  };
})();
