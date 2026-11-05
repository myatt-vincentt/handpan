// The screen layout: where the handpan stands in each view, where the camera
// looks from, how much it shows, and where the corner camera sits.
//
// Coordinates are the room's (metres, y up). The player stands at −z and
// looks down at the handpan; the Front view looks at it from +z, where the
// handpan is turned round and tilted towards you so every field shows.
import { Euler, Quaternion, Vector3 } from "three";

export type View = "front" | "player";
export const VIEWS: View[] = ["front", "player"];

/** Screen shape → 0 (laptop, wide) … 1 (phone, tall). */
export const phoneness = (aspect: number) =>
  Math.min(1, Math.max(0, (1.5 - aspect) / (1.5 - 0.56)));

export type CameraPose = {
  pos: Vector3;
  target: Vector3;
  /** Vertical field of view (degrees). */
  fov: number;
};

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
/** The vertical field of view that gives this horizontal one. */
export const vfovFromH = (hfov: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan(rad(hfov) / 2) / Math.max(0.1, aspect)));

// ---------------------------------------------------------------- the handpan

/** The handpan's radius at its rim (m), and its top's height above the rim. */
export const PAN_RADIUS = 0.272;
export const PAN_TOP = 0.12;

/** Where the handpan stands in each view: its rim's centre, tilt and turn. */
export const PLACE: Record<View, { pos: Vector3; quat: Quaternion }> = {
  // Level on its low stand, the player's side (Fields 1–5) towards −z.
  player: {
    pos: new Vector3(0, 0.6, -0.05),
    quat: new Quaternion(),
  },
  // Turned round so the same fields face you, tilted 24° towards you.
  front: {
    pos: new Vector3(0, 0.66, -0.05),
    quat: new Quaternion().setFromEuler(new Euler(rad(24), Math.PI, 0, "XYZ")),
  },
};

/**
 * Where the note hand's ghost waits, beside the handpan on your right
 * (offset from the handpan's centre, room axes, m).
 */
export const NOTE_HAND: Record<View, Vector3> = {
  player: new Vector3(-0.3, 0.08, -0.22),
  front: new Vector3(0.33, -0.04, -0.02),
};

// ---------------------------------------------------------------- the views

// Front: from the room, a little above, the handpan in the middle.
// Player: from where you stand, looking down at it.
const FRONT = {
  laptop: { pos: [0, 1.02, 1.05], target: [0, 0.7, -0.08], vfov: 37 },
  phone: { pos: [0.06, 1.04, 1.16], target: [0.06, 0.7, -0.05], hfov: 34 },
};
const PLAYER = {
  laptop: { pos: [0, 1.26, -0.52], target: [0, 0.5, -0.1], vfov: 42 },
  phone: { pos: [-0.08, 1.38, -0.62], target: [-0.08, 0.52, -0.05], hfov: 46 },
};
const VIEW_POSES = { front: FRONT, player: PLAYER };

/* eslint-disable no-param-reassign */
/** A view's camera for this screen shape (before the fit). */
export const viewPose = (view: View, aspect: number, out: CameraPose) => {
  const v = VIEW_POSES[view];
  const k = phoneness(aspect);
  const [lx, ly, lz] = v.laptop.pos;
  const [px, py, pz] = v.phone.pos;
  out.pos.set(lx + (px - lx) * k, ly + (py - ly) * k, lz + (pz - lz) * k);
  const [ltx, lty, ltz] = v.laptop.target;
  const [ptx, pty, ptz] = v.phone.target;
  out.target.set(
    ltx + (ptx - ltx) * k,
    lty + (pty - lty) * k,
    ltz + (ptz - ltz) * k,
  );
  const phoneV = vfovFromH(v.phone.hfov, aspect);
  out.fov = v.laptop.vfov + (phoneV - v.laptop.vfov) * k;
  return out;
};
/* eslint-enable no-param-reassign */

/** The points a view keeps on screen: the handpan's rim and top, and the note hand. */
export const keepPoints = (view: View): Vector3[] => {
  const { pos, quat } = PLACE[view];
  const pts: Vector3[] = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    pts.push(
      new Vector3(Math.cos(a) * PAN_RADIUS, 0, Math.sin(a) * PAN_RADIUS)
        .applyQuaternion(quat)
        .add(pos),
    );
  }
  pts.push(new Vector3(0, PAN_TOP, 0).applyQuaternion(quat).add(pos));
  // The note hand: its wrist and its raised fingertips.
  const hand = pos.clone().add(NOTE_HAND[view]);
  pts.push(hand.clone(), hand.clone().add(new Vector3(0, 0.18, 0)));
  return pts;
};

// ---------------------------------------------------------------- page UI

/** The page gutter (CSS px). */
export const GUTTER = 16;
/** The corner camera's corner radius (CSS px). */
export const FRAME_RADIUS = 16;
/** The dock's distance from the bottom edge, and its height (CSS px). */
export const DOCK_BOTTOM = 22;
export const DOCK_HEIGHT = 58;
/** The sign strip sits this far above the dock, and is this tall (CSS px). */
export const STRIP_GAP = 10;
export const STRIP_HEIGHT = 58;

/** Where the corner camera sits (CSS px): top right. */
export const frameRect = (width: number, height: number) => {
  // Portrait-ish on a phone, landscape-ish on a laptop, never extreme.
  const aspect = Math.min(1.33, Math.max(0.75, width / Math.max(1, height)));
  const h = Math.min(220, Math.max(110, height * 0.24));
  const w = Math.round(h * aspect);
  return {
    left: width - GUTTER - w,
    top: GUTTER,
    width: w,
    height: Math.round(h),
  };
};

/**
 * The screen's edges the view keeps clear (NDC, 1 = the edge): the top, and
 * under the corner camera right of its left edge (`frameLeft`); the dock and
 * the sign strip below.
 */
export const viewMargins = (width: number, height: number) => {
  const h = Math.max(1, height);
  const w = Math.max(1, width);
  const frame = frameRect(width, height);
  const bottomPx = DOCK_BOTTOM + DOCK_HEIGHT + STRIP_GAP + STRIP_HEIGHT + 12;
  return {
    side: 0.94,
    top: 1 - (2 * 24) / h,
    under: Math.max(0.2, 1 - (2 * (frame.top + frame.height + 12)) / h),
    frameLeft: (2 * (frame.left - 8)) / w - 1,
    bottom: Math.max(0.3, 1 - (2 * bottomPx) / h),
  };
};

/**
 * For drei's `<Html fullscreen>`: pin the page UI to the screen. By default
 * it follows the scene's origin, which moves on screen with the camera.
 */
export const pinToScreen = (
  _el: unknown,
  _camera: unknown,
  size: { width: number; height: number },
) => [size.width / 2, size.height / 2];
