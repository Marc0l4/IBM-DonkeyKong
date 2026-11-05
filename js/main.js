// ===== main.js =====
// Ponto de entrada do jogo.
// Responsabilidades:
//   1. Configurar o canvas (resolução lógica fixa interna + escala CSS responsiva)
//   2. Iniciar o game loop com fixed timestep de 60 Hz
//
// Estratégia de escala:
//   - canvas.width / canvas.height ficam sempre na resolução lógica (224×320).
//     Toda a física e o render trabalham nessas coordenadas — sem mudança.
//   - canvas.style.width / canvas.style.height são ajustados pelo CSS via
//     resizeCanvas() para que o canvas ocupe o maior espaço possível sem cortar.
//   - Usamos escala inteira (Math.floor) quando ≥ 1 para manter pixel art nítido;
//     escala fracionária só quando a janela for menor que a resolução lógica.
//   - ctx.setTransform NÃO é mais usado — a escala é toda via CSS, então as
//     coordenadas de desenho permanecem exatamente as lógicas (sem offset).
//
// Por que NÃO usar ctx.setTransform para a escala?
//   setTransform amplia o buffer interno do canvas, que teria que ser W×SCALE
//   de largura. Ao usar CSS, o buffer interno permanece W×H (menor, mais rápido)
//   e o navegador faz o upscale por hardware, sem custo na CPU do JS.

var DK = window.DK || {};

(function () {
  'use strict';

  var C      = DK.CONST;
  var canvas = document.getElementById('gameCanvas');
  var ctx    = canvas.getContext('2d');

  // ── RESOLUÇÃO LÓGICA INTERNA (nunca muda) ────────────────────────────────
  // O canvas interno tem exatamente a resolução lógica do jogo.
  // Todos os draws e coordenadas de física usam esses valores.
  canvas.width  = C.W;  // 224 px lógicos
  canvas.height = C.H;  // 320 px lógicos

  // Desliga a suavização no contexto 2D (garante pixels nítidos no draw)
  ctx.imageSmoothingEnabled = false;

  // ── RESIZE RESPONSIVO ────────────────────────────────────────────────────
  // Calcula a maior escala que cabe na viewport sem cortar o canvas.
  // Usa escala inteira (Math.floor) quando ≥ 1 para manter o visual pixelado.
  // Se a janela for menor que o jogo (improvável, mas possível em mobile muito
  // pequeno), usa escala fracionária para ainda caber.
  function resizeCanvas() {
    var scaleX = window.innerWidth  / C.W;
    var scaleY = window.innerHeight / C.H;
    var scale  = Math.min(scaleX, scaleY);

    // Escala inteira preserva pixel art; fracionária só quando < 1
    if (scale >= 1) scale = Math.floor(scale);

    // Aplica via style — o buffer interno (canvas.width/height) não muda
    canvas.style.width  = (C.W * scale) + 'px';
    canvas.style.height = (C.H * scale) + 'px';
  }

  // Chama imediatamente e a cada resize da janela
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── GAME LOOP (Fixed Timestep 60 Hz) ─────────────────────────────────────
  // O timestep fixo garante que a física seja idêntica em qualquer monitor
  // (60 Hz, 144 Hz, etc.). O acumulador absorve o tempo "sobrando".
  var FIXED_DT       = 1 / 60;
  var MAX_FRAME_TIME = 0.25;  // teto: evita "death spiral" se a aba ficar em background
  var lastTime       = 0;
  var accumulator    = 0;

  function gameLoop(timestamp) {
    var now       = timestamp / 1000;
    var frameTime = now - lastTime;
    lastTime = now;

    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;
    accumulator += frameTime;

    while (accumulator >= FIXED_DT) {
      DK.update(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    DK.render(ctx);
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(function (ts) {
    lastTime = ts / 1000;
    gameLoop(ts);
  });

}());
