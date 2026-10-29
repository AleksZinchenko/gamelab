// src/actor.js — 3D-герой у мальованій кімнаті: модель з Meshy (GLB зі скелетом), рухи (хода / дихання), повороти, тінь.
// Підлога в мальованій кімнаті — смуга: «глибина» d=0 біля задньої стіни, d=1 біля глядача. Камера ортографічна
// (без перспективи), тож глибину показуємо так, як художник на картині: що ближче — то нижче на екрані.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const HEIGHT = 400;           // зріст героя у пікселях кімнати за замовчуванням (Ліна: ≈0.8 висоти дверей); інші — clips.height
const TILT = 0.14;           // нахил моделі до глядача (рад): ми дивимось на кімнату трохи згори, як на малюнку
const FEET_BACK = 210, FEET_FRONT = 120;   // y ступнів біля задньої стіни і біля глядача (рядки 870…960 малюнка)

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
    this.walkAct = this.mixer.clipAction(walk);
    this.idles = clips.idle.map((re) => this.mixer.clipAction(clip(re)));
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
  }

  // плавний перехід між рухами (crossfade) — щоб хода не «вмикалась» ривком
  play(name) {
    if (name === this.cur) return;
    this.cur = name; this.fadeTo(name === 'walk' ? this.walkAct : this.idles[this.idleI], 0.25);
  }
  fadeTo(a, secs) { if (a === this.act) return; a.reset().play(); a.crossFadeFrom(this.act, secs, false); this.act = a; }

  walkTo(x, d = this.d) { this.target = { x, d }; this.rest = null; }
  // жест n разів поспіль (лише стоячи); повертає false, якщо такого жесту нема
  gesture(name, n = 1) {
    const a = this.gests[name]; if (!a || this.target) return false;
    this.cur = 'gest'; this.gestN = n; this.fadeTo(a, 0.3); return true;
  }
  get busy() { return this.cur === 'gest' || !!this.target; }

  update(dt, base = 0) {
    let dirX = 0, dirZ = 0;
    if (this.target) {
      // глибину рахуємо у «пікселях підлоги»: d=1 ≈ 300 px кроків уперед, щоб хода вглиб не була блискавичною
      const dx = this.target.x - this.x, dz = (this.target.d - this.d) * 300, dist = Math.hypot(dx, dz);
      if (dist < 4) { this.target = null; }
      else {
        const step = Math.min(dist, this.speed * dt);
        this.x += dx / dist * step; this.d += dz / dist * step / 300;
        dirX = dx / dist; dirZ = dz / dist;
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
