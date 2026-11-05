// Development only: window.__handpan, a look inside for testing without a
// camera — the state, the strikes, the sound meter, and controls:
//
//   __handpan.strike(3, 0.8)     strike field 3 (0 the Ding … 8)
//   __handpan.choose(5)          the note hand chooses field 5
//   __handpan.damp()             every note stops
//   __handpan.view("player"), __handpan.night(true)
//   __handpan.look([x, y, z], [tx, ty, tz], fov)   a fixed camera (null: back)
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { meter, sound } from "./audio";
import { cameraOverride } from "./CameraRig";
import type { View } from "./layout";
import type { FieldId } from "./notes";
import { choose, damp, handpan, setNight, setView, strike } from "./state";

const DevDebug = () => {
  const camera = useThree((st) => st.camera);
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const api = {
      handpan,
      camera,
      scene,
      meter,
      sound,
      /** The output's level and low end right now (what moves the speakers). */
      levels: () => ({ ...sound.levels(0) }),
      strike(field: FieldId, velocity = 0.8) {
        sound.unlock();
        strike(field, velocity, "pointer");
      },
      choose: (field: FieldId | null) => choose(field),
      damp: () => damp(),
      view: (v: View) => setView(v),
      night: (on: boolean) => setNight(on),
      look(pos: number[] | null, target: number[] = [0, 0.6, 0], fov = 40) {
        cameraOverride.pose = pos
          ? { pos: new Vector3(...pos), target: new Vector3(...target), fov }
          : null;
      },
    };
    (window as unknown as { __handpan?: typeof api }).__handpan = api;
    return () => {
      delete (window as unknown as { __handpan?: typeof api }).__handpan;
    };
  }, [camera, scene]);
  return null;
};

export default DevDebug;
