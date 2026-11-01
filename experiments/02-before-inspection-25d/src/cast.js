// src/cast.js — колеги Ліни в лабораторії: Двічі, Мирон, Академік. Кожен — 3D-герой (Actor) зі своїми рухами
// і своїм «розпорядком»: раз на кілька секунд щось робить сам. Так у кімнаті живуть персонажі, а не манекени,
// навіть коли гравець їх не чіпає (у Machinarium чи Samorost фонові герої теж весь час щось роблять).
import { Actor } from './actor.js';

// хто де стоїть (x, глибина d), куди дивиться, зріст у px і які рухи з файлу беремо (назви кліпів Meshy)
const CAST = {
  // інженер: кремезний, біля установки; жест — замах ключем (б'є завжди двічі — звідси прізвисько)
  dvichi: { url: 'assets/dvichi.glb', height: 410, x: 1780, d: 0.25, face: 1,
    walk: /^Casual_Walk$/, idle: [/^Idle_02$/, /^Idle_7$/], gest: { hit: /Hammer/ },
    range: [1650, 2550],
    plan: [['hit', 2], ['walk'], ['idle'], ['hit', 2]] },
  // хімік: високий, біля полиць з колбами; сьорбає щось із пробірки, потирає руки
  miron: { url: 'assets/miron.glb', height: 480, x: 3080, d: 0.2, face: -1,
    walk: /^Thoughtful_Walk$/, idle: [/^Idle_9$/, /^Idle_7$/], gest: { drink: /Drink/, rub: /Hand_Rub/ },
    range: [2780, 3280],
    plan: [['drink'], ['rub'], ['walk'], ['idle']] },
  // старий фізик: спить за своїм столом зліва (сидить на кріслі, обличчям до столу, тобто ліворуч).
  // Його хода (старече човгання), «чухає потилицю» і «ура» — на потім, коли прокинеться
  // foot: 80 — п'ятно ширше, ніж у тих, хто стоїть: він сидить, а крісло й лікті на столі займають більше місця
  akademik: { url: 'assets/akademik.glb', height: 460, x: 560, d: 0.02, face: -1, ang: -1.35, foot: 80,
    walk: /Elderly/, idle: [/Sleep_on_Desk/], gest: { scratch: /Confused_Scratch/, cheer: /Cheer/ },
    plan: [] },
};

export async function loadCast(scene) {
  const all = await Promise.all(Object.entries(CAST).map(async ([id, c]) => {
    const a = await Actor.load(c.url, scene, c);
    return { id, a, c, next: 3 + Math.random() * 5 };   // перша дія — через кілька секунд, у кожного своя
  }));
  const cast = Object.fromEntries(all.map((p) => [p.id, p.a]));

  // кожен кадр: оновити героїв; хто стоїть без діла довше за next — бере наступну дію з плану
  cast.update = (dt) => {
    for (const p of all) {
      p.a.update(dt);
      if (!p.c.plan.length || p.a.busy || (p.next -= dt) > 0) continue;
      const [what, n] = p.c.plan[Math.floor(Math.random() * p.c.plan.length)];
      if (what === 'walk') {               // кілька кроків у межах свого куточка
        const [x0, x1] = p.c.range;
        p.a.walkTo(x0 + Math.random() * (x1 - x0), 0.1 + Math.random() * 0.4);
      } else if (what !== 'idle') p.a.gesture(what, n || 1);
      p.next = 5 + Math.random() * 7;
    }
  };
  return cast;
}
