// src/actor.js — 3D-герой у мальованій кімнаті: модель з Meshy (GLB зі скелетом), рухи (хода / дихання), повороти, тінь.
// Підлога в мальованій кімнаті — смуга: «глибина» d=0 біля задньої стіни, d=1 біля глядача. Камера ортографічна
// (без перспективи), тож глибину показуємо так, як художник на картині: що ближче — то нижче на екрані.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const HEIGHT = 400;           // зріст героя у пікселях кімнати за замовчуванням (Ліна: ≈0.8 висоти дверей); інші — clips.height
const TILT = 0.14;           // нахил моделі до глядача (рад): ми дивимось на кімнату трохи згори, як на малюнку
const FEET_BACK = 210, FEET_FRONT = 120;   // y ступнів біля задньої стіни і біля глядача (рядки 870…960 малюнка)
// «П'ятно» героя на підлозі — еліпс: foot px у боки (x) і foot·FLAT у глибину (у «пікселях підлоги», d=1 ≈ 300).
// Тіло в плечах трохи ширше, ніж від грудей до спини, тому еліпс ледь сплюснутий (0.9). З 0.6 Ліна проходила так близько
// перед Двічі, що на екрані виглядало, ніби треться об нього плечем: уся підлога — лише 90 рядків малюнка.
// Щоб рахувати було просто, глибину ділимо на FLAT — еліпс стає колом (так званий «перехід у круглі координати»).
const FLAT = 0.9, MARGIN = 1.08;           // MARGIN — запас при обході: 8 % ширше за п'ятно, щоб не чіпляти плечем
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export class Actor {
  // clips: які рухи брати з файлу — { walk: /…/, idle: [/…/, /…/] } (кілька стійок чергуються — так герой живіший);
  // gest: { назва: /…/ } — жести «один раз» (випити, вдарити); height — зріст у px; x, d, face — де стоїть на старті
  static async load(url, scene, clips) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new Actor(gltf, scene, clips);
  }

  constructor(gltf, scene, clips) {
    // Ієрархія: tilt (позиція + нахил до глядача) → yaw (поворот, куди дивиться) → модель.
    // Так поворот завжди навколо вертикалі героя, а нахил — спільний для всієї сцени.
    this.tilt = new THREE.Group(); this.yaw = new THREE.Group(); this.tilt.add(this.yaw); scene.add(this.tilt);
    const model = gltf.scene; this.yaw.add(model);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar((clips.height || HEIGHT) / size.y);   // модель Meshy (метри) → пікселі кімнати
    this.tilt.rotation.x = TILT;
    model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });   // скелет рухає вершини — рамку не перераховуємо
    // тінь під ногами: темний напівпрозорий овал — без неї герой «висить» над підлогою
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false }));
    this.shadow.scale.set(85, 16, 1); scene.add(this.shadow);
    // рухи: беремо кліпи з файлу за назвою (Meshy називає їх «Idle_4», «Thoughtful_Walk» тощо)
    this.mixer = new THREE.AnimationMixer(model);
    const clip = (re) => gltf.animations.find((a) => re.test(a.name)) || gltf.animations[0];
    const walk = clip(clips.walk);
    // walkSkip — кістки, яких хода не чіпає (напр. голова й шия): «задумлива» хода опускає голову вниз,
    // а без цих доріжок голова лишається в спокійній позі моделі — дивиться вперед, як у мальованої Ліни
    if (clips.walkSkip) walk.tracks = walk.tracks.filter((t) => !clips.walkSkip.test(t.name));
    this.idles = clips.idle.map((re) => this.mixer.clipAction(clip(re)));
    if (clips.walkArms) armsFromIdle(walk, this.idles[clips.walkArms.from || 0], clips.walkArms, model, this.mixer);
    this.walkAct = this.mixer.clipAction(walk);
    // швидкість ходи міряємо з самої анімації — тоді ступні не ковзають по підлозі за будь-якої ходи
    // walkRate — темп кроків: >1 — ті самі кроки, але частіше (і швидкість росте разом з ним, ступні не ковзають)
    const rate = clips.walkRate || 1;
    this.speed = strideSpeed(model, this.mixer, this.walkAct, model.scale.x) * rate;
    this.walkAct.timeScale = rate;
    // жести: граються один раз і завмирають на останньому кадрі, поки не повернемось до стійки
    this.gests = {};
    for (const [n, re] of Object.entries(clips.gest || {})) {
      const a = this.mixer.clipAction(clip(re)); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; this.gests[n] = a;
    }
    this.idleI = 0; this.act = this.idles[0]; this.act.play(); this.cur = 'idle';
    // жест дограв: ще раз (Двічі б'є двічі!) або назад до стійки
    this.mixer.addEventListener('finished', (e) => {
      if (this.cur !== 'gest' || e.action !== this.act) return;
      if (--this.gestN > 0) { this.act.reset().play(); return; }
      this.cur = 'idle'; this.fadeTo(this.idles[this.idleI], 0.4);
    });
    // коли стійка дограла цикл — інколи змінюємо її на іншу (переступила, нахилила голову…)
    this.mixer.addEventListener('loop', (e) => {
      if (this.cur !== 'idle' || e.action !== this.act || this.idles.length < 2 || Math.random() < 0.5) return;
      this.idleI = (this.idleI + 1 + Math.floor(Math.random() * (this.idles.length - 1))) % this.idles.length;
      this.fadeTo(this.idles[this.idleI], 0.6);
    });
    // стан: позиція в кімнаті (x, глибина d), ціль, куди дивиться (face: 1 праворуч, -1 ліворуч)
    this.x = clips.x ?? 1300; this.d = clips.d ?? 0.4; this.target = null; this.face = clips.face ?? 1; this.ang = this.face * 0.6;
    this.rest = clips.ang ?? null;   // свій кут стоячи (Академік спить боком до столу); пішов — забуваємо
    // обхід інших: foot — півширина п'ятна; others — кого обходити (задає main.js);
    // avoid — кого зараз обходимо і з якого боку (пам'ятаємо, щоб не смикатись «то зліва, то справа»);
    // meet — до кого підійшли (тапнули прямо на колегу): дійшли — повертаємось до нього обличчям
    this.foot = clips.foot ?? 55; this.others = []; this.avoid = null; this.meet = null;
  }

  // плавний перехід між рухами (crossfade) — щоб хода не «вмикалась» ривком
  play(name) {
    if (name === this.cur) return;
    this.cur = name; this.fadeTo(name === 'walk' ? this.walkAct : this.idles[this.idleI], 0.25);
  }
  fadeTo(a, secs) { if (a === this.act) return; a.reset().play(); a.crossFadeFrom(this.act, secs, false); this.act = a; }

  walkTo(x, d = this.d) { this.target = { x, d }; this.rest = null; this.meet = null; }

  // Ціль усередині чийогось п'ятна (тапнули на колегу або колега став на місце, куди йдемо) —
  // переносимо ціль на край п'ятна з нашого боку: героїня підходить і стає поруч, а не «влазить» у нього
  unblock() {
    for (const o of this.others) {
      const R = this.foot + o.foot;
      if (Math.hypot(this.target.x - o.x, (this.target.d - o.d) * 300 / FLAT) >= R) continue;
      let ux = this.x - o.x, uz = (this.d - o.d) * 300 / FLAT, u = Math.hypot(ux, uz);
      if (u < 1) { ux = -o.face; uz = 0; u = 1; }          // стоїмо впритул — стаємо перед його обличчям
      this.target = { x: o.x + ux / u * R * MARGIN, d: clamp01(o.d + uz / u * R * MARGIN * FLAT / 300) };
      this.meet = o;
    }
  }

  // Кермування (steering): куди ступити цього кадру. dx, dz — до цілі (dz у «пікселях підлоги»).
  // Якщо прямий шлях перетинає чиєсь п'ятно — йдемо по дотичній до нього (як мотузка, що огинає стовп),
  // кожен кадр заново: колеги теж рухаються, тож план шляху наперед застарів би за секунду.
  steer(dx, dz, dist) {
    const gx = dx, gz = dz / FLAT, g = Math.hypot(gx, gz);   // шлях у круглих координатах
    let hit = null;
    for (const o of this.others) {
      const R = this.foot + o.foot;
      const cx = o.x - this.x, cz = (o.d - this.d) * 300 / FLAT, c = Math.hypot(cx, cz);
      if (c <= R) continue;     // уже впритул (колега сам підійшов) — не застрягаємо, йдемо як ішли
      // найближча до колеги точка нашого шляху: якщо вона в його п'ятні — шлях заблоковано
      const t = Math.min(g, Math.max(0, (cx * gx + cz * gz) / g));
      if (Math.hypot(gx / g * t - cx, gz / g * t - cz) >= R) continue;
      if (!hit || c < hit.c) hit = { o, cx, cz, c, R };      // обходимо найближчого
    }
    if (!hit) { this.avoid = null; return [dx / dist, dz / dist]; }
    // дві дотичні з нашої точки до кола (зліва і справа від колеги): кут на центр ± кут дотичної
    const { o, cx, cz, c, R } = hit;
    const base = Math.atan2(cz, cx), a = Math.asin(Math.min(1, R * MARGIN / c)), reach = Math.sqrt(Math.max(0, c * c - R * R));
    const dirs = [1, -1].map((s) => {
      const ang = base + s * a, ux = Math.cos(ang), uz = Math.sin(ang);
      const d = this.d + uz * reach * FLAT / 300;           // глибина, де пройдемо повз колегу
      // оцінка боку: менше відхилення від цілі — краще; вихід за межі підлоги (у стіну чи до глядача) — штраф
      const score = (ux * gx + uz * gz) / g - (d < -0.02 || d > 1.02 ? 10 : 0);
      return { s, ux, uz, score };
    });
    let pick = dirs[0].score >= dirs[1].score ? dirs[0] : dirs[1];
    // уже обходимо цього колегу — тримаємо обраний бік (інакше на рівних героїня «тупцює» між двома боками)
    if (this.avoid?.o === o) pick = dirs.find((v) => v.s === this.avoid.s && v.score > -5) || pick;
    this.avoid = { o, s: pick.s };
    // назад зі «круглих» координат у справжні: глибину множимо на FLAT і знову нормуємо довжину кроку до 1
    const rx = pick.ux, rz = pick.uz * FLAT, n = Math.hypot(rx, rz);
    return [rx / n, rz / n];
  }
  // жест n разів поспіль (лише стоячи); повертає false, якщо такого жесту нема
  gesture(name, n = 1) {
    const a = this.gests[name]; if (!a || this.target) return false;
    this.cur = 'gest'; this.gestN = n; this.fadeTo(a, 0.3); return true;
  }
  get busy() { return this.cur === 'gest' || !!this.target; }

  update(dt, base = 0) {
    let dirX = 0, dirZ = 0;
    if (this.target) {
      this.unblock();
      // глибину рахуємо у «пікселях підлоги»: d=1 ≈ 300 px кроків уперед, щоб хода вглиб не була блискавичною
      const dx = this.target.x - this.x, dz = (this.target.d - this.d) * 300, dist = Math.hypot(dx, dz);
      if (dist < 4) {
        this.target = null; this.avoid = null;
        // підійшли до колеги — повертаємось до нього (стоячи герой дивиться в бік face, пів-оберту до глядача)
        if (this.meet) { this.face = Math.sign(this.meet.x - this.x) || this.face; this.meet = null; }
      } else {
        [dirX, dirZ] = this.steer(dx, dz, dist);              // прямо до цілі або в обхід колеги
        const step = Math.min(dist, this.speed * dt);
        this.x += dirX * step; this.d = clamp01(this.d + dirZ * step / 300);
        if (Math.abs(dirX) > 0.2) this.face = Math.sign(dirX);
      }
    }
    if (this.target || this.cur !== 'gest') this.play(this.target ? 'walk' : 'idle');   // жест не перериваємо, хіба що пішли
    // поворот: у ході — по напрямку, але трохи до глядача (як у мальованих героїв у ракурсі 3/4);
    // стоячи — пів-оберту до глядача в бік, куди йшов. Кут доганяємо плавно (не крутимось миттєво).
    const goal = this.target ? Math.atan2(dirX, dirZ + 0.45 * Math.abs(dirX)) : this.rest ?? this.face * 0.6;
    let diff = goal - this.ang; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.ang += diff * Math.min(1, dt * 10); this.yaw.rotation.y = this.ang;
    // позиція: ступні на підлозі мальованої кімнати; ближче до глядача — нижче на екрані і трохи більший
    const y = base + FEET_BACK + (FEET_FRONT - FEET_BACK) * this.d, k = 1 + 0.06 * this.d;
    this.tilt.position.set(this.x, y, 40 + this.d * 120); this.tilt.scale.setScalar(k);
    this.shadow.position.set(this.x, y + 2, 39 + this.d * 120); this.shadow.scale.set(85 * k, 16 * k, 1);
    this.mixer.update(dt);
  }
}

