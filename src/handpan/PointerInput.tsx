// Playing with a mouse, fingers or the computer keyboard, no hands needed:
//   - tap or click a field; it rings. Each finger on a touch screen plays
//     its own field. With a mouse the field under it glows softly.
//   - the number keys: 1–6 the fields, 0 or the space bar the Ding, 7 and 8
//     the two small extra fields
// Works in both views.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster, Vector2, type Object3D } from "three";

import { sound } from "./audio";
import { fieldOfNames, keyField, type FieldId } from "./notes";
import { handpan, strike } from "./state";

/** Loudness of a tap or a computer key (a little different each time). */
const TAP_VELOCITY = 0.75;
const tapVelocity = () => TAP_VELOCITY + (Math.random() - 0.5) * 0.08;

/** Is this event on a control (the dock, a card, the camera, the media switcher…)? */
const onControl = (e: Event) => {
  const el = e.target as HTMLElement | null;
  return !!el?.closest?.(
    "[data-hud], button, select, input, textarea, a, [role='button']",
  );
};

/** A model part's name and its parents' names, nearest first. */
function* namesUp(o: Object3D | null) {
  let n: Object3D | null = o;
  while (n) {
    yield n.name;
    n = n.parent;
  }
}

export const PointerInput = () => {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const ray = new Raycaster();
    const ndc = new Vector2();
    const canvas = gl.domElement;
    const touchWas = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const cursorWas = canvas.style.cursor;

    const fieldUnder = (e: PointerEvent): FieldId | null => {
      if (!handpan.root) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(handpan.root, true);
      // The first visible surface hit decides (the shell hides what is behind it).
      const hit = hits.find((h) => h.object.visible);
      return hit ? fieldOfNames(namesUp(hit.object)) : null;
    };

    const setHover = (f: FieldId | null) => {
      if (handpan.hover === f) return;
      handpan.hover = f;
      canvas.style.cursor = f === null ? cursorWas : "pointer";
    };

    const onDown = (e: PointerEvent) => {
      if (onControl(e)) return;
      sound.unlock();
      const f = fieldUnder(e);
      if (f === null) return;
      strike(f, tapVelocity(), "pointer");
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || onControl(e)) {
        setHover(null);
        return;
      }
      setHover(fieldUnder(e));
    };
    const onLeave = () => setHover(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || onControl(e))
        return;
      const f = keyField(e.code);
      if (f === null) return;
      e.preventDefault();
      sound.unlock();
      strike(f, tapVelocity(), "keys");
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      canvas.style.touchAction = touchWas;
      canvas.style.cursor = cursorWas;
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [camera, gl]);

  return null;
};
