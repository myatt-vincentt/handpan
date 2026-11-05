import { describe, expect, it } from "vitest";

import {
  FIELD_IDS,
  FIELD_MIDI,
  fieldOfNames,
  frequency,
  keyField,
  noteName,
  signOf,
} from "./notes";

describe("the handpan's notes", () => {
  it("is a D minor scale: the Ding D3, then A3 Bb3 C4 D4 E4 F4, then G4 A4", () => {
    expect(FIELD_IDS.map((f) => noteName(FIELD_MIDI[f]))).toEqual([
      "D3",
      "A3",
      "Bb3",
      "C4",
      "D4",
      "E4",
      "F4",
      "G4",
      "A4",
    ]);
    expect(frequency(FIELD_MIDI[0])).toBeCloseTo(146.83, 1);
  });

  it("rises from field to field", () => {
    FIELD_IDS.slice(1).forEach((f) =>
      expect(FIELD_MIDI[f]).toBeGreaterThan(FIELD_MIDI[(f - 1) as 0]),
    );
  });

  it("plays 1–6 on the number keys, the Ding on 0 or space, the extras on 7 and 8", () => {
    expect(keyField("Digit1")).toBe(1);
    expect(keyField("Numpad6")).toBe(6);
    expect(keyField("Digit0")).toBe(0);
    expect(keyField("Space")).toBe(0);
    expect(keyField("Digit8")).toBe(8);
    expect(keyField("Digit9")).toBeNull();
    expect(keyField("KeyA")).toBeNull();
  });

  it("finds a field from a model part or its parents", () => {
    expect(fieldOfNames(["mesh_0", "Field_3", "Handpan"])).toBe(3);
    expect(fieldOfNames(["Field_Ding"])).toBe(0);
    expect(fieldOfNames(["Field_Extra_B"])).toBe(8);
    expect(fieldOfNames(["Handpan_Shell", "Handpan"])).toBeNull();
  });

  it("has a sign for the Ding and fields 1–6 only", () => {
    expect(signOf(0)).toBe("fist");
    expect(signOf(5)).toBe("open");
    expect(signOf(6)).toBe("rock");
    expect(signOf(7)).toBeNull();
  });
});
