// ===== main.js =====
// Ponto de entrada do jogo.
// Responsabilidades:
//   1. Criar o canvas offscreen lógico de 224×320 (sem DPR, sem escala)
//   2. Manter o canvas visível com fator inteiro k × DPR
//   3. A cada frame: atualizar física, desenhar no offscreen, copiar para visível
//   4. Recalcular k, DPR e dimensões do canvas visível a cada resize/mudança de zoom
//
// ── Estratégia de renderização pixel-perfect ─────────────────────────────────
//
//  offscreen (canvas fora do DOM):
//    - Tamanho fixo: 224 × 320 px (resolução lógica do jogo)
//    - ctx: imageSmoothingEnabled = false
//    - Toda a lógica de desenho (renderer.js) recebe ESTE contexto
//    - Coordenadas sempre inteiras (Math.round no render — física intocada)
//
//  canvas visível (#gameCanvas, no DOM):
//    - Tamanho do buffer: 224*k × 320*k  (em pixels físicos)
//    - Tamanho CSS:       (224*k/dpr) × (320*k/dpr)  (em px CSS inteiros)
//    - imageSmoothingEnabled = false  (reaplicado sempre que canvas.width/height mudam)
//    - Recebe o offscreen via drawImage sem interpolação
//
//  k (fator de escala inteiro):
//    k = Math.max(1, Math.floor(Math.min(
//          window.innerWidth  * dpr / 224,
//          window.innerHeight * dpr / 320
//        )))
//    Garantir k inteiro preserva pixel art: cada pixel lógico mapeia para k×k
//    pixels físicos exatos, sem meias amostras.
//
// Por que NÃO usar ctx.scale(dpr) no offscreen?
//   O offscreen tem exatamente W×H pixels. O código de desenho usa coordenadas
//   lógicas diretamente. Não há escala intermediária que possa gerar frações.
//   A escala final (para o DPR e para a janela) acontece apenas no drawImage,
//   uma operação de hardware sem antialiasing quando imageSmoothingEnabled=false.

var DK = window.DK || {};

(function () {
  'use strict';

  var C      = DK.CONST;

  // ── CANVAS OFFSCREEN LÓGICO ──────────────────────────────────────────────
  // Não é inserido no DOM. Tem exatamente 224×320 px — a resolução lógica.
  // Todo o desenho do jogo acontece aqui, sem escala por DPR.
  var offscreen    = document.createElement('canvas');
  offscreen.width  = C.W;
  offscreen.height = C.H;
  var offCtx       = offscreen.getContext('2d');
  offCtx.imageSmoothingEnabled = false;

  // Expõe o offscreen para possível uso de debug (não é necessário para o jogo)
  DK._offscreen = offscreen;

  // ── CANVAS VISÍVEL ───────────────────────────────────────────────────────
  var canvas = document.getElementById('gameCanvas');
  var ctx    = canvas.getContext('2d');

  // ── CÁLCULO DE ESCALA ────────────────────────────────────────────────────
  // dpr:  devicePixelRatio atual (pode mudar com zoom do navegador)
  // k:    fator inteiro mínimo 1 que cabe na viewport física
  // bW/bH: dimensões do buffer visível em pixels físicos (224*k × 320*k)
  // cW/cH: dimensões CSS do canvas (bW/dpr × bH/dpr) — sempre inteiros
  var dpr, k, bW, bH;

  function calcScale() {
    dpr = window.devicePixelRatio || 1;
    k   = Math.max(1, Math.floor(Math.min(
            window.innerWidth  * dpr / C.W,
            window.innerHeight * dpr / C.H
          )));
    bW  = C.W * k;  // largura do buffer visível (px físicos)
    bH  = C.H * k;  // altura do buffer visível (px físicos)
  }

  // ── CONFIGURAÇÃO DO CANVAS VISÍVEL ───────────────────────────────────────
  // Redimensiona o buffer do canvas visível e reaplica imageSmoothingEnabled.
  // ATENÇÃO: atribuir canvas.width/height reseta TODAS as propriedades do
  // contexto 2D (incluindo imageSmoothingEnabled). Por isso reaplicamos logo
  // após cada mudança de dimensão.
  function applyCanvasSize() {
    canvas.width  = bW;
    canvas.height = bH;
    // Contexto foi resetado pelo resize — reaplica configurações necessárias
    ctx.imageSmoothingEnabled = false;

    // Tamanho CSS em px inteiros para evitar sub-pixel rendering do elemento
    canvas.style.width  = Math.round(bW / dpr) + 'px';
    canvas.style.height = Math.round(bH / dpr) + 'px';
  }

  // ── RESIZE HANDLER ───────────────────────────────────────────────────────
  // Chamado ao redimensionar a janela OU quando o zoom/DPR mudar.
  // window.matchMedia com (resolution) detecta mudança de DPR (zoom do browser).
  function resizeCanvas() {
    var prevK   = k;
    var prevDpr = dpr;
    calcScale();
    // Só reaplica se algo mudou (evita reset desnecessário do contexto)
    if (k !== prevK || dpr !== prevDpr) {
      applyCanvasSize();
    }
  }

  // Calcula escala inicial e configura o canvas pela primeira vez
  calcScale();
  applyCanvasSize();

  // Ouve resize de janela
  window.addEventListener('resize', resizeCanvas);

  // Ouve mudança de DPR (zoom do navegador altera window.devicePixelRatio).
  // matchMedia com media query de resolução dispara quando o DPR muda.
  // Registramos e removemos o listener dinamicamente para sempre monitorar
  // o DPR atual, não um valor capturado no início.
  (function registrarMediaQueryDPR() {
    var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    function aoMudarDPR() {
      mq.removeEventListener('change', aoMudarDPR);
      resizeCanvas();
      registrarMediaQueryDPR(); // re-registra para o novo DPR
    }
    mq.addEventListener('change', aoMudarDPR);
  }());

  // ── GAME LOOP (Fixed Timestep 60 Hz) ─────────────────────────────────────
  // Física e lógica a 60 Hz fixos.
  // Render: desenha no offscreen lógico, depois copia para o canvas visível.
  var FIXED_DT       = 1 / 60;
  var MAX_FRAME_TIME = 0.25;
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

    // 1) Desenha no canvas offscreen lógico (224×320, coordenadas inteiras)
    DK.render(offCtx);

    // 2) Copia offscreen → canvas visível sem suavização
    //    drawImage com src=offscreen e dst=(0,0,bW,bH) escala de 224→bW por
    //    hardware, sem antialiasing pois imageSmoothingEnabled=false.
    ctx.drawImage(offscreen, 0, 0, bW, bH);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(function (ts) {
    lastTime = ts / 1000;
    gameLoop(ts);
  });

}());
