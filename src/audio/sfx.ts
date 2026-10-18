// §D13 synthesized sound (WebAudio). No audio files. Mute persisted with try/catch.
// Mix: every voice → master gain → compressor → speakers, with a small send to a
// code-generated reverb so the lab sounds like a room, not a beeper.
const MUTE_KEY = 'chogbreak.muted.v1';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
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

function setup(a: AudioContext) {
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  comp.connect(a.destination);
  master = a.createGain();
  master.gain.value = 0.8;
  master.connect(comp);

  // Reverb: decaying stereo noise impulse (1.2 s).
  const len = Math.floor(a.sampleRate * 1.2);
  const ir = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = a.createConvolver();
  conv.buffer = ir;
  const wet = a.createGain();
  wet.gain.value = 0.22;
  reverbIn = a.createGain();
  reverbIn.connect(conv).connect(wet).connect(master);

  noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const n = noiseBuf.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      setup(ctx);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Small random detune so repeated sounds don't feel robotic. */
const vary = (f: number, amt = 0.05) => f * (1 + (Math.random() * 2 - 1) * amt);

function out(a: AudioContext, node: AudioNode, wet = 0.3) {
  node.connect(master!);
  if (wet > 0) {
    const s = a.createGain();
    s.gain.value = wet;
    node.connect(s).connect(reverbIn!);
  }
}

type ToneOpts = { type?: OscillatorType; vol?: number; slideTo?: number; delay?: number; attack?: number; wet?: number; detune?: number };

function tone(freq: number, dur: number, o: ToneOpts = {}) {
  const a = audio();
  if (!a) return;
  const { type = 'sine', vol = 0.15, slideTo, delay = 0, attack = 0.004, wet = 0.25, detune = 0 } = o;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  out(a, g, wet);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

type NoiseOpts = { vol?: number; delay?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number; wet?: number; attack?: number };

function noise(dur: number, o: NoiseOpts = {}) {
  const a = audio();
  if (!a || !noiseBuf) return;
  const { vol = 0.2, delay = 0, filter = 'lowpass', freq = 2000, freqTo, q = 0.8, wet = 0.2, attack = 0.002 } = o;
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  out(a, g, wet);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

export const sfx = {
  click: () => {
    tone(vary(1700), 0.04, { type: 'triangle', vol: 0.05, wet: 0.05 });
    noise(0.025, { vol: 0.05, filter: 'highpass', freq: 5000, wet: 0 });
  },
  select: () => {
    tone(vary(520, 0.02), 0.07, { type: 'triangle', vol: 0.09 });
    tone(vary(780, 0.02), 0.09, { type: 'triangle', vol: 0.08, delay: 0.06 });
  },
  alarm: () => {
    // two-tone lab siren
    for (let i = 0; i < 3; i++) {
      tone(620, 0.16, { type: 'sawtooth', vol: 0.06, slideTo: 440, delay: i * 0.26, wet: 0.4 });
      tone(310, 0.16, { type: 'square', vol: 0.03, slideTo: 220, delay: i * 0.26, wet: 0.4 });
    }
  },
  electricity: () => {
    // crackle bursts + mains buzz
    for (let i = 0; i < 14; i++) noise(0.02 + Math.random() * 0.04, { vol: 0.1 + Math.random() * 0.1, delay: Math.random() * 0.7, filter: 'bandpass', freq: 3000 + Math.random() * 5000, q: 2, wet: 0.3 });
    tone(60, 0.8, { type: 'sawtooth', vol: 0.05, wet: 0.1 });
    tone(120, 0.8, { type: 'square', vol: 0.025, wet: 0.1 });
  },
  /** Rising machine whine while the splice charges. */
  spinUp: (dur = 1.2) => {
    tone(90, dur, { type: 'sawtooth', vol: 0.05, slideTo: 900, attack: 0.2, wet: 0.35 });
    tone(180, dur, { type: 'triangle', vol: 0.04, slideTo: 1800, attack: 0.2, wet: 0.35 });
    noise(dur, { vol: 0.05, filter: 'bandpass', freq: 400, freqTo: 4000, q: 3, attack: 0.3 });
  },
  impact: () => {
    // chamber door boom + metal ring
    tone(110, 0.6, { vol: 0.4, slideTo: 32, wet: 0.5 });
    noise(0.35, { vol: 0.35, freq: 900, freqTo: 120, wet: 0.5 });
    tone(612, 0.9, { type: 'triangle', vol: 0.05, wet: 0.6 });
    tone(617, 0.9, { type: 'triangle', vol: 0.04, wet: 0.6 });
  },
  punch: (step = 1) => {
    const heavy = step === 3;
    tone(vary(heavy ? 130 : 170), heavy ? 0.14 : 0.09, { vol: heavy ? 0.32 : 0.24, slideTo: 50, wet: 0.1 });
    noise(heavy ? 0.09 : 0.06, { vol: heavy ? 0.28 : 0.2, filter: 'bandpass', freq: vary(1400 + step * 500), q: 1.2, wet: 0.1 });
  },
  bigHit: () => {
    tone(vary(95), 0.35, { vol: 0.42, slideTo: 30, wet: 0.35 });
    noise(0.3, { vol: 0.35, filter: 'lowpass', freq: 2500, freqTo: 300, wet: 0.35 });
    tone(vary(240), 0.12, { type: 'square', vol: 0.08, slideTo: 80, wet: 0.2 });
  },
  whoosh: () => noise(0.16, { vol: 0.09, filter: 'bandpass', freq: vary(700), freqTo: 3200, q: 1.5, wet: 0.15, attack: 0.03 }),
  jump: () => tone(vary(280, 0.03), 0.12, { type: 'sine', vol: 0.08, slideTo: 640, wet: 0.1 }),
  ko: () => {
    // blast-zone explosion: boom + falling shriek + long rumble
    tone(70, 0.9, { vol: 0.45, slideTo: 25, wet: 0.6 });
    tone(1200, 0.7, { type: 'sawtooth', vol: 0.08, slideTo: 90, wet: 0.5 });
    noise(1.1, { vol: 0.4, freq: 3000, freqTo: 150, wet: 0.6, attack: 0.005 });
  },
  countdown: (go = false) => {
    if (!go) tone(440, 0.14, { type: 'square', vol: 0.07, wet: 0.3 });
    else [523, 659, 784].forEach((f) => tone(f, 0.45, { type: 'square', vol: 0.05, wet: 0.4 }));
  },
  victory: () => {
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.2, { type: 'square', vol: 0.06, delay: i * 0.1, wet: 0.35 }));
    [523, 659, 784, 1047].forEach((f) => tone(f, 1.2, { type: 'triangle', vol: 0.06, delay: 0.42, attack: 0.02, wet: 0.5 }));
  },
  defeat: () => {
    [392, 349, 311, 262].forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.09, delay: i * 0.18, slideTo: f * 0.97, wet: 0.45 }));
    tone(131, 1, { type: 'sawtooth', vol: 0.04, delay: 0.72, slideTo: 98, wet: 0.5 });
  },
  move: (kind: 'special' | 'close' | 'heal' | 'block' | 'zap' | 'honk' | 'warp') => {
    if (kind === 'special') {
      tone(vary(420), 0.18, { type: 'sawtooth', vol: 0.06, slideTo: 1100, wet: 0.35 });
      noise(0.12, { vol: 0.06, filter: 'highpass', freq: 3000 });
    } else if (kind === 'close') tone(vary(240), 0.1, { type: 'square', vol: 0.06, slideTo: 150, wet: 0.15 });
    else if (kind === 'heal') [660, 990, 1320].forEach((f, i) => tone(f, 0.18, { vol: 0.06, delay: i * 0.06, wet: 0.5 }));
    else if (kind === 'block') {
      tone(1500, 0.12, { type: 'triangle', vol: 0.08, slideTo: 1100, wet: 0.4 });
      tone(2250, 0.08, { type: 'sine', vol: 0.04, wet: 0.4 });
    } else if (kind === 'zap') {
      noise(0.22, { vol: 0.14, filter: 'highpass', freq: 5000, wet: 0.3 });
      tone(1600, 0.22, { type: 'sawtooth', vol: 0.06, slideTo: 250, wet: 0.3 });
    } else if (kind === 'honk') {
      tone(330, 0.28, { type: 'square', vol: 0.1, wet: 0.3 });
      tone(415, 0.28, { type: 'square', vol: 0.07, wet: 0.3 });
    } else if (kind === 'warp') {
      tone(180, 0.25, { vol: 0.1, slideTo: 1800, wet: 0.5 });
      noise(0.25, { vol: 0.05, filter: 'bandpass', freq: 600, freqTo: 6000, q: 4, wet: 0.5 });
    }
  },
  discovery: () => {
    // sparkly bell arpeggio for secret mutations
    [784, 988, 1175, 1568, 1976].forEach((f, i) => {
      tone(f, 0.6, { vol: 0.06, delay: i * 0.08, wet: 0.7 });
      tone(f * 2.01, 0.3, { vol: 0.02, delay: i * 0.08, wet: 0.7 });
    });
  },
};
