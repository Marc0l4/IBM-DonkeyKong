// ===== input.js =====
// Rastreia o estado do teclado e expõe helpers semânticos.
// Separado em arquivo próprio para que qualquer entidade possa ler input
// sem depender do arquivo de lógica do jogo.

var DK = window.DK || {};

(function () {
  'use strict';

  // Mapa de teclas pressionadas no momento { 'Space': true, ... }
  const keys = {};

  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    // Previne o scroll da página com setas e espaço
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  // Helpers semânticos — facilitam a leitura do código de lógica
  DK.input = {
    left:  function () { return !!(keys['ArrowLeft']  || keys['KeyA']); },
    right: function () { return !!(keys['ArrowRight'] || keys['KeyD']); },
    // ↑/↓ são usados exclusivamente para escadas (sem conflito com pulo)
    up:    function () { return !!(keys['ArrowUp']    || keys['KeyW']); },
    down:  function () { return !!(keys['ArrowDown']  || keys['KeyS']); },
    // Pulo: apenas Espaço — ↑ é reservado para subir escadas
    jump:  function () { return !!keys['Space']; },
    enter: function () { return !!keys['Enter']; },
  };

}());
