// Gold sparkles that rise off a field when a song's note is played right
// (more and higher for a perfect one), and across every field at a song's
// end. Soft glowing points that drift up and out and fade (strict ease-out).
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

import { pan } from "./Handpan";
import { handpan } from "./state";

/** Bursts in flight at most, points per burst. */
const BURSTS = 16;
const PER = 18;
/** A burst lasts this long (s); its points rise and spread this far (m). */
const LIFE = 0.9;
const RISE = { small: 0.05, big: 0.1 };
const SPREAD = { small: 0.05, big: 0.08 };
const GOLD = new Color("#ffd36b");

const glow = () => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
};

type Burst = {
  at: number;
  big: boolean;
  centre: Vector3;
  normal: Vector3;
  dirs: Vector3[];
  speed: number[];
};

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export const Sparkles = () => {
  const made = useMemo(() => {
    const n = BURSTS * PER;
    const geo = new BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("color", new BufferAttribute(col, 3));
    const pts = new Points(
      geo,
      new PointsMaterial({
        size: 0.016,
        map: glow(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    );
    pts.frustumCulled = false;
    pts.renderOrder = 6;
    const bursts: (Burst | null)[] = Array.from({ length: BURSTS }, () => null);
    return { pts, pos, col, geo, bursts, next: 0, seen: 0 };
  }, []);

  // The points ride on the handpan (they move with it between views).
  useEffect(() => {
    pan.holder.add(made.pts);
    return () => {
      pan.holder.remove(made.pts);
    };
  }, [made]);

  useFrame(() => {
    const now = performance.now() / 1000;
    // New sparkles become bursts.
    while (made.seen < handpan.sparkles.length) {
      const sp = handpan.sparkles[made.seen];
      made.seen += 1;
      const c = pan.centers.get(sp.field);
      if (c) {
        const normal = new Vector3(0, 1, 0).applyQuaternion(c.quaternion);
        const side = new Vector3(1, 0, 0).applyQuaternion(c.quaternion);
        const fwd = new Vector3().crossVectors(side, normal);
        made.bursts[made.next % BURSTS] = {
          at: sp.at,
          big: sp.big,
          centre: c.position.clone(),
          normal,
          dirs: Array.from({ length: PER }, () => {
            const a = Math.random() * Math.PI * 2;
            return side
              .clone()
              .multiplyScalar(Math.cos(a))
              .addScaledVector(fwd, Math.sin(a));
          }),
          speed: Array.from({ length: PER }, () => 0.5 + Math.random() * 0.5),
        };
        made.next += 1;
      }
    }
    // The list is drained once read (it only ever holds what is new).
    if (made.seen > 0 && made.seen === handpan.sparkles.length) {
      handpan.sparkles.length = 0;
      made.seen = 0;
    }
    made.bursts.forEach((b, i) => {
      for (let j = 0; j < PER; j += 1) {
        const k = (i * PER + j) * 3;
        const t = b ? (now - b.at) / LIFE : 2;
        if (!b || t < 0 || t >= 1) {
          made.col[k] = 0;
          made.col[k + 1] = 0;
          made.col[k + 2] = 0;
        } else {
          const e = ease(t);
          const sp = b.speed[j];
          const r = (b.big ? SPREAD.big : SPREAD.small) * sp * e;
          const h = 0.006 + (b.big ? RISE.big : RISE.small) * sp * e;
          const d = b.dirs[j];
          made.pos[k] = b.centre.x + d.x * r + b.normal.x * h;
          made.pos[k + 1] = b.centre.y + d.y * r + b.normal.y * h;
          made.pos[k + 2] = b.centre.z + d.z * r + b.normal.z * h;
          const fade = (1 - t) * (b.big ? 1 : 0.75);
          made.col[k] = GOLD.r * fade;
          made.col[k + 1] = GOLD.g * fade;
          made.col[k + 2] = GOLD.b * fade;
        }
      }
    });
    (made.geo.attributes.position as BufferAttribute).needsUpdate = true;
    (made.geo.attributes.color as BufferAttribute).needsUpdate = true;
  });

  return null;
};
