// The two ghost hands:
//   - the strike hand (gold, your left) hovers palm-down over the field it
//     last played and pats it when it is struck: it drops flat onto the
//     steel and lifts back
//   - the note hand (blue, your right) waits beside the handpan showing the
//     sign of the chosen field: a fist for the Ding, one to four fingers,
//     an open hand, or the rock sign for field 6
// Both move with the handpan when the view changes.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Matrix4, Quaternion, Vector3, type Object3D } from "three";

import { ease } from "./CameraRig";
import { dressGhost, ghostMaterial } from "./ghost";
import { pan } from "./Handpan";
import { NOTE_HAND } from "./layout";
import { MODELS, useOptionalModel } from "./models";
import { SIGNS, type FieldId, type Sign } from "./notes";
import { handpan, strikesSince } from "./state";

export const GHOST_COLOR = { strike: "#F2B21C", note: "#2F8CFF" };

/** The strike hand's palm above the steel (m): hovering, and patting. */
const PALM_HEIGHT = { hover: 0.04, pat: 0.006 };
/** A pat: down, held flat, then back up (s). */
const PAT = { down: 0.04, hold: 0.1, up: 0.3 };
/** The strike hand moves to a new field at this rate (1/s). */
const FOLLOW = 12;
/** The strike hand reaches from where you stand (pan's own frame, m). */
const REACH_FROM = new Vector3(0, 0, -0.5);
/** The note hand leans this far forward in the Player view (rad). */
const NOTE_LEAN = (40 * Math.PI) / 180;

const m4 = new Matrix4();
const vx = new Vector3();
/** A hand's turn from its fingers' and its back's directions. */
const handQuat = (fingers: Vector3, back: Vector3, out: Quaternion) => {
  vx.crossVectors(fingers, back);
  m4.makeBasis(vx, fingers, back);
  return out.setFromRotationMatrix(m4);
};

/** The note hand in each view: upright, palm to you and mirrored like a selfie (Front); leaning forward (Player). */
const NOTE_POSE = {
  front: handQuat(
    new Vector3(0, 1, 0),
    new Vector3(0, 0, -1),
    new Quaternion(),
  ),
  player: handQuat(
    new Vector3(0, Math.cos(NOTE_LEAN), Math.sin(NOTE_LEAN)),
    new Vector3(0, Math.sin(NOTE_LEAN), -Math.cos(NOTE_LEAN)),
    new Quaternion(),
  ),
};

const nodes = (root: Object3D, names: string[]) =>
  Object.fromEntries(names.map((n) => [n, root.getObjectByName(n) ?? null]));

export const GhostHands = () => {
  const strikeSrc = useOptionalModel(MODELS.ghostStrike);
  const noteSrc = useOptionalModel(MODELS.ghostNote);

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

  const note = useMemo(() => {
    const holder = new Group();
    if (!noteSrc) return null;
    const root = noteSrc.clone(true);
    dressGhost(root, ghostMaterial(GHOST_COLOR.note));
    holder.add(root);
    const signs = nodes(
      root,
      SIGNS.map((s) => `Sign_${s}`),
    ) as Record<string, Object3D | null>;
    return { holder, signs };
  }, [noteSrc]);

  const st = useRef({
    field: 3 as FieldId,
    seq: handpan.seq,
    patAt: -1e9,
    sign: "fist" as Sign,
    pos: new Vector3(),
    quat: new Quaternion(),
    started: false,
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
        const h =
          PALM_HEIGHT.pat + (PALM_HEIGHT.hover - PALM_HEIGHT.pat) * lift;
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

    // The note hand shows the chosen field's sign.
    if (note) {
      const { chosen } = handpan;
      if (chosen !== null && chosen <= 6) s.sign = SIGNS[chosen];
      SIGNS.forEach((sg) => {
        const o = note.signs[`Sign_${sg}`];
        if (o) o.visible = sg === s.sign;
      });
      const k = pan.front;
      tmp.p
        .lerpVectors(NOTE_HAND.player, NOTE_HAND.front, k)
        .add(pan.holder.position);
      note.holder.position.copy(tmp.p);
      note.holder.quaternion.slerpQuaternions(
        NOTE_POSE.player,
        NOTE_POSE.front,
        k,
      );
      // Mirrored like a selfie in Front (it flips halfway through a switch).
      note.holder.scale.set(k >= 0.5 ? -1 : 1, 1, 1);
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

  return note ? <primitive object={note.holder} /> : null;
};
