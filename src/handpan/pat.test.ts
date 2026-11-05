import { describe, expect, it } from "vitest";

import { PatReader, type PalmReading, type PatEvent } from "./pat";

const FPS = 30;
const SIZE = 0.12; // the palm's length on the picture (screen heights)

/** Runs a palm trace (y and x in palm lengths over time), returns the events. */
const run = (
  trace: (t: number) => { y: number; x?: number; fist?: boolean } | null,
  seconds: number,
) => {
  const r = new PatReader();
  const events: PatEvent[] = [];
  let seen = 0;
  for (let i = 0; i <= seconds * FPS; i += 1) {
    const t = i / FPS;
    const p = trace(t);
    if (p) {
      const reading: PalmReading = {
        t,
        x: (p.x ?? 0) * SIZE,
        y: p.y * SIZE,
        size: SIZE,
        fist: !!p.fist,
      };
      events.push(...r.push(reading));
      seen = t;
    } else events.push(...r.missing(t, t - seen));
  }
  return { reader: r, events, pats: events.filter((e) => e.kind === "pat") };
};

/** A pat starting at `at`: down `depth` palm lengths in `down` s, then back up over `up` s. */
const patAt = (
  t: number,
  at: number,
  depth: number,
  down: number,
  up = 0.2,
) => {
  if (t < at) return 0;
  if (t < at + down) {
    const k = (t - at) / down;
    return -depth * k * k; // speeding up on the way down
  }
  if (t < at + down + up) return -depth * (1 - (t - at - down) / up);
  return 0;
};

describe("strike-hand pats", () => {
  it("plays a quick pat once, at the bottom, loud", () => {
    const { pats } = run((t) => ({ y: patAt(t, 0.5, 1, 0.12) }), 1.5);
    expect(pats.length).toBe(1);
    expect(pats[0].t).toBeGreaterThan(0.6);
    expect(pats[0].t).toBeLessThan(0.75);
    if (pats[0].kind === "pat") expect(pats[0].velocity).toBeGreaterThan(0.6);
  });

  it("plays a small pat, quietly", () => {
    const { pats } = run((t) => ({ y: patAt(t, 0.5, 0.3, 0.1) }), 1.5);
    expect(pats.length).toBe(1);
    if (pats[0].kind === "pat") expect(pats[0].velocity).toBeLessThan(0.6);
  });

  it("plays every one of quick repeated pats (3 a second)", () => {
    const { pats } = run((t) => {
      const k = t % (1 / 3);
      return { y: patAt(k, 0, 0.7, 0.1, 0.18) };
    }, 3);
    expect(pats.length).toBeGreaterThanOrEqual(8);
    expect(pats.length).toBeLessThanOrEqual(10);
  });

  it("never plays on a slow drift down", () => {
    const { pats } = run((t) => ({ y: -0.6 * t }), 3);
    expect(pats.length).toBe(0);
  });

  it("never plays on a palm held still (with tracker jitter)", () => {
    const { pats } = run(
      (t) => ({ y: 0.02 * Math.sin(t * 40), x: 0.02 * Math.cos(t * 33) }),
      3,
    );
    expect(pats.length).toBe(0);
  });

  it("plays a pat the tracker loses on the way down", () => {
    const { pats } = run((t) => {
      if (t >= 0.55 && t < 0.72) return null; // blurred
      return { y: patAt(t, 0.5, 1, 0.15) };
    }, 1.5);
    expect(pats.length).toBe(1);
  });

  it("never plays a sideways sweep", () => {
    const { pats } = run(
      (t) => ({
        y: patAt(t, 0.5, 0.35, 0.15),
        x: t < 0.5 ? 0 : Math.min(1, (t - 0.5) / 0.15) * 2,
      }),
      1.5,
    );
    expect(pats.length).toBe(0);
  });

  it("damps with a fist, once", () => {
    const { events, pats } = run(
      (t) => ({ y: 0, fist: t > 0.5 && t < 1.2 }),
      2,
    );
    expect(pats.length).toBe(0);
    expect(events.filter((e) => e.kind === "damp").length).toBe(1);
  });

  it("damps when the hand is lost for a while, not for a moment", () => {
    const short = run((t) => (t > 0.5 && t < 0.7 ? null : { y: 0 }), 2);
    expect(short.events.filter((e) => e.kind === "damp").length).toBe(0);
    const long = run((t) => (t > 0.5 ? null : { y: 0 }), 2);
    expect(long.events.filter((e) => e.kind === "damp").length).toBe(1);
  });

  it("knows how lifted the palm is", () => {
    const { reader } = run((t) => ({ y: t < 1 ? 0 : 1 }), 1.2);
    expect(reader.lift).toBeGreaterThan(0.8);
  });
});
