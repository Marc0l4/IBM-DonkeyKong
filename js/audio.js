// ===== audio.js =====
// Sistema de áudio do jogo: motor Web Audio API, SFX e música procedural.
//
// ── Princípios ────────────────────────────────────────────────────────────
//  • AudioContext é criado/retomado APENAS após o primeiro gesto do usuário
//    (política de autoplay dos navegadores modernos).
//  • Toda a música é original, composta como dados (arrays de notas), nunca
//    copiada de jogos existentes.
//  • Scheduler de música: setInterval de ~25 ms agenda notas com lookahead
//    de ~100 ms usando audioCtx.currentTime — sem setTimeout por nota.
//  • Cada SFX usa envelope (ataque/release) para evitar estalos digitais.
//  • Percussão usa AudioBufferSourceNode com ruído branco; NÃO usa tipo
//    'noise' em OscillatorNode (que não existe na spec).
//  • Um único GainNode mestre controla o volume global.
//  • Mute salvo em localStorage; preferência persiste entre sessões.
//  • visibilitychange suspende/retoma o contexto corretamente.

var DK = window.DK || {};

(function () {
  'use strict';

  var C = DK.CONST;

  // ── Estado interno ─────────────────────────────────────────────────────────
  var _ctx         = null;   // AudioContext (criado no primeiro gesto)
  var _masterGain  = null;   // GainNode mestre
  var _desbloqueado = false; // true após o primeiro gesto do usuário
  var _mudo        = false;  // estado de mute atual
  var _faixaAtual  = null;   // nome da faixa em reprodução (string ou null)

  // Scheduler de música
  var _schedInterval  = null;  // id do setInterval do scheduler
  var _schedTempo     = 0;     // BPM atual (definido pela faixa)
  var _schedNotes     = null;  // array de notas da faixa atual
  var _schedIdx       = 0;     // índice da próxima nota a agendar
  var _schedNextTime  = 0;     // audioCtx.currentTime da próxima nota
  var _schedSources   = [];    // OscillatorNodes/Sources ativos (para parar)

  // Intervalo do scheduler e lookahead (ms / s)
  var SCHED_INTERVAL_MS = 25;
  var SCHED_LOOKAHEAD_S = 0.10;

  // ── Dados musicais ────────────────────────────────────────────────────────
  // Nota: frequências em Hz. Duração em "batidas" (1 = 1 semínima).
  // Canal: 'mel' = melodia (square), 'bass' = baixo (triangle), 'drum' = percussão.
  // 0 Hz = pausa (silêncio).
  //
  // BPM controla a duração de uma batida: beat_s = 60 / BPM.
  // Uma nota com dur=0.5 dura meio tempo.
  //
  // Todas as melodias são originais — inspiradas no estilo arcade 8-bit,
  // não replicam músicas de Donkey Kong nem de qualquer outro jogo.

  // Frequências de notas (oitavas 3–5)
  var N = {
    C3:130.8, D3:146.8, E3:164.8, F3:174.6, G3:196.0, A3:220.0, B3:246.9,
    C4:261.6, D4:293.7, E4:329.6, F4:349.2, G4:392.0, A4:440.0, B4:493.9,
    C5:523.3, D5:587.3, E5:659.3, F5:698.5, G5:784.0, A5:880.0, B5:987.8,
    Cs4:277.2, Ds4:311.1, Fs4:370.0, Gs4:415.3, As4:466.2,
    Cs5:554.4, Ds5:622.3, Fs5:740.0, Gs5:830.6, As5:932.3,
    Fs3:185.0,  // Fá#3 — usado no baixo da fase 2
    P:0,  // pausa
  };

  // ── FAIXA 1: Menu/Título ───────────────────────────────────────────────────
  // Melodia leve e convidativa, 120 BPM, 8 compassos de 4/4.
  var FAIXA_MENU = {
    bpm: 120,
    notas: [
      // Melodia (square) — motivo de 4 compassos repetido
      {c:'mel', f:N.E5, d:0.5}, {c:'mel', f:N.D5, d:0.5},
      {c:'mel', f:N.C5, d:0.5}, {c:'mel', f:N.E5, d:0.5},
      {c:'mel', f:N.G5, d:1.0}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.G5, d:0.5},
      {c:'mel', f:N.A5, d:0.5}, {c:'mel', f:N.G5, d:0.5},
      {c:'mel', f:N.F5, d:0.5}, {c:'mel', f:N.E5, d:0.5},
      {c:'mel', f:N.C5, d:1.5}, {c:'mel', f:N.P,  d:0.5},
      // Compasso 3-4
      {c:'mel', f:N.G4, d:0.5}, {c:'mel', f:N.A4, d:0.5},
      {c:'mel', f:N.C5, d:0.5}, {c:'mel', f:N.E5, d:0.5},
      {c:'mel', f:N.D5, d:1.0}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.E5, d:0.5},
      {c:'mel', f:N.C5, d:0.5}, {c:'mel', f:N.G4, d:0.5},
      {c:'mel', f:N.E4, d:0.5}, {c:'mel', f:N.G4, d:0.5},
      {c:'mel', f:N.C4, d:2.0},
      // Compasso 5-8 (variação)
      {c:'mel', f:N.C5, d:0.5}, {c:'mel', f:N.B4, d:0.5},
      {c:'mel', f:N.A4, d:0.5}, {c:'mel', f:N.G4, d:0.5},
      {c:'mel', f:N.E5, d:1.0}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.F5, d:0.5},
      {c:'mel', f:N.E5, d:0.5}, {c:'mel', f:N.D5, d:0.5},
      {c:'mel', f:N.C5, d:0.5}, {c:'mel', f:N.B4, d:0.5},
      {c:'mel', f:N.G4, d:1.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.A4, d:0.5}, {c:'mel', f:N.C5, d:0.5},
      {c:'mel', f:N.E5, d:0.5}, {c:'mel', f:N.G5, d:0.5},
      {c:'mel', f:N.E5, d:1.0}, {c:'mel', f:N.C5, d:1.0},
      // Baixo (triangle) — vamp simples
      {c:'bass', f:N.C3, d:1.0}, {c:'bass', f:N.G3, d:1.0},
      {c:'bass', f:N.C3, d:1.0}, {c:'bass', f:N.G3, d:1.0},
      {c:'bass', f:N.A3, d:1.0}, {c:'bass', f:N.E3, d:1.0},
      {c:'bass', f:N.F3, d:1.0}, {c:'bass', f:N.C3, d:1.0},
      {c:'bass', f:N.C3, d:1.0}, {c:'bass', f:N.G3, d:1.0},
      {c:'bass', f:N.C3, d:1.0}, {c:'bass', f:N.G3, d:1.0},
      {c:'bass', f:N.A3, d:1.0}, {c:'bass', f:N.E3, d:1.0},
      {c:'bass', f:N.G3, d:1.0}, {c:'bass', f:N.C3, d:1.0},
      // Percussão — bumbo em 1 e 3, caixa em 2 e 4 (simplificado)
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:1,    d:0.5}, {c:'drum', f:0,    d:0.5},
      {c:'drum', f:2,    d:0.5}, {c:'drum', f:0,    d:0.5},
    ],
  };

  // ── FAIXA 2: Fase 1 ────────────────────────────────────────────────────────
  // Andamento moderado (138 BPM), energia de ação controlada.
  var FAIXA_FASE1 = {
    bpm: 138,
    notas: [
      // Melodia — motivo de 8 compassos
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.C5, d:0.25},
      {c:'mel', f:N.D5, d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.D5, d:0.25},{c:'mel', f:N.F5, d:0.25},
      {c:'mel', f:N.D5, d:0.25},{c:'mel', f:N.B4, d:0.25},
      {c:'mel', f:N.C5, d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.G4, d:0.25},{c:'mel', f:N.A4, d:0.25},
      {c:'mel', f:N.B4, d:0.25},{c:'mel', f:N.C5, d:0.25},
      {c:'mel', f:N.D5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.F5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.E5, d:0.5}, {c:'mel', f:N.C5, d:0.5},
      {c:'mel', f:N.G4, d:1.0}, {c:'mel', f:N.P,  d:1.0},
      // Compasso 5-8
      {c:'mel', f:N.A5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.A5, d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.Fs5,d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.Cs5,d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.Fs5,d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.F5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.D5, d:0.25},
      {c:'mel', f:N.C5, d:0.25},{c:'mel', f:N.B4, d:0.25},
      {c:'mel', f:N.A4, d:0.25},{c:'mel', f:N.G4, d:0.25},
      {c:'mel', f:N.E5, d:0.5}, {c:'mel', f:N.G5, d:0.5},
      {c:'mel', f:N.C5, d:2.0},
      // Baixo
      {c:'bass', f:N.C3, d:0.5},{c:'bass', f:N.C4, d:0.5},
      {c:'bass', f:N.G3, d:0.5},{c:'bass', f:N.G3, d:0.5},
      {c:'bass', f:N.A3, d:0.5},{c:'bass', f:N.A3, d:0.5},
      {c:'bass', f:N.F3, d:0.5},{c:'bass', f:N.C3, d:0.5},
      {c:'bass', f:N.C3, d:0.5},{c:'bass', f:N.C4, d:0.5},
      {c:'bass', f:N.G3, d:0.5},{c:'bass', f:N.G3, d:0.5},
      {c:'bass', f:N.D3, d:0.5},{c:'bass', f:N.D3, d:0.5},
      {c:'bass', f:N.G3, d:0.5},{c:'bass', f:N.C3, d:0.5},
      // Percussão 8 compassos
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
      {c:'drum', f:1,d:0.5},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.5},{c:'drum', f:2,d:0.5},
    ],
  };

  // ── FAIXA 3: Fase 2 ────────────────────────────────────────────────────────
  // Andamento mais rápido (160 BPM), melodia mais urgente.
  var FAIXA_FASE2 = {
    bpm: 160,
    notas: [
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.C5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.G5, d:0.5},
      {c:'mel', f:N.Fs5,d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.D5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.Fs5,d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.E5, d:0.5},
      {c:'mel', f:N.C5, d:0.25},{c:'mel', f:N.D5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.Fs5,d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.G5, d:0.5},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.D5, d:0.25},
      {c:'mel', f:N.C5, d:0.25},{c:'mel', f:N.D5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.C5, d:1.0},
      // Variação
      {c:'mel', f:N.A5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.Fs5,d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.D5, d:0.25},{c:'mel', f:N.C5, d:0.25},
      {c:'mel', f:N.B4, d:0.5},
      {c:'mel', f:N.Gs5,d:0.25},{c:'mel', f:N.Fs5,d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.Ds5,d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.A5, d:0.5},
      {c:'mel', f:N.C5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.C5, d:0.25},{c:'mel', f:N.G4, d:0.25},
      {c:'mel', f:N.C5, d:1.0},
      // Baixo
      {c:'bass', f:N.C3, d:0.5},{c:'bass', f:N.G3, d:0.5},
      {c:'bass', f:N.A3, d:0.5},{c:'bass', f:N.E3, d:0.5},
      {c:'bass', f:N.F3, d:0.5},{c:'bass', f:N.C3, d:0.5},
      {c:'bass', f:N.G3, d:0.5},{c:'bass', f:N.C3, d:0.5},
      {c:'bass', f:N.D3, d:0.5},{c:'bass', f:N.A3, d:0.5},
      {c:'bass', f:N.B3, d:0.5},{c:'bass', f:N.Fs3,d:0.5},
      {c:'bass', f:N.G3, d:0.5},{c:'bass', f:N.D3, d:0.5},
      {c:'bass', f:N.C3, d:1.0},
      // Percussão mais rápida (semínimas)
      {c:'drum', f:1,d:0.25},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:0,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
    ],
  };

  // ── FAIXA 4: Fase 3 ────────────────────────────────────────────────────────
  // Mais rápida ainda (185 BPM), tom mais tenso (modo menor).
  var FAIXA_FASE3 = {
    bpm: 185,
    notas: [
      {c:'mel', f:N.A4, d:0.25},{c:'mel', f:N.C5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.G5, d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.F5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.D5, d:0.25},{c:'mel', f:N.C5, d:0.25},
      {c:'mel', f:N.B4, d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.Ds5,d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.F5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.Gs5,d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.C5, d:1.0},
      // Resposta tensa
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.F5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.Ds5,d:0.25},
      {c:'mel', f:N.E5, d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.As5,d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.Gs5,d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.F5, d:0.5}, {c:'mel', f:N.P,  d:0.5},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.F5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.F5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.D5, d:0.25},
      {c:'mel', f:N.A4, d:2.0},
      // Baixo tenso (modo menor)
      {c:'bass', f:N.A3, d:0.5},{c:'bass', f:N.E3, d:0.5},
      {c:'bass', f:N.F3, d:0.5},{c:'bass', f:N.C3, d:0.5},
      {c:'bass', f:N.E3, d:0.5},{c:'bass', f:N.B3, d:0.5},
      {c:'bass', f:N.A3, d:0.5},{c:'bass', f:N.E3, d:0.5},
      {c:'bass', f:N.D3, d:0.5},{c:'bass', f:N.A3, d:0.5},
      {c:'bass', f:N.G3, d:0.5},{c:'bass', f:N.D3, d:0.5},
      {c:'bass', f:N.A3, d:0.5},{c:'bass', f:N.E3, d:0.5},
      {c:'bass', f:N.A3, d:1.0},
      // Percussão intensa
      {c:'drum', f:1,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:0,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
    ],
  };

  // ── FAIXA 5: Modo Martelo ──────────────────────────────────────────────────
  // Energética e agitada (195 BPM), toca apenas enquanto o martelo está ativo.
  var FAIXA_MARTELO = {
    bpm: 195,
    notas: [
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.C5, d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.A5, d:0.25},
      {c:'mel', f:N.G5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.B5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.E5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.B5, d:0.25},{c:'mel', f:N.C5, d:0.25},
      {c:'mel', f:N.A5, d:0.25},{c:'mel', f:N.G5, d:0.25},
      {c:'mel', f:N.Fs5,d:0.25},{c:'mel', f:N.E5, d:0.25},
      {c:'mel', f:N.D5, d:0.25},{c:'mel', f:N.C5, d:0.25},
      {c:'mel', f:N.B4, d:0.25},{c:'mel', f:N.A4, d:0.25},
      {c:'mel', f:N.G5, d:0.5}, {c:'mel', f:N.E5, d:0.5},
      {c:'mel', f:N.C5, d:0.5}, {c:'mel', f:N.G4, d:0.5},
      // Baixo ostinato
      {c:'bass', f:N.C3, d:0.25},{c:'bass', f:N.C3, d:0.25},
      {c:'bass', f:N.G3, d:0.25},{c:'bass', f:N.C3, d:0.25},
      {c:'bass', f:N.C3, d:0.25},{c:'bass', f:N.C3, d:0.25},
      {c:'bass', f:N.G3, d:0.25},{c:'bass', f:N.C3, d:0.25},
      {c:'bass', f:N.G3, d:0.25},{c:'bass', f:N.G3, d:0.25},
      {c:'bass', f:N.D4, d:0.25},{c:'bass', f:N.G3, d:0.25},
      {c:'bass', f:N.G3, d:0.25},{c:'bass', f:N.G3, d:0.25},
      {c:'bass', f:N.D4, d:0.25},{c:'bass', f:N.G3, d:0.25},
      {c:'bass', f:N.A3, d:0.25},{c:'bass', f:N.E3, d:0.25},
      {c:'bass', f:N.A3, d:0.25},{c:'bass', f:N.E3, d:0.25},
      {c:'bass', f:N.F3, d:0.25},{c:'bass', f:N.C3, d:0.25},
      {c:'bass', f:N.G3, d:0.25},{c:'bass', f:N.C3, d:0.25},
      // Percussão rápida
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
      {c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},{c:'drum', f:1,d:0.25},{c:'drum', f:2,d:0.25},
    ],
  };

  // ── MAPA DE FAIXAS ────────────────────────────────────────────────────────
  var FAIXAS = {
    'menu':    FAIXA_MENU,
    'fase1':   FAIXA_FASE1,
    'fase2':   FAIXA_FASE2,
    'fase3':   FAIXA_FASE3,
    'martelo': FAIXA_MARTELO,
  };

  // Nomes das faixas por índice de fase (levelIndex)
  var FAIXA_POR_FASE = ['fase1', 'fase2', 'fase3'];

  // ── BUFFER DE RUÍDO BRANCO (para percussão) ────────────────────────────────
  // Criado uma única vez após a inicialização do contexto.
  var _noiseBuffer = null;

  function _criarNoiseBuffer() {
    if (!_ctx || _noiseBuffer) return;
    // 1 segundo de ruído branco a 44100 Hz (mono)
    var frames = _ctx.sampleRate;
    _noiseBuffer = _ctx.createBuffer(1, frames, _ctx.sampleRate);
    var data = _noiseBuffer.getChannelData(0);
    for (var i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  // ── UTILITÁRIOS DE SÍNTESE ────────────────────────────────────────────────

  // _tocarNota: agenda uma nota musical no tempo `quando`.
  // Canal 'mel'  → OscillatorNode square
  // Canal 'bass' → OscillatorNode triangle
  // Canal 'drum' → AudioBufferSourceNode (ruído branco curto)
  //   f=1 bumbo (ruído + pitch baixo), f=2 caixa (ruído + bandpass), f=0 silêncio
  function _tocarNota(canal, freq, durS, quando) {
    if (!_ctx || !_masterGain) return;
    if (canal === 'drum' && freq === 0) return; // silêncio de percussão

    var atk  = 0.005;  // ataque suave (s)
    var rel  = 0.04;   // release (s)
    var vol  = canal === 'bass' ? 0.6 : canal === 'drum' ? 0.8 : 1.0;

    var gainNode = _ctx.createGain();
    gainNode.connect(_masterGain);
    // Envelope: rampa de 0 → vol em atk, depois vol → 0 no final
    gainNode.gain.setValueAtTime(0, quando);
    gainNode.gain.linearRampToValueAtTime(vol, quando + atk);
    var fimSom = quando + Math.max(durS - rel, atk + 0.001);
    gainNode.gain.setValueAtTime(vol, fimSom);
    gainNode.gain.linearRampToValueAtTime(0, quando + durS);

    if (canal === 'drum') {
      // Percussão via ruído branco com filtro
      if (!_noiseBuffer) return;
      var src = _ctx.createBufferSource();
      src.buffer = _noiseBuffer;
      src.loop = false;

      var filtro = _ctx.createBiquadFilter();
      if (freq === 1) {
        // Bumbo: lowpass
        filtro.type = 'lowpass';
        filtro.frequency.value = 200;
      } else {
        // Caixa: bandpass
        filtro.type = 'bandpass';
        filtro.frequency.value = 1800;
        filtro.Q.value = 0.8;
      }
      src.connect(filtro);
      filtro.connect(gainNode);
      src.start(quando);
      src.stop(quando + Math.min(durS, 0.15));
      _schedSources.push(src);
      _schedSources.push(gainNode);
    } else {
      // Melodia / baixo via oscilador
      var osc = _ctx.createOscillator();
      osc.type = canal === 'bass' ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(freq, quando);
      osc.connect(gainNode);
      osc.start(quando);
      osc.stop(quando + durS);
      _schedSources.push(osc);
      _schedSources.push(gainNode);
    }
  }

  // _sfxEnvelope: toca um único oscilador one-shot com envelope.
  // Usado por todos os SFX (não musicais).
  function _sfxEnvelope(tipo, freqInicial, freqFinal, durS, volFator) {
    if (!_ctx || !_desbloqueado || _mudo) return;
    var vol = (volFator || 1.0) * C.AUDIO_MASTER_VOL * 2.5;
    var gain = _ctx.createGain();
    gain.connect(_ctx.destination);

    var t = _ctx.currentTime;
    var atk = 0.005, rel = 0.04;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + atk);
    gain.gain.setValueAtTime(vol, t + Math.max(durS - rel, atk));
    gain.gain.linearRampToValueAtTime(0, t + durS);

    if (tipo === 'noise') {
      if (!_noiseBuffer) return;
      var src = _ctx.createBufferSource();
      src.buffer = _noiseBuffer;
      src.loop = false;
      var f = _ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freqInicial;
      f.Q.value = 0.8;
      src.connect(f);
      f.connect(gain);
      src.start(t);
      src.stop(t + durS);
    } else {
      var osc = _ctx.createOscillator();
      osc.type = tipo;
      osc.frequency.setValueAtTime(freqInicial, t);
      if (freqFinal !== freqInicial) {
        osc.frequency.linearRampToValueAtTime(freqFinal, t + durS);
      }
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + durS);
    }
  }

  // ── SCHEDULER DE MÚSICA ───────────────────────────────────────────────────
  // Agendamento por lookahead: a cada 25 ms verifica se há notas a agendar
  // nos próximos 100 ms (audioCtx.currentTime + SCHED_LOOKAHEAD_S).
  // Isso desacopla o timing musical do requestAnimationFrame, evitando
  // glitches quando a aba perde foco ou o frame rate cai.

  function _pararScheduler() {
    if (_schedInterval !== null) {
      clearInterval(_schedInterval);
      _schedInterval = null;
    }
    // Para e desconecta todos os nodes ativos agendados
    _schedSources.forEach(function (n) {
      try {
        if (n.stop) n.stop(0);
        if (n.disconnect) n.disconnect();
      } catch (e) { /* já parou */ }
    });
    _schedSources = [];
  }

  function _tickScheduler() {
    if (!_ctx || !_schedNotes) return;
    var lookahead = _ctx.currentTime + SCHED_LOOKAHEAD_S;

    while (_schedNextTime < lookahead) {
      var nota = _schedNotes[_schedIdx];
      var beatS = 60 / _schedTempo;
      var durS  = nota.d * beatS;

      if (!_mudo) {
        _tocarNota(nota.c, nota.f, durS, _schedNextTime);
      }

      _schedNextTime += durS;
      _schedIdx = (_schedIdx + 1) % _schedNotes.length;
    }
  }

  function _iniciarScheduler(faixa) {
    _pararScheduler();
    _schedTempo    = faixa.bpm;
    _schedNotes    = faixa.notas;
    _schedIdx      = 0;
    _schedNextTime = _ctx.currentTime + 0.05; // pequeno delay inicial
    _schedInterval = setInterval(_tickScheduler, SCHED_INTERVAL_MS);
    _tickScheduler(); // agenda imediatamente sem esperar o primeiro tick
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────────────

  DK.audio = {

    // init(): cria ou retoma o AudioContext.
    // Deve ser chamado após o primeiro gesto do usuário (Enter no menu).
    // Seguro para chamar múltiplas vezes — idempotente.
    init: function () {
      if (!_ctx) {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        _masterGain = _ctx.createGain();
        _masterGain.gain.value = _mudo ? 0 : C.AUDIO_MASTER_VOL;
        _masterGain.connect(_ctx.destination);
        _criarNoiseBuffer();
      }

      // Política de autoplay: o navegador pode suspender o contexto.
      // resume() retorna uma Promise; ignoramos rejeições silenciosamente.
      if (_ctx.state === 'suspended') {
        _ctx.resume().catch(function () {});
      }

      _desbloqueado = true;

      // Se havia uma faixa pendente (solicitada antes do gesto), toca agora
      if (_faixaAtual && !_schedInterval) {
        var faixa = FAIXAS[_faixaAtual];
        if (faixa) _iniciarScheduler(faixa);
      }
    },

    // playMusic(nome): toca a faixa com o nome dado em loop.
    // Se a mesma faixa já estiver tocando, não faz nada.
    // Seguro de chamar antes de init() — marca a faixa como pendente.
    playMusic: function (nome) {
      if (_faixaAtual === nome && _schedInterval !== null) return;
      _faixaAtual = nome;

      if (!_desbloqueado || !_ctx) return; // será tocada em init()

      var faixa = FAIXAS[nome];
      if (!faixa) return;

      if (_ctx.state === 'suspended') {
        _ctx.resume().catch(function () {});
      }
      _iniciarScheduler(faixa);
    },

    // stopMusic(): para a música atual e limpa o scheduler.
    stopMusic: function () {
      _faixaAtual = null;
      _pararScheduler();
    },

    // sfx(nome): toca um efeito sonoro one-shot.
    // Seguro de chamar antes de init() — silencioso se não inicializado.
    sfx: function (nome) {
      if (!_desbloqueado || !_ctx || _mudo) return;

      switch (nome) {
        case 'andar':
          // Clique curto de passo
          _sfxEnvelope('square', 220, 180, 0.06, 0.3);
          break;

        case 'pulo':
          // Glissando rápido para cima
          _sfxEnvelope('square', 300, 700, 0.15, 0.7);
          break;

        case 'escada':
          // Tom metálico de degrau
          _sfxEnvelope('square', 440, 380, 0.08, 0.4);
          break;

        case 'puloBônus':
          // Arpejo rápido ascendente (dois tons curtos)
          _sfxEnvelope('square', 600, 900, 0.10, 0.6);
          // Segundo tom com leve delay via agendamento manual
          if (_ctx) {
            var t2 = _ctx.currentTime + 0.10;
            var g2 = _ctx.createGain();
            g2.connect(_ctx.destination);
            g2.gain.setValueAtTime(0, t2);
            g2.gain.linearRampToValueAtTime(C.AUDIO_MASTER_VOL * 2.0, t2 + 0.005);
            g2.gain.linearRampToValueAtTime(0, t2 + 0.12);
            var o2 = _ctx.createOscillator();
            o2.type = 'square';
            o2.frequency.setValueAtTime(1200, t2);
            o2.connect(g2);
            o2.start(t2);
            o2.stop(t2 + 0.12);
          }
          break;

        case 'martelada':
          // Impacto grave + ruído
          _sfxEnvelope('square', 150, 60, 0.12, 0.9);
          _sfxEnvelope('noise', 800, 800, 0.08, 0.7);
          break;

        case 'pegaMartelo':
          // Jingle ascendente de 3 notas
          _sfxEnvelopeSeq([
            { f: 523, d: 0.07 }, { f: 659, d: 0.07 }, { f: 784, d: 0.12 },
          ], 'square', 0.8);
          break;

        case 'morte':
          // Glissando longo descendente + ruído
          _sfxEnvelope('square', 600, 100, 0.5, 0.9);
          _sfxEnvelope('noise', 400, 400, 0.4, 0.5);
          break;

        case 'fireball':
          // Som de ignição: chirp rápido
          _sfxEnvelope('sawtooth', 800, 200, 0.18, 0.6);
          break;

        case 'faseConcluida':
          // Jingle ascendente curto e alegre
          _sfxEnvelopeSeq([
            { f: 523, d: 0.10 }, { f: 659, d: 0.10 },
            { f: 784, d: 0.10 }, { f: 1047, d: 0.20 },
          ], 'square', 0.9);
          break;

        case 'gameOver':
          // Jingle descendente sombrio
          _sfxEnvelopeSeq([
            { f: 392, d: 0.15 }, { f: 330, d: 0.15 },
            { f: 262, d: 0.15 }, { f: 196, d: 0.30 },
          ], 'square', 0.9);
          break;

        case 'vitoria':
          // Fanfarra curta e animada
          _sfxEnvelopeSeq([
            { f: 523, d: 0.08 }, { f: 659, d: 0.08 },
            { f: 784, d: 0.08 }, { f: 659, d: 0.08 },
            { f: 1047, d: 0.20 },
          ], 'square', 1.0);
          break;
      }
    },

    // toggleMute(): alterna mute e salva preferência no localStorage.
    toggleMute: function () {
      _mudo = !_mudo;
      if (_masterGain) {
        _masterGain.gain.value = _mudo ? 0 : C.AUDIO_MASTER_VOL;
      }
      try {
        localStorage.setItem('dk_mudo', _mudo ? '1' : '0');
      } catch (e) {}
    },

    // isMuted(): retorna true se o áudio estiver mudo.
    isMuted: function () {
      return _mudo;
    },

    // faixaPorFase(idx): retorna o nome da faixa para o levelIndex dado.
    faixaPorFase: function (idx) {
      return FAIXA_POR_FASE[idx] || 'fase1';
    },
  };

  // ── _sfxEnvelopeSeq: sequência de notas SFX com delays agendados ─────────
  // Agenda cada nota com timing preciso via audioCtx.currentTime,
  // sem usar setTimeout por nota. Todas são agendadas de uma vez no
  // momento da chamada, usando o scheduler de precisão do Web Audio.
  function _sfxEnvelopeSeq(notas, tipo, volFator) {
    if (!_ctx || !_desbloqueado || _mudo) return;
    var t = _ctx.currentTime + 0.01; // pequena margem inicial
    for (var i = 0; i < notas.length; i++) {
      (function (nota, quando) {
        var vol  = (volFator || 1.0) * C.AUDIO_MASTER_VOL * 2.5;
        var atk  = 0.005;
        var rel  = 0.04;
        var durS = nota.d;

        var gain = _ctx.createGain();
        gain.connect(_ctx.destination);
        gain.gain.setValueAtTime(0, quando);
        gain.gain.linearRampToValueAtTime(vol, quando + atk);
        gain.gain.setValueAtTime(vol, quando + Math.max(durS - rel, atk));
        gain.gain.linearRampToValueAtTime(0, quando + durS);

        var osc = _ctx.createOscillator();
        osc.type = tipo;
        osc.frequency.setValueAtTime(nota.f, quando);
        osc.connect(gain);
        osc.start(quando);
        osc.stop(quando + durS);
      }(notas[i], t));
      t += notas[i].d;
    }
  }

  // ── CARREGAMENTO DE PREFERÊNCIA DE MUTE ──────────────────────────────────
  // Lê o estado salvo no localStorage antes de qualquer gesto.
  (function () {
    try {
      _mudo = localStorage.getItem('dk_mudo') === '1';
    } catch (e) {}
  }());

  // ── TRATAMENTO DA TECLA M (toggle mute) ──────────────────────────────────
  // Registrado aqui no audio.js para manter a responsabilidade no módulo de áudio.
  // Não precisa de gesto prévio (só altera o estado; o contexto pode não existir ainda).
  document.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM') {
      DK.audio.toggleMute();
    }
  });

  // ── PAUSA / RETOMADA POR VISIBILIDADE DA ABA ──────────────────────────────
  // Quando a aba fica oculta: suspende o contexto (economiza CPU) e para o scheduler.
  // Quando volta: retoma APENAS se o áudio já foi desbloqueado, não estiver mudo
  // e houver uma faixa que deva estar tocando.
  document.addEventListener('visibilitychange', function () {
    if (!_ctx) return;

    if (document.hidden) {
      // Para o scheduler (evita notas se acumulando enquanto oculto)
      if (_schedInterval !== null) {
        clearInterval(_schedInterval);
        _schedInterval = null;
      }
      _ctx.suspend().catch(function () {});
    } else {
      // Aba voltou a ficar visível
      if (!_desbloqueado || _mudo) return;

      _ctx.resume().catch(function () {});

      // Reinicia o scheduler da faixa atual se havia uma tocando
      if (_faixaAtual) {
        var faixa = FAIXAS[_faixaAtual];
        if (faixa && !_schedInterval) {
          // Reinicia o scheduler — _schedIdx continua de onde parou
          _schedNextTime = _ctx.currentTime + 0.05;
          _schedInterval = setInterval(_tickScheduler, SCHED_INTERVAL_MS);
          _tickScheduler();
        }
      }
    }
  });

}());
