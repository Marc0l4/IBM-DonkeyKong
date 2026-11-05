// ===== constants.js =====
// Todas as constantes do jogo ficam aqui — sem "magic numbers" no restante do código.
// Ao mudar um valor aqui, o efeito se propaga em todo o jogo automaticamente.
//
// Namespace DK: usado em todos os arquivos JS para evitar poluir o escopo global.
// Como não usamos type="module", cada arquivo acrescenta propriedades ao objeto DK.
var DK = window.DK || {};

DK.CONST = {
  // ── Resolução lógica ──────────────────────────────────────────────────────
  W: 224,   // largura lógica do canvas (px)
  H: 320,   // altura lógica — aumentada de 256 para 320 para dar mais respiro
            // entre plataformas (barris podem ser pulados com folga)
  SCALE: 3, // fator de escala inteiro para o monitor (3× = 672×960 px)

  // ── Espaçamento entre plataformas ────────────────────────────────────────
  // PLATFORM_GAP controla a distância vertical entre cada par de vigas.
  // Derivamos os y de cada viga a partir desse valor em levels.js.
  // Validação: pulo máximo ≈ vy²/(2×g) = 8²/(2×0.45) ≈ 71 px > PLATFORM_GAP(52) + Mario(14) ✓
  PLATFORM_GAP: 52,

  // ── Física ────────────────────────────────────────────────────────────────
  GRAVITY:          0.45,  // aceleração gravitacional (px por frame²)
  JUMP_VY:         -8.0,   // impulso vertical do pulo (negativo = para cima)
  PLAYER_SPEED:     1.5,   // velocidade horizontal do Mario (px/frame)
  BARREL_FALL_SPEED: 1.8,  // velocidade de queda inicial do barril (px/frame)
  BARREL_FALL_GRAV:  0.3,  // gravidade aplicada ao barril em queda (acelera a queda)

  // ── Dimensões das entidades (hitbox) ─────────────────────────────────────
  MARIO_W:   10,
  MARIO_H:   14,
  BARREL_W:  10,
  BARREL_H:  10,
  HAMMER_W:   8,
  HAMMER_H:  10,
  DK_W:      32,
  DK_H:      36,
  PAULINE_W: 12,
  PAULINE_H: 20,
  FIREBALL_W: 8,
  FIREBALL_H: 8,

  // ── Duração de estados temporários ───────────────────────────────────────
  HAMMER_DURATION:  10,   // segundos com o martelo ativo
  DEATH_ANIM_TIME:   1.8, // segundos da animação de morte
  LEVEL_COMPLETE_TIME: 3, // segundos na tela "LEVEL COMPLETE"

  // ── Número de vidas iniciais ──────────────────────────────────────────────
  INITIAL_LIVES: 3,

  // ── Pontuação ─────────────────────────────────────────────────────────────
  SCORE_JUMP_BARREL:   100,
  SCORE_HAMMER_BARREL: 300,
  BONUS_TICK:          100, // quanto o bonus cai por vez
  BONUS_INTERVAL:        4, // segundos entre cada decremento do bonus

  // ── Cores principais (paleta estilo arcade) ───────────────────────────────
  CLR_BEAM:    '#d1195d', // vigas vermelho-magenta
  CLR_LADDER:  '#00e5ff', // escadas ciano
  CLR_BARREL:  '#e07820', // barris laranja
  CLR_MARIO:   '#e03020', // cor base do Mario
  CLR_HUD:     '#ffffff', // texto HUD branco
  CLR_HUD_BLU: '#4040ff', // texto HUD azul
  CLR_BONUS:   '#00e5ff', // caixa de bonus ciano
  CLR_DK:      '#a04010', // Donkey Kong marrom
  CLR_PAULINE: '#e080d0', // Pauline rosa
  CLR_FIRE:    '#ff4400', // fogo laranja-vermelho
  CLR_FIREBALL:'#ffcc00', // bola de fogo amarela
  CLR_BG:      '#000000', // fundo preto
};
