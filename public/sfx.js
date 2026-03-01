// public/sfx.js
// v2.0.6 - tiny SFX + BGM (WebAudio + MP3 assets)
let audioCtx = null;

function ctx(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// ★ clamp はここ1個だけ（重複エラー対策）
function clamp01(v){
  v = Number(v);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function playHit(){
  try{
    const ac = ctx();
    const t0 = ac.currentTime;

    // click + thump
    const o1 = ac.createOscillator();
    const g1 = ac.createGain();
    o1.type = "square";
    o1.frequency.setValueAtTime(220, t0);
    o1.frequency.exponentialRampToValueAtTime(120, t0 + 0.06);
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.exponentialRampToValueAtTime(0.10, t0 + 0.005);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    o1.connect(g1); g1.connect(ac.destination);
    o1.start(t0); o1.stop(t0 + 0.09);

    // little "tick"
    const o2 = ac.createOscillator();
    const g2 = ac.createGain();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(900, t0);
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(0.05, t0 + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    o2.connect(g2); g2.connect(ac.destination);
    o2.start(t0); o2.stop(t0 + 0.04);
  } catch {}
}

// ===== WebAudio helpers =====
function midiToFreq(m){
  return 440 * Math.pow(2, (m - 69) / 12);
}

function safeStopNode(n){
  try{ n?.stop?.(); } catch {}
  try{ n?.disconnect?.(); } catch {}
}

// ===== BGM: Deck (WebAudio) =====
let deckBgm = {
  timer: null,
  nodes: [],
  step: 0,
  playing: false,
  master: null,
  filter: null,
};

function clearDeckNodes(){
  const arr = deckBgm.nodes;
  deckBgm.nodes = [];
  for (const n of arr) safeStopNode(n);
}

function ensureDeckBus(ac, volume){
  if (deckBgm.master && deckBgm.filter){
    if (typeof volume === "number"){
      deckBgm.master.gain.value = Math.max(0, Math.min(1, volume));
    }
    return;
  }

  const master = ac.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume ?? 0.08));

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 950;
  filter.Q.value = 0.75;

  // 軽いコンプで“聞こえる音量”を底上げ
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -26;
  comp.knee.value = 28;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;

  filter.connect(comp);
  comp.connect(master);
  master.connect(ac.destination);

  deckBgm.master = master;
  deckBgm.filter = filter;
}

function triggerNote(ac, t, freq, dur, type, gainAmt){
  const o = ac.createOscillator();
  const g = ac.createGain();

  o.type = type;
  o.frequency.setValueAtTime(freq, t);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainAmt), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  o.connect(g);
  g.connect(deckBgm.filter);

  o.start(t);
  o.stop(t + dur + 0.02);

  deckBgm.nodes.push(o, g);
}

export async function startDeckBgm(opts = {}){
  try{
    const ac = (window.AudioContext || window.webkitAudioContext)
      ? (audioCtx ?? (audioCtx = new (window.AudioContext || window.webkitAudioContext)()))
      : null;
    if (!ac) return;

    ensureDeckBus(ac, opts.volume);

    if (ac.state === "suspended"){
      await ac.resume().catch(()=>{});
    }

    if (deckBgm.playing) return;
    deckBgm.playing = true;

    const bpm = opts.bpm ?? 64;
    const stepSec = (60 / bpm) / 2;

    const bass = [
      36, null, null, null,  33, null, null, null,
      38, null, null, null,  31, null, null, null,
      36, null, null, null,  33, null, null, null,
      38, null, null, null,  31, null, null, null,
    ];

    const chordHits = [
      [60,64], null, [67,71], null, [60,64], null, [67,71], null,
      [57,60], null, [64,67], null, [57,60], null, [64,67], null,
      [62,65], null, [69,72], null, [62,65], null, [69,72], null,
      [55,59], null, [62,65], null, [55,59], null, [62,65], null,
    ];

    const melody = [
      null, 72, null, 74,  null, null, 76, null,
      null, 72, null, 71,  null, null, 69, null,
      null, 74, null, 76,  null, null, 77, null,
      null, 74, null, 72,  null, null, 71, null,
    ];

    deckBgm.step = deckBgm.step % 32;

    deckBgm.timer = window.setInterval(()=>{
      if (!deckBgm.playing) return;

      const now = ac.currentTime;
      const i = deckBgm.step & 31;
      const t = now + 0.02;

      const m = melody[i];
      const b = bass[i];
      const ch = chordHits[i];

      const human = (Math.random() - 0.5) * 0.008;
      const tt = t + human;

      if (b != null){
        triggerNote(ac, tt, midiToFreq(b), Math.min(0.22, stepSec*0.62), "sine", 0.045);
      }
      if (ch){
        triggerNote(ac, tt, midiToFreq(ch[0]), Math.min(0.48, stepSec*1.35), "triangle", 0.022);
        triggerNote(ac, tt, midiToFreq(ch[1]), Math.min(0.48, stepSec*1.35), "triangle", 0.020);
      }
      if (m != null){
        triggerNote(ac, tt, midiToFreq(m), Math.min(0.30, stepSec*0.9), "triangle", 0.030);
      }

      if ((deckBgm.step % 32) === 0) clearDeckNodes();
      deckBgm.step = (deckBgm.step + 1) % 32;
    }, Math.max(60, Math.floor(stepSec * 1000)));

  } catch(e){
    console.log(e);
  }
}

