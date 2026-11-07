// ===== systems.js =====
// Sistemas de jogo que orquestram grupos de entidades:
//   BarrelSpawner  — cria e gerencia barris ao longo do tempo
//   FireballSystem — cria e gerencia bolas de fogo (fase 3)
//   ScoreSystem    — pontuação, high score e bonus decrescente

var DK = window.DK || {};

(function () {
  'use strict';

  var C = DK.CONST;

  // ── BARREL SPAWNER ────────────────────────────────────────────────────────
  DK.BarrelSpawner = {
    timer: 0,
    nextSpawn: 2.5,

    reset: function () {
      this.timer = 0;
      this.nextSpawn = 2.5;
      DK.game.barrels = [];
    },

    update: function (dt) {
      this.timer += dt;
      if (this.timer >= this.nextSpawn) {
        this.timer = 0;
        var p = DK.LEVELS[DK.game.levelIndex].params;
        // Intervalo aleatório dentro do range definido na fase
        this.nextSpawn = p.barrelIntervalMin +
          Math.random() * (p.barrelIntervalMax - p.barrelIntervalMin);
        this._spawnBarrel();
        DK.DonkeyKong.triggerThrow();
      }
      // Remove barris destruídos
      DK.game.barrels = DK.game.barrels.filter(function (b) { return b.state !== 'DEAD'; });
      // Limita a 6 barris em tela (performance)
      if (DK.game.barrels.length > 6) {
        DK.game.barrels.splice(0, DK.game.barrels.length - 6);
      }
    },

    _spawnBarrel: function () {
      var lvl   = DK.LEVELS[DK.game.levelIndex];
      var topBeam = lvl.beams[lvl.beams.length - 1]; // última viga = topo
      var spawnX  = topBeam.x1 + 10;
      // y exato da viga no ponto de nascimento (a viga do topo é levemente inclinada)
      var spawnY  = DK.physics.beamHeightAt(topBeam, spawnX + C.BARREL_W / 2) - C.BARREL_H;
      var b = DK.createBarrel(spawnX, spawnY, lvl.beams.length - 1, lvl.params.barrelSpeed);
      // Direção inicial = sentido da inclinação da viga (mesma regra do pouso)
      b.vx = (topBeam.y2 - topBeam.y1) >= 0 ? lvl.params.barrelSpeed : -lvl.params.barrelSpeed;
      DK.game.barrels.push(b);
    },
  };

  // ── FIREBALL SYSTEM ───────────────────────────────────────────────────────
  DK.FireballSystem = {
    reset: function () {
      DK.game.fireballs = [];
      var lvl = DK.LEVELS[DK.game.levelIndex];
      if (!lvl.params.hasFireballs) return;
      // Cria as fireballs definidas nos dados da fase
      lvl.params.fireballs.forEach(function (fd) {
        DK.game.fireballs.push(DK.createFireball(fd.beamIndex, fd.side));
        // SFX de ignição ao nascer cada bola de fogo
        DK.audio.sfx('fireball');
      });
    },

    update: function () {
      DK.game.fireballs.forEach(function (fb) { fb.update(); });
    },
  };

  // ── SCORE SYSTEM ─────────────────────────────────────────────────────────
  DK.ScoreSystem = {
    score:     0,
    highScore: parseInt(localStorage.getItem('dk_highscore') || '0'),
    bonus:     C.BONUS_START || 5000,
    bonusTimer: 0,
    level:     1,  // número da fase exibido no HUD (1-indexed)

    reset: function () {
      // Não reseta o score aqui — é mantido entre fases
      // Chame resetFull() no GAME OVER
      this.bonus      = DK.LEVELS[DK.game.levelIndex].params.bonusStart;
      this.bonusTimer = 0;
    },

    resetFull: function () {
      this.score      = 0;
      this.level      = 1;
      this.bonus      = DK.LEVELS[0].params.bonusStart;
      this.bonusTimer = 0;
    },

    add: function (points) {
      this.score += points;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('dk_highscore', this.highScore);
      }
    },

    update: function (dt) {
      this.bonusTimer += dt;
      if (this.bonusTimer >= C.BONUS_INTERVAL) {
        this.bonusTimer = 0;
        this.bonus = Math.max(0, this.bonus - C.BONUS_TICK);
        // Bonus zerou → Mario perde uma vida
        if (this.bonus === 0 && DK.game.state === 'PLAYING') {
          DK.game.lives--;
          if (DK.game.lives <= 0) {
            DK.game.state = 'GAME_OVER';
          } else {
            this.bonus = DK.LEVELS[DK.game.levelIndex].params.bonusStart;
            DK.Player.reset();
            DK.BarrelSpawner.reset();
          }
        }
      }
    },
  };

}());