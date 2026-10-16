// in-game sprite sizes in view px: { name: [w, h] } (engine.md §7 "Display size vs texture size")
window.SIZES = {
  bg_room_a: [1794, 1080], bg_room_b: [1794, 1080],   // фон-панорама (зшитий tools/stitch.py)
  lina_anchor: [142, 400],                            // Ліна: 400 px заввишки ≈ 0.8 висоти дверей (510 px)
  akademik_anchor: [237, 320],                        // Академік спить сидячи (стоячи був би ~460 px — високий і тонкий)
  rat_anchor: [140, 46], axel_anchor: [110, 45],      // щуриця на кабелі, Аксель в акваріумі
};
