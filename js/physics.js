// ===== physics.js =====
// Funções puras de física e detecção de colisão.
// Não dependem de estado global — recebem tudo como parâmetro.
//
// Por que separar da lógica das entidades?
// Porque essas funções são compartilhadas pelo Player, Barris e Fireballs.
// Tê-las aqui evita duplicação e facilita os testes manuais no console.

var DK = window.DK || {};

(function () {
  'use strict';

  /**
   * Retorna a altura (y) de uma viga num dado x por interpolação linear (lerp).
   * Se x estiver fora do segmento [x1, x2], retorna Infinity (sem chão nesse x).
   *
   * Por que lerp e não y1 fixo?
   * As vigas são segmentos inclinados — y varia linearmente com x.
   * t = fração de 0..1 ao longo da viga; y = y1 + t*(y2-y1).
   */
  function beamHeightAt(beam, x) {
    if (x < beam.x1 || x > beam.x2) return Infinity;
    var t = (x - beam.x1) / (beam.x2 - beam.x1);
    return beam.y1 + t * (beam.y2 - beam.y1);
  }

  /**
   * Colisão AABB (Axis-Aligned Bounding Box).
   * Retorna true se os dois retângulos se sobrepõem.
   * Cada retângulo: { x, y, w, h } onde (x,y) é o canto superior esquerdo.
   *
   * Princípio: dois retângulos NÃO se sobrepõem se um está
   * completamente à esquerda, à direita, acima ou abaixo do outro.
   * Negamos essa condição para obter "estão sobrepostos".
   */
  function rectOverlap(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  /**
   * Varre as vigas do array `beams` entre yPrev e yNext (movimento vertical)
   * e retorna a primeira viga cujo topo foi cruzado, com a altura de pouso.
   *
   * Este é o fix do bug de "atravessar plataformas":
   * Em vez de verificar só a posição atual (que pode ter pulado a viga
   * em velocidade alta), varremos o intervalo [yPrev, yNext] e encontramos
   * a primeira viga cruzada.
   *
   * @param {Array}  beams   — array de vigas { x1,y1,x2,y2 }
   * @param {number} cx      — x central do objeto (para o lerp)
   * @param {number} yPrev   — y dos pés antes do movimento
   * @param {number} yNext   — y dos pés após o movimento
   * @param {number} [belowIndex] — se informado, só considera vigas com índice
   *                 MENOR que ele (vigas abaixo da de origem). Usado pelo barril em
   *                 queda para nunca "pousar de volta" na viga de onde acabou de sair.
   * @returns {{ beamIndex, landY }} ou null
   */
  function sweepBeamsDown(beams, cx, yPrev, yNext, belowIndex) {
    var best = null;
    var limit = (belowIndex === undefined) ? beams.length : belowIndex;
    for (var i = 0; i < limit; i++) {
      var h = beamHeightAt(beams[i], cx);
      if (h === Infinity) continue;
      // A viga foi cruzada se estava ACIMA dos pés anteriores (yPrev <= h)
      // e os pés atuais estão ABAIXO dela (yNext >= h).
      // Usamos >= yPrev - 2 para tolerar objetos já parados sobre a viga.
      if (h >= yPrev - 2 && h <= yNext) {
        if (best === null || h < best.landY) {
          best = { beamIndex: i, landY: h };
        }
      }
    }
    return best;
  }

  /**
   * Verifica se o jogador está alinhado com uma escada escalável.
   * Retorna o índice da escada ou -1.
   *
   * @param {Array}  ladders — array de escadas da fase atual
   * @param {number} cx      — x central do jogador
   * @param {number} feet    — y dos pés do jogador
   * @param {boolean} onlyAccessible — ignora escadas quebradas se true
   */
  function findLadderAt(ladders, cx, feet, onlyAccessible) {
    var MARGIN = 5; // tolerância horizontal (px)
    for (var i = 0; i < ladders.length; i++) {
      var l = ladders[i];
      if (onlyAccessible && l.broken) continue;
      if (Math.abs(cx - l.x) > MARGIN) continue;
      if (feet >= l.yTop - 4 && feet <= l.yBottom + 4) return i;
    }
    return -1;
  }

  // Exporta as funções de física
  DK.physics = {
    beamHeightAt:    beamHeightAt,
    rectOverlap:     rectOverlap,
    sweepBeamsDown:  sweepBeamsDown,
    findLadderAt:    findLadderAt,
  };

}());