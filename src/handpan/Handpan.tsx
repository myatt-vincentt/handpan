// The handpan: a hammered steel shell, the Ding dome in the middle and eight
// tone fields round it, on a low stand. Each field lights up on its own:
//   - blue, softly, under the mouse; blue and steady when the note hand has
//     chosen it
//   - gold when it is struck (as loud as the strike), with three thin gold
//     rings rippling out over the steel
// Each view has its own placement: level in front of you in Player, turned
// round and tilted towards you in Front (each with its own stand). Switching
// views turns and tilts it along with the camera (strict ease-out).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type MeshStandardMaterial,
  type Object3D,
} from "three";

import { ease, GLIDE } from "./CameraRig";
import { PLACE, type View } from "./layout";
import { dressModel } from "./look";
import { MODELS, useOptionalModel } from "./models";
import { FIELD_IDS, FIELD_NODE, FIELD_OVAL, type FieldId } from "./notes";
import { handpan, strikesSince } from "./state";

/** The note hand's blue and the strike hand's gold (linear light, as glows). */
export const BLUE = new Color("#2F8CFF");
export const GOLD = new Color("#F2B21C");
/** The gold as a glow: a little deeper, so the tone curve keeps it gold, not white. */
const GOLD_GLOW = new Color(0.9, 0.36, 0.0);

/** How bright a field glows: under the mouse, chosen, and struck at full loudness. */
const GLOW = { hover: 0.3, chosen: 0.75, struck: 1.3 };
/** A strike's gold flash fades over this long (s). */
const FLASH = 0.9;
/** The ripples: three rings, each this much wider than the field, over this long (s). */
const RIPPLE = {
  sizes: [1.08, 1.25, 1.42],
  grow: 0.16,
  life: 1.1,
  stagger: 0.07,
};
/** Ripple rings in flight at most. */
const MAX_RIPPLES = 8;

/** The handpan's moving placement and its fields' centres (for the hands). */
export const pan = {
  /** Moves between the views' placements; the model hangs under it. */
  holder: new Group(),
  /** Each field's centre point (on its dome, +y out of the steel). */
  centers: new Map<FieldId, Object3D>(),
  /** 0 Player … 1 Front, eased. */
  front: handpan.view === "front" ? 1 : 0,
};

