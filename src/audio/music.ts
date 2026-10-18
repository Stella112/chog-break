// Synthesized background music (no audio files). Two short loops:
//   lab   — mellow: soft pads, slow arpeggio, light hats (menus, lab, reveal, results)
//   arena — driving: four-on-the-floor kick, clap, syncopated bass, chord stabs (fights)
// A lookahead scheduler keeps timing tight even when frames drop. Obeys the SOUND mute
// and has its own MUSIC mute (persisted).
import { audioGraph, isMuted, onMuteChange } from './sfx';

export type Track = 'lab' | 'arena';

const MUSIC_KEY = 'chogbreak.music.v1';
let musicMuted = (() => {
  try {
    return localStorage.getItem(MUSIC_KEY) === '0';
  } catch {
    return false;
  }
})();

type Song = {
  bpm: number;
  volume: number;
  /** One chord (MIDI notes) per bar. */
  chords: number[][];
  step: (s: Voice, bar: number, step: number, t: number, stepDur: number, chord: number[]) => void;
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Instrument voices, all routed into the music bus. */
class Voice {
  constructor(
    private ctx: AudioContext,
    private bus: GainNode,
    private reverb: GainNode,
    private noiseBuf: AudioBuffer,
  ) {}

  private env(t: number, peak: number, attack: number, dur: number, wet = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.bus);
    if (wet > 0) {
      const w = this.ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.reverb);
    }
    return g;
  }

  kick(t: number, vol = 0.9) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(this.env(t, vol, 0.002, 0.32));
    o.start(t);
    o.stop(t + 0.35);
  }

  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.7, wet = 0.1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this.env(t, vol, 0.002, dur, wet));
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  clap(t: number) {
    this.noise(t, 0.16, 0.35, 'bandpass', 1600, 0.9, 0.25);
    this.noise(t + 0.012, 0.12, 0.25, 'bandpass', 2200, 0.9, 0.25);
  }

  hat(t: number, open = false, vol = 0.12) {
    this.noise(t, open ? 0.14 : 0.035, vol, 'highpass', 7500, 0.6, 0.05);
  }

  bass(t: number, midi: number, dur: number, vol = 0.35) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(midi);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + dur);
    o.connect(f).connect(this.env(t, vol, 0.005, dur));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  pad(t: number, notes: number[], dur: number, vol = 0.05) {
    for (const n of notes) {
      for (const det of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        o.detune.value = det;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        o.connect(f).connect(this.env(t, vol, Math.min(0.4, dur * 0.3), dur, 0.5));
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  pluck(t: number, midi: number, vol = 0.09, dur = 0.35) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(midi);
    o.connect(this.env(t, vol, 0.004, dur, 0.45));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  stab(t: number, notes: number[], vol = 0.05) {
    for (const n of notes) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = mtof(n);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2000;
      o.connect(f).connect(this.env(t, vol, 0.004, 0.18, 0.3));
      o.start(t);
      o.stop(t + 0.22);
    }
  }
}

const SONGS: Record<Track, Song> = {
  lab: {
    bpm: 88,
    volume: 0.28,
    // Am7 · Fmaj7 · Dm7 · Esus
    chords: [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [50, 53, 57, 60],
      [52, 57, 59, 64],
    ],
    step(v, bar, step, t, sd, chord) {
      if (step === 0) v.pad(t, chord, sd * 16, 0.035);
      if (step === 0 || step === 10) v.bass(t, chord[0]! - 12, sd * 5, 0.22);
      if (step === 0) v.kick(t, 0.45);
      if (step % 4 === 2) v.hat(t, false, 0.05);
      if (step % 2 === 0) {
        const up = [...chord, chord[0]! + 12, chord[1]! + 12];
        const idx = ((step / 2) + bar) % up.length;
        v.pluck(t, up[idx]! + 12, 0.045, 0.5);
      }
    },
  },
  arena: {
    bpm: 128,
    volume: 0.3,
    // Am · F · C · G (power-ish triads)
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [55, 60, 64],
      [55, 59, 62],
    ],
    step(v, bar, step, t, sd, chord) {
      if (step % 4 === 0) v.kick(t, 0.85);
      if (step === 4 || step === 12) v.clap(t);
      if (step % 2 === 1) v.hat(t, false, 0.07);
      if (step % 4 === 2) v.hat(t, true, 0.08);
      if ([0, 3, 6, 8, 11, 14].includes(step)) v.bass(t, chord[0]! - 24 + (step === 14 ? 12 : 0), sd * 1.6, 0.3);
      if ([0, 6, 12].includes(step)) v.stab(t, chord.map((n) => n + 12), 0.035);
      if (bar % 2 === 1 && step % 2 === 0) v.pluck(t, chord[(step / 2) % chord.length]! + 24, 0.04, 0.2);
    },
  },
};

class MusicEngine {
  private track: Track | null = null;
  private bus: GainNode | null = null;
  private voice: Voice | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private bar = 0;
  private nextTime = 0;
  private waitingForGesture = false;

  constructor() {
    onMuteChange(() => this.refresh());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.refresh());
    }
  }

  setTrack(t: Track | null) {
    if (t === this.track) return;
    this.track = t;
    this.stop(0.35);
    this.refresh();
  }

  private get shouldPlay() {
    return !!this.track && !musicMuted && !isMuted() && !(typeof document !== 'undefined' && document.hidden);
  }

  /** Start, stop or resume to match the current track and mute state. */
  refresh() {
    if (!this.shouldPlay) return this.stop(0.25);
    if (this.timer) return;
    const g = audioGraph();
    if (!g || g.ctx.state !== 'running') return this.waitForGesture();
    this.bus = g.ctx.createGain();
    const song = SONGS[this.track!];
    this.bus.gain.setValueAtTime(0.0001, g.ctx.currentTime);
    this.bus.gain.exponentialRampToValueAtTime(song.volume, g.ctx.currentTime + 0.8);
    this.bus.connect(g.master);
    this.voice = new Voice(g.ctx, this.bus, g.reverb, g.noise);
    this.step = 0;
    this.bar = 0;
    this.nextTime = g.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(g.ctx), 25);
  }

  /** Browsers only allow audio after a user gesture. */
  private waitForGesture() {
    if (this.waitingForGesture || typeof window === 'undefined') return;
    this.waitingForGesture = true;
    const go = () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
      this.waitingForGesture = false;
      // let the click's own sound create/resume the context first
      setTimeout(() => this.refresh(), 60);
    };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  }

  private schedule(ctx: AudioContext) {
    if (!this.voice || !this.track) return;
    const song = SONGS[this.track];
    const sd = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const chord = song.chords[this.bar % song.chords.length]!;
      song.step(this.voice, this.bar, this.step, this.nextTime, sd, chord);
      this.nextTime += sd;
      this.step++;
      if (this.step === 16) {
        this.step = 0;
        this.bar++;
      }
    }
  }

  private stop(fade: number) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const bus = this.bus;
    this.bus = null;
    this.voice = null;
    if (bus) {
      const ctx = bus.context;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
      setTimeout(() => bus.disconnect(), fade * 1000 + 100);
    }
  }

  get playing() {
    return !!this.timer;
  }
}

export const music = new MusicEngine();

export const isMusicMuted = () => musicMuted;
export function setMusicMuted(m: boolean) {
  musicMuted = m;
  try {
    localStorage.setItem(MUSIC_KEY, m ? '0' : '1');
  } catch {
    // ignore
  }
  music.refresh();
}
