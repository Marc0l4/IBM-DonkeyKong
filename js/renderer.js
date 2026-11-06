// ===== renderer.js =====
// Todas as funções de desenho do jogo.
// Recebem `ctx` como parâmetro — sem acesso direto ao canvas.
// Leem DK.game e DK.ScoreSystem para os dados do HUD.

var DK = window.DK || {};

(function () {
  'use strict';

  var C = DK.CONST;

  // ── FUNDO ─────────────────────────────────────────────────────────────────
  function drawBackground(ctx) {
    ctx.fillStyle = C.CLR_BG;
    ctx.fillRect(0, 0, C.W, C.H);
  }

  // ── VIGAS ─────────────────────────────────────────────────────────────────
  // Cada viga é desenhada como um trapézio inclinado com padrão de treliça
  // (alternância de barras diagonais), imitando o estilo do arcade original.
  function drawBeams(ctx) {
    var beams = DK.LEVELS[DK.game.levelIndex].beams;
    var THICK = 5; // altura visual da viga (px)

    beams.forEach(function (beam) {
      var x1 = beam.x1, y1 = beam.y1, x2 = beam.x2, y2 = beam.y2;

      // Corpo principal da viga (trapézio)
      ctx.fillStyle = C.CLR_BEAM;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 + THICK);
      ctx.lineTo(x1, y1 + THICK);
      ctx.closePath();
      ctx.fill();

      // Padrão de treliça diagonal
      ctx.fillStyle = '#ff4488';
      var len   = x2 - x1;
      var steps = Math.floor(len / 8);
      for (var i = 0; i < steps; i++) {
        var t1 = i / steps, t2 = (i + 1) / steps;
        var lx1 = x1 + t1 * len, ly1 = y1 + t1 * (y2 - y1);
        var lx2 = x1 + t2 * len, ly2 = y1 + t2 * (y2 - y1);
        if (i % 2 === 0) {
          ctx.fillRect(lx1, ly1 + 1, 1, 3);
          ctx.fillRect(lx2, ly2 + 1, 1, 3);
          for (var d = 0; d <= 1; d += 0.33) {
            var dx = lx1 + d * (lx2 - lx1);
            var dy = ly1 + d * (ly2 - ly1) + 2;
            ctx.fillRect(Math.round(dx), Math.round(dy), 1, 1);
          }
        }
      }

      // Borda superior mais clara (destaque da superfície)
      ctx.fillStyle = '#ff88bb';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 + 1);
      ctx.lineTo(x1, y1 + 1);
      ctx.closePath();
      ctx.fill();
    });
  }

  // ── ESCADAS ───────────────────────────────────────────────────────────────
  function drawLadders(ctx) {
    var ladders = DK.LEVELS[DK.game.levelIndex].ladders;
    var W = 8; // largura da escada

    ladders.forEach(function (lad) {
      var x = lad.x, yTop = lad.yTop, yBottom = lad.yBottom;
      // Escadas quebradas são mais escuras (decorativas)
      var color = lad.broken ? '#007788' : C.CLR_LADDER;

      // Trilhos laterais
      ctx.fillStyle = color;
      ctx.fillRect(x - W / 2,     yTop, 2, yBottom - yTop);
      ctx.fillRect(x + W / 2 - 2, yTop, 2, yBottom - yTop);

      // Degraus (escada quebrada omite a parte do meio)
      var totalH   = yBottom - yTop;
      var steps    = Math.floor(totalH / 4);
      for (var i = 0; i <= steps; i++) {
        var sy = yTop + i * 4;
        if (lad.broken && i > steps * 0.3 && i < steps * 0.7) continue;
        ctx.fillRect(x - W / 2 + 2, sy, W - 4, 1);
      }
    });
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  function drawHUD(ctx) {
    var sc = DK.ScoreSystem;

    ctx.font = '6px monospace';

    // HIGH SCORE (centralizado no topo)
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillText('HIGH SCORE', 72, 10);

    // Pontuações
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText(String(sc.score).padStart(6, '0'),     2,  18);
    ctx.fillText(String(sc.highScore).padStart(6, '0'), 82, 18);

    // Nível atual (ex: L=02)
    ctx.fillStyle = C.CLR_HUD_BLU;
    ctx.fillText('L=' + String(sc.level).padStart(2, '0'), 175, 18);

    // Ícones de vidas (mini-Marios)
    ctx.fillStyle = C.CLR_MARIO;
    for (var i = 0; i < DK.game.lives; i++) {
      var lx = 2 + i * 12, ly = 24;
      ctx.fillRect(lx + 1, ly,     4, 2); // boné
      ctx.fillRect(lx,     ly + 2, 6, 2); // corpo
      ctx.fillRect(lx,     ly + 4, 2, 2); // perna esq
      ctx.fillRect(lx + 4, ly + 4, 2, 2); // perna dir
    }

    // Caixa BONUS (borda ciano, valor em branco)
    var bx = 158, by = 22;
    ctx.strokeStyle = C.CLR_BONUS;
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, 62, 14);
    ctx.fillStyle = C.CLR_BONUS;
    ctx.fillText('BONUS', bx + 12, by + 7);
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText(String(sc.bonus).padStart(5, ' '), bx + 8, by + 13);

    // Sem linha separadora — ela conflitava com o sprite do DK e o box BONUS
    // que ficam na área y=24..60 após o aumento da altura lógica do canvas.
  }

  // ── TELA DE MENU ──────────────────────────────────────────────────────────
  function drawMenuScreen(ctx) {
    ctx.fillStyle = C.CLR_BG;
    ctx.fillRect(0, 0, C.W, C.H);

    ctx.font = '10px monospace';
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillText('DONKEY KONG', 56, 70);

    ctx.font = '6px monospace';
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText('PRESSIONE  ENTER', 56, 110);
    ctx.fillText('PARA INICIAR',     68, 122);

    ctx.fillStyle = C.CLR_BONUS;
    ctx.fillText('CONTROLES:',            68, 152);
    ctx.fillStyle = '#aaa';
    ctx.fillText('SETAS / A-D : MOVER',   46, 164);
    ctx.fillText('ESPACO      : PULAR',   46, 174);
    ctx.fillText('CIMA / BAIXO: ESCADA',  46, 184);

    ctx.fillStyle = C.CLR_HUD_BLU;
    ctx.fillText('HIGH SCORE: ' + String(DK.ScoreSystem.highScore).padStart(6, '0'), 50, 215);

    // Mini DK decorativo
    ctx.fillStyle = C.CLR_DK;
    ctx.fillRect(92, 240, 32, 24);
    ctx.fillRect(96, 234, 24, 12);
  }

  // ── TELA GAME OVER ────────────────────────────────────────────────────────
  function drawGameOverScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, C.W, C.H);

    ctx.font = '10px monospace';
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillText('GAME  OVER', 62, 130);

    ctx.font = '6px monospace';
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText('SCORE: ' + String(DK.ScoreSystem.score).padStart(6, '0'), 72, 150);
    ctx.fillStyle = C.CLR_BONUS;
    ctx.fillText('ENTER PARA REINICIAR', 40, 180);
  }

  // ── TELA LEVEL COMPLETE ───────────────────────────────────────────────────
  function drawLevelCompleteScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, C.W, C.H);

    ctx.font = '8px monospace';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('LEVEL COMPLETE!', 52, 130);

    ctx.font = '6px monospace';
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText('BONUS: +' + DK.ScoreSystem.bonus, 72, 150);
    ctx.fillText('SCORE: ' + String(DK.ScoreSystem.score).padStart(6, '0'), 72, 162);


    // Indica a próxima fase (só se não for a última)
    var nextIdx = DK.game.levelIndex + 1; // levelIndex ainda não foi incrementado aqui
    if (nextIdx < DK.LEVELS.length) {
      ctx.fillStyle = C.CLR_BONUS;
      ctx.fillText('PROXIMO: L=' + String(nextIdx + 1).padStart(2, '0'), 68, 182);
    } else {
      // Última fase concluída — anuncia a vitória final
      ctx.fillStyle = '#ffff00';
      ctx.fillText('FASE FINAL COMPLETA!', 42, 182);
    }
  }

  // ── TELA WIN FINAL (placar completo após fase 3) ─────────────────────────
  // Tela full-screen (fundo preto sólido, não overlay) com estilo arcade.
  // "NEW RECORD!" pisca alternando a cada 500ms usando Date.now().
  function drawWinScreen(ctx) {
    var sc   = DK.ScoreSystem;
    var g    = DK.game;
    // Pisca a cada 500ms: Date.now() / 500 é um inteiro que alterna par/ímpar
    var blink = Math.floor(Date.now() / 500) % 2 === 0;

    // Fundo preto sólido (não overlay — é a tela principal de vitória)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.W, C.H);

    // Título
    ctx.font = '8px monospace';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('CONGRATULATIONS!', 36, 60);

    // Separador decorativo
    ctx.fillStyle = C.CLR_BEAM;
    ctx.fillRect(20, 68, C.W - 40, 1);

    // Placar
    ctx.font = '6px monospace';
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText('FINAL SCORE', 72, 90);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#ffff00';
    ctx.fillText(String(sc.score).padStart(6, '0'), 76, 104);

    ctx.font = '6px monospace';
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText('HIGH SCORE', 74, 122);
    ctx.fillText(String(sc.highScore).padStart(6, '0'), 82, 134);

    // "NEW RECORD!" pisca se o score atual bate o recorde
    if (sc.score >= sc.highScore && sc.score > 0 && blink) {
      ctx.fillStyle = '#ffff00';
      ctx.fillText('** NEW RECORD! **', 52, 150);
    }

    // Separador
    ctx.fillStyle = C.CLR_BEAM;
    ctx.fillRect(20, 158, C.W - 40, 1);

    // Estatísticas da partida
    ctx.fillStyle = C.CLR_HUD;
    ctx.fillText('FASES CONCLUIDAS: 3/3', 38, 174);
    ctx.fillText('VIDAS RESTANTES:  ' + g.lives, 38, 186);

    // Separador
    ctx.fillStyle = C.CLR_BEAM;
    ctx.fillRect(20, 194, C.W - 40, 1);

    // "PRESS ENTER" piscando
    if (blink) {
      ctx.fillStyle = C.CLR_BONUS;
      ctx.fillText('PRESS ENTER TO PLAY AGAIN', 26, 214);
    }
  }

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  // Chamado uma vez por frame (após todos os updates)
  DK.render = function (ctx) {
    drawBackground(ctx);

    if (DK.game.state === 'MENU') {
      drawMenuScreen(ctx);
      return;
    }

    // WIN é tela full-screen — não desenha a fase por baixo
    if (DK.game.state === 'WIN') {
      drawWinScreen(ctx);
      return;
    }

    // Fase ativa: desenha o cenário e entidades
    drawBeams(ctx);
    drawLadders(ctx);
    DK.OilBarrel.draw(ctx);

    // Martelos coletáveis
    DK.game.hammers.forEach(function (h) { h.draw(ctx); });

    // Entidades principais
    DK.DonkeyKong.draw(ctx);
    DK.Pauline.draw(ctx);
    DK.game.barrels.forEach(function (b) { b.draw(ctx); });
    DK.game.fireballs.forEach(function (fb) { fb.draw(ctx); });
    DK.Player.draw(ctx);

    // HUD sempre por cima de tudo
    drawHUD(ctx);

    // Overlays de estado (sobre a fase)
    if (DK.game.state === 'GAME_OVER')      drawGameOverScreen(ctx);
    if (DK.game.state === 'LEVEL_COMPLETE') drawLevelCompleteScreen(ctx);
  };

}());
