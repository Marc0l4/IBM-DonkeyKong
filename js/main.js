// ===== main.js =====
// Ponto de entrada do jogo.
// Responsabilidades:
//   1. Configurar o canvas (resolução lógica, escala, sem suavização)
//   2. Iniciar o game loop com fixed timestep de 60 Hz
//
// Por que fixed timestep?
// Garante que a física (gravidade, colisões) se comporte de forma idêntica
// independente do monitor (60Hz, 144Hz, etc.).
// O acumulador absorve o tempo "sobrando" entre frames sem deixar a física
// "acelerar" em monitores mais rápidos.

var DK = window.DK || {};

(function () {
  'use strict';

  var C   = DK.CONST;

  // ── CONFIGURAÇÃO DO CANVAS ────────────────────────────────────────────────
  var canvas = document.getElementById('gameCanvas');
  var ctx    = canvas.getContext('2d');

  // Tamanho físico = resolução lógica × escala inteira
  canvas.width  = C.W * C.SCALE;
  canvas.height = C.H * C.SCALE;

  // Desliga a suavização — essencial para pixel art nítida
  ctx.imageSmoothingEnabled = false;

  // Transforma o contexto: todo draw é feito em coords lógicas (W×H)
  // e escalado automaticamente pelo fator SCALE
  ctx.setTransform(C.SCALE, 0, 0, C.SCALE, 0, 0);

  // ── GAME LOOP (Fixed Timestep) ────────────────────────────────────────────
  var FIXED_DT      = 1 / 60;   // 16.67 ms por tick de física
  var MAX_FRAME_TIME = 0.25;    // teto de 250 ms (evita "death spiral" quando
                                // a aba fica em background e o tempo acumula)
  var lastTime    = 0;
  var accumulator = 0;

  function gameLoop(timestamp) {
    var now       = timestamp / 1000; // converte ms → s
    var frameTime = now - lastTime;
    lastTime = now;

    // Aplica o teto para não processar centenas de ticks de uma vez
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    accumulator += frameTime;

    // Processa todos os ticks fixos acumulados (pode ser 0, 1 ou 2 por frame)
    while (accumulator >= FIXED_DT) {
      DK.update(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    // Renderiza uma vez por frame (independente dos ticks de física)
    DK.render(ctx);

    requestAnimationFrame(gameLoop);
  }

  // Inicializa o loop
  requestAnimationFrame(function (ts) {
    lastTime = ts / 1000;
    gameLoop(ts);
  });

}());
