# Donkey Kong Clone — Workshop Demo

Clone simplificado do **Donkey Kong (1981)** em HTML5 Canvas puro. Projeto educacional para workshops de desenvolvimento de jogos 2D no navegador, sem frameworks, sem bundler, sem servidor.

## Jogue online

**[Abrir o jogo na Vercel](https://ibmdonkeykong.vercel.app/)**

---

## Como jogar

**Duplo clique em `index.html`** — abre direto no navegador. Nenhuma instalação necessária.

| Tecla | Ação |
|---|---|
| `←` / `→` ou `A` / `D` | Mover o Mario |
| `Espaço` | Pular (quando no chão) |
| `↑` / `W` | Subir escada |
| `↓` / `S` | Descer escada |
| `Enter` | Confirmar nos menus |

### Objetivo

Suba da base até o topo, passando por 6 plataformas inclinadas, desviando dos barris lançados pelo Donkey Kong, e alcance a Pauline para completar cada fase.

### Pontuação

| Ação | Pontos |
|---|---|
| Pular sobre um barril | +100 |
| Destruir barril com martelo | +300 |
| Bonus restante ao completar fase | +bonus |

O **bonus** começa em 5000 e cai 100 pontos a cada 4 segundos. Se zerar, você perde uma vida.

---

## Fases

| Fase | Detalhe |
|---|---|
| **L=01** | Layout clássico, vigas alternadas, dificuldade base |
| **L=02** | Inclinações mais íngremes, mais escadas quebradas, barris mais rápidos |
| **L=03** | Layout assimétrico, poucas escadas escaláveis, barris muito rápidos, **bola de fogo** perseguindo o Mario |

Completar as 3 fases leva à tela de vitória final. Game Over reinicia da fase 1.

---

## Estrutura de arquivos

```text
donkeyKong/
├── index.html          ← marcação HTML, links de CSS e scripts
├── README.md
├── css/
│   └── style.css       ← canvas centralizado, pixel art (image-rendering)
└── js/
    ├── constants.js    ← todas as constantes (CONST, PLATFORM_GAP, cores)
    ├── levels.js       ← dados das 3 fases (vigas, escadas, posições, params)
    ├── input.js        ← rastreio de teclado (DK.input)
    ├── physics.js      ← funções puras: beamHeightAt, rectOverlap, sweepBeamsDown
    ├── entities.js     ← Player, Barrel, DonkeyKong, Pauline, Hammer, OilBarrel, Fireball
    ├── systems.js      ← BarrelSpawner, FireballSystem, ScoreSystem
    ├── renderer.js     ← todas as funções de desenho e HUD
    ├── game.js         ← DK.game{}, update(), máquina de estados
    └── main.js         ← configuração do canvas e game loop
Por que scripts clássicos (sem type="module")?
Módulos ES exigem servidor HTTP (por causa do CORS). Scripts clássicos funcionam com file:// — basta duplo clique. Para manter o namespace limpo sem módulos, todos os arquivos contribuem para um único objeto global: window.DK.
Arquitetura
Namespace DK
Cada arquivo faz var DK = window.DK || {} e acrescenta suas propriedades:
DK.CONST          → constantes
DK.LEVELS[]       → dados das fases
DK.input          → estado do teclado
DK.physics        → funções de física
DK.Player         → entidade do jogador
DK.createBarrel   → fábrica de barris
DK.DonkeyKong     → entidade do DK
DK.Pauline        → entidade da Pauline
DK.createHammer   → fábrica de martelos
DK.OilBarrel      → barril de óleo com fogo
DK.createFireball → fábrica de fireballs
DK.BarrelSpawner  → sistema de spawn
DK.FireballSystem → sistema de fireballs
DK.ScoreSystem    → pontuação e bonus
DK.render()       → renderização completa
DK.game{}         → estado global
DK.update()       → update principal
DK.startGame()    → inicia do zero
DK.startLevel()   → carrega fase atual
Game Loop (Fixed Timestep)
requestAnimationFrame
  └─ accumulator += frameTime
  └─ while (accumulator >= 1/60):
      DK.update(1/60)   ← física sempre a 60 Hz
      accumulator -= 1/60
  └─ DK.render(ctx)     ← render uma vez por frame
O timestep fixo garante que a física seja idêntica em monitores de 60 Hz, 120 Hz ou 144 Hz.
Máquina de estados
MENU
  │ Enter
  ▼
PLAYING
  │ toca Pauline          │ sem vidas
  ▼                        ▼
LEVEL_COMPLETE          GAME_OVER
  │ timer (3s)             │ Enter
  ├─ próxima fase →  PLAYING
  └─ fase 3 concluída → WIN
                           │ Enter
                           ▼
                          MENU
Fases como dados (levels.js)
Toda a lógica do jogo lê DK.LEVELS[DK.game.levelIndex] — sem if (fase === 2) espalhado pelo código. Cada fase define:
{
  beams:    [ { x1, y1, x2, y2 }, ... ],
  ladders:  [ { x, yTop, yBottom, broken }, ... ],
  positions: { MARIO_START, DK, PAULINE, OIL_BARREL },
  hammers:  [ { x, y }, ... ],
  params: {
    barrelSpeed, barrelIntervalMin, barrelIntervalMax,
    ladderDescendChance, bonusStart,
    hasFireballs, fireballs: [ { beamIndex, side }, ... ]
  }
}
As posições y das vigas são derivadas da constante PLATFORM_GAP (52 px), então ajustar esse valor recalcula toda a fase.
Fix do bug de barris atravessando vigas
Problema original: o barril verificava só a posição atual. Com vy alto, podia “pular” uma viga em um único frame.

Solução — sweepBeamsDown(beams, cx, yPrev, yNext):
Varre o intervalo [yPrev, yNext] e encontra a primeira viga cruzada no caminho. O barril pousa na viga mais próxima encontrada, zera vy e inverte a direção de acordo com o slope da nova viga.
  Antes:        Depois (sweep):
  ════════       ════════
                    ← barril pousa aqui ✓
  ════════       ════════
  ↑ atravessa   ↑ detectado antes
Requisitos técnicos
- Nenhuma biblioteca externa
- Nenhum servidor necessário — file:// funciona
- Funciona em qualquer deploy estático (Vercel, GitHub Pages, Netlify)
- Sem erros no console do navegador
- High score salvo em localStorage
- Resolução lógica 224×320 px, escalada 3× (672×960 px no monitor)
- Todos os sprites desenhados por código (retângulos, fillRect)
Deploy na Vercel
O jogo está publicado em:

https://ibmdonkeykong.vercel.app/

Para criar seu próprio deploy:
1. Faça push da pasta donkeyKong/ para um repositório GitHub.
2. Importe o repositório na Vercel.
3. Em Framework Preset, selecione Other.
4. Em Root Directory, use donkeyKong — ou a raiz, caso ela já seja a pasta do projeto.
5. Clique em Deploy. Nenhuma configuração adicional é necessária.