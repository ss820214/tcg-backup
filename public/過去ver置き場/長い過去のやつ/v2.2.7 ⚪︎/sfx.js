// public/sfx.js
// v2.0.5 - tiny SFX (no asset files)
let audioCtx = null;

function ctx(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
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