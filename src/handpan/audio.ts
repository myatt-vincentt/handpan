// The handpan's sound, made in code with Web Audio (no recordings).
//
// A struck field rings like steel: a few pure partials (the note, its octave
// and the fifth above that, each a hair out of tune so they shimmer against a
// twin) with a soft attack and a long, slow decay; the higher partials die
// first, so a note starts bright and settles into a warm hum. A short soft
// knock of filtered noise is the hand on the steel. A harder strike is louder
// and brighter. Striking a field that still rings carries on from it (no
// click). Damping fades everything out quickly. Everything goes through a
// small room's echo and a gentle limiter. Silent until Start (browsers only
// start audio on a tap).
//
//   partials + knock → voice gain → master → dry + room → limiter → speakers
import { FIELD_MIDI, frequency, type FieldId } from "./notes";

const MASTER = 0.6;
/** The room's echo: its length (s), how fast it dies, how much of it is heard. */
const ROOM = { length: 2.6, decay: 2.6, wet: 0.32 };
/** Most notes ringing at once (the oldest fades out). */
const MAX_VOICES = 18;

/**
 * The partials: a multiple of the note's pitch, their level and how long
 * they ring (s, the time for the level to fall to about a third), and a twin
 * this many cents off that beats against it.
 */
const PARTIALS = [
  { mul: 1, level: 1, ring: 2.6, beat: 1.5 },
  { mul: 2, level: 0.42, ring: 1.6, beat: 2.5 },
  { mul: 3, level: 0.16, ring: 0.9, beat: 4 },
  { mul: 4.02, level: 0.05, ring: 0.45, beat: 0 },
];
/** The low notes ring longer, the high ones less (× ring). */
const RING_BY_PITCH = { low: 1.35, high: 0.85 };
/** The attack (s): soft, a palm not a stick. */
const ATTACK = 0.006;
/** Damping fades with this time constant (s). */
const DAMP = 0.07;
/** A field struck again while ringing first fades its old note over this (s). */
const RESTRIKE = 0.04;

type Voice = {
  field: FieldId;
  gain: GainNode;
  sources: OscillatorNode[];
  /** When it has died away (AudioContext time). */
  end: number;
  ending: boolean;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let noise: AudioBuffer | null = null;
const voices: Voice[] = [];

let analyser: AnalyserNode | null = null;
let wave: Float32Array | null = null;
let bins: Uint8Array | null = null;
/** What the room's speakers show: overall level and the low end (0..1, eased). */
const out = { level: 0, low: 0 };
/** Speaker motion: rise fast, fall back over this long (s). */
const RELEASE = 0.16;

/** What has been played (read by the development debug object). */
export const meter = {
  unlocked: false,
  /** The loudest sample sent out so far (1 = full scale). */
  peak: 0,
  events: [] as Array<{ t: number; field: FieldId; velocity: number }>,
};

/** A small room's echo: noise dying away, a little darker as it fades. */
const roomImpulse = (c: AudioContext) => {
  const n = Math.round(c.sampleRate * ROOM.length);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const k = 0.3 + 0.6 * (1 - t);
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * (1 - t) ** ROOM.decay;
    }
  }
  return ir;
};

