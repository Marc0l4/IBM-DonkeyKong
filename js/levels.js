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

  // ── Helpers para montar as fases sem erro de alinhamento ──────────────────
  // hAt: altura (y) da viga no x dado, por interpolação linear. Se x estiver fora
  // da viga, usa a ponta mais próxima (assim escadas decorativas não quebram).
  // (physics.js carrega DEPOIS deste arquivo, por isso o lerp é repetido aqui.)
  function hAt(beam, x) {
    x = Math.max(beam.x1, Math.min(beam.x2, x));
    return beam.y1 + (x - beam.x1) / (beam.x2 - beam.x1) * (beam.y2 - beam.y1);
  }
  // ladder: escada entre a viga de baixo (lower) e a de cima (upper) em x.
  // yTop/yBottom saem direto da altura das vigas → a escada sempre encosta nelas.
  function ladder(x, lower, upper, broken) {
    return { x: x, yTop: hAt(upper, x), yBottom: hAt(lower, x), broken: broken };
  }

  // REGRA DE GEOMETRIA (vale para as 3 fases) — é o que faz o barril cair de
  // plataforma em plataforma, como no arcade:
  //   P5 desce p/ direita → barril rola p/ direita e cai na ponta direita
  //   P4 desce p/ esquerda (x2 = borda, buraco à esquerda) → rola p/ esquerda
  //   P3 desce p/ direita (x1 = borda, buraco à direita)  → rola p/ direita
  //   ... e assim alternando até P0, que desce p/ esquerda rumo ao barril de óleo.
  // A viga de baixo SEMPRE cobre a ponta por onde o barril cai da de cima.

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
      { x1:  4, y1: p5y,     x2: W - 4, y2: p5y + 2  }, // P5 topo (desce leve p/ direita)
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
      PAULINE:     { x: W - 44,  y: p5y + 2 - C.PAULINE_H },
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

  const LEVEL_2_BEAMS = [
    { x1:  4, y1: q0y,      x2: W - 4,  y2: q0y - 4  }, // P0 chão (sobe p/ direita → barril rola p/ esquerda)
    { x1:  4, y1: q1y,      x2: W - 50, y2: q1y + 12 }, // P1 desce p/ direita (íngreme)
    { x1: 50, y1: q2y + 14, x2: W - 4,  y2: q2y      }, // P2 desce p/ esquerda (íngreme)
    { x1:  4, y1: q3y,      x2: W - 50, y2: q3y + 10 }, // P3 desce p/ direita
    { x1: 30, y1: q4y + 12, x2: W - 4,  y2: q4y      }, // P4 desce p/ esquerda
    { x1:  4, y1: q5y,      x2: W - 4,  y2: q5y + 2  }, // P5 topo (desce leve p/ direita)
  ];
  const LB2 = LEVEL_2_BEAMS;

  const LEVEL_2 = {
    beams: LB2,
    ladders: [
      // Entre P0 e P1  (só uma escalável)
      ladder(160, LB2[0], LB2[1], false),
      ladder( 40, LB2[0], LB2[1], true ),
      // Entre P1 e P2
      ladder( 80, LB2[1], LB2[2], false),
      ladder(180, LB2[1], LB2[2], true ),
      ladder(130, LB2[1], LB2[2], true ),
      // Entre P2 e P3
      ladder( 60, LB2[2], LB2[3], false),
      ladder(170, LB2[2], LB2[3], true ),
      // Entre P3 e P4  (só uma escalável, mais à direita)
      ladder(150, LB2[3], LB2[4], false),
      ladder( 40, LB2[3], LB2[4], true ),
      // Entre P4 e P5
      ladder( 70, LB2[4], LB2[5], false),
      ladder(190, LB2[4], LB2[5], true ),
    ],
    positions: {
      MARIO_START: { x: 18,     y: q0y - C.MARIO_H },
      DK:          { x: 10,     y: q5y - C.DK_H    },
      PAULINE:     { x: W - 44, y: q5y + 2 - C.PAULINE_H },
      OIL_BARREL:  { x: 4,      y: q0y - 16        },
    },
    hammers: [
      { x: 110, y: hAt(LB2[2], 114) - C.HAMMER_H - 2 },
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

  const LEVEL_3_BEAMS = [
    { x1:  4, y1: r0y,      x2: W - 4,  y2: r0y - 4  }, // P0 chão (sobe p/ direita → barril rola p/ esquerda)
    { x1:  4, y1: r1y,      x2: W - 60, y2: r1y + 10 }, // P1 desce p/ direita (curta)
    { x1: 60, y1: r2y + 16, x2: W - 4,  y2: r2y      }, // P2 desce p/ esquerda (íngreme)
    { x1:  4, y1: r3y,      x2: W - 60, y2: r3y + 12 }, // P3 desce p/ direita
    { x1: 40, y1: r4y + 8,  x2: W - 4,  y2: r4y      }, // P4 desce p/ esquerda
    { x1:  4, y1: r5y,      x2: W - 4,  y2: r5y + 2  }, // P5 topo (desce leve p/ direita)
  ];
  const LB3 = LEVEL_3_BEAMS;

  const LEVEL_3 = {
    beams: LB3,
    ladders: [
      // Entre P0 e P1  (só uma escalável — dificulta o início)
      ladder(150, LB3[0], LB3[1], false),
      ladder( 30, LB3[0], LB3[1], true ),
      // Entre P1 e P2
      ladder( 90, LB3[1], LB3[2], false),
      ladder(160, LB3[1], LB3[2], true ),
      // Entre P2 e P3
      ladder(100, LB3[2], LB3[3], false),
      ladder( 70, LB3[2], LB3[3], true ),
      ladder(180, LB3[2], LB3[3], true ),
      // Entre P3 e P4  (só uma escalável, extremo esquerdo)
      ladder( 48, LB3[3], LB3[4], false),
      ladder(150, LB3[3], LB3[4], true ),
      // Entre P4 e P5
      ladder(120, LB3[4], LB3[5], false),
      ladder( 60, LB3[4], LB3[5], true ),
    ],
    positions: {
      MARIO_START: { x: 18,     y: r0y - C.MARIO_H },
      DK:          { x: 10,     y: r5y - C.DK_H    },
      PAULINE:     { x: W - 44, y: r5y + 2 - C.PAULINE_H },
      OIL_BARREL:  { x: 4,      y: r0y - 16        },
    },
    hammers: [
      { x: 80, y: hAt(LB3[3], 84) - C.HAMMER_H - 2 },
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