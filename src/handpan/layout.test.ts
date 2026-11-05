import { describe, expect, it } from "vitest";

import { frameRect, keepPoints, phoneness, viewMargins } from "./layout";

describe("the layout", () => {
  it("reads a laptop as wide and a phone as tall", () => {
    expect(phoneness(16 / 9)).toBe(0);
    expect(phoneness(390 / 844)).toBe(1);
  });

  it("keeps the corner camera in the top-right corner", () => {
    const r = frameRect(1440, 900);
    expect(r.left + r.width).toBe(1440 - 16);
    expect(r.top).toBe(16);
  });

  it("keeps room for the dock and the sign strip below, and the corner camera above", () => {
    const m = viewMargins(390, 844);
    expect(m.bottom).toBeLessThan(0.7);
    expect(m.under).toBeLessThan(m.top);
    expect(m.frameLeft).toBeGreaterThan(-1);
    expect(m.frameLeft).toBeLessThan(1);
  });

  it("keeps the handpan's rim and its top in each view", () => {
    (["front", "player"] as const).forEach((v) => {
      const pts = keepPoints(v);
      expect(pts.length).toBe(13);
      // Every point is above the floor and near the handpan.
      pts.forEach((p) => {
        expect(p.y).toBeGreaterThan(0.3);
        expect(Math.hypot(p.x, p.z)).toBeLessThan(0.6);
      });
    });
  });
});