// Руки в ході: постава — зі стійки, розмах — з ходи.
// Чужа хода (рухи з бібліотеки зняті з інших людей) може тримати руки відведеними і кисті відігнутими — на Ліні
// з її халатом це виглядає як руки, заломлені в ліктях. Тому кожну кістку руки розкладаємо на дві частини:
//   середня поза в ході (mean) — «як тримає руку весь час» — її викидаємо і ставимо позу зі стійки (rest);
//   відхилення від середньої (mean⁻¹·q) — «розмах у такт крокам» — лишаємо, помножене на swing (1 — як було).
// Кути тут — кватерніони (quaternion: чотири числа, якими 3D-рушії записують поворот без «замикання осей»).
// Потім — дві поправки «як у живих людей» (o — налаштування з main.js, кути в градусах):
//   fwd — весь розмах зсунутий уперед: рука менше відходить назад за спину;
//   elbow — лікті трохи зігнуті вперед весь час, а на махові вперед — ще на elbowGain від кута маху.
function armsFromIdle(walk, idleAct, o, model, mixer) {
  const Q = THREE.Quaternion, ARM = /(Shoulder|Arm|ForeArm|Hand)\.quaternion$/, swing = o.swing ?? 1;
  const idle = idleAct.getClip();
  for (const t of walk.tracks.filter((t) => ARM.test(t.name))) {
    const it = idle.tracks.find((x) => x.name === t.name); if (!it) continue;
    const rest = new Q().fromArray(it.values, 0);         // поза кістки в першому кадрі стійки
    const v = t.values, n = v.length / 4, qs = [];
    // середній поворот: сума кватерніонів (усі «в одну півсферу», бо q і −q — той самий поворот), нормована
    const mean = new Q(0, 0, 0, 0);
    for (let i = 0; i < n; i++) {
      const q = new Q().fromArray(v, i * 4); if (i && q.dot(qs[0]) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      qs.push(q); mean.x += q.x; mean.y += q.y; mean.z += q.z; mean.w += q.w;
    }
    mean.normalize(); const inv = mean.clone().invert(), id = new Q();
    const s = /Hand/.test(t.name) ? swing * 0.5 : swing;   // кисть — удвічі спокійніше: інакше «махає» долонею назовні
    qs.forEach((q, i) => {
      const delta = inv.clone().multiply(q);               // розмах відносно середньої пози
      id.set(0, 0, 0, 1).slerp(delta, s);                  // s < 1 — менший розмах
      rest.clone().multiply(id).toArray(v, i * 4);         // нова поза = стійка + розмах
    });
  }
  // Поправки рахуємо від пози стійки: ставимо модель у перший кадр стійки, щоб знати, куди дивляться кістки
  idleAct.reset().play(); mixer.setTime(0); model.updateMatrixWorld(true);
  const DEG = Math.PI / 180, rot = (ax, a) => new Q().setFromAxisAngle(ax, a);
  for (const side of ['Left', 'Right']) {
    const [arm, fore, hand] = ['Arm', 'ForeArm', 'Hand'].map((b) => model.getObjectByName(side + b));
    const ta = walk.tracks.find((t) => t.name === side + 'Arm.quaternion');
    const tf = walk.tracks.find((t) => t.name === side + 'ForeArm.quaternion');
    if (!arm || !fore || !hand || !ta || !tf) continue;
    const axA = hingeAxis(arm, hand, model), axF = hingeAxis(fore, hand, model), restA = arm.quaternion.clone();
    // плече: кут маху в кожному кадрі (+ вперед) і зсув уперед на fwd
    const swingA = [];
    for (let i = 0; i < ta.values.length / 4; i++) {
      const q = new Q().fromArray(ta.values, i * 4);
      // мах = поворот відносно стійки, розкладений на вісь «уперед-назад» (так звана «закрутка» навколо осі)
      const r = q.clone().multiply(restA.clone().invert());
      swingA.push(2 * Math.atan2(r.x * axA.x + r.y * axA.y + r.z * axA.z, r.w));
      q.premultiply(rot(axA, (o.fwd || 0) * DEG)).toArray(ta.values, i * 4);
    }
    // лікоть: базовий згин + додатковий, коли рука йде вперед (кадри передпліччя й плеча в Meshy збігаються;
    // якщо раптом ні — лише базовий згин)
    const same = tf.times.length === ta.times.length;
    for (let i = 0; i < tf.values.length / 4; i++) {
      const extra = same ? Math.max(0, swingA[i]) * (o.elbowGain || 0) : 0;
      new Q().fromArray(tf.values, i * 4).premultiply(rot(axF, (o.elbow || 0) * DEG + extra)).toArray(tf.values, i * 4);
    }
  }
  idleAct.stop();
}

// Вісь «вперед-назад» для кістки (шарнір плеча чи ліктя): бічна вісь героя, записана в координатах батьківської
// кістки (поворот кістки задається відносно батька). Знак перевіряємо пробою: повертаємо на 10° і дивимось,
// чи кисть пішла вперед (+z моделі); якщо назад — вісь перевертаємо. Так не треба знати, як Meshy розвернув осі.
function hingeAxis(bone, hand, model) {
  const Q = THREE.Quaternion, V = THREE.Vector3;
  const ax = new V(1, 0, 0).applyQuaternion(model.getWorldQuaternion(new Q()))
    .applyQuaternion(bone.parent.getWorldQuaternion(new Q()).invert());
  const z = () => model.worldToLocal(hand.getWorldPosition(new V())).z, z0 = z(), q0 = bone.quaternion.clone();
  bone.quaternion.premultiply(new Q().setFromAxisAngle(ax, 0.17)); bone.updateMatrixWorld(true);
  const z1 = z(); bone.quaternion.copy(q0); bone.updateMatrixWorld(true);
  return z1 > z0 ? ax : ax.negate();
}

// Швидкість ходи з анімації (px/с). Анімація йде «на місці»: ступня, що стоїть на підлозі, їде назад рівно з тією
// швидкістю, з якою герой мав би йти вперед. Проганяємо цикл ходи по кадрах, для кожного кроку беремо нижчу ступню
// (вона на підлозі) і міряємо, скільки вона проїхала назад (модель дивиться вздовж +z).
function strideSpeed(model, mixer, act, scale) {
  const feet = ['LeftFoot', 'RightFoot'].map((n) => model.getObjectByName(n));
  if (feet.some((f) => !f)) return 220;
  const N = 60, T = act.getClip().duration, pts = [];
  act.reset().play();
  for (let i = 0; i <= N; i++) {
    mixer.setTime(T * i / N); model.updateMatrixWorld(true);
    pts.push(feet.map((f) => model.worldToLocal(f.getWorldPosition(new THREE.Vector3()))));
  }
  act.stop(); mixer.setTime(0);
  let back = 0;
  for (let i = 1; i <= N; i++) { const k = pts[i][0].y < pts[i][1].y ? 0 : 1; back += pts[i - 1][k].z - pts[i][k].z; }
  const v = back / T * scale;
  return v > 60 && v < 500 ? v : 220;                // захист від дивних анімацій: розумні межі
}

// рядок підлоги (y екрану в кімнаті) → глибина d; поза смугою підлоги — null
export const depthAt = (y) => (y > FEET_BACK + 40 ? null : THREE.MathUtils.clamp((FEET_BACK - y) / (FEET_BACK - FEET_FRONT), 0, 1));
