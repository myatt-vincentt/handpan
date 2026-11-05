import { describe, expect, it } from "vitest";

import { CHARTS, chartById, secondsPerBeat, type Chart } from "./songs";
import { COUNT_IN_BARS, judge, Session, starsFor, WINDOW } from "./session";

describe("songs", () => {
  it("are all well formed, on the Ding and fields 1–6 only", () => {
    expect(CHARTS.map((c) => c.id)).toEqual([
      "hot-cross-buns",
      "mary",
      "heartbeat",
      "ripple",
    ]);
    CHARTS.forEach((c) => {
      const end = c.bars * c.beatsPerBar;
      expect(c.notes.length).toBeGreaterThan(5);
      c.notes.forEach((n, i) => {
        expect(n.field).toBeGreaterThanOrEqual(0);
        expect(n.field).toBeLessThanOrEqual(6);
        expect(n.beat).toBeGreaterThanOrEqual(0);
        expect(n.beat).toBeLessThan(end);
        if (i > 0) expect(n.beat).toBeGreaterThan(c.notes[i - 1].beat);
      });
    });
  });

  it("plays Hot Cross Buns as D C Bb (fields 4 3 2)", () => {
    const hcb = chartById("hot-cross-buns")!;
    expect(hcb.notes.slice(0, 3).map((n) => n.field)).toEqual([4, 3, 2]);
  });
});

const tiny: Chart = {
  id: "t",
  title: "T",
  bpm: 60,
  beatsPerBar: 4,
  bars: 1,
  drone: 38,
  notes: [
    { beat: 0, field: 3 },
    { beat: 1, field: 0 },
    { beat: 2, field: 5 },
  ],
};

describe("Learn", () => {
  it("waits at each note until its field is struck, however long", () => {
    const s = new Session(tiny, "learn", 1, 0);
    s.update(30);
    expect(s.next).toBe(0);
    expect(s.waiting).toBe(true);
    expect(s.hit(3, 30)).toBe("good");
    expect(s.next).toBe(1);
    // Straight on to the next one: no tempo to keep up with.
    expect(s.hit(0, 30.2)).toBe("good");
    expect(s.next).toBe(2);
  });

  it("only notes a wrong field (for a hint), nothing fails", () => {
    const s = new Session(tiny, "learn", 1, 0);
    expect(s.hit(5, 1)).toBeNull();
    expect(s.wrong).toEqual({ field: 5, at: 1 });
    expect(s.next).toBe(0);
    expect(s.hit(3, 2)).toBe("good");
    expect(s.wrong).toBeNull();
  });

  it("finishes after the last note", () => {
    const s = new Session(tiny, "learn", 1, 0);
    s.hit(3, 0);
    s.hit(0, 0.1);
    s.hit(5, 0.2);
    s.update(2);
    expect(s.done).toBe(true);
    expect(s.progress).toBe(1);
  });
});

describe("Play", () => {
  const start = (speed = 1) => new Session(tiny, "play", speed, 0);
  /** The sound-clock time of a beat (after the count-in). */
  const at = (beat: number, speed = 1) =>
    (COUNT_IN_BARS * 4 + beat) * secondsPerBeat(tiny, speed);

  it("judges a strike by how close it lands", () => {
    expect(judge(0)).toBe("perfect");
    expect(judge(WINDOW.perfect + 0.01)).toBe("good");
    expect(judge(-WINDOW.good - 0.01)).toBe("miss");
  });

  it("counts in, then takes a strike on the beat", () => {
    const s = start();
    s.update(at(-1));
    expect(s.beat).toBeLessThan(0);
    expect(s.hit(3, at(0) + 0.03)).toBe("perfect");
    expect(s.hit(0, at(1) - 0.15)).toBe("good");
  });

  it("ignores a wrong field and a strike far from any note", () => {
    const s = start();
    expect(s.hit(5, at(0))).toBeNull();
    expect(s.hit(3, at(0) + 0.5)).toBeNull();
  });

  it("misses a note whose window passes, and finishes with stars", () => {
    const s = start();
    s.hit(3, at(0));
    s.update(at(1) + WINDOW.good + 0.05);
    expect(s.results[1]).toBe("miss");
    s.hit(5, at(2));
    s.update(at(4));
    expect(s.done).toBe(true);
    expect(s.stars).toBe(2);
  });

  it("runs slower at 0.75×", () => {
    const s = start(0.75);
    expect(s.hit(3, at(0, 0.75))).toBe("perfect");
    expect(s.hit(0, at(1, 1))).toBeNull(); // the old tempo's beat is too early
  });

  it("gives 1–3 stars", () => {
    expect(starsFor(["perfect", "perfect", "good"])).toBe(3);
    expect(starsFor(["good", "good", "miss"])).toBe(1);
    expect(starsFor(["perfect", "good", "miss"])).toBe(2);
    expect(starsFor(["miss", "miss", "miss"])).toBe(1);
  });
});
