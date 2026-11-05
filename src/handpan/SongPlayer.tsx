// Songs: learning one, or playing along with it.
//
// Learn waits for you: the next note's field pulses, its sign shows big on a
// card, and it counts when that field is struck (a sign held and a pat, or a
// tap, a click or its key). A right note sparkles gold and the next one
// comes up; a wrong one only brings a gentle hint. A soft drone holds under
// it all. Play runs in time after a bar's count-in, over the drone and a
// light shaker: each note is judged by how close it lands (a big sparkle for
// a perfect one, a small one for a good one), and the song ends in 1–3 stars.
// The end of either is a little celebration across the whole handpan.
// Everything runs on the sound's own clock.
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";

import { sound } from "./audio";
import { FIELD_IDS, type FieldId } from "./notes";
import { COUNT_IN_BARS, Session, type Mode } from "./session";
import { CHARTS, chartById, type Chart } from "./songs";
import { handpan } from "./state";

/** Play's slower speed. */
export const SLOW = 0.75;
/** How far ahead (s) the backing is scheduled. */
const LOOKAHEAD = 0.15;
/** Play: the next field starts to pulse this many beats before its note. */
const SHOW_AHEAD = 2;
/** Learn's drone is laid down in pieces this long (s). */
const LEARN_DRONE = 8;

type Cue = { beat: number; kind: "tick" | "shaker"; accent: boolean };

/** Play's backing: the count-in ticks, then a shaker on every half beat. */
const cuesOf = (chart: Chart): Cue[] => {
  const bpb = chart.beatsPerBar;
  const ticks: Cue[] = Array.from({ length: COUNT_IN_BARS * bpb }, (_, i) => ({
    beat: -COUNT_IN_BARS * bpb + i,
    kind: "tick",
    accent: i % bpb === 0,
  }));
  const end = chart.bars * bpb;
  const shakes: Cue[] = Array.from({ length: end * 2 }, (_, i) => ({
    beat: i / 2,
    kind: "shaker",
    accent: i % (bpb * 2) === 0,
  }));
  return [...ticks, ...shakes];
};

const player = {
  cues: [] as Cue[],
  next: 0,
  /** The drone is laid down until here (sound clock, s). */
  droneUntil: 0,
};

/** Each song's best stars this visit (Play only). */
const BEST_KEY = "handpan.best";
export const bestStars = (): Record<string, number> => {
  try {
    return JSON.parse(
      window.sessionStorage.getItem(BEST_KEY) ?? "{}",
    ) as Record<string, number>;
  } catch {
    return {};
  }
};
const saveBest = (id: string, stars: number) => {
  try {
    const best = bestStars();
    if ((best[id] ?? 0) >= stars) return;
    best[id] = stars;
    window.sessionStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // private mode: not remembered
  }
};

/** The bottom progress line (set by the page UI). */
export const progressLine: { el: HTMLElement | null } = { el: null };

/** Starts a song (from a tap: it also starts the sound). */
export const startSong = (id: string, mode: Mode) => {
  const chart = chartById(id);
  sound.unlock();
  const now = sound.now();
  if (!chart || now === null) return;
  sound.stopBacking();
  handpan.session = new Session(
    chart,
    mode,
    handpan.slow ? SLOW : 1,
    now + 0.1,
  );
  player.cues = mode === "play" ? cuesOf(chart) : [];
  player.next = 0;
  player.droneUntil = 0;
  handpan.songCard = false;
  handpan.finish = null;
  handpan.howTo = false;
  handpan.changed();
};

export const stopSong = () => {
  sound.stopBacking();
  handpan.session = null;
  handpan.target = null;
  handpan.changed();
};

/** The next song in the list after `id`. */
export const nextSongId = (id: string) => {
  const i = CHARTS.findIndex((c) => c.id === id);
  return CHARTS[(i + 1) % CHARTS.length].id;
};

/** Sparkles on a field (now). */
const sparkle = (field: FieldId, big: boolean, delay = 0) => {
  handpan.sparkles.push({ field, at: performance.now() / 1000 + delay, big });
};

export const SongPlayer = () => {
  useEffect(() => {
    handpan.songHit = (field) => {
      const s = handpan.session;
      const now = sound.now();
      if (s && now !== null) {
        s.hit(field, now);
        handpan.changed();
      }
    };
    const onVisible = () => {
      const s = handpan.session;
      const now = sound.now();
      if (!s || now === null) return;
      if (document.hidden) {
        s.pause(now);
        sound.stopBacking();
      } else if (s.paused) {
        // Back in the tab: a bar's count-in, then on from where it stopped.
        const bpb = s.chart.beatsPerBar;
        const countIn = s.mode === "play" ? bpb * s.secondsPerBeat : 0;
        s.resume(now, countIn);
        if (s.mode === "play")
          for (let i = 0; i < bpb; i += 1)
            sound.tick(now + i * s.secondsPerBeat, i === 0);
        const j = player.cues.findIndex((c) => c.beat > s.beat - 1e-6);
        player.next = j < 0 ? player.cues.length : j;
        player.droneUntil = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      handpan.songHit = null;
    };
  }, []);

  useFrame(() => {
    const s = handpan.session;
    const now = sound.now();
    if (!s || now === null) return;
    s.update(now);
    const { notes } = s.chart;

    // The backing: Play's ticks and shaker, and the drone under both modes.
    if (!s.paused) {
      const horizon = s.beat + LOOKAHEAD / s.secondsPerBeat;
      while (
        player.next < player.cues.length &&
        player.cues[player.next].beat < horizon
      ) {
        const c = player.cues[player.next];
        const at = s.timeOf(c.beat, now);
        if (c.kind === "tick") sound.tick(at, c.accent);
        else sound.shaker(at, c.accent);
        player.next += 1;
      }
      if (player.droneUntil < now + 1) {
        const from = Math.max(now, player.droneUntil);
        let length = LEARN_DRONE;
        if (s.mode === "play") {
          const end = s.chart.bars * s.chart.beatsPerBar;
          length = Math.max(1.5, s.timeOf(end, now) - from + 1.5);
        }
        sound.drone(s.chart.drone, from, length);
        player.droneUntil = from + length - 1;
      }
    }

    // The field that wants playing next pulses.
    const next = notes[s.next];
    handpan.target =
      next && (s.mode === "learn" || next.beat - s.beat <= SHOW_AHEAD)
        ? next.field
        : null;

    // Right notes sparkle.
    if (s.events.length) {
      s.events.forEach((e) => {
        if (e.result !== "miss") sparkle(e.field, e.result === "perfect");
      });
      s.events = [];
      handpan.changed();
    }

    if (progressLine.el)
      progressLine.el.style.transform = `scaleX(${s.progress})`;

    // The end: stars (Play), and a celebration across the handpan.
    if (s.done) {
      const stars = s.mode === "play" ? s.stars : 3;
      if (s.mode === "play") saveBest(s.chart.id, stars);
      FIELD_IDS.forEach((f, i) => sparkle(f, true, i * 0.07));
      sound.stopBacking();
      handpan.finish = {
        id: s.chart.id,
        mode: s.mode,
        stars,
        at: performance.now(),
      };
      handpan.session = null;
      handpan.target = null;
      handpan.changed();
    }
  });

  return null;
};
