// A song being learnt or played (pure: times in seconds on the audio clock).
//
// Learn: the song waits at each note until the right field is struck (as
// quickly or slowly as you like); a wrong field is only noted (for a
// hint), nothing can be failed. Play: the song runs at its tempo (or slower)
// and every note is judged by how close the strike lands: perfect, good, or
// missed.
import { secondsPerBeat, type Chart } from "./songs";
import type { FieldId } from "./notes";

export type Mode = "learn" | "play";
export type Judgement = "perfect" | "good" | "miss";

/**
 * Timing windows (s either side of the note). Generous: a sign
 * and a pat take a moment, and the camera adds a little delay.
 */
export const WINDOW = { perfect: 0.1, good: 0.22 };

/** How a hit `offset` seconds off the note is judged. */
export const judge = (offset: number): Judgement => {
  const d = Math.abs(offset);
  if (d <= WINDOW.perfect) return "perfect";
  if (d <= WINDOW.good) return "good";
  return "miss";
};

/** Stars for a finished song (1–3), from how well its notes were played. */
const POINTS: Record<Judgement, number> = { perfect: 1, good: 0.6, miss: 0 };

export const starsFor = (results: readonly (Judgement | null)[]) => {
  const n = results.length || 1;
  const score = results.reduce((sum, r) => sum + (r ? POINTS[r] : 0), 0) / n;
  if (score >= 0.8) return 3;
  if (score >= 0.5) return 2;
  return 1;
};

export type JudgeEvent = {
  index: number;
  field: FieldId;
  result: Judgement;
  at: number;
};

/** The count-in before the first downbeat (bars). */
export const COUNT_IN_BARS = 1;

export class Session {
  readonly chart: Chart;

  readonly mode: Mode;

  readonly speed: number;

  /** Each note's result (Learn: "good" once played). */
  readonly results: (Judgement | null)[];

  /** Play: how far off each judged hit landed (s, + late). */
  readonly offsets: (number | null)[];

  /** The next note to play (Learn) / the earliest not yet judged (Play). */
  next = 0;

  /** The song's position (beats from the first downbeat). */
  beat: number;

  done = false;

  /** Judgements not yet shown (the caller drains them). */
  events: JudgeEvent[] = [];

  /** Learn: the last wrong field struck, and when (for a hint). */
  wrong: { field: FieldId; at: number } | null = null;

  /** Paused (the tab is hidden): the song stands still. */
  paused = false;

  private last: number;

  /** After a pause the song stands still until here (a count-in). */
  private holdUntil = -Infinity;

  private readonly spb: number;

  constructor(chart: Chart, mode: Mode, speed: number, now: number) {
    this.chart = chart;
    this.mode = mode;
    this.speed = mode === "learn" ? 1 : speed;
    this.spb = secondsPerBeat(chart, this.speed);
    this.results = chart.notes.map(() => null);
    this.offsets = chart.notes.map(() => null);
    // Learn starts at the first note (no count-in, no tempo to keep up with);
    // Play counts in for a bar.
    this.beat =
      mode === "learn"
        ? (chart.notes[0]?.beat ?? 0)
        : -COUNT_IN_BARS * chart.beatsPerBar;
    this.last = now;
  }

  /** Seconds per beat. */
  get secondsPerBeat() {
    return this.spb;
  }

  /** Where the song may run to now (Learn waits at the next note). */
  get limit() {
    if (this.mode === "play" || this.next >= this.chart.notes.length)
      return Infinity;
    return this.chart.notes[this.next].beat;
  }

  /** Learn: the song is waiting at a note. */
  get waiting() {
    return (
      this.mode === "learn" && !this.done && this.beat >= this.limit - 1e-6
    );
  }

  /** The audio time of a beat (from the song's position now). */
  timeOf(beat: number, now: number) {
    return Math.max(now, this.holdUntil) + (beat - this.beat) * this.spb;
  }

  /** Stops the song where it is. */
  pause(now: number) {
    this.update(now);
    this.paused = true;
  }

  /** Goes on after `countIn` seconds (the caller plays a count-in). */
  resume(now: number, countIn: number) {
    this.paused = false;
    this.last = now;
    this.holdUntil = now + countIn;
  }

  /** Moves the song on to `now`. */
  update(now: number) {
    const from = Math.max(this.last, this.holdUntil);
    const dt = this.paused ? 0 : Math.max(0, now - from);
    this.last = now;
    if (this.done) return;
    this.beat = Math.min(this.limit, this.beat + dt / this.spb);
    const { notes } = this.chart;
    if (this.mode === "play") {
      // Notes whose window has passed are missed.
      while (this.next < notes.length) {
        const late = (this.beat - notes[this.next].beat) * this.spb;
        if (this.results[this.next] === null && late <= WINDOW.good) break;
        if (this.results[this.next] === null) {
          this.results[this.next] = "miss";
          this.events.push({
            index: this.next,
            field: notes[this.next].field,
            result: "miss",
            at: now,
          });
        }
        this.next += 1;
      }
    }
    const end = this.chart.bars * this.chart.beatsPerBar;
    if (
      this.next >= notes.length &&
      this.beat >= Math.min(end, notes[notes.length - 1].beat + 1)
    )
      this.done = true;
  }

  /** A field was struck at `now`; returns its judgement (or null if it played nothing). */
  hit(field: FieldId, now: number): Judgement | null {
    this.update(now);
    if (this.done) return null;
    const { notes } = this.chart;
    if (this.mode === "learn") {
      const note = notes[this.next];
      if (!note) return null;
      if (note.field !== field) {
        this.wrong = { field, at: now };
        return null;
      }
      this.wrong = null;
      this.results[this.next] = "good";
      this.events.push({ index: this.next, field, result: "good", at: now });
      this.beat = Math.max(this.beat, note.beat);
      this.next += 1;
      return "good";
    }
    // Play: the nearest note of that field still to judge, within the window.
    let best = -1;
    let bestOff = Infinity;
    for (let i = this.next; i < notes.length; i += 1) {
      const off = (this.beat - notes[i].beat) * this.spb;
      if (off < -WINDOW.good) break;
      if (
        notes[i].field === field &&
        this.results[i] === null &&
        Math.abs(off) < Math.abs(bestOff)
      ) {
        best = i;
        bestOff = off;
      }
    }
    if (best < 0) return null;
    const result = judge(bestOff);
    if (result === "miss") return null;
    this.results[best] = result;
    this.offsets[best] = bestOff;
    this.events.push({ index: best, field, result, at: now });
    return result;
  }

  /** How far through the song (0..1, by notes). */
  get progress() {
    const n = this.chart.notes.length;
    return n ? this.results.filter((r) => r !== null).length / n : 1;
  }

  get stars() {
    return starsFor(this.results);
  }
}
