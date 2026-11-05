// The ghost strike hand (gold, your left): it hovers palm-down over the
// chosen field (a little higher as you lift your palm) and pats it when it is
// struck: it drops flat onto the steel and lifts back. It moves with the
// handpan when the view changes. (Your note hand shows as the chosen field's
// blue glow and on the sign strip.)
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Matrix4, Quaternion, Vector3, type Object3D } from "three";

import { ease } from "./CameraRig";
import { dressGhost, ghostMaterial } from "./ghost";
import { pan } from "./Handpan";
import { hands } from "./Hands";
import { MODELS, useOptionalModel } from "./models";
import type { FieldId } from "./notes";
import { handpan, strikesSince } from "./state";

export const GHOST_COLOR = { strike: "#F2B21C", note: "#2F8CFF" };

/** The strike hand's palm above the steel (m): hovering, and patting. */
const PALM_HEIGHT = { hover: 0.04, pat: 0.006 };
/** Your palm's lift (palm lengths, up to `most`) raises the ghost this much per palm length (m), eased over `ease` (s). */
const LIFT = { most: 1.5, metres: 0.03, ease: 0.08 };
/** A pat: down, held flat, then back up (s). */
const PAT = { down: 0.04, hold: 0.1, up: 0.3 };
/** The strike hand moves to a new field at this rate (1/s). */
const FOLLOW = 12;
/** The strike hand reaches from where you stand (pan's own frame, m). */
const REACH_FROM = new Vector3(0, 0, -0.5);

const m4 = new Matrix4();
const vx = new Vector3();
/** A hand's turn from its fingers' and its back's directions. */
const handQuat = (fingers: Vector3, back: Vector3, out: Quaternion) => {
  vx.crossVectors(fingers, back);
  m4.makeBasis(vx, fingers, back);
  return out.setFromRotationMatrix(m4);
};

const nodes = (root: Object3D, names: string[]) =>
  Object.fromEntries(names.map((n) => [n, root.getObjectByName(n) ?? null]));

export const GhostHands = () => {
  const strikeSrc = useOptionalModel(MODELS.ghostStrike);

  const strike = useMemo(() => {
    const holder = new Group();
    if (!strikeSrc) return null;
    const root = strikeSrc.clone(true);
    dressGhost(root, ghostMaterial(GHOST_COLOR.strike));
    holder.add(root);
    const n = nodes(root, ["Hover", "Pat", "Palm_Center"]);
    const palm = n.Palm_Center?.position.clone() ?? new Vector3(0, 0.05, 0);
    return { holder, hover: n.Hover, pat: n.Pat, palm };
  }, [strikeSrc]);

  const st = useRef({
    field: 3 as FieldId,
    seq: handpan.seq,
    patAt: -1e9,
    pos: new Vector3(),
    quat: new Quaternion(),
    started: false,
    lift: 0,
  });
  const tmp = useMemo(
    () => ({
      n: new Vector3(),
      f: new Vector3(),
      q: new Quaternion(),
      p: new Vector3(),
      off: new Vector3(),
    }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now() / 1000;
    const s = st.current;

    // The strike hand follows the field last struck, and pats it.
    strikesSince(s.seq).forEach((e) => {
      s.seq = e.seq;
      s.field = e.field;
      s.patAt = e.at;
    });
    // Between strikes it waits over the chosen field.
    if (handpan.chosen !== null && now - s.patAt > PAT.down + PAT.hold)
      s.field = handpan.chosen;
    if (strike) {
      const c = pan.centers.get(s.field);
      if (c) {
        const { n, f, q, p, off } = tmp;
        n.set(0, 1, 0).applyQuaternion(c.quaternion);
        // Fingers point away from you, across the steel.
        f.copy(c.position).sub(REACH_FROM);
        f.addScaledVector(n, -f.dot(n)).normalize();
        handQuat(f, n, q);
        const t = now - s.patAt;
        let lift = 1;
        if (t >= 0 && t < PAT.down) lift = 1 - t / PAT.down;
        else if (t >= PAT.down && t < PAT.down + PAT.hold) lift = 0;
        else if (t >= PAT.down + PAT.hold)
          lift = ease((t - PAT.down - PAT.hold) / PAT.up);
        // Your palm lifted above its usual height lifts the ghost a little.
        s.lift +=
          (Math.min(LIFT.most, hands.strikeLift) - s.lift) *
          (1 - Math.exp(-dt / LIFT.ease));
        const hover = PALM_HEIGHT.hover + LIFT.metres * s.lift;
        const h = PALM_HEIGHT.pat + (hover - PALM_HEIGHT.pat) * lift;
        p.copy(c.position).addScaledVector(n, h);
        // The palm's centre lands on that point.
        off.copy(strike.palm).applyQuaternion(q);
        p.sub(off);
        const k = s.started ? 1 - Math.exp(-FOLLOW * dt) : 1;
        s.pos.lerp(p, k);
        s.quat.slerp(q, k);
        strike.holder.position.copy(s.pos);
        strike.holder.quaternion.copy(s.quat);
        const flat = lift < 0.5;
        if (strike.hover) strike.hover.visible = !flat;
        if (strike.pat) strike.pat.visible = flat;
        s.started = true;
      }
    }
  });

  // The strike hand rides on the handpan (it moves with it between views).
  useEffect(() => {
    if (!strike) return undefined;
    pan.holder.add(strike.holder);
    return () => {
      pan.holder.remove(strike.holder);
    };
  }, [strike]);

  return null;
};
