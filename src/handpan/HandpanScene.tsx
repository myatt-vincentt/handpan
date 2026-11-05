// Handpan: a steel handpan in a recording studio, played with your two
// hands. Your right hand shows a sign to choose a note (a fist for the Ding,
// one to four fingers, an open hand, the rock sign); your left hand pats to
// play it. A gold ghost hand pats the steel with you; the chosen field glows
// blue. Taps,
// clicks and the number keys play too. Your camera sits small in the corner.
//
//   CameraRig.tsx     the views (front, player), fitted to the screen (layout.ts)
//   Studio.tsx        the room and its light, day and night; the LEDs (led.ts)
//   Handpan.tsx       the handpan: its fields' glow and ripples, its stands
//   Hands.tsx         your hands: the note hand's signs (signs.ts), the strike
//                     hand's pats (pat.ts)
//   GhostHands.tsx    the ghost strike hand (ghost.ts)
//   PointerInput.tsx  taps, clicks and keys
//   CameraFrame.tsx   your camera in the corner
//   Hud.tsx           the bottom dock, the sign strip (SignStrip.tsx), how to play
//   audio.ts          the handpan's sound, made in code
//   notes.ts          the nine fields and their notes
//   Home.tsx          the home page (Start), shown over the scene while it loads
import { Suspense, useEffect } from "react";
import { HandTracker } from "@vincentt-xr/sdk/tracking";

import { CameraFrame } from "./CameraFrame";
import { CameraRig } from "./CameraRig";
import { GhostHands } from "./GhostHands";
import { Handpan } from "./Handpan";
import { Hands } from "./Hands";
import { Hud } from "./Hud";
import { PointerInput } from "./PointerInput";
import { handpan, useHandpanVersion } from "./state";
import { Studio } from "./Studio";

/** Hand readings per second. */
const HAND_FPS = 30;

/** Mounts once everything above it has loaded (the home page waits for it). */
const Loaded = () => {
  useEffect(() => {
    handpan.loaded = true;
    handpan.changed();
  }, []);
  return null;
};

export const HandpanScene = () => {
  useHandpanVersion();
  return (
    <>
      <CameraRig />
      <Suspense fallback={null}>
        <Studio />
        <Handpan />
        <GhostHands />
        <Loaded />
      </Suspense>
      {handpan.started ? <HandTracker targetFps={HAND_FPS} /> : null}
      <Hands />
      <CameraFrame />
      <PointerInput />
      <Hud />
    </>
  );
};
