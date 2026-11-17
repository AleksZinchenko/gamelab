// live/lang.js — мова гри: українська або англійська (2026-11-17, для itch.io).
// Ідея: у коді всі написи лишаються українськими, а перед малюванням проходять крізь T('…').
// В українському режимі T повертає той самий рядок, в англійському — переклад зі словника EN.
// Так файли рівнів (HINT, TITLE, назви брам) міняти не треба: перекладається там, де текст малюється (hud.js, plaza.js).
(function () {
  const KEY = 'yalynka.lang.v1';                     // вибір гравця в localStorage (окремо від прогресу гри)
  const EN = {
    // екран завантаження (index.html)
    'Завантаження…': 'Loading…',
    // назва гри і головне меню
    'Ялинка до світанку': 'The Tree Before Dawn',
    'Різдвяна пригода в містечку фахверкових будиночків': 'A Christmas adventure in a little half-timbered town',
    'стрілки — вибір, Enter — так, миша теж працює': 'arrows — choose, Enter — confirm, the mouse works too',
    'Грати': 'Play', 'Керування': 'Controls', 'Звук: ': 'Sound: ', 'Музика: ': 'Music: ',
    'увімкнено': 'on', 'вимкнено': 'off', 'Зняти прикраси (нова гра)': 'Take down the decorations (new game)',
    // пауза, кінець рівня, фінал
    'Пауза': 'Paused', 'Продовжити': 'Resume', 'Почати рівень знову': 'Restart level', 'Повернутись на площу': 'Back to the square',
    'Головне меню': 'Main menu', 'Назад': 'Back', 'На площу з добром': 'Carry it to the square', 'Пройти ще раз': 'Play again',
    'Гуляти площею': 'Stroll around the square',
    'Вулицю врятовано!': 'The street is saved!', 'Дахи врятовано!': 'The roofs are saved!', 'Річку врятовано!': 'The river is saved!',
    'Зірку повернуто!': 'The star is back!',
    'Солодощі': 'Sweets', 'Прикраси': 'Ornaments', 'Подарунки': 'Gifts', 'Зірка': 'Star', 'Цукерки на гілках': 'Candy on the branches',
    'Ялинка засяяла!': 'The tree is shining!', 'Зірка на місці — у містечку буде Різдво.': 'The star is back on top — Christmas is coming to town.',
    'Сірі Шарфи вперше прийшли на свято — і шарфи в них тепер кольорові': 'The Grey Scarves finally joined the party — in colourful scarves!',
    // екран «Керування»: ліва колонка — клавіші, права — що роблять
    '← → або A D': '← → or A D', 'біг': 'run', 'Пробіл / ↑': 'Space / ↑', 'стрибок (довше тримаєш — вище)': 'jump (hold longer — jump higher)',
    'X або клік мишею': 'X or mouse click', 'рогатка з шишками (миша — приціл)': 'pine-cone slingshot (mouse to aim)',
    'постріл угору': 'shoot upward', 'хлопавка: оглушує всіх поруч': 'firecracker: stuns everyone nearby', 'Esc або P': 'Esc or P', 'пауза': 'pause', '↑ + X': '↑ + X', 'C': 'C',   // однакові в обох мовах
    // підказки (SIM.HINT і LV.HINT рівнів)
    'стрілки / WASD — біг, Пробіл — стрибок, X або клік — рогатка, C — хлопавка, Esc — пауза':
      'arrows / WASD — run, Space — jump, X or click — slingshot, C — firecracker, Esc — pause',
    'Неси добро до ялинки. Брами на вулиці — ліворуч і праворуч: підійди й натисни ↑':
      'Bring everything back to the tree. The gates are to the left and right: walk up and press ↑',
    '↑ / ↓ біля драбини — лізти. На крутому даху не встоїш: стрибай, поки з’їжджаєш!':
      '↑ / ↓ at a ladder — climb. You can’t stand on a steep roof: jump while you slide!',
    'На льоду ковзко — гальмуй завчасно! Гасильник погасив ліхтар? Влуч у ліхтар шишкою — і він засвітить знову':
      'The ice is slippery — brake early! A snuffer put out a lamp? Hit the lamp with a pine cone and it will light up again',
    'Лізь угору! Стоїш на шестерні — вона везе вбік. На маятник стрибай, коли підлітає':
      'Climb up! A gear carries you sideways. Jump onto a pendulum when it swings close',
    // площа: брами й підказка біля брами
    'Пекарська вулиця': 'Bakers’ Lane', 'Ратушна вежа': 'Town Hall Tower', 'Дахи й димарі': 'Roofs & Chimneys', 'Замерзла річка': 'Frozen River',
    '↑  вирушити': '↑  go', 'Зачинено — скоро!': 'Closed — coming soon!',
    // бос: ім'я (Бурчак — від «бурчати») і підказки трьох фаз
    'Пан Бурчак': 'Mr. Grumble',
    'Збий вугілля шишкою — і воно полетить назад у Бурчака!': 'Hit the coal with a pine cone — it will fly back at Mr. Grumble!',
    'Кинь хлопавку до дзвона, коли Бурчак під ним!': 'Throw a firecracker at the bell when Mr. Grumble is under it!',
    'Наздожени Бурчака на даху й влуч шишкою!': 'Catch Mr. Grumble on the roof and hit him with a pine cone!',
  };
  // стартова мова: збережений вибір гравця; якщо його нема — українська лише для українського браузера, інакше англійська
  let cur = null;
  try { cur = localStorage.getItem(KEY); } catch (e) {}
  if (cur !== 'uk' && cur !== 'en') cur = (navigator.languages || [navigator.language || '']).some((l) => /^uk/i.test(l)) ? 'uk' : 'en';
  // тестовий режим ?lang=en / ?lang=uk — для перевірок, вибір НЕ зберігається
  const q = new URLSearchParams(location.search).get('lang'); if (q === 'uk' || q === 'en') cur = q;
  // missing — рядки без перекладу (якщо щось забули, у консолі: [...LANG.missing])
  const LANG = (window.LANG = { cur, missing: new Set(), EN });
  window.T = (s) => { if (LANG.cur === 'uk' || !s) return s; const e = EN[s]; if (e === undefined) { LANG.missing.add(s); return s; } return e; };
  // перемкнути мову: запам'ятати вибір і поміняти заголовок вкладки
  LANG.set = (l) => { LANG.cur = l; try { localStorage.setItem(KEY, l); } catch (e) {} document.title = T('Ялинка до світанку'); };
  document.title = T('Ялинка до світанку');
})();
