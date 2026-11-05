// ===== game.js =====
// Máquina de estados do jogo e update principal.
//
// Estados possíveis:
//   MENU            → tela inicial
//   PLAYING         → jogo em andamento
//   LEVEL_COMPLETE  → tela curta entre fases (mantém score/vidas)
//   WIN             → tela final após vencer a fase 3
//   GAME_OVER       → tela de game over (sem vidas)
//
// A transição PLAYING → LEVEL_COMPLETE → PLAYING (próxima fase)
// é gerenciada por levelCompleteTimer.

var DK = window.DK || {};

(function () {
  'use strict';

  var C = DK.CONST;

  // Estado global do jogo — compartilhado por todos os arquivos via DK.game
  DK.game = {
    state:      'MENU',
    levelIndex: 0,       // índice em DK.LEVELS (0 = fase 1, 1 = fase 2, 2 = fase 3)
    lives:      C.INITIAL_LIVES,
    barrels:    [],
    fireballs:  [],
    hammers:    [],
    levelCompleteTimer: 0,
    _enterPressed: false,
    _jumpedBarrels: [],  // rastro de barris já pontuados no pulo atual
  };

  // ── INICIALIZAÇÃO DA FASE ─────────────────────────────────────────────────
  // Chamado ao iniciar uma nova fase ou ao reiniciar após morte.
  // Não reseta o score nem as vidas — só reposiciona as entidades.
  DK.startLevel = function () {
    var lvl = DK.LEVELS[DK.game.levelIndex];

    // Recria os martelos a partir dos dados da fase
    DK.game.hammers = lvl.hammers.map(function (hd) {
      return DK.createHammer(hd.x, hd.y);
    });

    DK.game.barrels    = [];
    DK.game._jumpedBarrels = [];
    DK.game.state = 'PLAYING';

    // Reposiciona entidades fixas
    DK.DonkeyKong.reset();
    DK.Pauline.reset();
    DK.OilBarrel.reset();
    DK.Player.reset();

    // Sistemas
    DK.BarrelSpawner.reset();
    DK.FireballSystem.reset();
    DK.ScoreSystem.reset();        // reseta apenas o bonus (score e vidas são mantidos)
    DK.ScoreSystem.level = DK.game.levelIndex + 1;
  };

  // ── INÍCIO DO JOGO (do zero) ──────────────────────────────────────────────
  DK.startGame = function () {
    DK.game.levelIndex = 0;
    DK.game.lives      = C.INITIAL_LIVES;
    DK.ScoreSystem.resetFull();
    DK.startLevel();
  };

  // ── UPDATE PRINCIPAL ──────────────────────────────────────────────────────
  // Chamado a cada tick do fixed timestep (dt = 1/60 s).
  DK.update = function (dt) {
    var g   = DK.game;
    var inp = DK.input;

    // ── MENU ────────────────────────────────────────────────────────────────
    if (g.state === 'MENU') {
      if (inp.enter() && !g._enterPressed) {
        g._enterPressed = true;
        DK.startGame();
      }
      if (!inp.enter()) g._enterPressed = false;
      return;
    }

    // ── GAME OVER / WIN ──────────────────────────────────────────────────────
    if (g.state === 'GAME_OVER' || g.state === 'WIN') {
      if (inp.enter() && !g._enterPressed) {
        g._enterPressed = true;
        g.state = 'MENU';
      }
      if (!inp.enter()) g._enterPressed = false;
      return;
    }

    // ── LEVEL COMPLETE ────────────────────────────────────────────────────────
    if (g.state === 'LEVEL_COMPLETE') {
      g.levelCompleteTimer -= dt;
      if (g.levelCompleteTimer <= 0) {
        g.levelIndex++;
        if (g.levelIndex >= DK.LEVELS.length) {
          // Última fase concluída → WIN final
          g.state = 'WIN';
        } else {
          DK.startLevel();
        }
      }
      return;
    }

    // ── PLAYING ───────────────────────────────────────────────────────────────
    DK.OilBarrel.update();
    DK.DonkeyKong.update(dt);
    DK.Pauline.update(dt);

    DK.BarrelSpawner.update(dt);
    DK.FireballSystem.update();
    DK.ScoreSystem.update(dt);

    // Atualiza barris
    g.barrels.forEach(function (b) { b.update(dt); });

    // Atualiza Mario (se morreu, aguarda animação)
    if (DK.Player.state === 'DEAD') {
      DK.Player.update(dt);
      if (DK.Player.deadTimer <= 0) {
        g.lives--;
        if (g.lives <= 0) {
          g.state = 'GAME_OVER';
        } else {
          DK.Player.reset();
          DK.BarrelSpawner.reset();
          DK.ScoreSystem.bonus = DK.LEVELS[g.levelIndex].params.bonusStart;
          DK.ScoreSystem.bonusTimer = 0;
        }
      }
      return; // não verifica colisões enquanto Mario está morto
    }
    DK.Player.update(dt);

    // ── COLISÃO: Mario × Barris ───────────────────────────────────────────
    g.barrels.forEach(function (b, idx) {
      if (b.state === 'DEAD') return;

      // Pulo sobre barril (Mario subindo, barrel abaixo): +100 pts
      // Só conta na subida (vy < 0) e só uma vez por barril por pulo
      if (DK.Player.state === 'JUMPING' && DK.Player.vy < 0) {
        var pi = DK.physics.rectOverlap(DK.Player.hitbox(), { x: b.x - 4, y: b.y, w: b.w + 8, h: b.h });
        if (pi && g._jumpedBarrels.indexOf(idx) === -1) {
          g._jumpedBarrels.push(idx);
          DK.ScoreSystem.add(C.SCORE_JUMP_BARREL);
        }
      }

      // Colisão direta
      if (DK.physics.rectOverlap(DK.Player.hitbox(), b.hitbox())) {
        if (DK.Player.hasHammer) {
          b.state = 'DEAD';
          DK.ScoreSystem.add(C.SCORE_HAMMER_BARREL);
        } else {
          DK.Player.die();
        }
      }
    });

    // Limpa o registro de barris pulados quando Mario pousa
    if (DK.Player.state !== 'JUMPING') g._jumpedBarrels = [];

    // ── COLISÃO: Mario × Fireballs ────────────────────────────────────────
    g.fireballs.forEach(function (fb) {
      if (fb.state === 'DEAD') return;
      if (DK.physics.rectOverlap(DK.Player.hitbox(), fb.hitbox())) {
        DK.Player.die();
      }
    });

    // ── COLISÃO: Mario × Martelos ─────────────────────────────────────────
    g.hammers.forEach(function (h) {
      if (!h.active) return;
      if (DK.physics.rectOverlap(DK.Player.hitbox(), h.hitbox())) {
        h.active = false;
        DK.Player.hasHammer  = true;
        DK.Player.hammerTimer = C.HAMMER_DURATION;
      }
    });

    // ── COLISÃO: Mario × Pauline (vitória da fase!) ───────────────────────
    if (DK.physics.rectOverlap(DK.Player.hitbox(), DK.Pauline.hitbox())) {
      DK.ScoreSystem.add(DK.ScoreSystem.bonus); // bonus restante vira pontos
      g.state = 'LEVEL_COMPLETE';
      g.levelCompleteTimer = C.LEVEL_COMPLETE_TIME;
    }
  };

}());
