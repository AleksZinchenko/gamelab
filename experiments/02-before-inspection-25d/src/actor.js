// src/actor.js — 3D-герой у мальованій кімнаті: модель з Meshy (GLB зі скелетом), рухи (хода / дихання), повороти, тінь.
// Підлога в мальованій кімнаті — смуга: «глибина» d=0 біля задньої стіни, d=1 біля глядача. Камера ортографічна
// (без перспективи), тож глибину показуємо так, як художник на картині: що ближче — то нижче на екрані.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const HEIGHT = 400;           // зріст героя у пікселях кімнати (як 2D-Ліна: ≈0.8 висоти дверей)
const SPEED = 260;            // швидкість ходи, px/с — підібрано на пробі так, щоб ступні не ковзали по підлозі
const TILT = 0.14;            // нахил моделі до глядача (рад): ми дивимось на кімнату трохи згори, як на малюнку
const FEET_BACK = 210, FEET_FRONT = 120;   // y ступнів біля задньої стіни і біля глядача (рядки 870…960 малюнка)

export class Actor {
  static async load(url, scene) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new Actor(gltf, scene);
  }

  constructor(gltf, scene) {
    // Ієрархія: tilt (позиція + нахил до глядача) → yaw (поворот, куди дивиться) → модель.
    // Так поворот завжди навколо вертикалі героя, а нахил — спільний для всієї сцени.
    this.tilt = new THREE.Group(); this.yaw = new THREE.Group(); this.tilt.add(this.yaw); scene.add(this.tilt);
    const model = gltf.scene; this.yaw.add(model);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(HEIGHT / size.y);                 // модель Meshy — 1.6 «метра» → 400 px
    this.tilt.rotation.x = TILT;
    model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });   // скелет рухає вершини — рамку не перераховуємо
    // тінь під ногами: темний напівпрозорий овал — без неї герой «висить» над підлогою
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false }));
    this.shadow.scale.set(85, 16, 1); scene.add(this.shadow);
    // рухи: беремо кліпи з файлу за назвою (Meshy називає їх «Armature|walking_man|baselayer» тощо)
    this.mixer = new THREE.AnimationMixer(model);
    const clip = (re) => gltf.animations.find((a) => re.test(a.name));
    this.acts = { walk: this.mixer.clipAction(clip(/walk/i)), idle: this.mixer.clipAction(clip(/idle/i)) };
    this.acts.idle.play(); this.cur = 'idle';
    // стан: позиція в кімнаті (x, глибина d), ціль, куди дивиться (face: 1 праворуч, -1 ліворуч)
    this.x = 1300; this.d = 0.4; this.target = null; this.face = 1; this.ang = 0.6;
  }

  // плавний перехід між рухами (crossfade) — щоб хода не «вмикалась» ривком
  play(name) {
    if (name === this.cur) return;
    const a = this.acts[name], b = this.acts[this.cur];
    a.reset().play(); a.crossFadeFrom(b, 0.25, false); this.cur = name;
  }

  walkTo(x, d = this.d) { this.target = { x, d }; }

  update(dt, base = 0) {
    let dirX = 0, dirZ = 0;
    if (this.target) {
      // глибину рахуємо у «пікселях підлоги»: d=1 ≈ 300 px кроків уперед, щоб хода вглиб не була блискавичною
      const dx = this.target.x - this.x, dz = (this.target.d - this.d) * 300, dist = Math.hypot(dx, dz);
      if (dist < 4) { this.target = null; }
      else {
        const step = Math.min(dist, SPEED * dt);
        this.x += dx / dist * step; this.d += dz / dist * step / 300;
        dirX = dx / dist; dirZ = dz / dist;
        if (Math.abs(dirX) > 0.2) this.face = Math.sign(dirX);
      }
    }
    this.play(this.target ? 'walk' : 'idle');
    // поворот: у ході — по напрямку, але трохи до глядача (як у мальованих героїв у ракурсі 3/4);
    // стоячи — пів-оберту до глядача в бік, куди йшов. Кут доганяємо плавно (не крутимось миттєво).
    const goal = this.target ? Math.atan2(dirX, dirZ + 0.45 * Math.abs(dirX)) : this.face * 0.6;
    let diff = goal - this.ang; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.ang += diff * Math.min(1, dt * 10); this.yaw.rotation.y = this.ang;
    // позиція: ступні на підлозі мальованої кімнати; ближче до глядача — нижче на екрані і трохи більший
    const y = base + FEET_BACK + (FEET_FRONT - FEET_BACK) * this.d, k = 1 + 0.06 * this.d;
    this.tilt.position.set(this.x, y, 40 + this.d * 120); this.tilt.scale.setScalar(k);
    this.shadow.position.set(this.x, y + 2, 39 + this.d * 120); this.shadow.scale.set(85 * k, 16 * k, 1);
    this.mixer.update(dt);
  }
}

// рядок підлоги (y екрану в кімнаті) → глибина d; поза смугою підлоги — null
export const depthAt = (y) => (y > FEET_BACK + 40 ? null : THREE.MathUtils.clamp((FEET_BACK - y) / (FEET_BACK - FEET_FRONT), 0, 1));