export function stopDeckBgm(){
  try{
    deckBgm.playing = false;
    if (deckBgm.timer){
      clearInterval(deckBgm.timer);
      deckBgm.timer = null;
    }
    clearDeckNodes();
  } catch {}
}

export function playTestBeep(vol = 0.2){
  try{
    const ac = ctx();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + 0.2);
  } catch(e){ console.log(e); }
}

// ===== BGM: Battle (WebAudio) =====
let battleBgm = {
  timer: null,
  nodes: [],
  step: 0,
  playing: false,
  master: null,
  filter: null,
};

function ensureBattleBus(ac, volume){
  if (battleBgm.master && battleBgm.filter){
    if (typeof volume === "number"){
      battleBgm.master.gain.value = Math.max(0, Math.min(1, volume));
    }
    return;
  }

  const master = ac.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume ?? 0.12));

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  filter.Q.value = 0.7;

  filter.connect(master);
  master.connect(ac.destination);

  battleBgm.master = master;
  battleBgm.filter = filter;
}

function clearBattleNodes(){
  const arr = battleBgm.nodes;
  battleBgm.nodes = [];
  for (const n of arr) safeStopNode(n);
}

function triggerBattleNote(ac, t, freq, dur, type, gainAmt){
  const o = ac.createOscillator();
  const g = ac.createGain();

  o.type = type;
  o.frequency.setValueAtTime(freq, t);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainAmt), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  o.connect(g);
  g.connect(battleBgm.filter);

  o.start(t);
  o.stop(t + dur + 0.02);

  battleBgm.nodes.push(o, g);
}

function triggerKick(ac, t, gainAmt=0.12){
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.07);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainAmt), t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

  o.connect(g);
  g.connect(battleBgm.filter);

  o.start(t);
  o.stop(t + 0.14);
  battleBgm.nodes.push(o, g);
}

export async function startBattleBgm(opts = {}){
  try{
    const ac = (window.AudioContext || window.webkitAudioContext)
      ? (audioCtx ?? (audioCtx = new (window.AudioContext || window.webkitAudioContext)()))
      : null;
    if (!ac) return;

    ensureBattleBus(ac, opts.volume);

    if (ac.state === "suspended"){
      await ac.resume().catch(()=>{});
    }

    if (battleBgm.playing) return;
    battleBgm.playing = true;

    const bpm = opts.bpm ?? 140;
    const stepSec = (60 / bpm) / 2;

    const bass = [
      33, null, 33, null,  36, null, 36, null,
      38, null, 38, null,  40, null, 40, null,
    ];
    const lead = [
      null, 69, null, 72,  null, 74, null, 76,
      null, 72, null, 74,  null, 76, null, 77,
    ];

    battleBgm.step = battleBgm.step % 16;

    battleBgm.timer = window.setInterval(()=>{
      if (!battleBgm.playing) return;

      const now = ac.currentTime;
      const i = battleBgm.step & 15;
      const t = now + 0.02;
      const tt = t + (Math.random()-0.5)*0.006;

      if ((i % 2) === 0) triggerKick(ac, tt, 0.14);

      const b = bass[i];
      if (b != null){
        triggerBattleNote(ac, tt, midiToFreq(b), Math.min(0.16, stepSec*0.75), "sawtooth", 0.05);
      }

      const m = lead[i];
      if (m != null){
        triggerBattleNote(ac, tt, midiToFreq(m), Math.min(0.20, stepSec*0.85), "square", 0.03);
      }

      if ((battleBgm.step % 16) === 0) clearBattleNodes();
      battleBgm.step = (battleBgm.step + 1) % 16;
    }, Math.max(45, Math.floor(stepSec * 1000)));

  } catch(e){
    console.log(e);
  }
}

export function stopBattleBgm(){
  try{
    battleBgm.playing = false;
    if (battleBgm.timer){
      clearInterval(battleBgm.timer);
      battleBgm.timer = null;
    }
    clearBattleNodes();
  } catch {}
}

// ===== Deck BGM (MP3 asset) =====
// public/deck_bgm_cafe_loop.mp3 をループ再生（テンポは playbackRate）
let deckBgmCafeAudio = null;

export async function startDeckBgmCafe(opts = {}){
  try{
    const volume = clamp01(opts.volume ?? 0.35);
    const rate   = Math.max(0.5, Math.min(2.0, Number(opts.playbackRate ?? 1.10)));

    if (!deckBgmCafeAudio){
      deckBgmCafeAudio = new Audio("./deck_bgm_cafe_loop.mp3");
      deckBgmCafeAudio.loop = true;
      deckBgmCafeAudio.preload = "auto";
    }

    deckBgmCafeAudio.volume = volume;
    deckBgmCafeAudio.playbackRate = rate;

    await deckBgmCafeAudio.play();
  }catch(e){
    console.warn("[DeckBGM Cafe] play blocked or failed", e);
  }
}