const makeContext = () => {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const c = new AC({ latencyHint: "interactive" });
  master = c.createGain();
  master.gain.value = MASTER;
  const sum = c.createGain();
  const room = c.createConvolver();
  room.buffer = roomImpulse(c);
  const wet = c.createGain();
  wet.gain.value = ROOM.wet;
  master.connect(sum);
  master.connect(room).connect(wet).connect(sum);
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  analyser = c.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0;
  wave = new Float32Array(analyser.fftSize);
  bins = new Uint8Array(analyser.frequencyBinCount);
  sum.connect(limiter).connect(analyser).connect(c.destination);
  // The knock: a tenth of a second of noise.
  noise = c.createBuffer(1, Math.round(c.sampleRate * 0.1), c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  return c;
};

const fadeOut = (v: Voice, at: number, tau: number) => {
  /* eslint-disable no-param-reassign */
  v.ending = true;
  v.gain.gain.cancelScheduledValues(at);
  v.gain.gain.setValueAtTime(v.gain.gain.value, at);
  v.gain.gain.setTargetAtTime(0, at, tau);
  v.end = at + tau * 6;
  /* eslint-enable no-param-reassign */
  v.sources.forEach((o) => {
    try {
      o.stop(at + tau * 6 + 0.05);
    } catch {
      // already stopped
    }
  });
};

const drop = (v: Voice) => {
  const i = voices.indexOf(v);
  if (i >= 0) voices.splice(i, 1);
};

/** How long a note's partial rings (s) for this pitch. */
export const ringTime = (midi: number, base: number) => {
  const k = Math.min(1, Math.max(0, (midi - 50) / 19));
  return (
    base * (RING_BY_PITCH.low + (RING_BY_PITCH.high - RING_BY_PITCH.low) * k)
  );
};

export const sound = {
  /**
   * The output's level and its low end right now, each 0..1: quick to rise,
   * easing back over about 0.16 s. Silent is 0.
   */
  levels(dt: number) {
    if (!analyser || !wave || !bins || !ctx || ctx.state !== "running") {
      out.level = 0;
      out.low = 0;
      return out;
    }
    analyser.getFloatTimeDomainData(wave as Float32Array<ArrayBuffer>);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < wave.length; i += 1) {
      sum += wave[i] * wave[i];
      peak = Math.max(peak, Math.abs(wave[i]));
    }
    meter.peak = Math.max(meter.peak, peak);
    const rms = Math.sqrt(sum / wave.length);
    analyser.getByteFrequencyData(bins as Uint8Array<ArrayBuffer>);
    // The bins below about 200 Hz.
    const top = Math.max(
      1,
      Math.round((200 / (ctx.sampleRate / 2)) * bins.length),
    );
    let low = 0;
    for (let i = 1; i <= top; i += 1) low = Math.max(low, bins[i] / 255);
    const level = Math.min(1, rms * 4);
    const lowNow = Math.max(0, (low - 0.55) / 0.45);
    const fall = Math.exp(-dt / (RELEASE / 3));
    out.level = level > out.level ? level : out.level * fall;
    out.low = lowNow > out.low ? lowNow : out.low * fall;
    return out;
  },

  meter,

  /** Sets up the sound (no sound yet). */
  preload() {
    if (ctx) return;
    ctx = makeContext();
  },

  /** Start: the browser lets the sound play from here on. */
  unlock() {
    if (!ctx) this.preload();
    if (!ctx) return;
    // Play through the phone's silent switch, like a music app.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      // not supported
    }
    if (ctx.state !== "running") void ctx.resume();
    unlocked = true;
    meter.unlocked = true;
  },

  get unlocked() {
    return unlocked;
  },

  /** Strikes a field, `velocity` 0..1. */
  strike(field: FieldId, velocity: number) {
    const c = ctx;
    if (!c || !master || !unlocked || !noise) return;
    const at = c.currentTime + 0.005;
    const v = Math.min(1, Math.max(0.05, velocity));
    const midi = FIELD_MIDI[field];
    const f0 = frequency(midi);
    // Tidy up: notes that have died away, the same field still ringing.
    voices.filter((x) => x.end < at).forEach(drop);
    voices
      .filter((x) => x.field === field && !x.ending)
      .forEach((x) => fadeOut(x, at, RESTRIKE / 3));
    while (voices.filter((x) => !x.ending).length >= MAX_VOICES) {
      const old = voices.find((x) => !x.ending);
      if (!old) break;
      fadeOut(old, at, 0.05);
    }

    const gain = c.createGain();
    // Loudness grows with the strike, a little less than in step.
    gain.gain.value = 0.34 * v ** 0.9;
    gain.connect(master);
    const sources: OscillatorNode[] = [];
    let end = at;
    // A harder strike is brighter: more of the upper partials.
    const bright = 0.55 + 0.45 * v;
    PARTIALS.forEach((p, i) => {
      const ring = ringTime(midi, p.ring);
      const level = p.level * (i === 0 ? 1 : bright ** i);
      const freq = f0 * p.mul;
      if (freq > 9000) return;
      const twins = p.beat > 0 ? [-p.beat / 2, p.beat / 2] : [0];
      twins.forEach((cents) => {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        o.detune.value = cents;
        const g = c.createGain();
        const peak = level / twins.length;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + ATTACK * (1 + i * 0.5));
        g.gain.setTargetAtTime(0, at + ATTACK * (1 + i * 0.5), ring);
        o.connect(g).connect(gain);
        o.start(at);
        o.stop(at + ring * 7);
        sources.push(o);
        end = Math.max(end, at + ring * 7);
      });
    });
    // The knock: soft noise around the note, over in a few hundredths of a second.
    const knock = c.createBufferSource();
    knock.buffer = noise;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(4000, f0 * 4);
    bp.Q.value = 1.2;
    const kg = c.createGain();
    kg.gain.setValueAtTime(0.18 * v, at);
    kg.gain.setTargetAtTime(0, at, 0.012);
    knock.connect(bp).connect(kg).connect(gain);
    knock.start(at);
    knock.stop(at + 0.1);

    voices.push({ field, gain, sources, end, ending: false });
    meter.events.push({
      t: Math.round(c.currentTime * 1000),
      field,
      velocity: Number(v.toFixed(2)),
    });
    if (meter.events.length > 40) meter.events.shift();
  },

  /** Is any note still ringing? */
  ringing() {
    if (!ctx) return false;
    const now = ctx.currentTime;
    return voices.some((v) => !v.ending && v.end > now);
  },

  /** Damps every ringing note (a hand flat on the steel). */
  damp() {
    const c = ctx;
    if (!c) return;
    const at = c.currentTime;
    voices.filter((v) => !v.ending).forEach((v) => fadeOut(v, at, DAMP));
  },
};
