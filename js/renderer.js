// ===== renderer.js =====
// Todas as funções de desenho do jogo.
// Recebem `ctx` como parâmetro — o canvas offscreen lógico (224×320).
// Leem DK.game e DK.ScoreSystem para os dados do HUD.
//
// ── Pixel-perfect: boas práticas adotadas aqui ────────────────────────────
//  1. Nenhum fillText — todo texto usa bitmapText() com fillRect por glifo.
//  2. Vigas inclinadas são desenhadas coluna a coluna com fillRect, eliminando
//     o antialiasing de path/fill em bordas diagonais.
//  3. Todas as coordenadas passadas para fillRect/fillText são inteirizadas
//     com pxI() (Math.round). A física lê os valores originais (float); apenas
//     o render usa os arredondados.
//  4. strokeRect é evitado (bordas de 1px em sub-pixel ficam borradas);
//     substituído por quatro fillRect de 1px.
//  5. rgba(0,0,0,0.75) do overlay ainda gera semi-transparência — isso é
//     intencional (overlay de game over/tela) e não causa bordas borradas
//     porque é um fillRect inteiro (sem bordas diagonais).

var DK = window.DK || {};

(function () {
  'use strict';

  var C = DK.CONST;

  // ── UTILITÁRIO: inteiriza coordenada para render ───────────────────────────
  // Math.round garante que cada pixel lógico coincida com um pixel inteiro
  // no buffer offscreen, eliminando bordas semi-transparentes por sub-pixel.
  // NÃO use este valor na física — só no render.
  function pxI(v) { return Math.round(v) | 0; }

  // ── FONTE BITMAP ──────────────────────────────────────────────────────────
  // Cada glifo é descrito como um array de strings binárias de 5 chars:
  //   '1' = pixel aceso, '0' = pixel apagado
  // Grade: FONT_CW(5) × FONT_CH(7) pixels por glifo.
  // Cobertura: A-Z, 0-9, espaço, : ! - . / * = @ + ' ? ( ) # %
  // Os chars efetivamente usados nas telas do jogo são marcados com (*).
  var FONT_GLYPHS = {
    'A': ['01110','10001','10001','11111','10001','10001','10001'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    'C': ['01111','10000','10000','10000','10000','10000','01111'],
    'D': ['11110','10001','10001','10001','10001','10001','11110'],
    'E': ['11111','10000','10000','11110','10000','10000','11111'],
    'F': ['11111','10000','10000','11110','10000','10000','10000'],
    'G': ['01111','10000','10000','10111','10001','10001','01111'],
    'H': ['10001','10001','10001','11111','10001','10001','10001'],
    'I': ['01110','00100','00100','00100','00100','00100','01110'],
    'J': ['00011','00001','00001','00001','00001','10001','01110'],
    'K': ['10001','10010','10100','11000','10100','10010','10001'],
    'L': ['10000','10000','10000','10000','10000','10000','11111'],
    'M': ['10001','11011','10101','10001','10001','10001','10001'],
    'N': ['10001','11001','10101','10011','10001','10001','10001'],
    'O': ['01110','10001','10001','10001','10001','10001','01110'],
    'P': ['11110','10001','10001','11110','10000','10000','10000'],
    'Q': ['01110','10001','10001','10001','10101','10010','01101'],
    'R': ['11110','10001','10001','11110','10100','10010','10001'],
    'S': ['01111','10000','10000','01110','00001','00001','11110'],
    'T': ['11111','00100','00100','00100','00100','00100','00100'],
    'U': ['10001','10001','10001','10001','10001','10001','01110'],
    'V': ['10001','10001','10001','10001','10001','01010','00100'],
    'W': ['10001','10001','10001','10101','10101','11011','10001'],
    'X': ['10001','10001','01010','00100','01010','10001','10001'],
    'Y': ['10001','10001','01010','00100','00100','00100','00100'],
    'Z': ['11111','00001','00010','00100','01000','10000','11111'],
    '0': ['01110','10001','10011','10101','11001','10001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00010','00100','01000','11111'],
    '3': ['11111','00001','00010','00110','00001','10001','01110'],
    '4': ['00010','00110','01010','10010','11111','00010','00010'],
    '5': ['11111','10000','10000','11110','00001','00001','11110'],
    '6': ['00110','01000','10000','11110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00010','01100'],
    ' ': ['00000','00000','00000','00000','00000','00000','00000'],
    ':': ['00000','00100','00100','00000','00100','00100','00000'],
    '!': ['00100','00100','00100','00100','00100','00000','00100'],
    '-': ['00000','00000','00000','11111','00000','00000','00000'],
    '.': ['00000','00000','00000','00000','00000','00000','00100'],
    '/': ['00001','00001','00010','00100','01000','10000','10000'],
    '*': ['00000','10101','01110','11111','01110','10101','00000'],
    '=': ['00000','00000','11111','00000','11111','00000','00000'],
    '@': ['01110','10001','10101','10111','10100','10001','01110'],
    '+': ['00000','00100','00100','11111','00100','00100','00000'],
    "'": ['00100','00100','00100','00000','00000','00000','00000'],
    '?': ['01110','10001','00001','00110','00100','00000','00100'],
    '(': ['00010','00100','01000','01000','01000','00100','00010'],
    ')': ['01000','00100','00010','00010','00010','00100','01000'],
    '#': ['01010','01010','11111','01010','11111','01010','01010'],
    '%': ['11000','11001','00010','00100','01000','10011','00011'],
    '<': ['00010','00100','01000','10000','01000','00100','00010'],
    '>': ['01000','00100','00010','00001','00010','00100','01000'],
  };

  // bitmapText: desenha `text` no contexto a partir de (x, y) com a cor dada.
  // x, y são o canto superior-esquerdo do primeiro glifo.
  // scale: fator inteiro de ampliação dos pixels (padrão 1).
  // Retorna a largura total em pixels lógicos (para centralização).
  function bitmapText(ctx, text, x, y, color, scale) {
    scale = scale || 1;
    var cw  = C.FONT_CW * scale;  // largura de cada glifo em pixels lógicos
    var gap = scale;               // 1px de espaço entre glifos (escalonado)
    ctx.fillStyle = color;
    x = pxI(x);
    y = pxI(y);
    for (var ci = 0; ci < text.length; ci++) {
      var ch_char = text[ci].toUpperCase();
      var glyph   = FONT_GLYPHS[ch_char] || FONT_GLYPHS[' '];
      for (var row = 0; row < glyph.length; row++) {
        for (var col = 0; col < glyph[row].length; col++) {
          if (glyph[row][col] === '1') {
            ctx.fillRect(
              x + ci * (cw + gap) + col * scale,
              y + row * scale,
              scale,
              scale
            );
          }
        }
      }
    }
    return text.length * (cw + gap);
  }

  // bitmapTextWidth: calcula a largura em pixels lógicos sem desenhar nada.
  function bitmapTextWidth(text, scale) {
    scale = scale || 1;
    return text.length * (C.FONT_CW * scale + scale);
  }

  // bitmapTextCenter: centraliza o texto em torno de cx (centro horizontal).
  function bitmapTextCenter(ctx, text, cx, y, color, scale) {
    var w = bitmapTextWidth(text, scale);
    bitmapText(ctx, text, pxI(cx - w / 2), y, color, scale);
  }

  // ── FUNDO ─────────────────────────────────────────────────────────────────
  function drawBackground(ctx) {
    ctx.fillStyle = C.CLR_BG;
    ctx.fillRect(0, 0, C.W, C.H);
  }

  // ── VIGAS ─────────────────────────────────────────────────────────────────
  // Desenhadas coluna a coluna com fillRect(x, y, 1, THICK) para evitar o
  // antialiasing que o navegador aplica a paths/polígonos com bordas diagonais.
  // Para cada coluna x de x1 a x2 calculamos a altura da superfície da viga
  // por interpolação linear, depois desenhamos THICK pixels para baixo.
  function drawBeams(ctx) {
    var beams = DK.LEVELS[DK.game.levelIndex].beams;
    var THICK = 5;  // altura visual da viga (px)

    beams.forEach(function (beam) {
      var ix1 = pxI(beam.x1);
      var ix2 = pxI(beam.x2);
      var iy1 = pxI(beam.y1);
      var iy2 = pxI(beam.y2);
      var span = ix2 - ix1;
      if (span <= 0) return;

      // Desenha coluna a coluna: evita path/fill com antialiasing diagonal
      for (var x = ix1; x <= ix2; x++) {
        // Altura da superfície nesta coluna (interpolação linear)
        var t    = (x - ix1) / span;
        var topY = pxI(iy1 + t * (iy2 - iy1));

        // Corpo principal da viga
        ctx.fillStyle = C.CLR_BEAM;
        ctx.fillRect(x, topY + 1, 1, THICK - 1);

        // Borda superior mais clara (destaque da superfície)
        ctx.fillStyle = '#ff88bb';
        ctx.fillRect(x, topY, 1, 1);

        // Padrão de treliça: a cada 8 px, desenha um ponto rosado no meio
        if (((x - ix1) % 8) < 2) {
          ctx.fillStyle = '#ff4488';
          ctx.fillRect(x, topY + 2, 1, 2);
        }
      }
    });
  }

  // ── ESCADAS ───────────────────────────────────────────────────────────────
  function drawLadders(ctx) {
    var ladders = DK.LEVELS[DK.game.levelIndex].ladders;
    var W = 8; // largura da escada

    ladders.forEach(function (lad) {
      var x       = pxI(lad.x);
      var yTop    = pxI(lad.yTop);
      var yBottom = pxI(lad.yBottom);
      var color   = lad.broken ? '#007788' : C.CLR_LADDER;

      // Trilhos laterais
      ctx.fillStyle = color;
      ctx.fillRect(x - (W >> 1),         yTop, 2, yBottom - yTop);
      ctx.fillRect(x + (W >> 1) - 2,     yTop, 2, yBottom - yTop);

      // Degraus
      var totalH = yBottom - yTop;
      var steps  = Math.floor(totalH / 4);
      for (var i = 0; i <= steps; i++) {
        var sy = yTop + i * 4;
        if (lad.broken && i > steps * 0.3 && i < steps * 0.7) continue;
        ctx.fillRect(x - (W >> 1) + 2, sy, W - 4, 1);
      }
    });
  }

  // ── BORDA RETANGULAR SEM strokeRect ──────────────────────────────────────
  // strokeRect com lineWidth=1 gera bordas de 0.5px em cada lado — borradas.
  // Substituímos por quatro fillRect de 1px de espessura.
  function fillBorder(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x,         y,         w, 1); // topo
    ctx.fillRect(x,         y + h - 1, w, 1); // baixo
    ctx.fillRect(x,         y,         1, h); // esquerda
    ctx.fillRect(x + w - 1, y,         1, h); // direita
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  function drawHUD(ctx) {
    var sc = DK.ScoreSystem;

    // HIGH SCORE (centralizado no topo) — escala 1
    bitmapTextCenter(ctx, 'HIGH SCORE', C.W / 2, 2, C.CLR_MARIO, 1);

    // Pontuações — escala 1
    bitmapText(ctx, String(sc.score).padStart(6, '0'),     2,  10, C.CLR_HUD, 1);
    bitmapText(ctx, String(sc.highScore).padStart(6, '0'), pxI(C.W / 2 - bitmapTextWidth('000000', 1) / 2), 10, C.CLR_HUD, 1);

    // Nível atual (ex: L=02) — escala 1
    bitmapText(ctx, 'L=' + String(sc.level).padStart(2, '0'), 175, 10, C.CLR_HUD_BLU, 1);

    // Ícones de vidas (mini-Marios) — mantidos como fillRect (não são texto)
    ctx.fillStyle = C.CLR_MARIO;
    for (var i = 0; i < DK.game.lives; i++) {
      var lx = 2 + i * 12, ly = 18;
      ctx.fillRect(lx + 1, ly,     4, 2); // boné
      ctx.fillRect(lx,     ly + 2, 6, 2); // corpo
      ctx.fillRect(lx,     ly + 4, 2, 2); // perna esq
      ctx.fillRect(lx + 4, ly + 4, 2, 2); // perna dir
    }

    // Caixa BONUS: borda com fillBorder + texto bitmap
    var bx = pxI(158), by = pxI(18);
    fillBorder(ctx, bx, by, 62, 16, C.CLR_BONUS);
    bitmapText(ctx, 'BONUS', bx + 4, by + 2, C.CLR_BONUS, 1);
    bitmapText(ctx, String(sc.bonus).padStart(5, ' '), bx + 4, by + 10, C.CLR_HUD, 1);
  }

  // ── TELA DE MENU ──────────────────────────────────────────────────────────
  function drawMenuScreen(ctx) {
    ctx.fillStyle = C.CLR_BG;
    ctx.fillRect(0, 0, C.W, C.H);

    // Título em escala 2 (10px → 2 × (5+1) = 12px de largura por char)
    bitmapTextCenter(ctx, 'DONKEY KONG', C.W / 2, 62, C.CLR_MARIO, 2);

    // Instruções em escala 1
    bitmapTextCenter(ctx, 'PRESSIONE  ENTER', C.W / 2, 104, C.CLR_HUD, 1);
    bitmapTextCenter(ctx, 'PARA INICIAR',     C.W / 2, 115, C.CLR_HUD, 1);

    bitmapTextCenter(ctx, 'CONTROLES:', C.W / 2, 145, C.CLR_BONUS, 1);
    bitmapText(ctx, 'SETAS/A-D  - MOVER',  pxI(C.W / 2 - bitmapTextWidth('SETAS/A-D  - MOVER', 1) / 2), 157, '#aaaaaa', 1);
    bitmapText(ctx, 'ESPACO     - PULAR',  pxI(C.W / 2 - bitmapTextWidth('ESPACO     - PULAR', 1) / 2), 167, '#aaaaaa', 1);
    bitmapText(ctx, 'CIMA/BAIXO - ESCADA', pxI(C.W / 2 - bitmapTextWidth('CIMA/BAIXO - ESCADA', 1) / 2), 177, '#aaaaaa', 1);

    bitmapTextCenter(ctx,
      'HIGH SCORE  ' + String(DK.ScoreSystem.highScore).padStart(6, '0'),
      C.W / 2, 208, C.CLR_HUD_BLU, 1);

    // Mini DK decorativo (mantido como fillRect — não é texto)
    ctx.fillStyle = C.CLR_DK;
    ctx.fillRect(92, 230, 32, 24);
    ctx.fillRect(96, 224, 24, 12);

    // Indicador de som: "SOM: LIGADO/M" ou "SOM: DESLIGADO/M"
    // Posicionado no canto inferior da tela do menu, discreto.
    var somLabel = DK.audio.isMuted() ? 'SOM: DESLIGADO' : 'SOM: LIGADO';
    var somCor   = DK.audio.isMuted() ? '#555555' : '#00cc44';
    bitmapTextCenter(ctx, somLabel + '  M', C.W / 2, 300, somCor, 1);
  }

  // ── TELA GAME OVER ────────────────────────────────────────────────────────
  function drawGameOverScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, C.W, C.H);

    // 'GAME  OVER' em escala 2
    bitmapTextCenter(ctx, 'GAME  OVER', C.W / 2, 122, C.CLR_MARIO, 2);
    // Placar em escala 1
    bitmapTextCenter(ctx, 'SCORE  ' + String(DK.ScoreSystem.score).padStart(6, '0'), C.W / 2, 148, C.CLR_HUD, 1);
    bitmapTextCenter(ctx, 'ENTER PARA REINICIAR', C.W / 2, 173, C.CLR_BONUS, 1);
  }

  // ── TELA LEVEL COMPLETE ───────────────────────────────────────────────────
  function drawLevelCompleteScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, C.W, C.H);

    bitmapTextCenter(ctx, 'LEVEL COMPLETE!', C.W / 2, 122, '#ffff00', 2);
    bitmapTextCenter(ctx, 'BONUS  +' + DK.ScoreSystem.bonus, C.W / 2, 148, C.CLR_HUD, 1);
    bitmapTextCenter(ctx, 'SCORE  ' + String(DK.ScoreSystem.score).padStart(6, '0'), C.W / 2, 158, C.CLR_HUD, 1);

    var nextIdx = DK.game.levelIndex + 1;
    if (nextIdx < DK.LEVELS.length) {
      bitmapTextCenter(ctx, 'PROXIMO  L=' + String(nextIdx + 1).padStart(2, '0'), C.W / 2, 174, C.CLR_BONUS, 1);
    } else {
      bitmapTextCenter(ctx, 'FASE FINAL COMPLETA!', C.W / 2, 174, '#ffff00', 1);
    }
  }

  // ── TELA WIN FINAL ────────────────────────────────────────────────────────
  function drawWinScreen(ctx) {
    var sc    = DK.ScoreSystem;
    var g     = DK.game;
    var blink = Math.floor(Date.now() / 500) % 2 === 0;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.W, C.H);

    bitmapTextCenter(ctx, 'CONGRATULATIONS!', C.W / 2, 52, '#ffff00', 2);

    // Separadores — fillRect simples, sem borda diagonal
    ctx.fillStyle = C.CLR_BEAM;
    ctx.fillRect(20, 70, C.W - 40, 1);

    bitmapTextCenter(ctx, 'FINAL SCORE', C.W / 2, 82, C.CLR_HUD, 1);
    bitmapTextCenter(ctx, String(sc.score).padStart(6, '0'), C.W / 2, 92, '#ffff00', 2);

    bitmapTextCenter(ctx, 'HIGH SCORE', C.W / 2, 114, C.CLR_HUD, 1);
    bitmapTextCenter(ctx, String(sc.highScore).padStart(6, '0'), C.W / 2, 124, C.CLR_HUD, 1);

    if (sc.score >= sc.highScore && sc.score > 0 && blink) {
      bitmapTextCenter(ctx, '** NEW RECORD! **', C.W / 2, 140, '#ffff00', 1);
    }

    ctx.fillStyle = C.CLR_BEAM;
    ctx.fillRect(20, 150, C.W - 40, 1);

    bitmapText(ctx, 'FASES CONCLUIDAS  3/3', pxI(C.W / 2 - bitmapTextWidth('FASES CONCLUIDAS  3/3', 1) / 2), 162, C.CLR_HUD, 1);
    bitmapText(ctx, 'VIDAS RESTANTES   ' + g.lives, pxI(C.W / 2 - bitmapTextWidth('VIDAS RESTANTES   ' + g.lives, 1) / 2), 172, C.CLR_HUD, 1);

    ctx.fillStyle = C.CLR_BEAM;
    ctx.fillRect(20, 182, C.W - 40, 1);

    if (blink) {
      bitmapTextCenter(ctx, 'PRESS ENTER TO PLAY AGAIN', C.W / 2, 194, C.CLR_BONUS, 1);
    }
  }

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  // Chamado uma vez por frame (após todos os updates).
  // Recebe o ctx do canvas offscreen lógico (224×320).
  DK.render = function (ctx) {
    drawBackground(ctx);

    if (DK.game.state === 'MENU') {
      drawMenuScreen(ctx);
      return;
    }

    if (DK.game.state === 'WIN') {
      drawWinScreen(ctx);
      return;
    }

    drawBeams(ctx);
    drawLadders(ctx);
    DK.OilBarrel.draw(ctx);

    DK.game.hammers.forEach(function (h) { h.draw(ctx); });

    DK.DonkeyKong.draw(ctx);
    DK.Pauline.draw(ctx);
    DK.game.barrels.forEach(function (b) { b.draw(ctx); });
    DK.game.fireballs.forEach(function (fb) { fb.draw(ctx); });
    DK.Player.draw(ctx);

    drawHUD(ctx);

    if (DK.game.state === 'GAME_OVER')      drawGameOverScreen(ctx);
    if (DK.game.state === 'LEVEL_COMPLETE') drawLevelCompleteScreen(ctx);
  };

}());