export function stopDeckBgmCafe(){
  try{
    if (!deckBgmCafeAudio) return;
    deckBgmCafeAudio.pause();
    deckBgmCafeAudio.currentTime = 0;
  }catch{}
}

// ===== Battle BGM (MP3 asset) =====
// public/battle_bgm.mp3（midtempo採用）をループ再生
let battleBgmAudio = null;

export async function startBattleBgmMp3(opts = {}){
  try{
    const volume = clamp01(opts.volume ?? 0.55);
    const rate   = Math.max(0.5, Math.min(2.0, Number(opts.playbackRate ?? 1.00)));

    if (!battleBgmAudio){
      battleBgmAudio = new Audio("./battle_bgm.mp3");
      battleBgmAudio.loop = true;
      battleBgmAudio.preload = "auto";
    }

    battleBgmAudio.volume = volume;
    battleBgmAudio.playbackRate = rate;

    await battleBgmAudio.play();
  }catch(e){
    console.warn("[BattleBGM MP3] play blocked or failed", e);
  }
}

export function stopBattleBgmMp3(){
  try{
    if (!battleBgmAudio) return;
    battleBgmAudio.pause();
    battleBgmAudio.currentTime = 0;
  }catch{}
}

// ===== Alert BGM (MP3 asset) =====
// public/alert1.mp3, public/alert2.mp3 をループ再生
let alert1Audio = null;
let alert2Audio = null;

export async function startAlert1Mp3(opts = {}){
  try{
    const volume = clamp01(opts.volume ?? 0.55);
    const rate   = Math.max(0.5, Math.min(2.0, Number(opts.playbackRate ?? 1.00)));

    if (!alert1Audio){
      alert1Audio = new Audio("./alert1.mp3");
      alert1Audio.loop = true;
      alert1Audio.preload = "auto";
    }

    alert1Audio.volume = volume;
    alert1Audio.playbackRate = rate;

    await alert1Audio.play();
  }catch(e){
    console.warn("[Alert1 MP3] play blocked or failed", e);
  }
}

export function stopAlert1Mp3(){
  try{
    if (!alert1Audio) return;
    alert1Audio.pause();
    alert1Audio.currentTime = 0;
  }catch{}
}

export async function startAlert2Mp3(opts = {}){
  try{
    const volume = clamp01(opts.volume ?? 0.55);
    const rate   = Math.max(0.5, Math.min(2.0, Number(opts.playbackRate ?? 1.00)));

    if (!alert2Audio){
      alert2Audio = new Audio("./alert2.mp3");
      alert2Audio.loop = true;
      alert2Audio.preload = "auto";
    }

    alert2Audio.volume = volume;
    alert2Audio.playbackRate = rate;

    await alert2Audio.play();
  }catch(e){
    console.warn("[Alert2 MP3] play blocked or failed", e);
  }
}

export function stopAlert2Mp3(){
  try{
    if (!alert2Audio) return;
    alert2Audio.pause();
    alert2Audio.currentTime = 0;
  }catch{}
}

// ===== BGM mode controller =====
let _bgmEnabled = true;
let _bgmMode = "battle"; // "battle" | "alert1" | "alert2"
let _bgmOpts = { volume: 0.35, playbackRate: 1.0 };

function stopAll(){
  stopBattleBgmMp3();
  stopAlert1Mp3();
  stopAlert2Mp3();
}

async function playByMode(){
  stopAll();
  if (!_bgmEnabled) return;

  if (_bgmMode === "alert2") return startAlert2Mp3(_bgmOpts);
  if (_bgmMode === "alert1") return startAlert1Mp3(_bgmOpts);
  return startBattleBgmMp3(_bgmOpts);
}

export function setBgmEnabled(on, opts = null){
  _bgmEnabled = !!on;
  if (opts && typeof opts === "object"){
    _bgmOpts = {
      volume: clamp01(opts.volume ?? _bgmOpts.volume),
      playbackRate: Math.max(0.5, Math.min(2.0, Number(opts.playbackRate ?? _bgmOpts.playbackRate))),
    };
  }
  if (!_bgmEnabled) stopAll();
  else playByMode();
}

export function setBgmMode(mode, opts = null){
  const m = String(mode || "battle");
  if (m !== "battle" && m !== "alert1" && m !== "alert2") return;

  _bgmMode = m;
  if (opts && typeof opts === "object"){
    _bgmOpts = {
      volume: clamp01(opts.volume ?? _bgmOpts.volume),
      playbackRate: Math.max(0.5, Math.min(2.0, Number(opts.playbackRate ?? _bgmOpts.playbackRate))),
    };
  }
  // ✅ ここが肝：OFF中は鳴らさない（でもモードは保持する）
  if (!_bgmEnabled) return;
  playByMode();
}