const ellipseRing = (a: number, b: number, width: number) => {
  const n = 96;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j < n; j += 1) {
    const t = (j / n) * Math.PI * 2;
    [-width, width].forEach((dw) => {
      pos.push((a + dw) * Math.cos(t), 0, (b + dw) * Math.sin(t));
    });
    const j1 = (j + 1) % n;
    idx.push(2 * j, 2 * j1, 2 * j1 + 1, 2 * j, 2 * j1 + 1, 2 * j + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
};

type Ripple = {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  at: number;
  v: number;
  size: number;
};

/** A field's material: its own glow, softened towards its edge by the model's glow mask. */
/* eslint-disable no-param-reassign */
const glowingField = (m: MeshStandardMaterial) => {
  m.emissive.setRGB(0, 0, 0);
  m.emissiveIntensity = 1;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float _glow;\nvarying float vGlow;\n${shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vGlow = _glow;",
    )}`;
    shader.fragmentShader = `varying float vGlow;\n${shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= smoothstep(0.0, 1.0, vGlow);",
    )}`;
  };
  m.customProgramCacheKey = () => "handpan-field";
};
/* eslint-enable no-param-reassign */

const tilt = new Quaternion();
const turn = new Quaternion();
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const TILT = { player: 0, front: (24 * Math.PI) / 180 };

/** The placement `k` of the way from Player (0) to Front (1). */
const placeAt = (k: number, holder: Object3D) => {
  holder.position.lerpVectors(PLACE.player.pos, PLACE.front.pos, k);
  // Tilt and turn separately, so the half turn always goes the same way round.
  tilt.setFromAxisAngle(X, TILT.player + (TILT.front - TILT.player) * k);
  turn.setFromAxisAngle(Y, Math.PI * k);
  holder.quaternion.copy(tilt).multiply(turn);
};

export const Handpan = () => {
  const model = useOptionalModel(MODELS.handpan);
  const { root, fields, stands } = useMemo(() => {
    if (!model) return { root: null, fields: new Map(), stands: null };
    const r = model.clone(true);
    dressModel(r);
    const f = new Map<FieldId, MeshStandardMaterial>();
    FIELD_IDS.forEach((id) => {
      const mesh = r.getObjectByName(FIELD_NODE[id]) as Mesh | undefined;
      if (!mesh) return;
      const m = (mesh.material as MeshStandardMaterial).clone();
      glowingField(m);
      mesh.material = m;
      f.set(id, m);
      const c = r.getObjectByName(`${FIELD_NODE[id]}_Center`);
      if (c) pan.centers.set(id, c);
    });
    const s = {
      player: r.getObjectByName("Handpan_Stand") ?? null,
      front: r.getObjectByName("Handpan_Stand_Front") ?? null,
    };
    return { root: r, fields: f, stands: s };
  }, [model]);

  // The ripple rings: a few kept ready, each laid on its field when struck.
  const ripples = useMemo(() => {
    const list: Ripple[] = [];
    for (let i = 0; i < MAX_RIPPLES; i += 1) {
      const mat = new MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new Mesh(ellipseRing(1, 1, 0.02), mat);
      mesh.visible = false;
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      list.push({ mesh, mat, at: -1e9, v: 0, size: 1 });
    }
    return list;
  }, []);
  const ringGeo = useMemo(
    () =>
      new Map(
        FIELD_IDS.map((id) => [
          id,
          ellipseRing(FIELD_OVAL[id][0], FIELD_OVAL[id][1], 0.0011),
        ]),
      ),
    [],
  );

  useEffect(() => {
    handpan.root = root;
    return () => {
      handpan.root = null;
    };
  }, [root]);

  const sw = useRef({ view: handpan.view as View, at: -10, from: pan.front });
  const seq = useRef(handpan.seq);
  const next = useRef(0);
  const tmp = useMemo(() => new Color(), []);
  const tmp2 = useMemo(() => new Color(), []);
  const radial = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const now = performance.now() / 1000;
    // The placement follows the view (with the camera's glide).
    const s = sw.current;
    if (s.view !== handpan.view) {
      s.from = pan.front;
      s.view = handpan.view;
      s.at = now;
    }
    const to = handpan.view === "front" ? 1 : 0;
    pan.front = s.from + (to - s.from) * ease((now - s.at) / GLIDE);
    placeAt(pan.front, pan.holder);
    if (stands?.player) stands.player.visible = pan.front < 0.5;
    if (stands?.front) stands.front.visible = pan.front >= 0.5;

    // The fields' glow: blue under the mouse or chosen, gold when struck.
    fields.forEach((m, id) => {
      let blue = 0;
      if (handpan.chosen === id) blue = GLOW.chosen;
      else if (handpan.hover === id) blue = GLOW.hover;
      const e = (now - handpan.struckAt[id]) / FLASH;
      // The flash fades gently (it is a glow, not a motion), and the gold
      // takes the blue's place while it lasts.
      const f = e >= 0 && e < 1 ? (1 - e) ** 2 : 0;
      const gold = GLOW.struck * handpan.struckV[id] * f;
      tmp.copy(BLUE).multiplyScalar(blue * (1 - Math.min(1, 2 * f)));
      m.emissive.copy(tmp).add(tmp2.copy(GOLD_GLOW).multiplyScalar(gold));
    });

    // New strikes send out ripples.
    strikesSince(seq.current).forEach((ev) => {
      seq.current = ev.seq;
      const c = pan.centers.get(ev.field);
      if (!c) return;
      // The rings' first axis points from the middle out through the field.
      radial.set(c.position.x, 0, c.position.z);
      const yaw =
        radial.lengthSq() > 1e-6 ? Math.atan2(-radial.z, radial.x) : 0;
      RIPPLE.sizes.forEach((size, i) => {
        const r = ripples[next.current % MAX_RIPPLES];
        next.current += 1;
        c.add(r.mesh);
        r.mesh.geometry = ringGeo.get(ev.field)!;
        // The centre point's frame is only tipped with the steel, so turning
        // about its up axis lines the ring's oval up with the field.
        r.mesh.rotation.set(0, yaw, 0);
        r.mesh.position.set(0, 0.0015, 0);
        r.at = now + i * RIPPLE.stagger;
        r.v = Math.max(0.35, ev.velocity);
        r.size = size;
      });
    });
    ripples.forEach((r) => {
      const t = (now - r.at) / RIPPLE.life;
      if (t < 0 || t >= 1) {
        // eslint-disable-next-line no-param-reassign
        r.mesh.visible = false;
        return;
      }
      // eslint-disable-next-line no-param-reassign
      r.mesh.visible = true;
      const k = ease(t);
      const sc = 1 + (r.size - 1 + RIPPLE.grow) * k;
      r.mesh.scale.set(sc, 1, sc);
      // eslint-disable-next-line no-param-reassign
      r.mat.opacity = r.v * (1 - k) * 0.9;
    });
  });

  return (
    <primitive object={pan.holder}>
      {root ? <primitive object={root} /> : null}
    </primitive>
  );
};
