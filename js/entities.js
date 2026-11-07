// ===== entities.js =====
// Definição de todas as entidades do jogo:
//   Player, createBarrel, DonkeyKong, Pauline, createHammer, OilBarrel, createFireball
//
// Cada entidade segue o contrato { update(dt), draw(ctx), hitbox() }.
// As entidades leem DK.game.level para saber qual fase está ativa (vigas, escadas).

var DK = window.DK || {};

(function () {
  'use strict';

  // Atalhos locais (definidos em constants.js)
  var C = DK.CONST;
  // ph = physics helpers (definidos em physics.js)
  function ph()  { return DK.physics; }
  // inp = input helpers
  function inp() { return DK.input; }
  // Fase atual (array de dados)
  function lvl() { return DK.LEVELS[DK.game.levelIndex]; }

  // ── Sprites do Mario (desenhados com retângulos, estilo pixel art) ────────

  function _drawMarioIdle(ctx) {
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillRect(-5, 5, 10, 6);        // torso
    ctx.fillStyle = '#2040c0';
    ctx.fillRect(-4, 11, 8, 3);        // pernas (idle)
    ctx.fillStyle = '#f0a060';
    ctx.fillRect(-4, 0, 8, 5);         // cabeça
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillRect(-5, -1, 10, 3);       // boné
    ctx.fillStyle = '#000';
    ctx.fillRect(1, 1, 2, 2);          // olho
    ctx.fillStyle = '#3a1a00';
    ctx.fillRect(-3, 3, 7, 1);         // bigode
    ctx.fillStyle = '#f0a060';
    ctx.fillRect(-6, 6, 2, 3);         // braço esq
    ctx.fillRect(4,  6, 2, 3);         // braço dir
  }

  function _drawMarioWalk(ctx, frame) {
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillRect(-5, 5, 10, 6);
    ctx.fillStyle = '#2040c0';
    if (frame === 1) {
      ctx.fillRect(-5, 11, 4, 3);      // perna esq à frente
      ctx.fillRect( 1, 11, 4, 3);      // perna dir atrás
    } else {
      ctx.fillRect(-4, 11, 8, 3);
    }
    ctx.fillStyle = '#f0a060';
    ctx.fillRect(-4, 0, 8, 5);
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillRect(-5, -1, 10, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillStyle = '#3a1a00';
    ctx.fillRect(-3, 3, 7, 1);
    ctx.fillStyle = '#f0a060';
    ctx.fillRect(-6, 6, 2, 3);
    ctx.fillRect(4,  6, 2, 3);
  }

  function _drawMarioJump(ctx) {
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillRect(-5, 5, 10, 6);
    ctx.fillStyle = '#2040c0';
    ctx.fillRect(-4, 10, 8, 2);
    ctx.fillRect(-5, 12, 3, 2);        // pernas abertas no pulo
    ctx.fillRect( 2, 12, 3, 2);
    ctx.fillStyle = '#f0a060';
    ctx.fillRect(-4, 0, 8, 5);
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillRect(-5, -1, 10, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillStyle = '#3a1a00';
    ctx.fillRect(-3, 3, 7, 1);
    ctx.fillStyle = '#f0a060';
    ctx.fillRect(-7, 4, 2, 4);         // braços levantados
    ctx.fillRect( 5, 4, 2, 4);
  }

  function _drawMarioClimb(ctx, frame) {
    ctx.fillStyle = '#2040c0';
    ctx.fillRect(-5, 5, 10, 8);
    ctx.fillStyle = '#f0a060';
    ctx.fillRect(-3, 0, 7, 5);
    ctx.fillStyle = C.CLR_MARIO;
    ctx.fillRect(-4, -1, 9, 3);
    ctx.fillStyle = '#f0a060';
    // Braços alternados para imitar movimento de subida
    if (frame === 0) {
      ctx.fillRect(-7, 3, 2, 3);
      ctx.fillRect( 4, 6, 2, 3);
    } else {
      ctx.fillRect(-7, 6, 2, 3);
      ctx.fillRect( 4, 3, 2, 3);
    }
  }

  function _drawMarioHammer(ctx, frame) {
    _drawMarioWalk(ctx, frame);
    ctx.fillStyle = '#c06010';
    ctx.fillRect(-2, -8, 4, 6);        // cabo
    ctx.fillStyle = '#808080';
    ctx.fillRect(-4, -10, 8, 4);       // cabeça do martelo
    ctx.fillStyle = '#fff';
    ctx.fillRect(-3, -9, 2, 1);        // brilho
  }

  // ── PLAYER (Mario) ────────────────────────────────────────────────────────
  DK.Player = {
    x: 0, y: 0, vx: 0, vy: 0,
    w: C.MARIO_W, h: C.MARIO_H,
    // Estados: IDLE | WALKING | JUMPING | CLIMBING | DEAD
    state: 'IDLE',
    onGround: false,
    currentBeam: 0,
    facingRight: true,
    deadTimer: 0,
    hasHammer: false,
    hammerTimer: 0,
    walkFrame: 0, walkTimer: 0,
    climbFrame: 0, climbTimer: 0,
    _jumpPressed: false,
    _climbLadder: -1,

    reset: function () {
      var pos = lvl().positions.MARIO_START;
      this.x = pos.x;
      this.y = pos.y;
      this.vx = 0; this.vy = 0;
      this.state = 'IDLE';
      this.onGround = true;
      this.currentBeam = 0;
      this.facingRight = true;
      this.deadTimer = 0;
      this.hasHammer = false;
      this.hammerTimer = 0;
      this.walkFrame = 0; this.walkTimer = 0;
      this.climbFrame = 0; this.climbTimer = 0;
      this._jumpPressed = false;
      this._climbLadder = -1;
    },

    update: function (dt) {
      if (this.state === 'DEAD') {
        this.deadTimer -= dt;
        return; // sem física durante a morte
      }
      if (this.hasHammer) {
        this.hammerTimer -= dt;
        if (this.hammerTimer <= 0) {
          this.hasHammer = false;
          // Martelo acabou → volta à trilha da fase atual
          DK.audio.playMusic(DK.audio.faixaPorFase(DK.game.levelIndex));
        }
      }
      if (this.state === 'CLIMBING') {
        this._updateClimbing();
      } else {
        this._updateWalking();
      }
    },

    _updateWalking: function () {
      var i = inp();
      this.vx = 0;
      if (i.left())  { this.vx = -C.PLAYER_SPEED; this.facingRight = false; }
      if (i.right()) { this.vx =  C.PLAYER_SPEED;  this.facingRight = true;  }

      // Entrar na escada (↑ ou ↓ quando alinhado) — verificado ANTES do pulo
      // para que ↑ priorize a escada quando o Mario está sobre ela.
      if (!this.hasHammer && this.onGround && (i.up() || i.down())) {
        var ladders = lvl().ladders;
        var li = ph().findLadderAt(ladders, this.x + this.w / 2, this.y + this.h, true);
        if (li !== -1) {
          var lad = ladders[li];
          var goUp   = i.up()   && this.y + this.h > lad.yTop + 2;
          var goDown = i.down() && this.y < lad.yBottom - 2;
          if (goUp || goDown) {
            this.state = 'CLIMBING';
            this._climbLadder = li;
            this.x = lad.x - this.w / 2; // centraliza na escada
            this.vy = 0;
            this._jumpPressed = true;     // evita pulo imediato ao sair da escada
            return;
          }
        }
      }

      // Pulo com Espaço (sem conflito com ↑ de escada)
      if (i.jump() && this.onGround && !this.hasHammer) {
        if (!this._jumpPressed) {
          this.vy = C.JUMP_VY;
          this.state = 'JUMPING';
          this.onGround = false;
          this._jumpPressed = true;
          DK.audio.sfx('pulo'); // SFX disparado apenas na borda de ativação do pulo
        }
      }
      if (!i.jump()) this._jumpPressed = false;

      // Aplica gravidade e move
      this.vy += C.GRAVITY;
      this.x  += this.vx;
      this.y  += this.vy;

      this._snapToBeam();
      // Limita às bordas horizontais do canvas
      this.x = Math.max(0, Math.min(C.W - this.w, this.x));

      // Atualiza estado de animação
      if (this.onGround) {
        if (this.vx !== 0) {
          this.state = 'WALKING';
          this.walkTimer++;
          if (this.walkTimer > 8) {
            this.walkFrame ^= 1;
            this.walkTimer = 0;
            // SFX de passo: disparado apenas no flip de frame (a cada ~8 frames),
            // nunca a cada frame — evita sobrecarga de nodes de áudio.
            DK.audio.sfx('andar');
          }
        } else {
          this.state = 'IDLE';
        }
      }
    },

    _updateClimbing: function () {
      var i   = inp();
      var lad = lvl().ladders[this._climbLadder];
      this.vx = 0;
      if (i.up())        this.vy = -1.2;
      else if (i.down()) this.vy =  1.2;
      else               this.vy =  0;

      if (this.vy !== 0) {
        this.climbTimer++;
        if (this.climbTimer > 8) {
          this.climbFrame ^= 1;
          this.climbTimer = 0;
          // SFX de degrau: mesma estratégia do andar — só no flip de frame.
          DK.audio.sfx('escada');
        }
      }

      this.y += this.vy;
      this.x  = lad.x - this.w / 2; // mantém centralizado na escada

      // Chegou ao topo — desce à viga de cima
      if (this.y + this.h / 2 <= lad.yTop) {
        this.y = lad.yTop - this.h;
        this.state = 'IDLE';
        this.vy = 0;
        this._snapToBeam();
        return;
      }
      // Chegou à base — cai na viga de baixo
      if (this.y + this.h / 2 >= lad.yBottom) {
        this.y = lad.yBottom - this.h;
        this.state = 'IDLE';
        this.vy = 0;
        this._snapToBeam();
      }
    },

    _snapToBeam: function () {
      // Enquanto está subindo (vy < 0), deixa o pulo acontecer livremente
      if (this.vy < 0) { this.onGround = false; return; }

      var cx    = this.x + this.w / 2;
      var feet  = this.y + this.h;
      var beams = lvl().beams;

      // Varre todas as vigas para encontrar a mais próxima abaixo dos pés
      var bestBeam = -1, bestH = Infinity;
      for (var i = 0; i < beams.length; i++) {
        var h = ph().beamHeightAt(beams[i], cx);
        if (h === Infinity) continue;
        // Aceita vigas que estão abaixo (ou muito próximas) dos pés
        if (feet <= h + Math.abs(this.vy) + 3 && h < bestH) {
          bestH = h; bestBeam = i;
        }
      }

      if (bestBeam !== -1 && feet >= bestH - 1) {
        this.y = bestH - this.h;
        this.vy = 0;
        this.onGround = true;
        this.currentBeam = bestBeam;
      } else if (bestBeam !== -1 && this.currentBeam === bestBeam) {
        // Continua sobre a mesma viga inclinada — segue o slope
        this.y = bestH - this.h;
        this.vy = 0;
        this.onGround = true;
      } else {
        this.onGround = false;
      }
    },

    die: function () {
      if (this.state === 'DEAD') return;
      this.state = 'DEAD';
      this.deadTimer = C.DEATH_ANIM_TIME;
      this.vx = 0; this.vy = 0;
      // Para a música e toca o SFX de morte
      DK.audio.stopMusic();
      DK.audio.sfx('morte');
    },

    hitbox: function () {
      return { x: this.x + 1, y: this.y, w: this.w - 2, h: this.h };
    },

    draw: function (ctx) {
      if (this.state === 'DEAD') {
        // Animação de morte: pisca (aparece em frames pares)
        if (Math.floor(this.deadTimer * 10) % 2 === 0) return;
      }
      var px = Math.round(this.x);
      var py = Math.round(this.y);
      var f  = this.facingRight ? 1 : -1;
      var cx = px + this.w / 2;

      ctx.save();
      ctx.translate(cx, py);
      ctx.scale(f, 1); // espelha horizontalmente se olhando à esquerda

      if (this.state === 'CLIMBING') {
        _drawMarioClimb(ctx, this.climbFrame);
      } else if (this.hasHammer) {
        _drawMarioHammer(ctx, this.walkFrame);
      } else if (this.state === 'JUMPING') {
        _drawMarioJump(ctx);
      } else if (this.state === 'WALKING') {
        _drawMarioWalk(ctx, this.walkFrame);
      } else {
        _drawMarioIdle(ctx);
      }
      ctx.restore();
    },
  };

  // ── BARREL (Barril) ───────────────────────────────────────────────────────
  // createBarrel é uma fábrica — retorna um novo objeto barril.
  // O fix principal está em _updateFalling: usamos sweepBeamsDown para
  // detectar cruzamento de vigas frame a frame, evitando o bug de atravessar.
  DK.createBarrel = function (x, y, beamIndex, speed) {
    return {
      x: x, y: y,
      vx: speed,   // velocidade fornecida pela fase (params.barrelSpeed)
      vy: 0,
      w: C.BARREL_W, h: C.BARREL_H,
      beamIndex: beamIndex,
      state: 'ROLLING',   // ROLLING | FALLING | DEAD
      rollFrame: 0, rollTimer: 0,
      _targetBeam: -1,
      _ladderDescent: false,
      _lastLadder: -1,   // última escada sorteada (evita sortear 2x a mesma)

      hitbox: function () {
        return { x: this.x + 1, y: this.y + 1, w: this.w - 2, h: this.h - 2 };
      },

      update: function () {
        if (this.state === 'DEAD') return;
        if (this.state === 'FALLING') {
          this._updateFalling();
        } else {
          this._updateRolling();
        }
        this.rollTimer++;
        if (this.rollTimer > 6) { this.rollFrame = (this.rollFrame + 1) % 4; this.rollTimer = 0; }
      },

      _updateRolling: function () {
        var beams = lvl().beams;
        var beam  = beams[this.beamIndex];
        this.x += this.vx;

        // Snap vertical à viga para seguir a inclinação
        var cx = this.x + this.w / 2;
        var h  = ph().beamHeightAt(beam, cx);
        if (h !== Infinity) this.y = h - this.h;

        // Passando por uma escada escalável? Pode descer por ela
        if (this._tryLadderDescent()) return;

        // Chegou na ponta? Cai para a viga de baixo.
        // IMPORTANTE: só vale se o barril está INDO na direção da ponta (vx > 0 p/ a
        // direita, vx < 0 p/ a esquerda). O barril pousa justamente na ponta da viga
        // de baixo, e sem essa checagem ele "caía" de novo no mesmo frame, pulando
        // plataformas (P4 → P2 → P0 em vez de P4 → P3 → P2...).
        if (this.vx > 0 && this.x + this.w > beam.x2 + 2) {
          this._startFall(beam.x2);
        }
        else if (this.vx < 0 && this.x < beam.x1 - 2) {
          this._startFall(beam.x1);
        }
      },

      _tryLadderDescent: function () {
        // Chance de descer por uma escada escalável que PARTE da viga atual
        // (o topo da escada, yTop, encosta na viga em que o barril está).
        // Cada escada é testada uma única vez por passagem (_lastLadder).
        var ladders = lvl().ladders;
        var params  = lvl().params;
        var beam    = lvl().beams[this.beamIndex];
        var cx      = this.x + this.w / 2;
        for (var i = 0; i < ladders.length; i++) {
          var l = ladders[i];
          if (l.broken) continue;
          if (Math.abs(cx - l.x) > Math.abs(this.vx)) continue;      // ainda não cruzou o centro
          var beamHere = ph().beamHeightAt(beam, l.x);
          if (beamHere === Infinity || Math.abs(beamHere - l.yTop) > 4) continue; // escada de outra viga
          if (this._lastLadder === i) continue;                      // já sorteada nesta passagem
          this._lastLadder = i;
          if (Math.random() < params.ladderDescendChance) {
            this.x = l.x - this.w / 2;
            this.state = 'FALLING';
            this.vy = C.BARREL_FALL_SPEED;
            this._targetBeam  = this.beamIndex - 1;
            this._ladderDescent = true;
            return true;
          }
        }
        return false;
      },

      _startFall: function (edgeX) {
        // Inicia a queda pela ponta da viga
        this.x = edgeX - this.w / 2;
        this.state = 'FALLING';
        this.vy = C.BARREL_FALL_SPEED;
        this._ladderDescent = false;
        this._targetBeam = this.beamIndex - 1; // próxima viga abaixo
      },

      _updateFalling: function () {
        var beams = lvl().beams;

        // Segurança: qualquer barril que saia pela base da tela é destruído
        // (antes, só o caso "_targetBeam < 0" tinha essa checagem).
        if (this.y > C.H + 20) { this.state = 'DEAD'; return; }

        // Caiu além da viga mais baixa (chão): só continua caindo até sair da tela
        if (this._targetBeam < 0) {
          this.y += this.vy;
          this.vy += C.BARREL_FALL_GRAV;
          return;
        }

        var yPrev = this.y + this.h; // y dos pés ANTES de mover
        this.vy += C.BARREL_FALL_GRAV; // gravidade acelera a queda
        this.y  += this.vy;
        var yNext = this.y + this.h; // y dos pés DEPOIS de mover
        var cx    = this.x + this.w / 2;

        // ── FIX DO BUG "BARRIL VOLTA NA PONTA DA VIGA" ────────────────────
        // Causa: a varredura aceitava a PRÓPRIA viga de origem (hit.beamIndex <=
        // this.beamIndex). No primeiro frame da queda a ponta da viga ainda estava
        // "cruzada", então o barril pousava de volta nela, voltava a rolar, passava
        // da ponta, caía, pousava de novo... num ciclo infinito (ROLLING/FALLING
        // alternando a cada frame, preso na borda).
        // Solução: passar this.beamIndex como limite — só vigas ABAIXO contam.
        // sweepBeamsDown varre [yPrev, yNext], então ainda não atravessa vigas
        // mesmo em velocidade alta.
        var hit = ph().sweepBeamsDown(beams, cx, yPrev, yNext, this.beamIndex);

        if (hit !== null) {
          // Pousou! Snap para a superfície da viga
          this.y    = hit.landY - this.h;
          this.vy   = 0;
          this.beamIndex = hit.beamIndex;
          this.state     = 'ROLLING';
          this._lastLadder = -1;
          // Direção de rolagem = sentido da inclinação da nova viga
          // (desce p/ direita → +, desce p/ esquerda → -), na velocidade da fase
          var b     = beams[hit.beamIndex];
          var slope = b.y2 - b.y1;
          var spd   = lvl().params.barrelSpeed;
          this.vx   = slope >= 0 ? spd : -spd;
          this._ladderDescent = false;
        }
      },

      draw: function (ctx) {
        if (this.state === 'DEAD') return;
        var px = Math.round(this.x);
        var py = Math.round(this.y);
        var r  = this.rollFrame;

        ctx.fillStyle = C.CLR_BARREL;
        ctx.fillRect(px,     py + 2, this.w, this.h - 4);
        ctx.fillRect(px + 2, py,     this.w - 4, this.h);
        ctx.fillStyle = '#803010';
        ctx.fillRect(px + 1, py + 2, this.w - 2, 1);
        ctx.fillRect(px + 1, py + this.h - 3, this.w - 2, 1);
        ctx.fillRect(px + 1, py + 5, this.w - 2, 1);
        // Símbolo de rotação (alternado a cada frame)
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        if (r === 0 || r === 2) {
          ctx.fillRect(px + 2, py + 4, 6, 2);
        } else {
          ctx.fillRect(px + 4, py + 2, 2, 6);
        }
      },
    };
  };

  // ── DONKEY KONG ───────────────────────────────────────────────────────────
  DK.DonkeyKong = {
    w: C.DK_W, h: C.DK_H,
    animFrame: 0, animTimer: 0, throwAnim: 0,

    reset: function () {
      var pos = lvl().positions.DK;
      this.x = pos.x; this.y = pos.y;
      this.animFrame = 0; this.animTimer = 0; this.throwAnim = 0;
    },

    update: function () {
      this.animTimer++;
      if (this.animTimer > 15) { this.animFrame ^= 1; this.animTimer = 0; }
      if (this.throwAnim > 0) this.throwAnim--;
    },

    triggerThrow: function () { this.throwAnim = 30; },

    draw: function (ctx) {
      var px = Math.round(this.x);
      var py = Math.round(this.y);
      var throwing = this.throwAnim > 0;
      var f = this.animFrame;

      ctx.fillStyle = C.CLR_DK;
      ctx.fillRect(px + 4, py + 12, 24, 20);   // corpo
      ctx.fillRect(px + 6, py + 2,  20, 14);   // cabeça
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 8,  py + 6, 4, 4);     // olho esq
      ctx.fillRect(px + 18, py + 6, 4, 4);     // olho dir
      ctx.fillStyle = '#000';
      ctx.fillRect(px + 9,  py + 7, 2, 2);
      ctx.fillRect(px + 19, py + 7, 2, 2);
      ctx.fillStyle = '#703008';
      ctx.fillRect(px + 12, py + 10, 8, 4);    // nariz
      ctx.fillStyle = '#c06020';
      ctx.fillRect(px + 7,  py + 16, 18, 12);  // barriga
      ctx.fillStyle = C.CLR_DK;
      if (throwing) {
        ctx.fillRect(px + 28, py +  8, 6, 10); // braço dir levantado
        ctx.fillRect(px,      py + 14, 6, 10);
      } else {
        var oy = f === 0 ? 0 : 2;
        ctx.fillRect(px + 28, py + 14 + oy, 6, 10);
        ctx.fillRect(px,      py + 14 - oy, 6, 10);
      }
      // Pilha de barris à esquerda do DK
      ctx.fillStyle = C.CLR_BARREL;
      for (var i = 0; i < 3; i++) {
        ctx.fillRect(px - 14, py + 8 + i * 8, 12, 7);
        ctx.fillStyle = '#803010';
        ctx.fillRect(px - 14, py + 9 + i * 8, 12, 1);
        ctx.fillStyle = C.CLR_BARREL;
      }
    },
  };

  // ── PAULINE ───────────────────────────────────────────────────────────────
  DK.Pauline = {
    w: C.PAULINE_W, h: C.PAULINE_H,
    animFrame: 0, animTimer: 0,

    reset: function () {
      var pos = lvl().positions.PAULINE;
      this.x = pos.x; this.y = pos.y;
    },

    update: function () {
      this.animTimer++;
      if (this.animTimer > 30) { this.animFrame ^= 1; this.animTimer = 0; }
    },

    hitbox: function () {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    },

    draw: function (ctx) {
      var px = Math.round(this.x);
      var py = Math.round(this.y);
      var f  = this.animFrame;
      ctx.fillStyle = C.CLR_PAULINE;
      ctx.fillRect(px + 2, py + 10, 8, 10);    // vestido
      ctx.fillRect(px - 1, py + 8 + (f === 0 ? 0 : -2), 4, 6);  // braço esq
      ctx.fillRect(px + 9, py + 8 + (f === 0 ? -2 : 0), 4, 6);  // braço dir
      ctx.fillStyle = '#e0a080';
      ctx.fillRect(px + 3, py + 6, 6, 6);      // corpo
      ctx.fillRect(px + 2, py + 1, 8, 7);      // cabeça
      ctx.fillStyle = '#703010';
      ctx.fillRect(px + 1, py,     10, 4);      // cabelo
      ctx.fillRect(px + 1, py + 4, 2,  4);
    },
  };

  // ── HAMMER (Martelo coletável) ────────────────────────────────────────────
  DK.createHammer = function (x, y) {
    return {
      x: x, y: y,
      w: C.HAMMER_W, h: C.HAMMER_H,
      active: true,

      hitbox: function () {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
      },

      draw: function (ctx) {
        if (!this.active) return;
        var px = Math.round(this.x);
        var py = Math.round(this.y);
        ctx.fillStyle = '#c06010';
        ctx.fillRect(px + 3, py + 4, 2, 6);    // cabo
        ctx.fillStyle = '#808080';
        ctx.fillRect(px,     py,     8, 4);     // cabeça
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + 1, py + 1, 2, 1);    // brilho
      },
    };
  };

  // ── OIL BARREL (Barril de óleo com chamas) ────────────────────────────────
  DK.OilBarrel = {
    w: 14, h: 16,
    fireFrame: 0, fireTimer: 0,

    reset: function () {
      var pos = lvl().positions.OIL_BARREL;
      this.x = pos.x; this.y = pos.y;
    },

    update: function () {
      this.fireTimer++;
      if (this.fireTimer > 8) { this.fireFrame = (this.fireFrame + 1) % 3; this.fireTimer = 0; }
    },

    draw: function (ctx) {
      var px = Math.round(this.x), py = Math.round(this.y);
      ctx.fillStyle = '#2040c0';
      ctx.fillRect(px,     py,     this.w,     this.h);
      ctx.fillStyle = '#4060e0';
      ctx.fillRect(px + 1, py + 1, this.w - 2, 4);
      ctx.fillStyle = '#0020a0';
      ctx.fillRect(px,     py + 6,  this.w, 2);
      ctx.fillRect(px,     py + 12, this.w, 2);
      // Chamas em 3 posições com offset de frame (efeito de flickering)
      var flames = [{ ox: 1, oy: -8 }, { ox: 4, oy: -10 }, { ox: 8, oy: -7 }];
      for (var i = 0; i < flames.length; i++) {
        var fl  = flames[i];
        var off = (this.fireFrame + i) % 3;
        ctx.fillStyle = off === 0 ? '#ff4400' : off === 1 ? '#ffaa00' : '#ff6600';
        ctx.fillRect(px + fl.ox, py + fl.oy - off, 3, 5 + off);
      }
      // Gotejamento de óleo (decorativo)
      ctx.fillStyle = '#000088';
      ctx.fillRect(px + 3, py + this.h,     2, 4);
      ctx.fillRect(px + 8, py + this.h + 1, 2, 3);
    },
  };

  // ── FIREBALL (Bola de fogo — fase 3) ─────────────────────────────────────
  // A fireball anda pelas vigas igual a um barril, mas persegue o Mario:
  // inverte de direção quando o Mario está no lado oposto.
  DK.createFireball = function (beamIndex, side) {
    var beams = DK.LEVELS[DK.game.levelIndex].beams;
    var beam  = beams[beamIndex];
    var startX = (side === 'right') ? beam.x2 - C.FIREBALL_W - 2 : beam.x1 + 2;
    var startVx = (side === 'right') ? -0.8 : 0.8;
    var h = DK.physics.beamHeightAt(beam, startX + C.FIREBALL_W / 2);

    return {
      x: startX,
      y: h - C.FIREBALL_H,
      vx: startVx,
      w: C.FIREBALL_W, h: C.FIREBALL_H,
      beamIndex: beamIndex,
      state: 'ALIVE',    // ALIVE | DEAD
      animFrame: 0, animTimer: 0,

      update: function () {
        if (this.state === 'DEAD') return;
        var beams = lvl().beams;
        var beam  = beams[this.beamIndex];

        this.x += this.vx;

        // Snap vertical à viga
        var cx = this.x + this.w / 2;
        var h  = ph().beamHeightAt(beam, cx);
        if (h !== Infinity) this.y = h - this.h;

        // Ao chegar na ponta, inverte (não cai — fica na mesma viga)
        if (this.x + this.w > beam.x2) {
          this.x = beam.x2 - this.w;
          this.vx = -Math.abs(this.vx);
        }
        if (this.x < beam.x1) {
          this.x = beam.x1;
          this.vx = Math.abs(this.vx);
        }

        // Perseguição simples: se o Mario está do lado oposto, acelera em direção a ele
        var mario = DK.Player;
        if (mario.currentBeam === this.beamIndex) {
          var toMario = (mario.x > this.x) ? 1 : -1;
          this.vx = toMario * (Math.abs(this.vx) + 0.002); // acelera levemente
          this.vx = Math.max(-2.5, Math.min(2.5, this.vx)); // cap de velocidade
        }

        this.animTimer++;
        if (this.animTimer > 6) { this.animFrame ^= 1; this.animTimer = 0; }
      },

      hitbox: function () {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
      },

      draw: function (ctx) {
        if (this.state === 'DEAD') return;
        var px = Math.round(this.x);
        var py = Math.round(this.y);
        var f  = this.animFrame;
        // Bola de fogo: núcleo amarelo com halo laranja pulsando
        ctx.fillStyle = f === 0 ? '#ff6600' : '#ff8800';
        ctx.fillRect(px,     py + 1, this.w,     this.h - 2);
        ctx.fillRect(px + 1, py,     this.w - 2, this.h);
        ctx.fillStyle = C.CLR_FIREBALL;
        ctx.fillRect(px + 2, py + 2, this.w - 4, this.h - 4);
        // Olhinhos (dá um toque de personalidade)
        ctx.fillStyle = '#000';
        ctx.fillRect(px + 1, py + 1, 2, 2);
        ctx.fillRect(px + 5, py + 1, 2, 2);
      },
    };
  };

}());