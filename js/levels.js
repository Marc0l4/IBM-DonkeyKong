// ===== levels.js =====
// Dados das 3 fases do jogo. Toda a lógica lê DK.LEVELS[n] — sem if(fase===2).
//
// Cada fase define:
//   beams[]    — plataformas inclinadas { x1,y1,x2,y2 }
//   ladders[]  — escadas { x, yTop, yBottom, broken }
//   positions  — spawn points de cada entidade
//   params     — dificuldade: velocidade dos barris, intervalos, bonus, etc.
//   hammers[]  — posições dos martelos coletáveis
//
// As posições y são derivadas de PLATFORM_GAP para que ajustar uma constante
// recalcule toda a fase automaticamente.

var DK = window.DK || {};

(function () {
  'use strict';

  // Atalho para facilitar a leitura das fórmulas abaixo
  const C = DK.CONST;
  const G = C.PLATFORM_GAP; // 52 px entre vigas
  const W = C.W;             // 224 px de largura lógica
  const H = C.H;             // 320 px de altura lógica

  // HUD ocupa os primeiros 36 px do topo (HIGH SCORE + linha de vidas)
  const HUD_H = 36;

  // ── FASE 1 ────────────────────────────────────────────────────────────────
  // Layout clássico: vigas inclinadas alternando o sentido, dificuldade base.
  //
  // Mapeamento de índices (de baixo para cima):
  //   P0 = chão    y ≈ H - 20
  //   P1           y ≈ H - 20 - G
  //   P2           y ≈ H - 20 - 2G
  //   P3           y ≈ H - 20 - 3G
  //   P4           y ≈ H - 20 - 4G
  //   P5 = topo    y ≈ H - 20 - 5G
  //
  // A inclinação (deltaY entre x1 e x2) alternada cria o caminho em zigue-zague.

  const p0y = H - 18;            // chão
  const p1y = p0y - G;           // P1
  const p2y = p1y - G;           // P2
  const p3y = p2y - G;           // P3
  const p4y = p3y - G;           // P4
  const p5y = p4y - G + 4;       // P5 (topo, um pouco mais próximo do P4)

  const LEVEL_1 = {
    beams: [
      // slope +4 = desce para a direita; slope -6 = sobe para a direita
      { x1:  4, y1: p0y,     x2: W - 4, y2: p0y - 4  }, // P0 chão (quase reto)
      { x1:  4, y1: p1y,     x2: W - 44,y2: p1y + 8  }, // P1 desce p/ direita
      { x1: 44, y1: p2y + 8, x2: W - 4, y2: p2y      }, // P2 sobe p/ direita
      { x1:  4, y1: p3y,     x2: W - 44,y2: p3y + 8  }, // P3 desce p/ direita
      { x1: 44, y1: p4y + 6, x2: W - 4, y2: p4y      }, // P4 sobe p/ direita
      { x1:  4, y1: p5y + 2, x2: W - 4, y2: p5y      }, // P5 topo (leve inclinação)
    ],
    ladders: [
      // Entre P0 e P1
      { x: 140, yTop: p1y,      yBottom: p0y - 4,  broken: false },
      { x:  40, yTop: p1y,      yBottom: p0y - 4,  broken: true  },
      // Entre P1 e P2
      { x: 100, yTop: p2y,      yBottom: p1y + 8,  broken: false },
      { x: 170, yTop: p2y,      yBottom: p1y + 6,  broken: true  },
      // Entre P2 e P3
      { x:  60, yTop: p3y,      yBottom: p2y + 8,  broken: false },
      { x: 180, yTop: p3y,      yBottom: p2y + 4,  broken: true  },
      // Entre P3 e P4
      { x: 110, yTop: p4y,      yBottom: p3y + 8,  broken: false },
      { x:  30, yTop: p4y + 2,  yBottom: p3y + 4,  broken: true  },
      // Entre P4 e P5
      { x:  80, yTop: p5y,      yBottom: p4y + 6,  broken: false },
      { x: 190, yTop: p5y,      yBottom: p4y + 2,  broken: true  },
    ],
    positions: {
      MARIO_START: { x: 18,      y: p0y - C.MARIO_H },
      DK:          { x: 10,      y: p5y - C.DK_H    },
      PAULINE:     { x: W - 44,  y: p5y - C.PAULINE_H },
      OIL_BARREL:  { x: 4,       y: p0y - 16        },
    },
    hammers: [
      { x: 32,       y: p1y - C.HAMMER_H - 2 },
      { x: W - 64,   y: p4y - C.HAMMER_H - 2 },
    ],
    params: {
      barrelSpeed:         1.2,
      barrelIntervalMin:   2.0,
      barrelIntervalMax:   4.0,
      ladderDescendChance: 0.25,
      bonusStart:          5000,
      hasFireballs:        false,
      fireballs:           [],
    },
  };

  // ── FASE 2 ────────────────────────────────────────────────────────────────
  // Inclinações mais acentuadas, mais escadas quebradas, barris mais rápidos.
  // O caminho é mais complicado: algumas vigas estão deslocadas lateralmente.

  const q0y = H - 18;
  const q1y = q0y - G;
  const q2y = q1y - G + 4;
  const q3y = q2y - G;
  const q4y = q3y - G + 4;
  const q5y = q4y - G + 6;

  const LEVEL_2 = {
    beams: [
      { x1:  4, y1: q0y,      x2: W - 4,  y2: q0y - 4  }, // P0 chão
      { x1:  4, y1: q1y + 12, x2: W - 50, y2: q1y      }, // P1 sobe p/ direita
      { x1: 50, y1: q2y,      x2: W - 4,  y2: q2y + 14 }, // P2 desce p/ direita (íngreme)
      { x1:  4, y1: q3y + 10, x2: W - 50, y2: q3y      }, // P3 sobe p/ direita
      { x1: 30, y1: q4y,      x2: W - 4,  y2: q4y + 12 }, // P4 desce p/ direita
      { x1:  4, y1: q5y + 2,  x2: W - 4,  y2: q5y      }, // P5 topo
    ],
    ladders: [
      // Entre P0 e P1  (só uma escalável)
      { x: 160, yTop: q1y,     yBottom: q0y - 4,  broken: false },
      { x:  40, yTop: q1y + 4, yBottom: q0y - 4,  broken: true  },
      // Entre P1 e P2
      { x:  80, yTop: q2y,     yBottom: q1y + 12, broken: false },
      { x: 180, yTop: q2y,     yBottom: q1y + 8,  broken: true  },
      { x: 130, yTop: q2y + 4, yBottom: q1y + 8,  broken: true  },
      // Entre P2 e P3
      { x:  60, yTop: q3y,     yBottom: q2y + 14, broken: false },
      { x: 170, yTop: q3y,     yBottom: q2y + 10, broken: true  },
      // Entre P3 e P4  (só uma escalável, mais à direita)
      { x: 150, yTop: q4y,     yBottom: q3y + 10, broken: false },
      { x:  30, yTop: q4y,     yBottom: q3y + 6,  broken: true  },
      // Entre P4 e P5
      { x:  70, yTop: q5y,     yBottom: q4y + 12, broken: false },
      { x: 190, yTop: q5y,     yBottom: q4y + 8,  broken: true  },
    ],
    positions: {
      MARIO_START: { x: 18,     y: q0y - C.MARIO_H },
      DK:          { x: 10,     y: q5y - C.DK_H    },
      PAULINE:     { x: W - 44, y: q5y - C.PAULINE_H },
      OIL_BARREL:  { x: 4,      y: q0y - 16        },
    },
    hammers: [
      { x: 110, y: q2y - C.HAMMER_H - 2 },
    ],
    params: {
      barrelSpeed:         1.6,   // barris mais rápidos
      barrelIntervalMin:   1.5,
      barrelIntervalMax:   3.0,
      ladderDescendChance: 0.30,  // barris descem escadas mais frequentemente
      bonusStart:          4000,  // bonus menor
      hasFireballs:        false,
      fireballs:           [],
    },
  };

  // ── FASE 3 ────────────────────────────────────────────────────────────────
  // Menos escadas escaláveis, barris muito rápidos, bola de fogo perseguindo Mario.
  // Layout assimétrico: uma plataforma mais curta no meio dificulta a subida.

  const r0y = H - 18;
  const r1y = r0y - G;
  const r2y = r1y - G + 6;
  const r3y = r2y - G - 2;
  const r4y = r3y - G + 4;
  const r5y = r4y - G + 8;

  const LEVEL_3 = {
    beams: [
      { x1:  4, y1: r0y,      x2: W - 4,  y2: r0y - 4  }, // P0 chão
      { x1:  4, y1: r1y + 10, x2: W - 60, y2: r1y      }, // P1 sobe p/ dir (curta)
      { x1: 60, y1: r2y,      x2: W - 4,  y2: r2y + 16 }, // P2 desce p/ dir (íngreme)
      { x1:  4, y1: r3y,      x2: W - 60, y2: r3y + 12 }, // P3 desce p/ dir
      { x1: 40, y1: r4y + 8,  x2: W - 4,  y2: r4y      }, // P4 sobe p/ dir
      { x1:  4, y1: r5y + 2,  x2: W - 4,  y2: r5y      }, // P5 topo
    ],
    ladders: [
      // Entre P0 e P1  (só uma escalável — dificulta o início)
      { x: 150, yTop: r1y,      yBottom: r0y - 4,  broken: false },
      { x:  30, yTop: r1y + 2,  yBottom: r0y - 4,  broken: true  },
      // Entre P1 e P2
      { x:  90, yTop: r2y,      yBottom: r1y + 10, broken: false },
      { x: 160, yTop: r2y,      yBottom: r1y + 6,  broken: true  },
      // Entre P2 e P3
      { x: 100, yTop: r3y,      yBottom: r2y + 16, broken: false },
      { x:  50, yTop: r3y,      yBottom: r2y + 12, broken: true  },
      { x: 180, yTop: r3y + 2,  yBottom: r2y + 12, broken: true  },
      // Entre P3 e P4  (só uma escalável, extremo esquerdo)
      { x:  40, yTop: r4y,      yBottom: r3y + 12, broken: false },
      { x: 170, yTop: r4y + 2,  yBottom: r3y + 8,  broken: true  },
      // Entre P4 e P5
      { x: 120, yTop: r5y,      yBottom: r4y + 8,  broken: false },
      { x:  60, yTop: r5y + 2,  yBottom: r4y + 4,  broken: true  },
    ],
    positions: {
      MARIO_START: { x: 18,     y: r0y - C.MARIO_H },
      DK:          { x: 10,     y: r5y - C.DK_H    },
      PAULINE:     { x: W - 44, y: r5y - C.PAULINE_H },
      OIL_BARREL:  { x: 4,      y: r0y - 16        },
    },
    hammers: [
      { x: 80, y: r3y - C.HAMMER_H - 2 },
    ],
    params: {
      barrelSpeed:         2.0,    // barris muito rápidos
      barrelIntervalMin:   1.2,
      barrelIntervalMax:   2.5,
      ladderDescendChance: 0.35,
      bonusStart:          3000,   // bonus inicial menor
      hasFireballs:        true,
      // Fireballs nascem em P1 e P3, cada uma com beamIndex e direção inicial
      fireballs: [
        { beamIndex: 1, side: 'right' }, // nasce na direita de P1
        { beamIndex: 3, side: 'left'  }, // nasce na esquerda de P3
      ],
    },
  };

  // Exporta o array de fases (índice 0 = fase 1, etc.)
  DK.LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

}());
