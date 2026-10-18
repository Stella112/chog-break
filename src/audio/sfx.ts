// §D13 synthesized sound (WebAudio). No audio files. Mute persisted with try/catch.
const MUTE_KEY = 'chogbreak.muted.v1';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.15, slideTo?: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, delay = 0, lowpass = 2000) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  click: () => tone(660, 0.05, 'square', 0.06),
  select: () => tone(440, 0.08, 'triangle', 0.1, 880),
  alarm: () => {
    for (let i = 0; i < 3; i++) tone(520, 0.18, 'sawtooth', 0.08, 380, i * 0.25);
  },
  electricity: () => {
    noise(0.6, 0.12, 0, 6000);
    for (let i = 0; i < 6; i++) tone(80 + i * 40, 0.05, 'square', 0.05, 2000, i * 0.08);
  },
  impact: () => {
    tone(120, 0.4, 'sine', 0.35, 40);
    noise(0.3, 0.25, 0, 900);
  },
  discovery: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, undefined, i * 0.09)),
};
