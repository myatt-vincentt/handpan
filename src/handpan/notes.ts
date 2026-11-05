// The handpan's nine notes, in a D minor scale (D Kurd) so any two notes sound
// well together: the Ding in the middle, six tone fields round it, and two
// small extra fields at the far side. Plain code (no scene).
//
// Field 0 is the Ding; 1–6 are the fields the note hand's signs choose; 7 and
// 8 are the two small extras (played by tapping).

export type FieldId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const FIELD_IDS: FieldId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** The fields a sign can choose (the Ding and 1–6). */
export const SIGN_FIELDS: FieldId[] = [0, 1, 2, 3, 4, 5, 6];

/** Each field's note (MIDI number): D3 | A3 Bb3 C4 D4 E4 F4 | G4 A4. */
export const FIELD_MIDI: Record<FieldId, number> = {
  0: 50,
  1: 57,
  2: 58,
  3: 60,
  4: 62,
  5: 64,
  6: 65,
  7: 67,
  8: 69,
};

/** Each field's node in the handpan model. */
export const FIELD_NODE: Record<FieldId, string> = {
  0: "Field_Ding",
  1: "Field_1",
  2: "Field_2",
  3: "Field_3",
  4: "Field_4",
  5: "Field_5",
  6: "Field_6",
  7: "Field_Extra_A",
  8: "Field_Extra_B",
};

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** A note's name, like "Bb3". */
export const noteName = (midi: number) =>
  `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

/** A note's pitch (Hz). */
export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

const LOWEST = FIELD_MIDI[0];
const HIGHEST = FIELD_MIDI[8];

/** Low = red … high = violet: a note's colour as a hue (0..1). */
export const pitchHue = (midi: number) =>
  0.78 * Math.min(1, Math.max(0, (midi - LOWEST) / (HIGHEST - LOWEST)));

/** A field's colour as a hue (0..1). */
export const fieldHue = (field: FieldId) => pitchHue(FIELD_MIDI[field]);

/** The field a computer key plays: 1–6 the fields, 0 or space the Ding, 7 and 8 the extras. */
export const keyField = (code: string): FieldId | null => {
  if (code === "Space" || code === "Digit0" || code === "Numpad0") return 0;
  const m = /^(?:Digit|Numpad)([1-8])$/.exec(code);
  return m ? (Number(m[1]) as FieldId) : null;
};

/** The field a model part belongs to (its name or a parent's), or null. */
export const fieldOfNames = (names: Iterable<string>): FieldId | null => {
  // eslint-disable-next-line no-restricted-syntax
  for (const n of names) {
    const id = FIELD_IDS.find((f) => FIELD_NODE[f] === n);
    if (id !== undefined) return id;
  }
  return null;
};

/** The note hand's signs, in field order: a fist is the Ding, one finger field 1 … rock field 6. */
export type Sign = "fist" | "one" | "two" | "three" | "four" | "open" | "rock";
export const SIGNS: Sign[] = [
  "fist",
  "one",
  "two",
  "three",
  "four",
  "open",
  "rock",
];
/** The sign that chooses a field (the extras have none). */
export const signOf = (field: FieldId): Sign | null =>
  field <= 6 ? SIGNS[field] : null;

/**
 * Each field's oval on the steel (m): across (towards the centre) and along
 * the rim. The Ding is round.
 */
export const FIELD_OVAL: Record<FieldId, [number, number]> = {
  0: [0.095, 0.095],
  1: [0.062, 0.053],
  2: [0.061, 0.052],
  3: [0.06, 0.051],
  4: [0.058, 0.05],
  5: [0.056, 0.048],
  6: [0.054, 0.047],
  7: [0.044, 0.037],
  8: [0.044, 0.037],
};
