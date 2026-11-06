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

  // ── RESOLUÇÃO FÍSICA DO BUFFER (leva em conta o devicePixelRatio) ────────
  // Em telas HiDPI (Retina, Windows 125%/150%), o navegador mapeia 1 px CSS
  // para dpr px físicos. Se o buffer interno tiver só 224px e o CSS esticar
  // para 672px, o navegador usa interpolação bilinear → borrão.
  //
  // Solução: o buffer interno é dpr vezes maior (ex: 448×640 em dpr=2).
  // Escalamos o contexto por dpr uma única vez, então todo o código de desenho
  // continua usando as coordenadas lógicas (224×320) — sem mudança nas outras
  // funções.
  //
  // IMPORTANTE: canvas.width/height NÃO são alterados no resize para não
  // resetar o contexto (o que desligaria imageSmoothingEnabled).
  // Só são definidos aqui, uma vez.
  var dpr = window.devicePixelRatio || 1;

  canvas.width  = C.W * dpr;
  canvas.height = C.H * dpr;

  // Desliga suavização APÓS definir canvas.width/height (definir as dimensões
  // reseta o contexto 2D, apagando qualquer configuração anterior).
  ctx.imageSmoothingEnabled = false;

  // Escala o contexto para que 1 unidade de desenho = 1 px lógico.
  // Assim todo o código de render/física permanece em coordenadas 224×320.
  ctx.scale(dpr, dpr);

  // ── RESIZE RESPONSIVO (só altera canvas.style, nunca canvas.width/height) ──
  // Calcula a maior escala CSS que cabe na viewport.
  // Usa escala inteira (Math.floor) quando ≥ 1 para preservar pixel art nítido.
  // Em janelas muito pequenas (< resolução lógica) usa fracionária para caber.
  // Math.round final garante que style.width/height seja sempre inteiro de px CSS,
  // evitando sub-pixel rendering que borra o canvas.
  function resizeCanvas() {
    var scaleX = window.innerWidth  / C.W;
    var scaleY = window.innerHeight / C.H;
    var scale  = Math.min(scaleX, scaleY);

    // Escala inteira para pixel art; fracionária só se a janela for menor que o jogo
    if (scale >= 1) scale = Math.floor(scale);

    // Math.round elimina sub-pixels CSS (ex: 224 * 2.99 = 670.x → 671px inteiro)
    canvas.style.width  = Math.round(C.W * scale) + 'px';
    canvas.style.height = Math.round(C.H * scale) + 'px';
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
