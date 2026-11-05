// The songs and grooves to learn (pure data): the fields to play, in beats
// from the first downbeat, and the drone the backing holds under them. Only
// the Ding and fields 1–6 (the ones a sign can choose).
//
//   field:  0 Ding D3 · 1 A3 · 2 Bb3 · 3 C4 · 4 D4 · 5 E4 · 6 F4
import type { FieldId } from "./notes";

export type Note = { beat: number; field: FieldId };

export type Chart = {
  id: string;
  /** A short caption for the song card. */
  title: string;
  bpm: number;
  beatsPerBar: number;
  /** Bars the song lasts (after the count-in). */
  bars: number;
  notes: Note[];
  /** The backing's drone (MIDI): its low root and a fifth above. */
  drone: number;
};

/** Notes from [beat, field] pairs. */
const notes = (list: [number, FieldId][]): Note[] =>
  list.map(([beat, field]) => ({ beat, field }));

/** A pattern of [beat in bar, field] repeated bar after bar. */
const bars = (pattern: [number, FieldId][][], beatsPerBar: number) =>
  pattern.flatMap((bar, i) =>
    notes(bar.map(([b, f]) => [i * beatsPerBar + b, f] as [number, FieldId])),
  );

// Hot Cross Buns (traditional, public domain), in B flat: D C Bb.
const HOT_CROSS_BUNS: Chart = {
  id: "hot-cross-buns",
  title: "Hot Cross Buns",
  bpm: 80,
  beatsPerBar: 4,
  bars: 4,
  drone: 46, // B flat
  notes: bars(
    [
      [
        [0, 4],
        [1, 3],
        [2, 2],
      ],
      [
        [0, 4],
        [1, 3],
        [2, 2],
      ],
      [
        [0, 2],
        [0.5, 2],
        [1, 2],
        [1.5, 2],
        [2, 3],
        [2.5, 3],
        [3, 3],
        [3.5, 3],
      ],
      [
        [0, 4],
        [1, 3],
        [2, 2],
      ],
    ],
    4,
  ),
};

// Mary Had a Little Lamb (traditional, public domain), in B flat.
const MARY: Chart = {
  id: "mary",
  title: "Mary Had a Little Lamb",
  bpm: 92,
  beatsPerBar: 4,
  bars: 8,
  drone: 46,
  notes: bars(
    [
      // Ma-ry had a lit-tle lamb
      [
        [0, 4],
        [1, 3],
        [2, 2],
        [3, 3],
      ],
      [
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      // lit-tle lamb, lit-tle lamb
      [
        [0, 3],
        [1, 3],
        [2, 3],
      ],
      [
        [0, 4],
        [1, 6],
        [2, 6],
      ],
      // Ma-ry had a lit-tle lamb, its fleece was white as snow
      [
        [0, 4],
        [1, 3],
        [2, 2],
        [3, 3],
      ],
      [
        [0, 4],
        [1, 4],
        [2, 4],
        [3, 4],
      ],
      [
        [0, 3],
        [1, 3],
        [2, 4],
        [3, 3],
      ],
      [[0, 2]],
    ],
    4,
  ),
};

// Groove 1: the Ding like a heartbeat, a field between each.
const HEARTBEAT: Chart = {
  id: "heartbeat",
  title: "Groove 1: Heartbeat",
  bpm: 72,
  beatsPerBar: 4,
  bars: 4,
  drone: 38, // D
  notes: bars(
    [
      [
        [0, 0],
        [1, 1],
        [2, 0],
        [3, 2],
      ],
      [
        [0, 0],
        [1, 3],
        [2, 0],
        [3, 4],
      ],
      [
        [0, 0],
        [1, 1],
        [2, 0],
        [3, 2],
      ],
      [
        [0, 0],
        [1, 5],
        [2, 4],
        [3, 0],
      ],
    ],
    4,
  ),
};

// Groove 2: up the fields and back down, a ripple round the steel.
const RIPPLE: Chart = {
  id: "ripple",
  title: "Groove 2: Ripple",
  bpm: 76,
  beatsPerBar: 4,
  bars: 4,
  drone: 38,
  notes: bars(
    [
      [
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
      ],
      [
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 5],
      ],
      [
        [0, 4],
        [1, 3],
        [2, 2],
        [3, 1],
      ],
      [
        [0, 0],
        [2, 0],
      ],
    ],
    4,
  ),
};

export const CHARTS: Chart[] = [HOT_CROSS_BUNS, MARY, HEARTBEAT, RIPPLE];

export const chartById = (id: string) => CHARTS.find((c) => c.id === id);

/** Seconds per beat at a speed (1 = the song's tempo). */
export const secondsPerBeat = (chart: Chart, speed = 1) =>
  60 / (chart.bpm * speed);
