import { Color } from "three";
import { describe, expect, it } from "vitest";

import { LedFlash } from "./led";
import type { FieldId } from "./notes";

const run = (f: LedFlash, seconds: number) => {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds / dt); i += 1) f.update(dt);
};

const hueOf = (c: Color) => c.getHSL({ h: 0, s: 0, l: 0 }).h;

describe("LED flash", () => {
  it("is dark until something is played", () => {
    const f = new LedFlash();
    run(f, 1);
    expect(f.amount).toBe(0);
  });

  it("lights at once, as loud as the note, and eases away in about half a second", () => {
    const loud = new LedFlash();
    loud.hit(3, 1);
    expect(loud.amount).toBeCloseTo(1, 5);
    const soft = new LedFlash();
    soft.hit(3, 0.3);
    expect(soft.amount).toBeLessThan(0.5);
    run(loud, 0.6);
    expect(loud.amount).toBeLessThan(0.05);
  });

  it("is red for the Ding and violet for the highest field", () => {
    const low = new LedFlash();
    low.hit(0, 1);
    const high = new LedFlash();
    high.hit(8, 1);
    const lh = hueOf(low.color);
    expect(lh < 0.03 || lh > 0.97).toBe(true);
    expect(hueOf(high.color)).toBeGreaterThan(0.72);
    expect(hueOf(high.color)).toBeLessThan(0.84);
  });

  it("never runs away when many notes play at once", () => {
    const f = new LedFlash();
    for (let i = 0; i < 20; i += 1) f.hit((i % 9) as FieldId, 1);
    expect(Math.max(f.color.r, f.color.g, f.color.b)).toBeLessThanOrEqual(1.5);
  });
});
