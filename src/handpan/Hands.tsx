// Your two hands, read from the hand tracker every frame:
//   - your right hand (the note hand) shows a sign; once it holds, that field
//     is chosen (it glows blue and the strip lights its sign). A lost note
//     hand keeps its sign.
//   - your left hand (the strike hand) pats with an open palm: each pat plays
//     the chosen field, as loud as the pat was quick. A fist, or taking the
//     hand away, damps every ringing note.
// The tracker names hands as they are on your body (left is your left),
// whichever way the camera shows them.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import {
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";

import { SIGNS } from "./notes";
import { PatReader } from "./pat";
import { fingersUp, SignReader, type Joint } from "./signs";
import { choose, damp, handpan, strike, type Side } from "./state";

/** Which of your hands does what (swap these to play the other way round). */
export const HAND: { strike: Side; note: Side } = {
  strike: "left",
  note: "right",
};

/** What the ghost hand and the corner camera read about your hands. */
export const hands = {
  /** The strike hand is in view, and how far above its usual height its palm is (palm lengths). */
  strikeTracked: false,
  strikeLift: 0,
  /** The note hand is in view. */
  noteTracked: false,
};

type Pt = { x: number; y: number };
const PALM = [0, 5, 9, 13, 17];

export const Hands = () => {
  const node = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const st = useRef({
    signs: new SignReader(),
    pats: new PatReader(),
    noteStamp: -1,
    strikeStamp: -1,
    strikeUp: null as boolean[] | null,
    strikeSeen: performance.now() / 1000,
  });

  useFrame(() => {
    const s = st.current;
    const now = performance.now() / 1000;
    const on = handpan.started;
    const note = on ? (node?.poses?.[HAND.note] ?? null) : null;
    const hit = on ? (node?.poses?.[HAND.strike] ?? null) : null;

    // The note hand's sign.
    if (note && !note.held) {
      hands.noteTracked = true;
      if (note.timestampMs !== s.noteStamp) {
        s.noteStamp = note.timestampMs;
        const sign = s.signs.push(
          note.timestampMs / 1000,
          note.world as Joint[],
        );
        if (sign) choose(SIGNS.indexOf(sign) as 0);
      }
    } else {
      hands.noteTracked = false;
      s.signs.lost();
    }

    // The strike hand's pats and fist.
    if (hit && !hit.held) {
      hands.strikeTracked = true;
      s.strikeSeen = now;
      if (hit.timestampMs !== s.strikeStamp) {
        s.strikeStamp = hit.timestampMs;
        const img = hit.image as Pt[];
        const a = handpan.aspect;
        // On the picture, in screen heights (so up and across are the same size).
        const p = (i: number) => ({ x: img[i].x * 0.5 * a, y: img[i].y * 0.5 });
        let cx = 0;
        let cy = 0;
        PALM.forEach((i) => {
          const q = p(i);
          cx += q.x / PALM.length;
          cy += q.y / PALM.length;
        });
        const d = (i: number, k: number) => {
          const u = p(i);
          const v = p(k);
          return Math.hypot(u.x - v.x, u.y - v.y);
        };
        s.strikeUp = fingersUp(hit.world as Joint[], s.strikeUp);
        const fist = s.strikeUp.every((u) => !u);
        const events = s.pats.push({
          t: hit.timestampMs / 1000,
          x: cx,
          y: cy,
          size: Math.max(d(0, 9), d(5, 17) * 1.15),
          fist,
        });
        events.forEach((e) => {
          if (e.kind === "damp") damp();
          else strike(handpan.chosen ?? 0, e.velocity, "strike");
        });
        hands.strikeLift = s.pats.lift;
      }
    } else {
      hands.strikeTracked = false;
      s.strikeUp = null;
      s.pats
        .missing(now, now - s.strikeSeen)
        .forEach((e) => e.kind === "damp" && damp());
    }
  });

  return null;
};
