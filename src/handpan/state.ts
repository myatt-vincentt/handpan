// What the handpan, the ghost hands, taps and keys and the page UI share.
// Per-frame values are read and written in the frame loop (never React
// state); the few the page UI shows bump a version it subscribes to.
import { useSyncExternalStore } from "react";
import type { Object3D } from "three";

import { sound } from "./audio";
import { VIEWS, type View } from "./layout";
import { FIELD_MIDI, type FieldId } from "./notes";

export type PlaySource = "strike" | "pointer" | "keys";
export type Side = "left" | "right";

/** A field struck, for the lights, the ripples and the hands. */
export type StrikeEvent = {
  seq: number;
  field: FieldId;
  midi: number;
  velocity: number;
  by: PlaySource;
  /** performance.now() / 1000 */
  at: number;
};

const listeners = new Set<() => void>();
let version = 0;

export const handpan = {
  /** The handpan's model in the scene (for taps). */
  root: null as Object3D | null,
  /** Screen width ÷ height. */
  aspect: 1,
  /** The latest strikes (the lights, ripples and hands read the ones they haven't seen). */
  events: [] as StrikeEvent[],
  seq: 0,
  /** performance.now() / 1000 of each field's last strike, and its loudness. */
  struckAt: new Float64Array(9).fill(-1e9),
  struckV: new Float32Array(9),
  /** The field the note hand has chosen (lit blue), or null. */
  chosen: 0 as FieldId | null,
  /** The field under the mouse (lit blue softly), or null. */
  hover: null as FieldId | null,
  /** performance.now() / 1000 of the last damp (a fist on the steel). */
  dampedAt: -1e9,
  /** Recent strikes (read by the development debug object). */
  log: [] as Array<{
    t: number;
    field: FieldId;
    velocity: number;
    by: PlaySource;
  }>,

  // What the page UI shows.
  view: "front" as View,
  night: false,
  /** The corner camera is tucked away. */
  camHidden: false,
  /** The studio, the handpan and the hands have loaded. */
  loaded: false,
  /** Start was tapped on the home page (the camera runs). */
  started: false,
  /** The home page has gone (the handpan is in front of you). */
  entered: false,
  /** The "how to play" steps card is open. */
  howTo: false,
  /** It opened right after Start: it closes by itself (performance.now() ms). */
  howToUntil: null as number | null,
  /** After the first card: the dock's one pulse (performance.now() ms). */
  dockPulseAt: null as number | null,
  changed() {
    version += 1;
    listeners.forEach((l) => l());
  },
};

export const nextView = () => {
  handpan.view = VIEWS[(VIEWS.indexOf(handpan.view) + 1) % VIEWS.length];
  handpan.changed();
};

export const setView = (v: View) => {
  handpan.view = v;
  handpan.changed();
};

export const setNight = (on: boolean) => {
  handpan.night = on;
  handpan.changed();
};

/** Start on the home page: the sound and the camera. */
export const start = () => {
  if (handpan.started) return;
  sound.unlock();
  handpan.started = true;
  handpan.changed();
};

/** The home page has faded: the steps card shows for a few seconds. */
export const INTRO_CARD_MS = 6000;
export const enter = () => {
  if (handpan.entered) return;
  handpan.entered = true;
  handpan.howTo = true;
  handpan.howToUntil = performance.now() + INTRO_CARD_MS;
  handpan.changed();
};

/** The steps card closes. After the first one the dock pulses once. */
export const closeHowTo = () => {
  if (!handpan.howTo) return;
  const first = handpan.howToUntil !== null;
  handpan.howTo = false;
  handpan.howToUntil = null;
  if (first) handpan.dockPulseAt = performance.now();
  handpan.changed();
};

export const toggleCam = () => {
  handpan.camHidden = !handpan.camHidden;
  handpan.changed();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Re-renders the caller when the page UI's state changes. */
export const useHandpanVersion = () =>
  useSyncExternalStore(subscribe, () => version);

/** The note hand chooses a field (it lights blue). */
export const choose = (field: FieldId | null) => {
  if (handpan.chosen === field) return;
  handpan.chosen = field;
  handpan.changed();
};

/**
 * A field is struck: its sound, its gold flash and ripples, the lights.
 * A field struck by tap or key also becomes the chosen one (a sign field).
 */
export const strike = (field: FieldId, velocity: number, by: PlaySource) => {
  const now = performance.now() / 1000;
  sound.strike(field, velocity);
  handpan.struckAt[field] = now;
  handpan.struckV[field] = velocity;
  handpan.seq += 1;
  handpan.events.push({
    seq: handpan.seq,
    field,
    midi: FIELD_MIDI[field],
    velocity,
    by,
    at: now,
  });
  if (handpan.events.length > 32) handpan.events.shift();
  handpan.log.push({
    t: Math.round(now * 1000),
    field,
    velocity: Number(velocity.toFixed(2)),
    by,
  });
  if (handpan.log.length > 60) handpan.log.shift();
  if (by !== "strike" && field <= 6) choose(field);
  // The first pat by hand closes the how-to card.
  if (by === "strike" && handpan.howTo) closeHowTo();
};

/** Every ringing note is damped. */
export const damp = () => {
  handpan.dampedAt = performance.now() / 1000;
  sound.damp();
};

/** The strikes since `seq` (oldest first). */
export const strikesSince = (seq: number) =>
  handpan.events.filter((e) => e.seq > seq);
